import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeBytes, canonicalCharset, decodeSingleByte } from '../../src/app/engine/decode.js';
import { fixtureBytes } from './helpers.mjs';

const WESTERN = ['Seán /Ó Briain/', 'Björn /Åström/', 'José /Muñoz/', 'François /Müller/'];
const UNICODE = ['Seán /Dvořák/', 'Κωνσταντίνος /Παπαδόπουλος/', '/Nguyễn/ Thị Hoa', 'Иван /Петров/'];
const namesIn = text => [...text.matchAll(/^1 NAME (.*)$/gm)].map(m => m[1].trim());

test('UTF-8 with BOM', () => {
  const u8 = new Uint8Array([0xEF, 0xBB, 0xBF, ...new TextEncoder().encode('0 HEAD\n1 NAME Zoë\n')]);
  const r = decodeBytes(u8);
  assert.equal(r.charset, 'UTF-8');
  assert.equal(r.text, '0 HEAD\n1 NAME Zoë\n');
});

test('UTF-16LE and UTF-16BE with BOM', () => {
  for (const [file, cs] of [['utf16le-bom.ged', 'UTF-16LE'], ['utf16be-bom.ged', 'UTF-16BE']]) {
    const r = decodeBytes(fixtureBytes(file));
    assert.equal(r.charset, cs);
    assert.deepEqual(namesIn(r.text), UNICODE);
    assert.ok(r.text.startsWith('0 HEAD'));
  }
});

test('UTF-16 without a BOM is detected from the zero-byte pattern', () => {
  const text = '0 HEAD\r\n1 CHAR UNICODE\r\n0 @I1@ INDI\r\n1 NAME Zoë /Łęcka/\r\n0 TRLR\r\n';
  const le = new Uint8Array(text.length * 2);
  const be = new Uint8Array(text.length * 2);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    le[2 * i] = c & 255; le[2 * i + 1] = c >> 8;
    be[2 * i] = c >> 8; be[2 * i + 1] = c & 255;
  }
  assert.equal(decodeBytes(le).charset, 'UTF-16LE');
  assert.equal(decodeBytes(le).text, text);
  assert.equal(decodeBytes(be).charset, 'UTF-16BE');
  assert.equal(decodeBytes(be).text, text);
});

test('1 CHAR ANSEL decodes the ANSEL table', () => {
  const r = decodeBytes(fixtureBytes('ansel.ged'));
  assert.equal(r.charset, 'ANSEL');
  assert.deepEqual(namesIn(r.text), ['Seán /Dvořák/', 'Łucja /Ødegård/', '/Nguyễn/ Thị Hoa', 'François /Müller-Gonçalves/']);
});

test('ANSI (CP1252), IBMPC (CP850) and MACINTOSH (MacRoman)', () => {
  for (const [file, cs] of [['cp1252-ansi.ged', 'CP1252'], ['cp850-ibmpc.ged', 'CP850'], ['macroman.ged', 'MACROMAN']]) {
    const r = decodeBytes(fixtureBytes(file));
    assert.equal(r.charset, cs, file);
    assert.deepEqual(namesIn(r.text), WESTERN, file);
  }
});

test('a file that says ANSEL but holds UTF-8 is read as UTF-8, with a warning', () => {
  const r = decodeBytes(fixtureBytes('utf8-declared-ansel.ged'));
  assert.equal(r.charset, 'UTF-8');
  assert.deepEqual(namesIn(r.text), UNICODE);
  assert.match(r.warnings[0], /says ANSEL but contains UTF-8/);
});

test('no CHAR line (GEDCOM 7) means UTF-8', () => {
  const r = decodeBytes(fixtureBytes('gedcom7.ged'));
  assert.equal(r.charset, 'UTF-8');
  assert.ok(r.text.includes('Élodie /Martin/'));
});

test('declared UTF-8 with Windows-1252 bytes falls back to CP1252', () => {
  const u8 = Uint8Array.from([...Buffer.from('0 HEAD\n1 CHAR UTF-8\n0 @I1@ INDI\n1 NAME Jos', 'latin1'), 0xE9, ...Buffer.from(' /Mu', 'latin1'), 0xF1, ...Buffer.from('oz/\n', 'latin1')]);
  const r = decodeBytes(u8);
  assert.equal(r.charset, 'CP1252');
  assert.ok(r.text.includes('José /Muñoz/'));
  assert.equal(r.warnings.length, 1);
});

test('declared ASCII with accented bytes', () => {
  const u8 = Uint8Array.from([...Buffer.from('0 HEAD\n1 CHAR ASCII\n1 NAME M', 'latin1'), 0xFC, ...Buffer.from('ller\n', 'latin1')]);
  const r = decodeBytes(u8);
  assert.equal(r.charset, 'CP1252');
  assert.ok(r.text.includes('Müller'));
});

test('output is NFC-normalised (decomposed input is composed)', () => {
  const decomposed = '0 HEAD\n1 CHAR UTF-8\n1 NAME Sea\u0301n /Dvor\u030Ca\u0301k/\n';
  const r = decodeBytes(new TextEncoder().encode(decomposed));
  assert.ok(r.text.includes('Seán /Dvořák/'));
  assert.equal(r.text, r.text.normalize('NFC'));
});

test('accepts an ArrayBuffer', () => {
  const ab = new TextEncoder().encode('0 HEAD\n1 NAME Åsa\n').buffer;
  assert.equal(decodeBytes(ab).text, '0 HEAD\n1 NAME Åsa\n');
});

test('canonicalCharset maps the values seen in the wild', () => {
  const cases = {
    'UTF-8': 'UTF-8', utf8: 'UTF-8', UNICODE: 'UNICODE', ANSEL: 'ANSEL', ANSI: 'CP1252', 'windows-1252': 'CP1252',
    'ISO-8859-1': 'CP1252', 'IBM WINDOWS': 'CP1252', IBMPC: 'CP850', 'IBM-PC': 'CP850', MACINTOSH: 'MACROMAN', ASCII: 'ASCII', KLINGON: null,
  };
  for (const [k, v] of Object.entries(cases)) assert.equal(canonicalCharset(k), v, k);
});

test('single-byte tables cover all 256 bytes', () => {
  const all = Uint8Array.from({ length: 256 }, (_, i) => i);
  for (const cs of ['CP1252', 'CP850', 'MACROMAN']) assert.equal(decodeSingleByte(all, cs).length, 256);
  assert.equal(decodeSingleByte(Uint8Array.from([0x80, 0x8E, 0xE9]), 'CP1252'), '€Žé');
  assert.equal(decodeSingleByte(Uint8Array.from([0x80, 0x81, 0x9B]), 'CP850'), 'Çüø');
  assert.equal(decodeSingleByte(Uint8Array.from([0x80, 0x8A, 0xAF]), 'MACROMAN'), 'ÄäØ');
});
