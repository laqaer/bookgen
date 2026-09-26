import test from 'node:test';
import assert from 'node:assert/strict';
import { nameLadder, splitName, fixCaps, initialOf } from '../../src/app/engine/names.js';

const P = (given, surname, name, suffix = '') => ({ given, surname, suffix, name: name ?? [given, surname, suffix].filter(Boolean).join(' ') });

test('the contract ladder, exactly', () => {
  assert.deepEqual(nameLadder(P('Johann Georg Friedrich', 'Weber')), [
    'Johann Georg Friedrich Weber', 'Johann Georg F. Weber', 'Johann G. Weber', 'J. G. Weber', 'Weber', 'J. G. W.',
  ]);
});

test('shorter given names', () => {
  assert.deepEqual(nameLadder(P('Johann Georg', 'Weber')), ['Johann Georg Weber', 'Johann G. Weber', 'J. G. Weber', 'Weber', 'J. G. W.']);
  assert.deepEqual(nameLadder(P('Anna', 'Weber')), ['Anna Weber', 'A. Weber', 'Weber', 'A. W.']);
  assert.deepEqual(nameLadder(P('', 'Smith')), ['Smith', 'S.']);
  assert.deepEqual(nameLadder(P('Jean-Pierre', 'Dubois')), ['Jean-Pierre Dubois', 'J.-P. Dubois', 'Dubois', 'J.-P. D.']);
});

test('suffixes, nicknames and particles', () => {
  assert.deepEqual(nameLadder(P('John', 'Smith', undefined, 'Jr.')), ['John Smith Jr.', 'John Smith', 'J. Smith', 'Smith', 'J. S.']);
  assert.deepEqual(nameLadder(P('John "Jack"', 'Smith')), ['John "Jack" Smith', 'John Smith', 'J. Smith', 'Smith', 'J. S.']);
  assert.deepEqual(nameLadder(P('Anna Maria', 'van der Berg')), ['Anna Maria van der Berg', 'Anna M. van der Berg', 'A. M. van der Berg', 'van der Berg', 'A. M. B.']);
});

test('surname-first and CJK names keep their order', () => {
  assert.deepEqual(nameLadder(P('Thị Hoa', 'Nguyễn', 'Nguyễn Thị Hoa')), ['Nguyễn Thị Hoa', 'Nguyễn Hoa', 'Nguyễn', 'N. T. H.']);
  assert.deepEqual(nameLadder(P('秀英', '王', '王秀英')), ['王秀英', '王']);
});

test('Greek and other scripts use their own initials', () => {
  assert.deepEqual(nameLadder(P('Κωνσταντίνος', 'Παπαδόπουλος')), ['Κωνσταντίνος Παπαδόπουλος', 'Κ. Παπαδόπουλος', 'Παπαδόπουλος', 'Κ. Π.']);
  assert.equal(initialOf('Ødegård'), 'Ø.');
});

test('royal styles without a surname shorten at "of" and commas, getting strictly shorter', () => {
  assert.deepEqual(nameLadder(P('George III of Great Britain', '')), ['George III of Great Britain', 'George III', 'G. III']);
  assert.deepEqual(nameLadder(P('Prince Edward, Duke of Kent and Strathearn', '')), [
    'Prince Edward, Duke of Kent and Strathearn', 'Edward, Duke of Kent and Strathearn', 'Prince Edward', 'Edward', 'E.',
  ]);
  const l = nameLadder(P('Princess Elizabeth Albertine of Saxe-Hildburghausen', ''));
  assert.deepEqual(l.slice(-3), ['Elizabeth Albertine', 'Elizabeth A.', 'E. A.']);
  for (let i = 1; i < l.length; i++) assert.ok(l[i].length < l[i - 1].length);
  assert.deepEqual(nameLadder(P('Victoria', '')), ['Victoria', 'V.']);
});

test('names are never hyphenated or broken inside a word', () => {
  for (const rung of nameLadder(P('Margaret Rose', 'Almeida-Novak'))) {
    for (const word of rung.split(' ')) assert.ok(/^[\p{L}.'-]+$/u.test(word), word);
  }
  assert.deepEqual(nameLadder({}), []);
  assert.deepEqual(nameLadder(null), []);
});

test('splitName', () => {
  assert.deepEqual(splitName('Anna Maria van der Berg'), { given: 'Anna Maria', surname: 'van der Berg', suffix: '' });
  assert.deepEqual(splitName('John Smith Jr.'), { given: 'John', surname: 'Smith', suffix: 'Jr.' });
  assert.deepEqual(splitName('Anna'), { given: 'Anna', surname: '', suffix: '' });
  assert.deepEqual(splitName('Anna /Kowalski/'), { given: 'Anna', surname: 'Kowalski', suffix: '' });
  assert.deepEqual(splitName('/Nguyễn/ Thị Hoa'), { given: 'Thị Hoa', surname: 'Nguyễn', suffix: '' });
  assert.deepEqual(splitName('  '), { given: '', surname: '', suffix: '' });
});

test('fixCaps title-cases names written in capitals only', () => {
  assert.equal(fixCaps('SMITH'), 'Smith');
  assert.equal(fixCaps('VAN DER BERG'), 'van der Berg');
  assert.equal(fixCaps("O'BRIEN"), "O'Brien");
  assert.equal(fixCaps('MCDONALD'), 'McDonald');
  assert.equal(fixCaps('MACHADO'), 'Machado');
  assert.equal(fixCaps('DVOŘÁK'), 'Dvořák');
  assert.equal(fixCaps('McDonald'), 'McDonald');
  assert.equal(fixCaps('XIV'), 'XIV');
});
