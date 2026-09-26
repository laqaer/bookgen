import test from 'node:test';
import assert from 'node:assert/strict';
import { treeFromSlots, normalizeSlots, encodeAsk, decodeAsk, decodeAskFull, mergeSlots, setAskCodec, MAX_SLOTS } from '../../src/app/engine/builder.js';
import { ancestors, parentsOf, suggestRoot } from '../../src/app/engine/tree.js';
import { loadLZString } from './helpers.mjs';

const LZ = loadLZString();

const SLOTS = [
  { name: 'Anna Kowalski', birthYear: 1990, birthPlace: 'Ohio' },
  { name: 'Jan Kowalski', birthYear: 'about 1960', birthPlace: 'Toledo, Ohio' },
  { name: 'Maria Nowak', birthYear: 1962, birthAbout: true, birthPlace: 'Polska' },
  { name: 'Stanisław Kowalski', birthYear: 1930, deathYear: 2001, birthPlace: 'Kraków, Poland' },
];

test('treeFromSlots builds people and families on the Ahnentafel layout', () => {
  const t = treeFromSlots(SLOTS, { nowYear: 2026 });
  assert.deepEqual(Object.keys(t.people), ['Q1', 'Q2', 'Q3', 'Q4']);
  assert.equal(t.meta.homeId, 'Q1');
  assert.equal(t.meta.count, 4);
  assert.equal(suggestRoot(t), 'Q1');
  const q1 = t.people.Q1;
  assert.deepEqual([q1.given, q1.surname, q1.name, q1.sex], ['Anna', 'Kowalski', 'Anna Kowalski', 'U']);
  assert.deepEqual([q1.birth.country, q1.birth.region], ['United States', 'Ohio']);
  assert.equal(q1.living, true);
  assert.equal(t.people.Q2.sex, 'M');
  assert.equal(t.people.Q3.sex, 'F');
  assert.equal(t.people.Q2.birth.date.display, 'c. 1960');
  assert.equal(t.people.Q3.birth.date.display, 'c. 1962');
  assert.equal(t.people.Q4.death.date.year, 2001);
  assert.equal(t.people.Q4.living, false);
  assert.deepEqual(parentsOf(t, 'Q1'), { father: 'Q2', mother: 'Q3', family: 'QF1', pedi: 'birth' });
  assert.deepEqual([...ancestors(t, 'Q1', 4).entries()], [[1, 'Q1'], [2, 'Q2'], [3, 'Q3'], [4, 'Q4']]);
  assert.deepEqual(structuredClone(t), t);
});

test('gaps between filled slots get empty placeholders so every line reaches the root', () => {
  const t = treeFromSlots({ 1: { name: 'Me' }, 13: { name: 'Great Grandma', birthYear: 1901 } });
  assert.deepEqual(Object.keys(t.people).sort(), ['Q1', 'Q13', 'Q3', 'Q6']);
  assert.equal(t.people.Q3.placeholder, true);
  assert.equal(t.people.Q6.placeholder, true);
  assert.equal(t.people.Q6.sex, 'M');
  assert.equal(ancestors(t, 'Q1', 4).get(13), 'Q13');
  // Nothing at all still gives a root to draw.
  assert.deepEqual(Object.keys(treeFromSlots([]).people), ['Q1']);
});

test('normalizeSlots accepts arrays, objects keyed by slot, and ahnen fields; caps at 15', () => {
  const fromArr = normalizeSlots([{ name: 'A' }, null, { name: 'C' }]);
  const fromObj = normalizeSlots({ 1: { name: 'A' }, 3: { name: 'C' }, 99: { name: 'ignored' } });
  const fromAhnen = normalizeSlots([{ ahnen: 3, name: 'C' }, { ahnen: 1, name: 'A' }]);
  assert.equal(fromArr.length, MAX_SLOTS);
  assert.deepEqual(fromArr, fromObj);
  assert.deepEqual(fromArr, fromAhnen);
  assert.equal(normalizeSlots([{ name: '   ' }, { birthPlace: '' }])[0], null);
  assert.equal(normalizeSlots([{ name: 'x'.repeat(500) }])[0].name.length, 160);
});

test('Ask link round trip with lz-string (URL-fragment safe)', () => {
  setAskCodec(LZ);
  try {
    const code = encodeAsk(SLOTS, { for: 'Anna', from: 'Aunt Rose' });
    assert.match(code, /^z1\.[A-Za-z0-9+\-$]+$/);
    const back = decodeAskFull(code);
    assert.deepEqual(back.meta, { for: 'Anna', from: 'Aunt Rose' });
    assert.deepEqual(back.slots, normalizeSlots(SLOTS));
    assert.deepEqual(decodeAsk(`https://gildroot.com/gift/#ask=${code}`), normalizeSlots(SLOTS));
    assert.deepEqual(decodeAsk(`#ask=${code}`), normalizeSlots(SLOTS));
    // Compressed: shorter than the JSON it carries.
    assert.ok(code.length < JSON.stringify(SLOTS).length);
  } finally {
    setAskCodec(null);
  }
});

test('Ask links use the browser global LZString when present', () => {
  globalThis.LZString = LZ;
  try {
    const code = encodeAsk([{ name: 'Zoë Ødegård' }]);
    assert.ok(code.startsWith('z1.'));
    assert.equal(decodeAsk(code)[0].name, 'Zoë Ødegård');
  } finally {
    delete globalThis.LZString;
  }
});

test('without lz-string the fallback codec still round-trips (base64url JSON)', () => {
  const code = encodeAsk(SLOTS);
  assert.match(code, /^j1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodeAsk(code), normalizeSlots(SLOTS));
  // A "z1." link cannot be read without the codec: null, not a crash.
  setAskCodec(LZ);
  const z = encodeAsk(SLOTS);
  setAskCodec(null);
  assert.equal(decodeAsk(z), null);
});

test('decodeAsk rejects damaged or foreign links', () => {
  setAskCodec(LZ);
  try {
    for (const bad of ['', 'hello', 'z1.', 'z1.!!!!', 'j1.bm90IGpzb24', '#ask=j1.eyJ2IjoyfQ', 42, null]) assert.equal(decodeAsk(bad), null, String(bad));
    // Hostile content is cleaned: control characters stripped, slot numbers bounded.
    const evil = 'j1.' + Buffer.from(JSON.stringify({ v: 1, s: [[1, 'A\u0000B<script>'], [99, 'x'], ['2', 'Dad', 1950]] })).toString('base64url');
    const s = decodeAsk(evil);
    assert.equal(s[0].name, 'A B<script>');
    assert.equal(s[1].name, 'Dad');
    assert.equal(s[1].birthYear, 1950);
  } finally {
    setAskCodec(null);
  }
});

test('mergeSlots fills gaps, prefers exact years, and lists real conflicts', () => {
  const mine = { 1: { name: 'Anna Kowalski', birthYear: 1990 }, 2: { name: 'Jan Kowalski', birthYear: 1960, birthAbout: true }, 3: { name: 'Maria Nowak' } };
  const theirs = {
    1: { name: 'anna kowalski', birthPlace: 'Ohio' },
    2: { name: 'Jan Kowalski', birthYear: 1960 },
    3: { name: 'Maria Nowak', birthYear: 1962, birthPlace: 'Kraków' },
    4: { name: 'Stanisław Kowalski' },
    5: { name: 'Zofia', birthYear: 1935 },
  };
  const conflictSide = { 3: { name: 'Marta Nowak', birthYear: 1963 } };
  const { merged, conflicts } = mergeSlots(mine, theirs);
  assert.deepEqual(conflicts, []);
  assert.deepEqual(merged[0], { name: 'Anna Kowalski', birthPlace: 'Ohio', birthYear: 1990 });
  assert.deepEqual(merged[1], { name: 'Jan Kowalski', birthYear: 1960 }); // exact beats "about"
  assert.deepEqual(merged[2], { name: 'Maria Nowak', birthPlace: 'Kraków', birthYear: 1962 });
  assert.equal(merged[3].name, 'Stanisław Kowalski');
  assert.equal(merged[4].name, 'Zofia');
  const second = mergeSlots(merged, conflictSide);
  assert.deepEqual(second.conflicts, [
    { slot: 3, field: 'name', a: 'Maria Nowak', b: 'Marta Nowak' },
    { slot: 3, field: 'birthYear', a: 1962, b: 1963 },
  ]);
  assert.equal(second.merged[2].name, 'Maria Nowak'); // yours kept until you choose
});
