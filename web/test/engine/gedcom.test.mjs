import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGedcom, parseNameValue, cleanId } from '../../src/app/engine/gedcom.js';
import { parentsOf } from '../../src/app/engine/tree.js';
import { fixtureBytes } from './helpers.mjs';

const G = lines => lines.join('\n');
const BASIC = G([
  '0 HEAD', '1 GEDC', '2 VERS 5.5.1', '1 CHAR UTF-8',
  '0 @I1@ INDI', '1 NAME John /Smith/', '1 SEX M', '1 BIRT', '2 DATE 1 JAN 1900', '2 PLAC Boston, Suffolk, Massachusetts, USA', '1 FAMC @F1@',
  '0 @I2@ INDI', '1 NAME William /Smith/', '1 SEX M', '1 DEAT', '2 DATE 1950', '1 FAMS @F1@',
  '0 @I3@ INDI', '1 NAME Mary /Jones/', '1 SEX F', '1 FAMS @F1@',
  '0 @F1@ FAM', '1 HUSB @I2@', '1 WIFE @I3@', '1 CHIL @I1@', '1 MARR', '2 DATE 1898', '2 PLAC Cork, Ireland',
  '0 TRLR', '',
]);

test('basic structure matches the contract', () => {
  const t = parseGedcom(BASIC, { nowYear: 2026 });
  assert.deepEqual(Object.keys(t.people), ['I1', 'I2', 'I3']);
  const p = t.people.I1;
  assert.equal(p.id, 'I1');
  assert.equal(p.given, 'John');
  assert.equal(p.surname, 'Smith');
  assert.equal(p.name, 'John Smith');
  assert.equal(p.suffix, '');
  assert.equal(p.sex, 'M');
  assert.equal(p.birth.date.display, '1 Jan 1900');
  assert.equal(p.birth.place, 'Boston, Suffolk, Massachusetts, USA');
  assert.equal(p.birth.country, 'United States');
  assert.equal(p.death, null);
  assert.equal(p.living, false);
  assert.deepEqual(p.famc, [{ fam: 'F1', pedi: 'birth' }]);
  assert.deepEqual(p.fams, []);
  const f = t.families.F1;
  assert.deepEqual(f.partners, ['I2', 'I3']);
  assert.deepEqual(f.children, ['I1']);
  assert.equal(f.marriage.date.year, 1898);
  assert.equal(f.marriage.country, 'Ireland');
  assert.deepEqual(t.meta, { source: '', version: '5.5.1', charset: 'UTF-8', count: 3, homeId: null, warnings: [] });
});

test('the tree is plain JSON (survives structuredClone and JSON)', () => {
  const t = parseGedcom(fixtureBytes('edge-cases.ged'));
  assert.deepEqual(structuredClone(t), t);
  assert.deepEqual(JSON.parse(JSON.stringify(t)), t);
});

test('string, Uint8Array and ArrayBuffer inputs give the same tree', () => {
  const bytes = new TextEncoder().encode(BASIC);
  const a = parseGedcom(BASIC, { nowYear: 2026 });
  const b = parseGedcom(bytes, { nowYear: 2026 });
  const c = parseGedcom(bytes.buffer, { nowYear: 2026 });
  assert.deepEqual(b, a);
  assert.deepEqual(c, a);
});

test('LF, CRLF, CR-only and mixed line endings are equivalent', () => {
  const base = parseGedcom(BASIC, { nowYear: 2026 });
  const lines = BASIC.split('\n');
  assert.deepEqual(parseGedcom(lines.join('\r\n'), { nowYear: 2026 }), base);
  assert.deepEqual(parseGedcom(lines.join('\r'), { nowYear: 2026 }), base);
  assert.deepEqual(parseGedcom(lines.map((l, i) => l + ['\n', '\r\n', '\r'][i % 3]).join(''), { nowYear: 2026 }), base);
});

test('CONC and CONT, including a NAME split across lines', () => {
  const t = parseGedcom(fixtureBytes('edge-cases.ged'));
  assert.equal(t.people.E90.name, 'Johann Georg Friedrich Weber'); // "Fried" + CONC "rich", /WEBER/ title-cased
  const text = G(['0 HEAD', '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 PLAC Cork,', '3 CONC  Ireland', '0 TRLR']);
  assert.equal(parseGedcom(text).people.I1.birth.place, 'Cork, Ireland');
});

test('tolerant: level jumps, trailing spaces, blank and junk lines, leading spaces', () => {
  const t = parseGedcom(fixtureBytes('edge-cases.ged'));
  const w = t.people.E90;
  assert.equal(w.sex, 'M'); // "1 SEX M   "
  assert.equal(w.birth.date.display, '11 Feb 1731/32'); // "3 DATE" under "1 BIRT" (level jump)
  assert.equal(w.birth.place, 'Ansbach, Kingdom of Bavaria');
  assert.equal(w.birth.country, 'Germany');
  assert.ok(t.meta.warnings.some(x => /could not be read/.test(x)));
  const indented = G(['  0 HEAD', '  0 @I1@ INDI', '    1 NAME Indented /Person/', '\t1 SEX F', '0 TRLR']);
  const ti = parseGedcom(indented);
  assert.equal(ti.people.I1.name, 'Indented Person');
  assert.equal(ti.people.I1.sex, 'F');
});

test('vendor _TAGS, sources, notes and media are ignored without harm', () => {
  const t = parseGedcom(fixtureBytes('ancestry-style.ged'));
  assert.equal(t.meta.count, 10);
  assert.equal(t.meta.source, 'Ancestry.com Member Trees');
  assert.deepEqual(t.meta.warnings, []);
  const m = t.people.I282046532844;
  assert.equal(m.name, 'Michael Stanley Kowalczyk');
  assert.equal(m.birth.date.display, '19 Jun 1955');
  assert.equal(t.people.I282046532845.birth.date.qualifier, 'ABT'); // "abt 1957"
  assert.equal(t.people.I282046532847.birth.date.qualifier, 'BEF'); // "Bef. 1925"
});

test('Ancestry-style _FREL/_MREL adoption and "Living" placeholder names', () => {
  const t = parseGedcom(fixtureBytes('ancestry-style.ged'), { nowYear: 2026 });
  const adopted = t.people.I282046532852;
  assert.deepEqual(adopted.famc, [{ fam: 'F12', pedi: 'adopted' }]);
  assert.equal(adopted.given, '');
  assert.equal(adopted.name, 'Kowalczyk');
  assert.equal(adopted.living, true);
  assert.deepEqual(t.people.I282046532843.famc, [{ fam: 'F12', pedi: 'birth' }]);
  assert.equal(t.people.I282046532846.birth.country, 'Poland'); // Kraków, Galicia, Austria-Hungary
});

test('MyHeritage-style export: SUBM name gives the home person; _UPD/_UID/RIN ignored', () => {
  const t = parseGedcom(fixtureBytes('myheritage-style.ged'));
  assert.equal(t.meta.homeId, 'I2');
  assert.equal(t.meta.source, 'MyHeritage Family Tree Builder');
  assert.equal(t.people.I3.name, 'Ewa Kamińska'); // birth name, not the _MARNM
  assert.equal(t.people.I1.birth.country, 'Poland');
  assert.equal(t.people.I5.birth.country, 'Germany'); // Gniezno, Posen, Deutsches Reich (1917): the file's own words win
});

test('GEDCOM 7: no CHAR, @VOID@, SCHMA, PHRASE, SEX X, calendars, SNOTE, adoption', () => {
  const t = parseGedcom(fixtureBytes('gedcom7.ged'), { nowYear: 2026 });
  assert.equal(t.meta.version, '7.0');
  assert.equal(t.meta.charset, 'UTF-8');
  assert.deepEqual(t.meta.warnings, []);
  assert.deepEqual(t.families.F2.partners, ['I4']); // HUSB @VOID@ dropped
  assert.deepEqual(parentsOf(t, 'I2'), { father: null, mother: 'I4', family: 'F2', pedi: 'birth' });
  assert.equal(t.people.I5.sex, 'U');
  assert.equal(t.people.I5.birth.date.calendar, 'french');
  assert.equal(t.people.I5.death.date.calendar, 'julian');
  assert.equal(t.people.I4.birth.date.display, '1930–1935');
  assert.equal(t.people.I2.death.date, null); // "1 DEAT Y"
  assert.equal(t.people.I2.living, false);
  assert.deepEqual(t.people.I6.famc, [{ fam: 'F3', pedi: 'adopted' }]);
  assert.equal(t.people.I1.name, 'Élodie Martin');
});

test('GEDCOM 7 TRAN: a Latin-script translation becomes the romanised form', () => {
  const t = parseGedcom(G(['0 HEAD', '1 GEDC', '2 VERS 7.0',
    '0 @I1@ INDI', '1 NAME Κωνσταντίνος /Παπαδόπουλος/', '2 TRAN Konstantinos /Papadopoulos/', '3 LANG el-Latn',
    '0 @I2@ INDI', '1 NAME Aiko /Tanaka/', '2 TRAN 田中 /愛子/', '3 LANG ja',
    '0 TRLR']));
  assert.equal(t.people.I1.romanized, 'Konstantinos Papadopoulos');
  assert.equal(t.people.I2.romanized, undefined);
});

test('same-sex couple: both partners kept in file order', () => {
  const t = parseGedcom(fixtureBytes('edge-cases.ged'));
  assert.deepEqual(t.families.F10.partners, ['E20', 'E21']);
  assert.deepEqual(parentsOf(t, 'E1'), { father: 'E20', mother: 'E21', family: 'F10', pedi: 'birth' });
});

test('adoption: PEDI and ADOP recorded on famc', () => {
  const t = parseGedcom(fixtureBytes('edge-cases.ged'));
  assert.deepEqual(t.people.E30.famc, [{ fam: 'F31', pedi: 'birth' }, { fam: 'F32', pedi: 'adopted' }]);
});

test('multiple marriages and missing sex', () => {
  const t = parseGedcom(fixtureBytes('edge-cases.ged'));
  assert.deepEqual(t.people.E40.fams, ['F41', 'F42']);
  assert.equal(t.people.E51.sex, 'U');
  assert.equal(t.people.E50.sex, 'U');
  // A lone WIFE with unknown sex still fills the mother slot.
  assert.deepEqual(parentsOf(t, 'E50'), { father: null, mother: 'E51', family: 'F51', pedi: 'birth' });
});

test('CJK and Hebrew names, with romanised forms', () => {
  const t = parseGedcom(fixtureBytes('edge-cases.ged'));
  assert.equal(t.people.E80.name, '王秀英');
  assert.equal(t.people.E80.surname, '王');
  assert.equal(t.people.E80.romanized, 'Xiuying Wang');
  assert.equal(t.people.E80.birth.country, 'China');
  assert.equal(t.people.E81.name, 'שרה לוי');
  assert.equal(t.people.E81.romanized, 'Sarah Levi');
  assert.equal(t.people.E81.birth.date.calendar, 'hebrew');
});

test('placeholder names, burial as death, records without ids, dangling links', () => {
  const t = parseGedcom(fixtureBytes('edge-cases.ged'));
  assert.equal(t.people.E91.given, '');
  assert.equal(t.people.E91.name, 'Weber');
  assert.equal(t.people.E91.birth.country, 'Poland'); // (now Wrocław, Poland)
  assert.equal(t.people.E92.name, '');
  assert.equal(t.people.E93.death.tag, 'BURI');
  assert.equal(t.people.E93.death.date.year, 1921);
  assert.ok(Object.values(t.people).some(p => p.name === 'Nobody Noid' && p.id.startsWith('IAUTO')));
  assert.deepEqual(t.people.E90.famc, []); // @F999@ does not exist
  assert.ok(t.meta.warnings.some(w => /family that is not in the file/.test(w)));
  assert.ok(t.meta.warnings.some(w => /had no id/.test(w)));
});

test('one-sided links are repaired in both directions', () => {
  const text = G([
    '0 HEAD',
    '0 @C@ INDI', '1 NAME Kid /A/', '1 FAMC @F@',       // only the child points to F
    '0 @P@ INDI', '1 NAME Pa /A/', '1 SEX M',           // only F points to P
    '0 @M@ INDI', '1 NAME Ma /A/', '1 SEX F', '1 FAMS @F@',
    '0 @F@ FAM', '1 HUSB @P@', '1 HUSB @GHOST@',
    '0 TRLR',
  ]);
  const t = parseGedcom(text);
  assert.deepEqual(t.families.F.children, ['C']);
  assert.deepEqual(t.families.F.partners, ['P', 'M']);
  assert.deepEqual(t.people.P.fams, ['F']);
  assert.ok(t.meta.warnings.some(w => /person who is not in the file/.test(w)));
});

test('duplicate ids keep the first record', () => {
  const t = parseGedcom(G(['0 HEAD', '0 @I1@ INDI', '1 NAME First /One/', '0 @I1@ INDI', '1 NAME Second /One/', '0 TRLR']));
  assert.equal(t.people.I1.name, 'First One');
  assert.ok(t.meta.warnings.some(w => /more than once/.test(w)));
});

test('HEAD _HOME, SUBM pointers and ANCI give the home person', () => {
  const home = parseGedcom(G(['0 HEAD', '1 _HOME @I2@', '0 @I1@ INDI', '1 NAME A /A/', '0 @I2@ INDI', '1 NAME B /B/', '0 TRLR']));
  assert.equal(home.meta.homeId, 'I2');
  const subm = parseGedcom(G(['0 HEAD', '1 SUBM @S1@', '0 @S1@ SUBM', '1 NAME Someone', '1 _HOME @I1@', '0 @I1@ INDI', '1 NAME A /A/', '0 TRLR']));
  assert.equal(subm.meta.homeId, 'I1');
  const anci = parseGedcom(G(['0 HEAD', '0 @I1@ INDI', '1 NAME A /A/', '0 @I2@ INDI', '1 NAME B /B/', '1 ANCI @S1@', '0 @S1@ SUBM', '1 NAME X', '0 TRLR']));
  assert.equal(anci.meta.homeId, 'I2');
  const bad = parseGedcom(G(['0 HEAD', '1 _HOME @NOPE@', '0 @I1@ INDI', '1 NAME A /A/', '0 TRLR']));
  assert.equal(bad.meta.homeId, null);
});

test('ALL CAPS names are title-cased; NAME TYPE prefers the birth name', () => {
  const t = parseGedcom(G(['0 HEAD', '0 @I1@ INDI', '1 NAME Mary /SMITH/', '2 TYPE married', '1 NAME MARY ELLEN /O\'BRIEN/', '2 TYPE birth', '0 TRLR']));
  assert.equal(t.people.I1.name, "Mary Ellen O'Brien");
});

test('GIVN/SURN sub-tags fill an empty or slash-less NAME', () => {
  const t = parseGedcom(G(['0 HEAD',
    '0 @I1@ INDI', '1 NAME', '2 GIVN Anna', '2 SURN Nowak',
    '0 @I2@ INDI', '1 NAME Jan Kowalski', '2 GIVN Jan', '2 SURN Kowalski',
    '0 @I3@ INDI', '1 NAME /Smith/ Jr.',
    '0 TRLR']));
  assert.deepEqual([t.people.I1.given, t.people.I1.surname, t.people.I1.name], ['Anna', 'Nowak', 'Anna Nowak']);
  assert.deepEqual([t.people.I2.given, t.people.I2.surname], ['Jan', 'Kowalski']);
  assert.deepEqual([t.people.I3.surname, t.people.I3.suffix, t.people.I3.name], ['Smith', 'Jr.', 'Smith Jr.']);
});

test('christening fills in for a missing birth date', () => {
  const t = parseGedcom(G(['0 HEAD', '0 @I1@ INDI', '1 NAME A /B/', '1 BIRT', '2 PLAC Cork', '1 CHR', '2 DATE 3 MAR 1801', '2 PLAC Cork', '0 TRLR']));
  assert.equal(t.people.I1.birth.tag, 'CHR');
  assert.equal(t.people.I1.birth.date.year, 1801);
});

test('never throws: empty input, binary junk, non-GEDCOM text', () => {
  for (const input of ['', new Uint8Array(0), new Uint8Array([0, 1, 2, 255, 254, 13, 10]), 'Hello, this is a letter.\nNot a family tree.', undefined, null]) {
    const t = parseGedcom(input);
    assert.equal(t.meta.count, 0);
    assert.ok(t.meta.warnings.length >= 1);
  }
});

test('hostile record ids ("__proto__", "constructor") are ordinary keys', () => {
  const t = parseGedcom(G(['0 HEAD', '0 @__proto__@ INDI', '1 NAME Evil /One/', '1 FAMS @constructor@', '0 @constructor@ FAM', '1 HUSB @__proto__@',
    '1 CHIL @toString@', '0 @toString@ INDI', '1 NAME Two /Strings/', '1 FAMC @valueOf@', '0 TRLR']));
  assert.deepEqual(Object.keys(t.people), ['__proto__', 'toString']);
  assert.equal(Object.getPrototypeOf(t.people), Object.prototype);
  assert.equal(t.people.__proto__.name, 'Evil One'); // eslint-disable-line no-proto
  assert.deepEqual(t.families.constructor.partners, ['__proto__']);
  assert.deepEqual(t.people.toString.famc, [{ fam: 'constructor', pedi: 'birth' }]);
  assert.deepEqual(parentsOf(t, 'toString').father, '__proto__');
  assert.deepEqual(parentsOf(t, 'valueOf'), { father: null, mother: null, family: null, pedi: null });
  assert.deepEqual(JSON.parse(JSON.stringify(t)).people.__proto__.name, 'Evil One'); // eslint-disable-line no-proto
});

test('helpers: parseNameValue and cleanId', () => {
  assert.deepEqual(parseNameValue('John /Smith/ Jr.'), { given: 'John', surname: 'Smith', suffix: 'Jr.', surnameFirst: false, hadSlashes: true });
  assert.deepEqual(parseNameValue('/Nguyễn/ Thị Hoa'), { given: 'Thị Hoa', surname: 'Nguyễn', suffix: '', surnameFirst: true, hadSlashes: true });
  assert.deepEqual(parseNameValue('Prince Edward, Duke of Kent'), { given: 'Prince Edward, Duke of Kent', surname: '', suffix: '', surnameFirst: false, hadSlashes: false });
  assert.deepEqual(parseNameValue('John /Smith'), { given: 'John', surname: 'Smith', suffix: '', surnameFirst: false, hadSlashes: true });
  assert.equal(cleanId('@I12@'), 'I12');
  assert.equal(cleanId('I12'), 'I12');
});
