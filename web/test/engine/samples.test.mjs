import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseGedcom } from '../../src/app/engine/gedcom.js';
import { ancestors, collapse, stats, suggestRoot, relationship } from '../../src/app/engine/tree.js';
import { displayFor } from '../../src/app/engine/living.js';
import { nameLadder } from '../../src/app/engine/names.js';
import { SAMPLES, sampleBytes } from './helpers.mjs';

test('victoria.ged (Wikidata CC0): 298 people, Victoria is the suggested root', () => {
  const t = parseGedcom(sampleBytes('victoria.ged'), { nowYear: 2026 });
  assert.equal(t.meta.count, 298);
  assert.equal(Object.keys(t.families).length, 152);
  assert.deepEqual(t.meta.warnings, []);
  assert.equal(suggestRoot(t), 'I1');
  const v = t.people.I1;
  assert.equal(v.name, 'Victoria');
  assert.equal(v.birth.date.display, '24 May 1819');
  assert.equal(v.death.date.year, 1901);
  assert.equal(displayFor(v).dates, '1819–1901');
  const s = stats(t);
  assert.equal(s.living, 0);
  assert.deepEqual(s.fill.slice(0, 8), [1, 1, 1, 1, 1, 1, 1, 1]); // 7-generation hero chart is full
  assert.equal(s.countries[0].country, 'Germany');
  assert.ok(s.places.resolved / s.places.total > 0.9);
  // "NAME Unknown" is a placeholder, not a name.
  assert.equal(t.people.I270.name, '');
  assert.deepEqual(nameLadder(t.people.I270), []);
  // Every real name has a ladder that ends short.
  for (const p of Object.values(t.people).filter(x => x.name)) {
    const l = nameLadder(p);
    assert.ok(l.length >= 2, p.name);
    assert.ok(l[l.length - 1].length <= 12, `${p.name}: ${l[l.length - 1]}`);
  }
});

test('almeida-novak.ged is clearly labelled fictional', () => {
  const text = readFileSync(join(SAMPLES, 'almeida-novak.ged'), 'utf8');
  assert.match(text.split('\n0 ')[0], /FICTIONAL SAMPLE DATA/);
  assert.match(text, /None of these people are real/);
});

test('almeida-novak.ged: six generations, living root with hidden dates', () => {
  const t = parseGedcom(sampleBytes('almeida-novak.ged'), { nowYear: 2026 });
  assert.deepEqual(t.meta.warnings, []);
  assert.equal(t.meta.homeId, 'I1');
  const root = t.people.I1;
  assert.equal(root.name, 'Margaret Rose Almeida-Novak');
  assert.equal(root.birth.date.year, 1962);
  assert.equal(root.living, true);
  assert.equal(displayFor(root, 'hide-dates').dates, '');
  assert.equal(displayFor(root, 'living-only').name, 'Living');
  const a = ancestors(t, 'I1', 8);
  assert.equal(Math.max(...[...a.keys()].map(n => Math.floor(Math.log2(n)) + 1)), 6);
  const s = stats(t);
  assert.deepEqual(s.fill, [1, 1, 1, 1, 1, 0.781]);
});

test('almeida-novak.ged: diacritics, a Greek-script name, a sparse branch', () => {
  const t = parseGedcom(sampleBytes('almeida-novak.ged'), { nowYear: 2026 });
  const byName = n => Object.values(t.people).find(p => p.name === n);
  for (const n of ['Seán Patrick Byrne', 'Jan Dvořák', 'Lars Ødegård', 'Nguyễn Thị Hoa', 'Maria da Conceição Medeiros', 'Κωνσταντίνος Παπαδόπουλος']) {
    assert.ok(byName(n), n);
  }
  const greek = byName('Κωνσταντίνος Παπαδόπουλος');
  assert.equal(greek.romanized, 'Konstantinos Papadopoulos');
  assert.equal(byName('Nguyễn Thị Hoa').surname, 'Nguyễn');
  const a = ancestors(t, 'I1', 6);
  // The Greek and Vietnamese great-great-grandparents have few or no known parents.
  assert.equal(a.get(23) && t.people[a.get(23)].name, 'Vasiliki');
  for (const n of [39, 44, 45, 46, 47]) assert.equal(a.has(n), false, `slot ${n}`);
  assert.equal(t.people[a.get(38)].birth, null);
});

test('almeida-novak.ged: birthplaces across seven countries and several US states', () => {
  const t = parseGedcom(sampleBytes('almeida-novak.ged'), { nowYear: 2026 });
  const s = stats(t);
  assert.deepEqual(s.countries.map(c => c.country).sort(), ['Czechia', 'Greece', 'Ireland', 'Norway', 'Portugal', 'United States', 'Vietnam']);
  const states = new Set(Object.values(t.people).filter(p => p.birth?.country === 'United States').map(p => p.birth.region));
  assert.ok(states.size >= 5, [...states].join(', '));
});

test('almeida-novak.ged: one pedigree collapse (second cousins who married in 1899)', () => {
  const t = parseGedcom(sampleBytes('almeida-novak.ged'), { nowYear: 2026 });
  const c = collapse(ancestors(t, 'I1', 6));
  assert.equal(c.size, 2);
  assert.deepEqual(c.get('I52'), [52, 62]);
  assert.deepEqual(c.get('I53'), [53, 63]);
  assert.equal(t.families.F3.marriage.date.year, 1899);
  assert.equal(relationship(t, 'I6', 'I7').label, 'second cousin');
});
