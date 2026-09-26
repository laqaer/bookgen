import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, formatYearRange, yearText, compareDates } from '../../src/app/engine/dates.js';

const pick = (d, ...keys) => Object.fromEntries(keys.filter(k => d[k] !== undefined).map(k => [k, d[k]]));

test('contract display strings', () => {
  assert.equal(parseDate('24 MAY 1819').display, '24 May 1819');
  assert.equal(parseDate('ABT 1843').display, 'c. 1843');
  assert.equal(parseDate('BEF 1790').display, 'before 1790');
  assert.equal(parseDate('1731/32').display, '1731/32');
  assert.equal(parseDate('BET 1790 AND 1795').display, '1790–1795');
});

test('exact and partial dates', () => {
  assert.deepEqual(pick(parseDate('24 MAY 1819'), 'year', 'month', 'day', 'qualifier', 'sortKey'), { year: 1819, month: 5, day: 24, qualifier: '', sortKey: 18190524 });
  assert.deepEqual(pick(parseDate('MAY 1819'), 'year', 'month', 'day', 'display'), { year: 1819, month: 5, display: 'May 1819' });
  assert.deepEqual(pick(parseDate('1819'), 'year', 'month', 'display', 'sortKey'), { year: 1819, display: '1819', sortKey: 18190000 });
  assert.deepEqual(pick(parseDate('24 MAY'), 'year', 'month', 'day', 'sortKey'), { month: 5, day: 24, sortKey: null });
  assert.equal(parseDate('24 MAY 1819').raw, '24 MAY 1819');
});

test('qualifiers ABT/CAL/EST/BEF/AFT/INT', () => {
  for (const [raw, q, disp] of [
    ['ABT 1843', 'ABT', 'c. 1843'], ['CAL 1850', 'CAL', 'c. 1850'], ['EST 1850', 'EST', 'c. 1850'],
    ['BEF 1790', 'BEF', 'before 1790'], ['AFT 1790', 'AFT', 'after 1790'], ['ABT MAR 1850', 'ABT', 'c. Mar 1850'],
    ['INT 1843 (the famine year)', 'INT', '1843'],
  ]) {
    const d = parseDate(raw);
    assert.equal(d.qualifier, q, raw);
    assert.equal(d.display, disp, raw);
  }
  assert.equal(parseDate('INT 1843 (the famine year)').phrase, 'the famine year');
});

test('ranges and periods', () => {
  const bet = parseDate('BET 1790 AND 1795');
  assert.deepEqual(pick(bet, 'qualifier', 'year', 'year2', 'display'), { qualifier: 'BET', year: 1790, year2: 1795, display: '1790–1795' });
  const ft = parseDate('FROM 1790 TO 1795');
  assert.deepEqual(pick(ft, 'qualifier', 'year', 'year2', 'display'), { qualifier: 'FROM', year: 1790, year2: 1795, display: '1790–1795' });
  assert.equal(parseDate('FROM 1790').display, 'from 1790');
  assert.equal(parseDate('TO 1795').qualifier, 'TO');
  assert.equal(parseDate('BET 1 JAN 1790 AND 5 JUN 1795').display, '1 Jan 1790 – 5 Jun 1795');
  assert.equal(parseDate('1790-1795').display, '1790–1795');
  assert.equal(parseDate('1790/95').qualifier, 'BET'); // not dual dating: 95 is not 91
});

test('dual dating (Old Style / New Style)', () => {
  const d = parseDate('11 FEB 1731/32');
  assert.deepEqual(pick(d, 'year', 'month', 'day', 'dual', 'display'), { year: 1732, month: 2, day: 11, dual: '1731/32', display: '11 Feb 1731/32' });
  assert.equal(parseDate('1699/00').year, 1700);
  assert.equal(parseDate('1699/00').dual, '1699/00');
  assert.equal(parseDate('1731/1732').dual, '1731/32');
  assert.equal(parseDate('1731/2').dual, '1731/32');
});

test('calendar escapes: Julian kept, French republican and Hebrew kept raw with an approximate year', () => {
  const j = parseDate('@#DJULIAN@ 12 MAR 1690');
  assert.deepEqual(pick(j, 'year', 'month', 'day', 'calendar', 'display'), { year: 1690, month: 3, day: 12, calendar: 'julian', display: '12 Mar 1690' });
  assert.equal(parseDate('JULIAN 12 MAR 1690').calendar, 'julian'); // GEDCOM 7 keyword
  const f = parseDate('@#DFRENCH R@ 12 VEND 11');
  assert.equal(f.calendar, 'french');
  assert.equal(f.year, 1802);
  assert.equal(f.display, '12 Vendémiaire an XI');
  assert.equal(parseDate('FRENCH_R 12 VEND 11').year, 1802);
  const h = parseDate('@#DHEBREW@ 15 NSN 5602');
  assert.equal(h.calendar, 'hebrew');
  assert.equal(h.year, 1842);
  assert.equal(h.display, '15 Nisan 5602');
  assert.equal(parseDate('@#DJULIAN@ ABT 1700').qualifier, 'ABT');
  // Unknown month code in a non-Gregorian calendar: no crash, raw text kept.
  assert.equal(parseDate('@#DHEBREW@ 15 XYZ 5602').display, '@#DHEBREW@ 15 XYZ 5602');
});

test('free-text dates people type', () => {
  const cases = {
    'abt. 1843': ['ABT', 1843], 'c. 1843': ['ABT', 1843], c1843: ['ABT', 1843], 'ca 1843': ['ABT', 1843], '~1843': ['ABT', 1843],
    'about 1843': ['ABT', 1843], 'circa 1843': ['ABT', 1843], 'before 1790': ['BEF', 1790], 'Bef. 1925': ['BEF', 1925], 'after 1790': ['AFT', 1790],
    '1819-05-24': ['', 1819], '24.05.1819': ['', 1819], '5/24/1819': ['', 1819], 'May 24, 1819': ['', 1819], '24th May 1819': ['', 1819],
    '24 Mai 1819': ['', 1819], '3 Okt 1843': ['', 1843], '1 janvier 1850': ['', 1850], 'zwischen 1790 und 1795': ['BET', 1790], 'um 1800': ['ABT', 1800],
  };
  for (const [raw, [q, y]] of Object.entries(cases)) {
    const d = parseDate(raw);
    assert.equal(d.qualifier, q, raw);
    assert.equal(d.year, y, raw);
  }
  assert.equal(parseDate('5/24/1819').display, '24 May 1819');
  assert.equal(parseDate('24.05.1819').display, '24 May 1819');
});

test('B.C. years, decades, phrases and junk never throw', () => {
  assert.equal(parseDate('44 B.C.').year, -44);
  assert.equal(parseDate('44 B.C.').display, '44 BC');
  const dec = parseDate('1840s');
  assert.equal(dec.display, '1840s');
  assert.equal(dec.qualifier, 'ABT');
  const phrase = parseDate('(Stillborn)');
  assert.equal(phrase.display, 'Stillborn');
  assert.equal(phrase.sortKey, null);
  const spring = parseDate('Spring 1843');
  assert.equal(spring.year, 1843);
  assert.equal(spring.display, 'Spring 1843');
  for (const junk of ['', 'garbage', 'Y', '??', '0', '31 FOO 1900', null, undefined]) {
    const d = parseDate(junk);
    assert.equal(typeof d.display, 'string');
    assert.ok(d.qualifier !== undefined);
  }
  assert.equal(parseDate('').display, '');
});

test('parseDate returns fresh objects (cache is not shared)', () => {
  const a = parseDate('24 MAY 1819');
  a.year = 1;
  assert.equal(parseDate('24 MAY 1819').year, 1819);
});

test('formatYearRange', () => {
  assert.equal(formatYearRange(parseDate('24 MAY 1819'), parseDate('22 JAN 1901')), '1819–1901');
  assert.equal(formatYearRange({ date: parseDate('ABT 1843') }, { date: parseDate('1901') }), 'c. 1843–1901');
  assert.equal(formatYearRange(parseDate('1791'), null), 'b. 1791');
  assert.equal(formatYearRange(null, parseDate('1901')), 'd. 1901');
  assert.equal(formatYearRange(null, null), '');
  assert.equal(formatYearRange(parseDate('11 FEB 1731/32'), parseDate('1790')), '1731/32–1790');
  assert.equal(formatYearRange('BEF 1790', 'AFT 1850'), 'bef. 1790–aft. 1850');
  assert.equal(formatYearRange({ date: null, place: 'Cork' }, { date: null }), '');
  assert.equal(yearText(parseDate('BET 1790 AND 1800')), 'c. 1795');
});

test('compareDates sorts unknown dates last', () => {
  const list = [parseDate('1900'), parseDate(''), parseDate('ABT 1850'), parseDate('3 MAR 1850')];
  list.sort(compareDates);
  assert.deepEqual(list.map(d => d.raw), ['ABT 1850', '3 MAR 1850', '1900', '']);
});
