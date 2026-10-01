// GEDCOM viewer: the tree report, as pure functions (no DOM). Used by /tools/gedcom-viewer/ and
// tested in web/test/site/tools.test.mjs. Counts come from the engine's stats(); the data-quality
// checks below only look at what the file says. They never guess or fill anything in.

import { stats, parentsOf } from '../engine/tree.js';

/** Birthplace colors: the Atlas palette, in order (design/SYSTEM.md). */
export const ATLAS_VARS = Object.freeze(['--atlas-1', '--atlas-2', '--atlas-3', '--atlas-4', '--atlas-5', '--atlas-6', '--atlas-7']);

const yearOf = ev => (typeof ev?.date?.year === 'number' ? ev.date.year : null);
const keyOf = ev => (typeof ev?.date?.sortKey === 'number' ? ev.date.sortKey : null);

/**
 * Countries for a bar: the top 7 by count, then everything else as "Other countries".
 * @param {{ country: string, count: number }[]} countries sorted by count (engine stats())
 * @returns {{ label: string, count: number, share: number, color: string }[]}
 */
export function countryBar(countries) {
  const total = countries.reduce((s, c) => s + c.count, 0);
  if (!total) return [];
  const top = countries.slice(0, ATLAS_VARS.length).map((c, i) => ({ label: c.country, count: c.count, share: c.count / total, color: `var(${ATLAS_VARS[i]})` }));
  const rest = countries.slice(ATLAS_VARS.length);
  if (rest.length) {
    const n = rest.reduce((s, c) => s + c.count, 0);
    top.push({ label: `Other countries (${rest.length})`, count: n, share: n / total, color: 'var(--atlas-other)' });
  }
  return top;
}

/**
 * Data-quality checks. Each returns the people it found, so the page can list them.
 * @param {object} tree
 * @returns {{ id: string, title: string, why: string, ids: string[] }[]} in a fixed order; empty checks included
 */
export function qualityChecks(tree) {
  const people = Object.values(tree.people || {});
  const checks = [
    { id: 'no-birth-date', title: 'No birth date', why: 'Charts show a blank where the dates go. An estimate such as “about 1850” is better than nothing.', ids: [] },
    { id: 'no-birthplace', title: 'No birthplace', why: 'These people are left out of the birthplace colors (Atlas).', ids: [] },
    { id: 'unplaced', title: 'Birthplace not matched to a country', why: 'We could not tell which country these places are in. In the studio you can assign each one in two clicks.', ids: [] },
    { id: 'death-before-birth', title: 'Died before they were born', why: 'The death date is earlier than the birth date. One of them is probably mistyped.', ids: [] },
    { id: 'young-parent', title: 'A parent under 13 at the birth', why: 'A parent’s birth year is less than 13 years before this child’s. Often a date belongs to a different person with the same name.', ids: [] },
    { id: 'long-life', title: 'Lived more than 110 years', why: 'Birth and death dates are more than 110 years apart. Worth a second look.', ids: [] },
    { id: 'no-sex', title: 'Sex not recorded', why: 'Charts still work. Relationship names fall back to neutral words, such as \u201Cparent\u201D or \u201Csibling.\u201D', ids: [] },
    { id: 'unconnected', title: 'Not connected to anyone', why: 'No parents, partners or children in this file.', ids: [] },
    { id: 'same-name-year', title: 'Same name and birth year as someone else', why: 'Possibly the same person entered twice. Only you can tell.', ids: [] },
  ];
  const by = Object.fromEntries(checks.map(c => [c.id, c]));
  const seen = new Map();
  for (const p of people) {
    const by0 = yearOf(p.birth), dy = yearOf(p.death);
    if (by0 === null) by['no-birth-date'].ids.push(p.id);
    if (!p.birth?.place) by['no-birthplace'].ids.push(p.id);
    else if (!p.birth.country) by.unplaced.ids.push(p.id);
    const bk = keyOf(p.birth), dk = keyOf(p.death);
    if (bk !== null && dk !== null && dk < bk && !(p.death?.date?.qualifier) && !(p.birth?.date?.qualifier)) by['death-before-birth'].ids.push(p.id);
    if (by0 !== null && dy !== null && dy - by0 > 110) by['long-life'].ids.push(p.id);
    if (p.sex !== 'M' && p.sex !== 'F') by['no-sex'].ids.push(p.id);
    if (!(p.famc || []).length && !(p.fams || []).length) by.unconnected.ids.push(p.id);
    if (by0 !== null) {
      const { father, mother } = parentsOf(tree, p.id);
      for (const par of [father, mother]) {
        const py = par ? yearOf(tree.people[par]?.birth) : null;
        if (py !== null && by0 - py < 13) { by['young-parent'].ids.push(p.id); break; }
      }
    }
    const nm = String(p.name || '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
    if (nm && by0 !== null) {
      const k = `${nm}|${by0}`;
      if (!seen.has(k)) seen.set(k, []);
      seen.get(k).push(p.id);
    }
  }
  for (const ids of seen.values()) if (ids.length > 1) by['same-name-year'].ids.push(...ids);
  return checks;
}

/**
 * Everything the viewer shows, in one object.
 * @param {object} tree
 * @returns {object}
 */
export function treeReport(tree) {
  const s = stats(tree);
  const checks = qualityChecks(tree);
  const root = s.rootId ? tree.people[s.rootId] : null;
  return {
    people: s.people,
    families: s.families,
    males: s.males, females: s.females, unknownSex: s.unknownSex,
    living: s.living,
    earliestYear: s.earliestYear, latestYear: s.latestYear,
    withBirthYear: s.withBirthYear, withBirthPlace: s.withBirthPlace,
    surnames: s.surnames,
    countries: s.countries,
    countryBar: countryBar(s.countries),
    places: s.places,
    root: root ? { id: root.id, name: root.name } : null,
    generations: s.generations,
    fill: s.fill,
    checks,
    issues: checks.reduce((n, c) => n + c.ids.length, 0),
    source: tree.meta?.source || '',
    version: tree.meta?.version || '',
    charset: tree.meta?.charset || '',
    warnings: (tree.meta?.warnings || []).slice(0, 20),
  };
}

/** "1,234" */
export const fmt = n => Math.round(n).toLocaleString('en-US');

/** "38%" from a 0..1 share, "less than 1%" for tiny non-zero shares. */
export function pct(share) {
  if (share > 0 && share < 0.005) return 'less than 1%';
  return `${Math.round(share * 100)}%`;
}

/** Sort people for the list: surname, then given names, then birth year. */
export function sortPeople(list) {
  return [...list].sort((a, b) => (a.surname || '￿').localeCompare(b.surname || '￿') || (a.given || '').localeCompare(b.given || '') || (yearOf(a.birth) ?? 9999) - (yearOf(b.birth) ?? 9999));
}
