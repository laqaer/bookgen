#!/usr/bin/env node
// Regenerates the binary / re-encoded fixtures in this folder from UTF-8 sources defined here.
//   node web/test/fixtures/make-fixtures.mjs
// Outputs: ansel.ged, utf16le-bom.ged, utf16be-bom.ged, cp1252-ansi.ged, cp850-ibmpc.ged,
// macroman.ged, utf8-declared-ansel.ged, gedcom7.gdz, zipped-export.zip.
// All people are fictional.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodeAnsel } from '../../src/app/engine/ansel.js';
import { decodeSingleByte } from '../../src/app/engine/decode.js';
import { zipSync, strToU8 } from '../../src/vendor/fflate.module.js';

const DIR = dirname(fileURLToPath(import.meta.url));

/** The small family used for every charset variant. `@CHAR@` is replaced per file. */
export function charsetSource(charDecl, names) {
  const [a, b, c, d] = names;
  return [
    '0 HEAD',
    '1 SOUR GILDROOT_FIXTURES',
    '1 GEDC',
    '2 VERS 5.5.1',
    '2 FORM LINEAGE-LINKED',
    ...(charDecl ? [`1 CHAR ${charDecl}`] : []),
    '1 NOTE Fictional charset fixture.',
    '0 @I1@ INDI',
    `1 NAME ${a}`,
    '1 SEX M',
    '1 BIRT',
    '2 DATE 3 MAR 1901',
    '2 PLAC Castlebar, County Mayo, Ireland',
    '1 FAMS @F1@',
    '0 @I2@ INDI',
    `1 NAME ${b}`,
    '1 SEX F',
    '1 BIRT',
    '2 DATE ABT 1904',
    '1 FAMS @F1@',
    '0 @I3@ INDI',
    `1 NAME ${c}`,
    '1 SEX F',
    '1 FAMC @F1@',
    '0 @I4@ INDI',
    `1 NAME ${d}`,
    '1 SEX M',
    '1 FAMC @F1@',
    '0 @F1@ FAM',
    '1 HUSB @I1@',
    '1 WIFE @I2@',
    '1 CHIL @I3@',
    '1 CHIL @I4@',
    '0 TRLR',
    '',
  ].join('\r\n');
}

/** Names per charset (must be representable in that charset). */
export const ANSEL_NAMES = ['Seán /Dvořák/', 'Łucja /Ødegård/', '/Nguyễn/ Thị Hoa', 'François /Müller-Gonçalves/'];
export const WESTERN_NAMES = ['Seán /Ó Briain/', 'Björn /Åström/', 'José /Muñoz/', 'François /Müller/'];
export const UNICODE_NAMES = ['Seán /Dvořák/', 'Κωνσταντίνος /Παπαδόπουλος/', '/Nguyễn/ Thị Hoa', 'Иван /Петров/'];

function reverseTable(name) {
  const all = decodeSingleByte(Uint8Array.from({ length: 256 }, (_, i) => i), name);
  const map = new Map();
  Array.from(all).forEach((ch, i) => { if (!map.has(ch)) map.set(ch, i); });
  return map;
}

function encodeSingle(str, name) {
  const rev = reverseTable(name);
  return Uint8Array.from(Array.from(str.normalize('NFC')).map(ch => {
    if (!rev.has(ch)) throw new Error(`${name} cannot encode ${ch}`);
    return rev.get(ch);
  }));
}

function utf16(str, le) {
  const out = new Uint8Array(2 + str.length * 2);
  out[0] = le ? 0xFF : 0xFE; out[1] = le ? 0xFE : 0xFF;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    out[2 + 2 * i] = le ? c & 0xFF : c >> 8;
    out[3 + 2 * i] = le ? c >> 8 : c & 0xFF;
  }
  return out;
}

function main() {
  const w = (name, bytes) => { writeFileSync(join(DIR, name), bytes); console.log('wrote', name, bytes.length, 'bytes'); };
  w('ansel.ged', encodeAnsel(charsetSource('ANSEL', ANSEL_NAMES)));
  w('utf16le-bom.ged', utf16(charsetSource('UNICODE', UNICODE_NAMES), true));
  w('utf16be-bom.ged', utf16(charsetSource('UNICODE', UNICODE_NAMES), false));
  w('cp1252-ansi.ged', encodeSingle(charsetSource('ANSI', WESTERN_NAMES), 'CP1252'));
  w('cp850-ibmpc.ged', encodeSingle(charsetSource('IBMPC', WESTERN_NAMES), 'CP850'));
  w('macroman.ged', encodeSingle(charsetSource('MACINTOSH', WESTERN_NAMES), 'MACROMAN'));
  w('utf8-declared-ansel.ged', new TextEncoder().encode(charsetSource('ANSEL', UNICODE_NAMES)));
  const g7 = readFileSync(join(DIR, 'gedcom7.ged'));
  w('gedcom7.gdz', zipSync({ 'gedcom.ged': new Uint8Array(g7), 'media/portrait.txt': strToU8('placeholder for a media file') }, { level: 6, mtime: new Date('2026-09-25T00:00:00Z') }));
  const anc = readFileSync(join(DIR, 'ancestry-style.ged'));
  w('zipped-export.zip', zipSync({
    '__MACOSX/Kowalczyk Family/._tree.ged': strToU8('resource fork junk'),
    'Kowalczyk Family/readme.txt': strToU8('Exported tree'),
    'Kowalczyk Family/tree.ged': new Uint8Array(anc),
  }, { level: 6, mtime: new Date('2026-09-25T00:00:00Z') }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
