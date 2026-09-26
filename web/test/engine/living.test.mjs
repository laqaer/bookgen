import test from 'node:test';
import assert from 'node:assert/strict';
import { isLiving, displayFor, estimateBirthYear } from '../../src/app/engine/living.js';
import { parseDate } from '../../src/app/engine/dates.js';
import { parseGedcom } from '../../src/app/engine/gedcom.js';

const ev = (date, place = '') => ({ date: date ? parseDate(date) : null, place, country: null });
const person = (o = {}) => ({ id: 'X', given: 'Ann', surname: 'Lee', name: 'Ann Lee', suffix: '', sex: 'F', birth: null, death: null, living: false, famc: [], fams: [], ...o });

test('born under 100 years ago with no death: living', () => {
  assert.equal(isLiving(person({ birth: ev('1962') }), 2026), true);
  assert.equal(isLiving(person({ birth: ev('1927') }), 2026), true);
  assert.equal(isLiving(person({ birth: ev('1926') }), 2026), false); // 100 years
  assert.equal(isLiving(person({ birth: ev('ABT 1950') }), 2026), true);
});

test('any death evidence means not living', () => {
  assert.equal(isLiving(person({ birth: ev('1962'), death: ev(null) }), 2026), false); // "1 DEAT Y"
  assert.equal(isLiving(person({ birth: ev('1990'), death: ev('2020') }), 2026), false);
});

test('no dates: estimated from partners, children, parents and marriages', () => {
  const text = [
    '0 HEAD', '1 CHAR UTF-8',
    '0 @A@ INDI', '1 NAME Parent /One/', '1 FAMS @F1@',            // no dates; child born 1990
    '0 @B@ INDI', '1 NAME Child /One/', '1 BIRT', '2 DATE 1990', '1 FAMC @F1@',
    '0 @C@ INDI', '1 NAME Old /Timer/', '1 FAMS @F2@',             // married 1880
    '0 @D@ INDI', '1 NAME Kid /Timer/', '1 FAMC @F3@',             // parents born 1985
    '0 @E@ INDI', '1 NAME Mom /Young/', '1 BIRT', '2 DATE 1985', '1 FAMS @F3@',
    '0 @G@ INDI', '1 NAME No /Clues/',
    '0 @F1@ FAM', '1 HUSB @A@', '1 CHIL @B@',
    '0 @F2@ FAM', '1 HUSB @C@', '1 MARR', '2 DATE 1880',
    '0 @F3@ FAM', '1 WIFE @E@', '1 CHIL @D@',
    '0 TRLR',
  ].join('\n');
  const tree = parseGedcom(text, { nowYear: 2026 });
  assert.equal(tree.people.A.living, true);
  assert.equal(tree.people.C.living, false);
  assert.equal(tree.people.D.living, true);
  assert.equal(tree.people.G.living, false);
  assert.equal(estimateBirthYear(tree.people.A, tree), 1990 - 28);
  assert.equal(isLiving(tree.people.A, 2026), false); // without the tree there is nothing to go on
});

test('displayFor privacy modes', () => {
  const living = person({ birth: ev('1962', 'Providence, Rhode Island, USA'), living: true });
  const dead = person({ name: 'Old Lee', birth: ev('24 MAY 1819', 'Kensington'), death: ev('1901'), living: false });
  assert.deepEqual(displayFor(living, 'hide-dates'), { name: 'Ann Lee', dates: '', place: 'Providence, Rhode Island, USA' });
  assert.deepEqual(displayFor(living), { name: 'Ann Lee', dates: '', place: 'Providence, Rhode Island, USA' });
  assert.deepEqual(displayFor(living, 'living-only'), { name: 'Living', dates: '', place: '' });
  assert.deepEqual(displayFor(living, 'show-all'), { name: 'Ann Lee', dates: 'b. 1962', place: 'Providence, Rhode Island, USA' });
  for (const mode of ['hide-dates', 'living-only', 'show-all']) {
    assert.deepEqual(displayFor(dead, mode), { name: 'Old Lee', dates: '1819–1901', place: 'Kensington' });
  }
  assert.deepEqual(displayFor(null), { name: '', dates: '', place: '' });
});
