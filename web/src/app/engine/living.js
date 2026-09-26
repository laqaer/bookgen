// Living-person detection and privacy-aware display. Pure JS, no DOM.
// A person is living when there is no death evidence and they were born less than 100 years
// ago. With no dates of their own, their birth is estimated from partners, children, parents
// and marriages ("living-looking" relatives), so privacy errs on the side of hiding.

import { formatYearRange } from './dates.js';

const MAX_AGE = 100;
const GEN = 28; // years per generation, for estimates

function eventYear(ev) {
  return ev && ev.date && typeof ev.date.year === 'number' ? ev.date.year : null;
}

/** True when the record shows the person died (any death, burial or cremation event). */
export function hasDied(person) {
  return !!(person && person.death);
}

/**
 * Estimate a birth year from the person's own events and their relatives in the tree.
 * @param {object} person
 * @param {object|null} tree
 * @param {number} depth recursion guard
 * @returns {number|null}
 */
export function estimateBirthYear(person, tree = null, depth = 0) {
  if (!person) return null;
  const own = eventYear(person.birth);
  if (own !== null) return own;
  if (!tree || depth > 2) return null;
  const est = [];
  const people = tree.people || {};
  const families = tree.families || {};
  for (const fid of person.fams || []) {
    const fam = families[fid];
    if (!fam) continue;
    const my = eventYear(fam.marriage);
    if (my !== null) est.push(my - 25);
    for (const pid of fam.partners) {
      if (pid === person.id) continue;
      const py = eventYear(people[pid] && people[pid].birth);
      if (py !== null) est.push(py);
    }
    for (const cid of fam.children) {
      const c = people[cid];
      const cy = c ? (eventYear(c.birth) ?? (depth < 2 ? estimateBirthYear(c, tree, depth + 1) : null)) : null;
      if (cy !== null) est.push(cy - GEN);
    }
  }
  for (const link of person.famc || []) {
    const fam = families[link.fam];
    if (!fam) continue;
    for (const pid of fam.partners) {
      const py = eventYear(people[pid] && people[pid].birth);
      if (py !== null) est.push(py + GEN);
    }
    const my = eventYear(fam.marriage);
    if (my !== null) est.push(my + 2);
  }
  if (!est.length) return null;
  // Take the earliest estimate: a marriage or a parent's birth constrains the year most tightly.
  return Math.min(...est);
}

/**
 * Is this person (probably) living?
 * @param {object} person a Person
 * @param {number} [nowYear] defaults to the current year
 * @param {object|null} [tree] optional Tree, used to estimate a missing birth year from relatives
 * @returns {boolean}
 */
export function isLiving(person, nowYear = new Date().getFullYear(), tree = null) {
  if (!person) return false;
  if (hasDied(person)) return false;
  const y = eventYear(person.birth);
  if (y !== null) return nowYear - y < MAX_AGE;
  const est = estimateBirthYear(person, tree);
  if (est !== null) return nowYear - est < MAX_AGE;
  return false;
}

/**
 * What to print for a person under a privacy mode.
 * - 'hide-dates' (default): living people keep their name and place, dates are hidden.
 * - 'living-only': living people show as "Living" with nothing else.
 * - 'show-all': everything is shown.
 * People who are not living always show everything.
 * @param {object} person
 * @param {'hide-dates'|'living-only'|'show-all'} [mode]
 * @returns {{ name: string, dates: string, place: string }}
 */
export function displayFor(person, mode = 'hide-dates') {
  if (!person) return { name: '', dates: '', place: '' };
  const name = person.name || '';
  const dates = formatYearRange(person.birth, person.death);
  const place = (person.birth && person.birth.place) || '';
  if (!person.living || mode === 'show-all') return { name, dates, place };
  if (mode === 'living-only') return { name: 'Living', dates: '', place: '' };
  return { name, dates: '', place };
}
