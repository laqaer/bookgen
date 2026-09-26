import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCountry, ALIASES, COUNTRY_NAMES, normalizePlaceKey, cleanPlace } from '../../src/app/engine/places.js';

const US_STATES = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY',
  Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
  Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District of Columbia': 'DC',
};
const IRISH_COUNTIES = ['Antrim', 'Armagh', 'Carlow', 'Cavan', 'Clare', 'Cork', 'Derry', 'Donegal', 'Down', 'Dublin', 'Fermanagh', 'Galway', 'Kerry',
  'Kildare', 'Kilkenny', 'Laois', 'Leitrim', 'Limerick', 'Longford', 'Louth', 'Mayo', 'Meath', 'Monaghan', 'Offaly', 'Roscommon', 'Sligo',
  'Tipperary', 'Tyrone', 'Waterford', 'Westmeath', 'Wexford', 'Wicklow'];
const PROVINCES = { Ontario: 'ON', Quebec: 'QC', 'British Columbia': 'BC', Alberta: 'AB', Manitoba: 'MB', Saskatchewan: 'SK', 'Nova Scotia': 'NS',
  'New Brunswick': 'NB', 'Newfoundland and Labrador': 'NL', 'Prince Edward Island': 'PE', 'Northwest Territories': 'NT', Yukon: 'YT', Nunavut: 'NU' };

const r = p => resolveCountry(p);

test('the alias table is large and well-formed', () => {
  const keys = Object.keys(ALIASES);
  assert.ok(keys.length >= 600, `only ${keys.length} aliases`);
  for (const k of keys) {
    assert.equal(k, normalizePlaceKey(k), `key not normalised: ${k}`);
    const e = ALIASES[k];
    assert.ok(e.ambiguous ? e.country === null && e.candidates.length >= 1 : typeof e.country === 'string', k);
  }
  assert.ok(COUNTRY_NAMES.length >= 150);
});

test('all 50 US states and DC, by name and USPS code', () => {
  for (const [state, code] of Object.entries(US_STATES)) {
    assert.deepEqual(r(state), { country: 'United States', region: state, ambiguous: false }, state);
    assert.deepEqual(r(`Springfield, ${code}`), { country: 'United States', region: state, ambiguous: false }, code);
    assert.deepEqual(r(`Springfield, ${state}, USA`), { country: 'United States', region: state, ambiguous: false }, `${state}, USA`);
  }
});

test('two-letter codes only match when written as codes', () => {
  assert.equal(r('Boston, MA').region, 'Massachusetts');
  assert.equal(r('Boston, Mass.').region, 'Massachusetts');
  assert.equal(r('Pittsburgh, Pa.').region, 'Pennsylvania');
  assert.equal(r('N.Y.').region, 'New York');
  assert.equal(r('Ma').country, null); // "Ma" in ordinary text is not Massachusetts
  assert.equal(r('in').country, null);
});

test('Canadian provinces, names and codes', () => {
  for (const [prov, code] of Object.entries(PROVINCES)) {
    assert.deepEqual(r(prov), { country: 'Canada', region: prov, ambiguous: false }, prov);
    assert.equal(r(`Toronto, ${code}`).region, prov, code);
  }
  assert.equal(r('Upper Canada').region, 'Ontario');
  assert.equal(r('Lower Canada').region, 'Quebec');
  assert.equal(r('Québec').region, 'Quebec');
});

test('UK nations resolve to United Kingdom with the nation as region', () => {
  for (const nation of ['England', 'Scotland', 'Wales', 'Northern Ireland']) {
    assert.deepEqual(r(nation), { country: 'United Kingdom', region: nation, ambiguous: false });
  }
  assert.deepEqual(r('Leeds, Yorkshire, England'), { country: 'United Kingdom', region: 'England', ambiguous: false });
  assert.equal(r('Cymru').region, 'Wales');
  assert.equal(r('Kensington Palace, United Kingdom').country, 'United Kingdom');
});

test('all 32 Irish counties resolve to Ireland, with County/Co. prefixes', () => {
  for (const c of IRISH_COUNTIES) {
    assert.equal(r(c).country, 'Ireland', c);
    assert.equal(r(`County ${c}`).country, 'Ireland', `County ${c}`);
    assert.equal(r(`Co. ${c}`).country, 'Ireland', `Co. ${c}`);
  }
  assert.deepEqual(r('Castlebar, County Mayo, Ireland'), { country: 'Ireland', region: 'County Mayo', ambiguous: false });
  assert.equal(r('Éire').country, 'Ireland');
});

test('native names and common spellings', () => {
  const cases = {
    Deutschland: 'Germany', Nederland: 'Netherlands', Sverige: 'Sweden', Norge: 'Norway', Polska: 'Poland', Česko: 'Czechia',
    'Česká republika': 'Czechia', Österreich: 'Austria', Schweiz: 'Switzerland', España: 'Spain', Italia: 'Italy', Magyarország: 'Hungary',
    Suomi: 'Finland', Danmark: 'Denmark', Ísland: 'Iceland', Ελλάδα: 'Greece', Россия: 'Russia', 'Việt Nam': 'Vietnam', 中国: 'China',
    日本: 'Japan', România: 'Romania', Hrvatska: 'Croatia', Türkiye: 'Turkey', Brasil: 'Brazil', 'U.S.A.': 'United States',
    'United States of America': 'United States', Holland: 'Netherlands', Sweeden: 'Sweden', 'Great Britain': 'United Kingdom',
  };
  for (const [name, country] of Object.entries(cases)) assert.equal(r(name).country, country, name);
});

test('historical states', () => {
  assert.deepEqual(r('Prussia'), { country: 'Germany', region: 'Prussia', ambiguous: false });
  assert.deepEqual(r('Kingdom of Bavaria'), { country: 'Germany', region: 'Bavaria', ambiguous: false });
  assert.deepEqual(r('Bohemia'), { country: 'Czechia', region: 'Bohemia', ambiguous: false });
  assert.equal(r('Ottoman Empire').country, 'Turkey');
  assert.equal(r('Persia').country, 'Iran');
  assert.equal(r('Ceylon').country, 'Sri Lanka');
  assert.equal(r('Deutsches Reich').country, 'Germany');
  for (const amb of ['Austria-Hungary', 'Russian Empire', 'Galicia', 'Soviet Union', 'Czechoslovakia', 'Yugoslavia', 'French Indochina']) {
    const res = r(amb);
    assert.equal(res.country, null, amb);
    assert.equal(res.ambiguous, true, amb);
    assert.ok(res.candidates.length >= 2, amb);
  }
  assert.ok(r('Austria-Hungary').candidates.includes('Czechia'));
});

test('the last part is read first, then the others right to left', () => {
  assert.deepEqual(r('Boston, Suffolk, Massachusetts, USA'), { country: 'United States', region: 'Massachusetts', ambiguous: false });
  assert.deepEqual(r('Paris, Texas'), { country: 'United States', region: 'Texas', ambiguous: false });
  assert.deepEqual(r('London, Ontario, Canada'), { country: 'Canada', region: 'Ontario', ambiguous: false });
  assert.equal(r('Bristol, Gloucestershire, England').region, 'England');
  // Ambiguous last part: a clearer part further left settles it.
  assert.deepEqual(r('Tábor, Bohemia, Austrian Empire'), { country: 'Czechia', region: 'Bohemia', ambiguous: false });
  assert.equal(r('Kraków, Galicia, Austria-Hungary').country, 'Poland');
  assert.equal(r('Lemberg, Galicia, Austria-Hungary').country, 'Ukraine');
  assert.deepEqual(r('Hải Phòng, Tonkin, French Indochina'), { country: 'Vietnam', region: 'Tonkin', ambiguous: false });
  // Nothing settles it: stays ambiguous for the user to assign.
  const amb = r('Brody, Galicia, Austria-Hungary');
  assert.equal(amb.country, null);
  assert.equal(amb.ambiguous, true);
  assert.equal(amb.region, 'Austria-Hungary');
});

test('"(now ...)" notes, empty parts and junk', () => {
  assert.equal(r('Breslau, Silesia, Prussia (now Wrocław, Poland)').country, 'Poland');
  assert.deepEqual(r(', , Cork, Ireland'), { country: 'Ireland', region: 'County Cork', ambiguous: false });
  assert.deepEqual(r(''), { country: null, region: null, ambiguous: false });
  assert.deepEqual(r(null), { country: null, region: null, ambiguous: false });
  assert.deepEqual(r('Osborne House'), { country: null, region: null, ambiguous: false });
  assert.equal(r('?, ?, Norway').country, 'Norway');
});

test('Georgia: the US state by default, the country when named as such', () => {
  assert.equal(r('Atlanta, Georgia').country, 'United States');
  assert.equal(r('Tbilisi, Republic of Georgia').country, 'Georgia');
  assert.equal(r('Sakartvelo').country, 'Georgia');
});

test('resolveCountry returns fresh objects', () => {
  const a = r('Norway');
  a.country = 'X';
  assert.equal(r('Norway').country, 'Norway');
});

test('cleanPlace trims parts and drops empty jurisdictions', () => {
  assert.equal(cleanPlace(' , ,  Cork ,Ireland '), 'Cork, Ireland');
  assert.equal(cleanPlace(''), '');
  assert.equal(normalizePlaceKey('The Netherlands'), 'netherlands');
  assert.equal(normalizePlaceKey('Ødegård'), 'odegard');
  assert.equal(normalizePlaceKey('U.S.A.'), 'usa');
});
