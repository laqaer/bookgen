import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeAnsel, encodeAnsel } from '../../src/app/engine/ansel.js';

const bytes = (...parts) => Uint8Array.from(parts.flatMap(p => (typeof p === 'string' ? [...Buffer.from(p, 'latin1')] : [p])));

test('combining diacritics precede the base letter and compose to NFC', () => {
  // The read-gedcom proof case from the brief: "Se" + acute + "an /Dvo" + caron + "rak/".
  const s = decodeAnsel(bytes('Se', 0xE2, 'an /Dvo', 0xE9, 'rak/'));
  assert.equal(s, 'Seán /Dvořak/');
  assert.equal(s, s.normalize('NFC'));
  assert.equal(s.length, 13); // composed: á and ř are single code points
});

test('every combining mark in the table decodes onto the following letter', () => {
  const cases = [
    [0xE1, 'a', 'à'], [0xE2, 'e', 'é'], [0xE3, 'o', 'ô'], [0xE4, 'n', 'ñ'], [0xE5, 'a', 'ā'], [0xE6, 'g', 'ğ'],
    [0xE7, 'z', 'ż'], [0xE8, 'u', 'ü'], [0xE9, 'c', 'č'], [0xEA, 'a', 'å'], [0xEE, 'o', 'ő'], [0xF0, 'c', 'ç'],
    [0xF1, 'e', 'ę'], [0xF2, 'i', 'ị'], [0xF7, 's', 'ș'], [0xE0, 'a', 'ả'],
  ];
  for (const [b, base, expected] of cases) assert.equal(decodeAnsel(bytes(b, base)), expected, `0x${b.toString(16)}`);
});

test('stacked diacritics (Vietnamese) keep their order', () => {
  // ễ = e + circumflex + tilde; ANSEL writes both marks before the e.
  assert.equal(decodeAnsel(bytes('Nguy', 0xE3, 0xE4, 'en')), 'Nguyễn');
  assert.equal(decodeAnsel(bytes('Th', 0xF2, 'i')), 'Thị');
});

test('spacing graphic characters', () => {
  assert.equal(decodeAnsel(bytes(0xA1, 'ukasz')), 'Łukasz');
  assert.equal(decodeAnsel(bytes(0xA2, 'degard')), 'Ødegard');
  assert.equal(decodeAnsel(bytes(0xB2)), 'ø');
  assert.equal(decodeAnsel(bytes(0xA5, 0xB5, 0xA6, 0xB6)), 'ÆæŒœ');
  assert.equal(decodeAnsel(bytes(0xB1, 0xB3, 0xB4, 0xBA, 0xB8)), 'łđþðı');
  assert.equal(decodeAnsel(bytes(0xAC, 0xAD, 0xBC, 0xBD)), 'ƠƯơư');
  assert.equal(decodeAnsel(bytes(0xC3, 0xC0, 0xB9, 0xC5, 0xC6)), '©°£¿¡');
  assert.equal(decodeAnsel(bytes(0xCF)), 'ß'); // GEDCOM es-zet
  assert.equal(decodeAnsel(bytes(0xC7)), 'ß'); // MARC-21 es-zet
  assert.equal(decodeAnsel(bytes(0xBE, 0xBF)), '□■');
});

test('a diacritic with no letter becomes its spacing form', () => {
  assert.equal(decodeAnsel(bytes('a', 0xE2, ' b')), 'a´b');
  assert.equal(decodeAnsel(bytes('x', 0xE8, '\n')), 'x¨\n');
  assert.equal(decodeAnsel(bytes('end', 0xE3)), 'end^');
});

test('undefined bytes fall back to Windows-1252 and are counted', () => {
  const s = decodeAnsel(bytes('caf', 0x93, 'x', 0x94));
  assert.equal(s, 'caf“x”');
  assert.equal(decodeAnsel.lastUnknownBytes, 2);
});

test('encodeAnsel / decodeAnsel round trip for diacritic-heavy names', () => {
  for (const name of ['Seán Dvořák', 'Łucja Ødegård', 'Nguyễn Thị Hoa', 'François Müller-Gonçalves', 'Ångström', 'Øyvind Ærø']) {
    assert.equal(decodeAnsel(encodeAnsel(name)), name.normalize('NFC'));
  }
});

test('plain ASCII passes through unchanged', () => {
  const text = '0 HEAD\r\n1 CHAR ANSEL\r\n0 TRLR\r\n';
  assert.equal(decodeAnsel(Buffer.from(text, 'latin1')), text);
});
