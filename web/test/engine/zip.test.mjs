import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGedcom, isZip, isGzip, listArchive } from '../../src/app/engine/zip.js';
import { parseGedcom } from '../../src/app/engine/gedcom.js';
import { zipSync, gzipSync, strToU8 } from '../../src/vendor/fflate.module.js';
import { fixtureBytes } from './helpers.mjs';

test('.gdz (GEDZIP 7): gedcom.ged at the root', () => {
  const u8 = fixtureBytes('gedcom7.gdz');
  assert.ok(isZip(u8));
  assert.deepEqual(listArchive(u8).map(e => e.name).sort(), ['gedcom.ged', 'media/portrait.txt']);
  const ged = extractGedcom(u8);
  assert.deepEqual(ged, fixtureBytes('gedcom7.ged'));
  assert.equal(parseGedcom(ged).meta.version, '7.0');
});

test('.zip export: finds the .ged in a folder and skips __MACOSX junk', () => {
  const ged = extractGedcom(fixtureBytes('zipped-export.zip'));
  const t = parseGedcom(ged);
  assert.equal(t.meta.source, 'Ancestry.com Member Trees');
  assert.equal(t.meta.count, 10);
});

test('the largest .ged wins when there is no gedcom.ged', () => {
  const zip = zipSync({ 'small.ged': strToU8('0 HEAD\n0 TRLR\n'), 'big.GED': strToU8('0 HEAD\n0 @I1@ INDI\n1 NAME Big /One/\n0 TRLR\n') });
  assert.equal(parseGedcom(extractGedcom(zip)).people.I1.name, 'Big One');
});

test('gzip and plain bytes', () => {
  const plain = strToU8('0 HEAD\n0 @I1@ INDI\n1 NAME A /B/\n0 TRLR\n');
  const gz = gzipSync(plain);
  assert.ok(isGzip(gz));
  assert.deepEqual(extractGedcom(gz), plain);
  assert.equal(extractGedcom(plain), plain); // not an archive: returned as is
  assert.equal(isZip(plain), false);
});

test('archives without a GEDCOM, and damaged archives, throw a plain message', () => {
  assert.throws(() => extractGedcom(zipSync({ 'photo.jpg': strToU8('jpeg') })), /no \.ged file/);
  const broken = fixtureBytes('gedcom7.gdz').slice(0, 200);
  assert.throws(() => extractGedcom(broken), /could not be opened/);
});
