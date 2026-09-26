import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGedcom } from '../../src/app/engine/gedcom.js';
import {
  ancestors, collapse, parentsOf, searchPeople, suggestRoot, stats, relationship, relationshipLabel,
  applyOverrides, generationFill, autoGenerations, generationOf,
} from '../../src/app/engine/tree.js';
import { fixtureBytes, sampleBytes } from './helpers.mjs';

const edge = () => parseGedcom(fixtureBytes('edge-cases.ged'), { nowYear: 2026 });
const almeida = () => parseGedcom(sampleBytes('almeida-novak.ged'), { nowYear: 2026 });
const victoria = () => parseGedcom(sampleBytes('victoria.ged'), { nowYear: 2026 });

test('ancestors: Ahnentafel numbering (1 root, 2n father, 2n+1 mother)', () => {
  const t = victoria();
  const a = ancestors(t, 'I1', 3);
  assert.deepEqual([...a.keys()], [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(a.get(1), 'I1');
  assert.equal(t.people[a.get(2)].name, 'Prince Edward, Duke of Kent and Strathearn');
  assert.equal(t.people[a.get(3)].name, 'Princess Victoria of Saxe-Coburg-Saalfeld');
  assert.equal(t.people[a.get(4)].name, 'George III of Great Britain');
  assert.equal(t.people[a.get(5)].name, 'Charlotte of Mecklenburg-Strelitz');
  // Generation g holds 2^(g-1) … 2^g − 1.
  for (const n of ancestors(t, 'I1', 7).keys()) assert.ok(generationOf(n) <= 7);
  assert.equal(generationOf(1), 1);
  assert.equal(generationOf(3), 2);
  assert.equal(generationOf(64), 7);
  assert.equal(ancestors(t, 'I1', 1).size, 1);
  assert.equal(ancestors(t, 'nobody', 5).size, 0);
  assert.equal(ancestors(t, '@I1@', 2).get(1), 'I1'); // "@I1@" accepted
});

test('collapse: first cousins who married (edge-cases) and second cousins (sample)', () => {
  const t = edge();
  const c = collapse(ancestors(t, 'E62', 4));
  assert.deepEqual([...c.entries()], [['E70', [8, 14]], ['E71', [9, 15]]]);
  const s = almeida();
  const cs = collapse(ancestors(s, 'I1', 6));
  assert.deepEqual([...cs.entries()], [['I52', [52, 62]], ['I53', [53, 63]]]);
  assert.equal(collapse(ancestors(s, 'I1', 5)).size, 0);
});

test('parentsOf: birth by default, adoptive on request (global or per person)', () => {
  const t = edge();
  assert.deepEqual(parentsOf(t, 'E30'), { father: null, mother: 'E31', family: 'F31', pedi: 'birth' });
  const adoptive = { father: 'E32', mother: 'E33', family: 'F32', pedi: 'adopted' };
  assert.deepEqual(parentsOf(t, 'E30', { adoptive: true }), adoptive);
  assert.deepEqual(parentsOf(t, 'E30', { adoptive: new Set(['E30']) }), adoptive);
  assert.deepEqual(parentsOf(t, 'E30', { adoptive: ['E30'] }), adoptive);
  assert.deepEqual(parentsOf(t, 'E30', { adoptive: { E30: true } }), adoptive);
  assert.deepEqual(parentsOf(t, 'E30', { adoptive: id => id === 'E30' }), adoptive);
  assert.deepEqual(parentsOf(t, 'E30', { adoptive: new Set(['someone-else']) }).family, 'F31');
  const a = ancestors(t, 'E30', 2, { adoptive: true });
  assert.deepEqual([...a.values()], ['E30', 'E32', 'E33']);
  assert.deepEqual(parentsOf(t, 'nobody'), { father: null, mother: null, family: null, pedi: null });
});

test('parentsOf: only an adoptive family known -> it is used even by default', () => {
  const t = parseGedcom(fixtureBytes('gedcom7.ged'));
  assert.deepEqual(parentsOf(t, 'I6'), { father: null, mother: 'I1', family: 'F3', pedi: 'adopted' });
});

test('searchPeople: accent- and case-insensitive prefixes, years, ids', () => {
  const t = almeida();
  assert.equal(searchPeople(t, 'sean byrne')[0].id, 'I10');
  assert.equal(searchPeople(t, 'SEÁN')[0].id, 'I10');
  assert.equal(searchPeople(t, 'odegard lars')[0].id, 'I18');
  assert.equal(searchPeople(t, 'nguyen hoa')[0].id, 'I19');
  assert.equal(searchPeople(t, 'konstantinos')[0].id, 'I22'); // romanised form
  assert.equal(searchPeople(t, 'Κωνσταντίνος')[0].id, 'I22');
  const pach = searchPeople(t, 'pacheco');
  assert.deepEqual(pach.map(p => p.id).sort(), ['I13', 'I26', 'I31', 'I52']);
  const y = searchPeople(t, 'pacheco 1788');
  assert.equal(y.length, 1);
  assert.equal(y[0].id, 'I52');
  assert.equal(y[0].years, '1788–1860');
  assert.equal(y[0].name, 'António Pacheco'); // results are Person objects plus years/score
  assert.equal(searchPeople(t, 'I18')[0].id, 'I18');
  assert.equal(searchPeople(t, 'ma', 3).length, 3);
  assert.deepEqual(searchPeople(t, ''), []);
  assert.deepEqual(searchPeople(t, 'zzzzqqq'), []);
});

test('suggestRoot: home hint first, else most known ancestors', () => {
  assert.equal(suggestRoot(almeida()), 'I1'); // HEAD _HOME
  assert.equal(suggestRoot(victoria()), 'I1'); // most ancestors
  assert.equal(suggestRoot(parseGedcom(fixtureBytes('myheritage-style.ged'))), 'I2'); // SUBM name
  assert.equal(suggestRoot(parseGedcom(fixtureBytes('ancestry-style.ged'))), 'I282046532843');
  assert.equal(suggestRoot(parseGedcom('0 HEAD\n0 TRLR')), null);
});

test('stats', () => {
  const s = stats(almeida());
  assert.equal(s.people, 62);
  assert.equal(s.families, 30);
  assert.equal(s.living, 5);
  assert.equal(s.rootId, 'I1');
  assert.equal(s.generations, 6);
  assert.deepEqual(s.fill, [1, 1, 1, 1, 1, 0.781]);
  assert.equal(s.earliestYear, 1785);
  assert.deepEqual(s.countries.map(c => c.country), ['Portugal', 'United States', 'Czechia', 'Ireland', 'Norway', 'Greece', 'Vietnam']);
  assert.equal(s.places.total, s.places.resolved);
  assert.equal(s.males + s.females + s.unknownSex, s.people);
});

test('generationFill and autoGenerations (deepest generation at least 25% filled)', () => {
  const t = parseGedcom(fixtureBytes('sparse-3gen.ged'));
  assert.deepEqual(generationFill(t, 'P1', 4), [1, 0.5, 0.25, 0]);
  assert.equal(autoGenerations(t, 'P1', 8), 3);
  assert.equal(autoGenerations(victoria(), 'I1', 8), 8);
  assert.equal(autoGenerations(almeida(), 'I1', 6), 6);
});

test('relationship labels (B relative to A)', () => {
  const L = relationshipLabel;
  assert.equal(L(0, 0, 'F'), 'self');
  assert.equal(L(1, 0, 'M'), 'father');
  assert.equal(L(2, 0, 'F'), 'grandmother');
  assert.equal(L(3, 0, 'M'), 'great-grandfather');
  assert.equal(L(4, 0, 'M'), 'great-great-grandfather');
  assert.equal(L(5, 0, 'M'), '3rd great-grandfather');
  assert.equal(L(0, 1, 'F'), 'daughter');
  assert.equal(L(0, 3, 'U'), 'great-grandchild');
  assert.equal(L(1, 1, 'M'), 'brother');
  assert.equal(L(1, 1, 'F', true), 'half-sister');
  assert.equal(L(1, 1, 'U', true), 'half-sibling');
  assert.equal(L(2, 1, 'F'), 'aunt');
  assert.equal(L(3, 1, 'F'), 'grandaunt');
  assert.equal(L(4, 1, 'F'), 'great-grandaunt');
  assert.equal(L(4, 1, 'M'), 'great-granduncle');
  assert.equal(L(1, 2, 'M'), 'nephew');
  assert.equal(L(1, 3, 'F'), 'grandniece');
  assert.equal(L(2, 2), 'first cousin');
  assert.equal(L(3, 3), 'second cousin');
  assert.equal(L(3, 4), 'second cousin once removed');
  assert.equal(L(4, 3), 'second cousin once removed');
  assert.equal(L(2, 4), 'first cousin twice removed');
  assert.equal(L(4, 7), 'third cousin 3 times removed');
  assert.equal(L(3, 3, 'U', true), 'half second cousin');
});

test('relationship: from the tree', () => {
  const s = almeida();
  const sc = relationship(s, 'I6', 'I7');
  assert.equal(sc.label, 'second cousin');
  assert.equal(sc.kind, 'cousin');
  assert.deepEqual([sc.degree, sc.removed], [2, 0]);
  assert.deepEqual(sc.common.sort(), ['I52', 'I53']);
  assert.ok(sc.others.includes('wife')); // they also married each other
  const half = relationship(s, 'I9', 'I107');
  assert.equal(half.label, 'half-brother');
  assert.equal(half.inverse, 'half-sister');
  assert.equal(relationship(s, 'I1', 'I104').label, 'uncle');
  assert.equal(relationship(s, 'I104', 'I1').label, 'niece');
  assert.equal(relationship(s, 'I102', 'I18').label, '3rd great-grandfather');
  assert.equal(relationship(s, 'I18', 'I102').label, '3rd great-granddaughter');
  assert.equal(relationship(s, 'I1', 'I100').label, 'brother');
  assert.equal(relationship(s, 'I1', 'I101').label, 'husband');
  assert.equal(relationship(s, 'I1', 'I101').kind, 'spouse');
  assert.equal(relationship(s, 'I1', 'I1').label, 'self');
  assert.equal(relationship(s, 'I101', 'I5').label, 'no blood relationship found');
  // Second cousin once removed: Rosa (I3, daughter of Maria I7) and Manuel (I6) share I52/I53.
  assert.equal(relationship(s, 'I3', 'I6').label, 'father'); // the direct line wins
  const e = edge();
  assert.equal(relationship(e, 'E60', 'E61').label, 'first cousin');
  assert.equal(relationship(e, 'E43', 'E44').label, 'half-sister');
  assert.equal(relationship(e, 'E62', 'E70').label, 'great-grandfather');
});

test('relationship: great-grandaunt and second cousin once removed', () => {
  // A small synthetic family: G1+G2 -> (P, Q). P -> P1 -> P2 -> P3 ; Q -> Q1 -> Q2.
  const lines = ['0 HEAD'];
  const indi = (id, name, sex, famc, fams) => {
    lines.push(`0 @${id}@ INDI`, `1 NAME ${name}`, `1 SEX ${sex}`);
    if (famc) lines.push(`1 FAMC @${famc}@`);
    for (const f of fams || []) lines.push(`1 FAMS @${f}@`);
  };
  indi('G1', 'Gus /Top/', 'M', null, ['FG']); indi('G2', 'Gwen /Top/', 'F', null, ['FG']);
  indi('P', 'Paul /Top/', 'M', 'FG', ['FP']); indi('Q', 'Queenie /Top/', 'F', 'FG', ['FQ']);
  indi('P1', 'Pat /Top/', 'M', 'FP', ['FP1']); indi('P2', 'Pip /Top/', 'M', 'FP1', ['FP2']); indi('P3', 'Pia /Top/', 'F', 'FP2', []);
  indi('Q1', 'Quin /Low/', 'M', 'FQ', ['FQ1']); indi('Q2', 'Quill /Low/', 'F', 'FQ1', []);
  for (const [f, h, w, kids] of [['FG', 'G1', 'G2', ['P', 'Q']], ['FP', 'P', null, ['P1']], ['FP1', 'P1', null, ['P2']], ['FP2', 'P2', null, ['P3']], ['FQ', null, 'Q', ['Q1']], ['FQ1', 'Q1', null, ['Q2']]]) {
    lines.push(`0 @${f}@ FAM`);
    if (h) lines.push(`1 HUSB @${h}@`);
    if (w) lines.push(`1 WIFE @${w}@`);
    for (const k of kids) lines.push(`1 CHIL @${k}@`);
  }
  lines.push('0 TRLR');
  const t = parseGedcom(lines.join('\n'));
  assert.equal(relationship(t, 'P3', 'Q').label, 'great-grandaunt'); // P3 -> P2 -> P1 -> P -> G; Q is P's sister
  assert.equal(relationship(t, 'Q', 'P3').label, 'great-grandniece');
  assert.equal(relationship(t, 'P2', 'Q2').label, 'second cousin');
  assert.equal(relationship(t, 'P3', 'Q2').label, 'second cousin once removed');
  assert.equal(relationship(t, 'P1', 'Q1').label, 'first cousin');
  assert.equal(relationship(t, 'P1', 'Q2').label, 'first cousin once removed');
});

test('relationship: double first cousins', () => {
  // Two brothers married two sisters.
  const g = ['0 HEAD'];
  const add = (...l) => g.push(...l);
  add('0 @A1@ INDI', '1 NAME A1 /A/', '1 SEX M', '1 FAMS @FA@', '0 @A2@ INDI', '1 NAME A2 /A/', '1 SEX F', '1 FAMS @FA@');
  add('0 @B1@ INDI', '1 NAME B1 /B/', '1 SEX M', '1 FAMS @FB@', '0 @B2@ INDI', '1 NAME B2 /B/', '1 SEX F', '1 FAMS @FB@');
  add('0 @S1@ INDI', '1 NAME S1 /A/', '1 SEX M', '1 FAMC @FA@', '1 FAMS @F1@', '0 @S2@ INDI', '1 NAME S2 /A/', '1 SEX M', '1 FAMC @FA@', '1 FAMS @F2@');
  add('0 @D1@ INDI', '1 NAME D1 /B/', '1 SEX F', '1 FAMC @FB@', '1 FAMS @F1@', '0 @D2@ INDI', '1 NAME D2 /B/', '1 SEX F', '1 FAMC @FB@', '1 FAMS @F2@');
  add('0 @K1@ INDI', '1 NAME K1 /A/', '1 SEX M', '1 FAMC @F1@', '0 @K2@ INDI', '1 NAME K2 /A/', '1 SEX F', '1 FAMC @F2@');
  add('0 @FA@ FAM', '1 HUSB @A1@', '1 WIFE @A2@', '1 CHIL @S1@', '1 CHIL @S2@');
  add('0 @FB@ FAM', '1 HUSB @B1@', '1 WIFE @B2@', '1 CHIL @D1@', '1 CHIL @D2@');
  add('0 @F1@ FAM', '1 HUSB @S1@', '1 WIFE @D1@', '1 CHIL @K1@', '0 @F2@ FAM', '1 HUSB @S2@', '1 WIFE @D2@', '1 CHIL @K2@', '0 TRLR');
  const t = parseGedcom(g.join('\n'));
  const r = relationship(t, 'K1', 'K2');
  assert.equal(r.label, 'double first cousin');
  assert.equal(r.common.length, 4);
});

test('applyOverrides: edits without touching the source tree', () => {
  const t = almeida();
  const before = JSON.stringify(t);
  const o = applyOverrides(t, {
    I18: { name: 'Captain Lars Ødegård' },
    '@I10@': { birth: 'ABT 1869', place: 'Westport, County Mayo, Ireland' },
    I9: { death: null },
    I4: { hidden: true },
    I13: { unknown: true },
    I2: { birth: { date: '1926', place: 'Evanston, Illinois' } },
    NOPE: { name: 'ignored' },
  }, { nowYear: 2026 });
  assert.equal(JSON.stringify(t), before); // source unchanged
  assert.notEqual(o, t);
  assert.equal(o.people.I18.name, 'Captain Lars Ødegård');
  assert.equal(o.people.I18.surname, 'Ødegård');
  assert.equal(o.people.I10.birth.date.display, 'c. 1869');
  assert.equal(o.people.I10.birth.place, 'Westport, County Mayo, Ireland');
  assert.equal(o.people.I10.birth.country, 'Ireland');
  assert.equal(o.people.I9.death, null);
  assert.equal(o.people.I9.living, false); // born 1876: not living even without a death event
  assert.equal(o.people.I2.birth.place, 'Evanston, Illinois');
  assert.equal(o.people.I2.birth.region, 'Illinois');
  // Hidden: the slot and the line above it drop out of the chart.
  const a = ancestors(o, 'I1', 4);
  assert.equal(a.has(4), false);
  assert.equal(a.has(8), false);
  assert.equal(a.get(5), 'I5');
  // Unknown: the slot stays (the line above too) but shows nothing.
  assert.equal(o.people.I13.name, '');
  assert.equal(o.people.I13.birth, null);
  assert.equal(ancestors(o, 'I1', 5).get(13), 'I13');
  assert.equal(ancestors(o, 'I1', 5).get(26), 'I26');
  assert.equal(applyOverrides(t, {}), t);
  assert.equal(applyOverrides(t, null), t);
});
