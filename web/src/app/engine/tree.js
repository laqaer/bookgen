// Family model queries: ancestors (Ahnentafel), pedigree collapse, parents, search, root
// suggestion, statistics, relationships (cousin calculator) and edit overrides.
// Pure JS, no DOM. Works on the plain-JSON Tree produced by gedcom.js or builder.js.

import { parseDate, formatYearRange } from './dates.js';
import { resolveCountry, cleanPlace } from './places.js';
import { isLiving } from './living.js';
import { splitName } from './names.js';

/** Accept "I1" or "@I1@". */
const own = (obj, k) => Object.prototype.hasOwnProperty.call(obj, k);

function normId(tree, id) {
  if (!id || !tree || !tree.people) return null;
  if (own(tree.people, id)) return id;
  const s = String(id).trim().replace(/^@(.+)@$/, '$1');
  return own(tree.people, s) ? s : null;
}

function fold(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036F]/g, '')
    .replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae').replace(/ß/g, 'ss').replace(/[đĐ]/g, 'd').replace(/[łŁ]/g, 'l')
    .toLowerCase();
}

function wantsAdoptive(opt, id) {
  if (!opt) return false;
  if (opt === true) return true;
  if (typeof opt === 'function') return !!opt(id);
  if (opt instanceof Set) return opt.has(id);
  if (Array.isArray(opt)) return opt.includes(id);
  if (typeof opt === 'object') return !!opt[id];
  return false;
}

const RANK_BIRTH = { birth: 0, unknown: 1, adopted: 2, foster: 3, step: 4 };
const RANK_ADOPTIVE = { adopted: 0, foster: 1, step: 2, birth: 3, unknown: 4 };

/** Choose the family whose partners count as this person's parents. */
function pickParentFamily(tree, person, adoptive) {
  let best = null, bestRank = Infinity;
  const rank = adoptive ? RANK_ADOPTIVE : RANK_BIRTH;
  for (const link of person.famc || []) {
    const fam = own(tree.families, link.fam) ? tree.families[link.fam] : null;
    if (!fam || !fam.partners.length) continue;
    const r = rank[link.pedi] ?? 5;
    if (r < bestRank) { best = { fam, pedi: link.pedi }; bestRank = r; }
  }
  return best;
}

/**
 * Parents of a person. Birth parents by default; `adoptive` (true, or a Set/array/object/function
 * of person ids) switches to adoptive parents. For same-sex parents the first partner fills the
 * father slot (left, "paternal side") and the second the mother slot. Hidden people are left out.
 * @param {object} tree
 * @param {string} id
 * @param {{ adoptive?: boolean|Set<string>|string[]|Record<string, boolean>|((id: string) => boolean) }} [opts]
 * @returns {{ father: string|null, mother: string|null, family: string|null, pedi: string|null }}
 */
export function parentsOf(tree, id, opts = {}) {
  const pid = normId(tree, id);
  const none = { father: null, mother: null, family: null, pedi: null };
  if (!pid) return none;
  const person = tree.people[pid];
  const pick = pickParentFamily(tree, person, wantsAdoptive(opts.adoptive, pid));
  if (!pick) return none;
  const { fam, pedi } = pick;
  let father = null, mother = null;
  const ps = fam.partners.filter(x => own(tree.people, x));
  if (ps.length >= 2) { father = ps[0]; mother = ps[1]; }
  else if (ps.length === 1) {
    const q = tree.people[ps[0]];
    const role = fam.roles ? fam.roles[fam.partners.indexOf(ps[0])] : null;
    if (q.sex === 'F' || (q.sex !== 'M' && role === 'WIFE')) mother = ps[0];
    else father = ps[0];
  }
  if (father && tree.people[father].hidden) father = null;
  if (mother && tree.people[mother].hidden) mother = null;
  return { father, mother, family: fam.id, pedi };
}

/**
 * Ancestors of rootId as an Ahnentafel map: 1 = root, 2n = father (first parent), 2n+1 = mother.
 * Generation g holds numbers 2^(g-1) … 2^g − 1. A person reached twice (pedigree collapse)
 * appears under every number.
 * @param {object} tree
 * @param {string} rootId
 * @param {number} [gens] generations including the root (default 8, max 30)
 * @param {{ adoptive?: any }} [opts]
 * @returns {Map<number, string>}
 */
export function ancestors(tree, rootId, gens = 8, opts = {}) {
  const map = new Map();
  const root = normId(tree, rootId);
  if (!root) return map;
  const G = Math.max(1, Math.min(30, Math.floor(gens) || 1));
  map.set(1, root);
  const queue = [[1, root, 1]];
  const cache = new Map();
  for (let qi = 0; qi < queue.length; qi++) {
    const [a, id, g] = queue[qi];
    if (g >= G) continue;
    let par = cache.get(id);
    if (!par) { par = parentsOf(tree, id, opts); cache.set(id, par); }
    if (par.father) { map.set(2 * a, par.father); queue.push([2 * a, par.father, g + 1]); }
    if (par.mother) { map.set(2 * a + 1, par.mother); queue.push([2 * a + 1, par.mother, g + 1]); }
  }
  return new Map([...map.entries()].sort((x, y) => x[0] - y[0]));
}

/**
 * Pedigree collapse: people who appear under more than one Ahnentafel number.
 * @param {Map<number, string>} ahnenMap
 * @returns {Map<string, number[]>} personId -> sorted numbers (only people appearing 2+ times)
 */
export function collapse(ahnenMap) {
  const inv = new Map();
  for (const [a, id] of ahnenMap) {
    let arr = inv.get(id);
    if (!arr) { arr = []; inv.set(id, arr); }
    arr.push(a);
  }
  const out = new Map();
  for (const [id, arr] of inv) if (arr.length > 1) out.set(id, arr.sort((x, y) => x - y));
  return out;
}

/** Generation of an Ahnentafel number (1 -> 1, 2..3 -> 2, 4..7 -> 3). */
export function generationOf(ahnen) {
  return Math.floor(Math.log2(ahnen)) + 1;
}

/**
 * Fraction of slots filled in each generation (index 0 = generation 1).
 * @returns {number[]}
 */
export function generationFill(tree, rootId, gens = 8, opts = {}) {
  const map = ancestors(tree, rootId, gens, opts);
  const counts = new Array(gens).fill(0);
  for (const a of map.keys()) counts[generationOf(a) - 1]++;
  return counts.map((c, i) => c / 2 ** i);
}

/**
 * Auto depth: the deepest generation that is at least 25% filled, capped.
 * @returns {number}
 */
export function autoGenerations(tree, rootId, cap = 8, opts = {}) {
  const fill = generationFill(tree, rootId, cap, opts);
  let best = 1;
  fill.forEach((f, i) => { if (f >= 0.25) best = i + 1; });
  return best;
}

// ---- Search -------------------------------------------------------------------------------

const searchIndex = new WeakMap();

function indexFor(tree) {
  let idx = searchIndex.get(tree.people);
  if (idx) return idx;
  idx = [];
  for (const id in tree.people) {
    const p = tree.people[id];
    const text = fold([p.name, p.given, p.surname, p.romanized].filter(Boolean).join(' '));
    const tokens = [...new Set(text.split(/[^\p{L}\p{N}]+/u).filter(Boolean))];
    const years = [p.birth?.date?.year, p.death?.date?.year].filter(y => typeof y === 'number').map(String);
    idx.push({ id, full: fold(p.name), tokens, years, surname: fold(p.surname), idKey: id.toLowerCase() });
  }
  searchIndex.set(tree.people, idx);
  return idx;
}

/**
 * Type-ahead search over names (accent- and case-insensitive, token prefixes), years and ids.
 * "weber 1791" finds Johann Weber born 1791. Results are Person objects plus `years` and `score`.
 * @param {object} tree
 * @param {string} q
 * @param {number} [limit]
 * @returns {Array<object>}
 */
export function searchPeople(tree, q, limit = 20) {
  if (!tree || !tree.people) return [];
  const query = fold(q).trim();
  if (!query) return [];
  const qTokens = query.split(/[^\p{L}\p{N}@]+/u).filter(Boolean);
  const idq = query.replace(/@/g, '');
  const results = [];
  for (const e of indexFor(tree)) {
    let score = 0;
    let ok = true;
    for (const t of qTokens) {
      if (/^\d{3,4}$/.test(t)) {
        if (e.years.some(y => y === t)) score += 4;
        else if (e.years.some(y => y.startsWith(t))) score += 2;
        else if (e.idKey === t.toLowerCase()) score += 5;
        else { ok = false; break; }
        continue;
      }
      let best = 0;
      for (const tok of e.tokens) {
        if (tok === t) { best = 3; break; }
        if (tok.startsWith(t)) best = Math.max(best, 2);
        else if (t.length >= 3 && tok.includes(t)) best = Math.max(best, 1);
      }
      if (!best && e.idKey === t.toLowerCase().replace(/@/g, '')) best = 5;
      if (!best) { ok = false; break; }
      score += best;
    }
    if (!ok) {
      if (e.idKey === idq) score = 10; else continue;
    }
    if (e.full === query) score += 6;
    else if (e.full.startsWith(query)) score += 3;
    if (e.surname && qTokens.includes(e.surname)) score += 1;
    results.push({ id: e.id, score, key: e.full });
  }
  results.sort((a, b) => b.score - a.score || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return results.slice(0, Math.max(0, limit)).map(r => {
    const p = tree.people[r.id];
    return { ...p, years: formatYearRange(p.birth, p.death), score: r.score };
  });
}

// ---- Root suggestion ------------------------------------------------------------------------

/**
 * Suggest a starting person: the file's home person (HEAD _HOME, SUBM link, ANCI) when present,
 * otherwise the person with the most known ancestors (8 generations), youngest first on ties.
 * @param {object} tree
 * @returns {string|null}
 */
export function suggestRoot(tree) {
  if (!tree || !tree.people) return null;
  const home = tree.meta && tree.meta.homeId;
  if (home && own(tree.people, home)) return home;
  const ids = Object.keys(tree.people);
  if (!ids.length) return null;
  const idx = new Map(ids.map((id, i) => [id, i]));
  const fa = new Int32Array(ids.length).fill(-1);
  const mo = new Int32Array(ids.length).fill(-1);
  ids.forEach((id, i) => {
    const par = parentsOf(tree, id);
    if (par.father) fa[i] = idx.get(par.father);
    if (par.mother) mo[i] = idx.get(par.mother);
  });
  // slots_d(p) = 1 + slots_{d-1}(father) + slots_{d-1}(mother); 8 generations.
  let prev = new Float64Array(ids.length); // d = 0 -> 0
  for (let d = 1; d <= 8; d++) {
    const cur = new Float64Array(ids.length);
    for (let i = 0; i < ids.length; i++) cur[i] = 1 + (fa[i] >= 0 ? prev[fa[i]] : 0) + (mo[i] >= 0 ? prev[mo[i]] : 0);
    prev = cur;
  }
  let best = 0;
  const year = i => tree.people[ids[i]].birth?.date?.year ?? -Infinity;
  for (let i = 1; i < ids.length; i++) {
    if (prev[i] > prev[best] || (prev[i] === prev[best] && year(i) > year(best))) best = i;
  }
  return ids[best];
}

// ---- Statistics -----------------------------------------------------------------------------

/**
 * Summary numbers for the file: counts, date span, surnames, birth countries, place coverage,
 * and the suggested root with its generation depth and fill.
 * @param {object} tree
 * @returns {object}
 */
export function stats(tree) {
  const s = {
    people: 0, families: Object.keys(tree.families || {}).length, males: 0, females: 0, unknownSex: 0, living: 0,
    withBirthYear: 0, withBirthPlace: 0, earliestYear: null, latestYear: null,
    surnames: [], countries: [],
    places: { total: 0, resolved: 0, ambiguous: 0, unresolved: [] },
    rootId: null, generations: 0, fill: [],
  };
  const surnames = new Map(), countries = new Map(), unresolved = new Map();
  for (const id in tree.people) {
    const p = tree.people[id];
    s.people++;
    if (p.sex === 'M') s.males++; else if (p.sex === 'F') s.females++; else s.unknownSex++;
    if (p.living) s.living++;
    for (const ev of [p.birth, p.death]) {
      const y = ev?.date?.year;
      if (typeof y === 'number') {
        if (s.earliestYear === null || y < s.earliestYear) s.earliestYear = y;
        if (s.latestYear === null || y > s.latestYear) s.latestYear = y;
      }
    }
    if (typeof p.birth?.date?.year === 'number') s.withBirthYear++;
    if (p.birth?.place) {
      s.withBirthPlace++;
      s.places.total++;
      const country = p.birth.country !== undefined && p.birth.country !== null ? p.birth.country : resolveCountry(p.birth.place).country;
      if (country) { s.places.resolved++; countries.set(country, (countries.get(country) || 0) + 1); }
      else {
        if (resolveCountry(p.birth.place).ambiguous) s.places.ambiguous++;
        unresolved.set(p.birth.place, (unresolved.get(p.birth.place) || 0) + 1);
      }
    }
    if (p.surname) surnames.set(p.surname, (surnames.get(p.surname) || 0) + 1);
  }
  const top = (m, key, n) => [...m.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))).slice(0, n).map(([k, v]) => ({ [key]: k, count: v }));
  s.surnames = top(surnames, 'surname', 10);
  s.countries = top(countries, 'country', 50);
  s.places.unresolved = top(unresolved, 'place', 50);
  s.rootId = suggestRoot(tree);
  if (s.rootId) {
    const map = ancestors(tree, s.rootId, 30);
    let maxG = 0;
    for (const a of map.keys()) maxG = Math.max(maxG, generationOf(a));
    s.generations = maxG;
    const counts = new Array(Math.min(maxG, 12)).fill(0);
    for (const a of map.keys()) { const g = generationOf(a); if (g <= counts.length) counts[g - 1]++; }
    s.fill = counts.map((c, i) => Math.round((c / 2 ** i) * 1000) / 1000);
  }
  return s;
}

// ---- Relationships --------------------------------------------------------------------------

const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
function ordinalWord(n) { return ORD[n] || `${n}th`; }
function ordinalNum(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function timesRemoved(k) {
  return k === 1 ? 'once removed' : k === 2 ? 'twice removed' : `${k} times removed`;
}
function gendered(sex, m, f, n) { return sex === 'M' ? m : sex === 'F' ? f : n; }

/** "great-" prefixes: 0 -> '', 1 -> 'great-', 2 -> 'great-great-', 3 -> '3rd great-'. */
function greats(k) {
  if (k <= 0) return '';
  if (k <= 2) return 'great-'.repeat(k);
  return `${ordinalNum(k)} great-`;
}

/**
 * Name the relationship of B to A, given generations up from each to the common ancestor.
 * @param {number} upA generations from A up to the common ancestor
 * @param {number} upB generations from B up to the common ancestor
 * @param {'M'|'F'|'U'} sexB
 * @param {boolean} half
 * @returns {string}
 */
export function relationshipLabel(upA, upB, sexB = 'U', half = false) {
  const h = half ? 'half-' : '';
  if (upA === 0 && upB === 0) return 'self';
  if (upA === 0) {
    // B descends from A.
    if (upB === 1) return gendered(sexB, 'son', 'daughter', 'child');
    return greats(upB - 2) + gendered(sexB, 'grandson', 'granddaughter', 'grandchild');
  }
  if (upB === 0) {
    if (upA === 1) return gendered(sexB, 'father', 'mother', 'parent');
    return greats(upA - 2) + gendered(sexB, 'grandfather', 'grandmother', 'grandparent');
  }
  if (upA === 1 && upB === 1) return h + gendered(sexB, 'brother', 'sister', 'sibling');
  if (upA === 1) {
    // B descends from A's sibling.
    const pre = upB === 2 ? '' : greats(upB - 3) + 'grand';
    return h + gendered(sexB, `${pre}nephew`, `${pre}niece`, `${pre}niece or ${pre}nephew`);
  }
  if (upB === 1) {
    // B is a sibling of A's ancestor.
    const pre = upA === 2 ? '' : greats(upA - 3) + 'grand';
    return h + gendered(sexB, `${pre}uncle`, `${pre}aunt`, `${pre}aunt or ${pre}uncle`);
  }
  const degree = Math.min(upA, upB) - 1;
  const removed = Math.abs(upA - upB);
  return (half ? 'half ' : '') + `${ordinalWord(degree)} cousin` + (removed ? ` ${timesRemoved(removed)}` : '');
}

/** All ancestors of id with their minimum distance (self at 0). */
function upMap(tree, id) {
  const dist = new Map([[id, 0]]);
  const queue = [id];
  for (let i = 0; i < queue.length && i < 200000; i++) {
    const cur = queue[i];
    const d = dist.get(cur);
    if (d >= 40) continue;
    const { father, mother } = parentsOf(tree, cur);
    for (const p of [father, mother]) {
      if (p && !dist.has(p)) { dist.set(p, d + 1); queue.push(p); }
    }
  }
  return dist;
}

function arePartners(tree, a, b) {
  const pa = tree.people[a];
  return !!(pa && pa.fams.some(fid => { const f = tree.families[fid]; return f && f.partners.includes(b); }));
}

/**
 * Relationship between two people, based on their closest common ancestors.
 * `label` describes B relative to A ("second cousin once removed", "great-grandaunt",
 * "half-sister"); `inverse` describes A relative to B.
 * @param {object} tree
 * @param {string} aId
 * @param {string} bId
 * @returns {{ label: string, inverse: string, kind: 'self'|'ancestor'|'descendant'|'sibling'|'aunt-uncle'|'niece-nephew'|'cousin'|'spouse'|'none',
 *   half: boolean, upA: number|null, upB: number|null, degree?: number, removed?: number, common: string[], others: string[] }}
 */
export function relationship(tree, aId, bId) {
  const a = normId(tree, aId), b = normId(tree, bId);
  const base = { label: '', inverse: '', kind: 'none', half: false, upA: null, upB: null, common: [], others: [] };
  if (!a || !b) return { ...base, label: 'not found', inverse: 'not found' };
  const A = tree.people[a], B = tree.people[b];
  if (a === b) return { ...base, label: 'self', inverse: 'self', kind: 'self', upA: 0, upB: 0, common: [a] };
  const upA = upMap(tree, a), upB = upMap(tree, b);
  const common = [];
  for (const [id, da] of upA) if (upB.has(id)) common.push({ id, da, db: upB.get(id) });
  const spouse = arePartners(tree, a, b);
  const spouseWord = gendered(B.sex, 'husband', 'wife', 'spouse');
  const spouseInv = gendered(A.sex, 'husband', 'wife', 'spouse');
  if (!common.length) {
    if (spouse) return { ...base, label: spouseWord, inverse: spouseInv, kind: 'spouse' };
    return { ...base, label: 'no blood relationship found', inverse: 'no blood relationship found' };
  }
  common.sort((x, y) => (x.da + x.db) - (y.da + y.db) || Math.max(x.da, x.db) - Math.max(y.da, y.db));
  // Lowest common ancestors: drop any common ancestor that is itself an ancestor of a chosen one.
  const chosen = [];
  const chosenUps = [];
  for (const c of common) {
    if (chosenUps.some(m => m.has(c.id) && m.get(c.id) > 0)) continue;
    chosen.push(c);
    chosenUps.push(upMap(tree, c.id));
    if (chosen.length > 12) break;
  }
  const groups = new Map();
  for (const c of chosen) {
    const k = `${c.da}|${c.db}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c.id);
  }
  const results = [];
  for (const [k, ids] of groups) {
    const [da, db] = k.split('|').map(Number);
    let half = false;
    if (da > 0 && db > 0) {
      // Full relationship when two of the common ancestors are a couple.
      half = !ids.some((x, i) => ids.some((y, j) => j > i && arePartners(tree, x, y)));
    }
    // Two separate couples at the same distance: double cousins.
    const double = da >= 2 && db >= 2 && ids.length >= 4;
    results.push({ da, db, ids, half, double });
  }
  const labelOf = (o, sex, inv) => (o.double ? 'double ' : '') + (inv ? relationshipLabel(o.db, o.da, sex, o.half) : relationshipLabel(o.da, o.db, sex, o.half));
  const r = results[0];
  const label = labelOf(r, B.sex, false);
  const inverse = labelOf(r, A.sex, true);
  const kind = r.da === 0 ? 'descendant' : r.db === 0 ? 'ancestor' : r.da === 1 && r.db === 1 ? 'sibling'
    : r.db === 1 ? 'aunt-uncle' : r.da === 1 ? 'niece-nephew' : 'cousin';
  const out = { label, inverse, kind, half: r.half, upA: r.da, upB: r.db, common: r.ids, others: [] };
  if (kind === 'cousin') { out.degree = Math.min(r.da, r.db) - 1; out.removed = Math.abs(r.da - r.db); }
  for (const o of results.slice(1)) {
    const l = labelOf(o, B.sex, false);
    if (l !== label && !out.others.includes(l)) out.others.push(l);
  }
  if (spouse) out.others.push(spouseWord);
  return out;
}

// ---- Overrides ------------------------------------------------------------------------------

function eventWithPlace(ev, place) {
  const clean = cleanPlace(String(place || '').normalize('NFC'));
  const r = clean ? resolveCountry(clean) : { country: null, region: null };
  return { date: ev ? ev.date : null, place: clean, country: r.country, region: r.region, tag: (ev && ev.tag) || 'BIRT' };
}

function mergeEvent(ev, o, tag) {
  if (o === null) return null;
  let date = ev ? ev.date : null;
  let place = ev ? ev.place : '';
  if (typeof o === 'string' || typeof o === 'number') {
    const s = String(o).trim();
    date = s ? parseDate(s) : null;
  } else if (o && typeof o === 'object') {
    if ('date' in o) {
      const d = o.date;
      date = d === null || d === '' ? null : typeof d === 'object' ? d : parseDate(String(d));
    }
    if ('place' in o) place = o.place || '';
  }
  const withPlace = eventWithPlace({ date, tag: (ev && ev.tag) || tag }, place);
  withPlace.tag = (ev && ev.tag) || tag;
  return withPlace;
}

/**
 * Apply project overrides (edits made in the studio) without touching the source tree.
 * overrides: { [personId]: { name?, given?, surname?, sex?, birth?, death?, place?, hidden?, unknown?, living? } }
 * - birth/death: a date string ("ABT 1843"), or { date?, place? }; null removes the event.
 * - place: the birthplace.
 * - hidden: the person (and the line above them) is left out of charts.
 * - unknown: keep the slot and the line above, but show no name or dates.
 * @param {object} tree
 * @param {Record<string, object>} overrides
 * @param {{ nowYear?: number }} [opts]
 * @returns {object} a new Tree
 */
export function applyOverrides(tree, overrides, opts = {}) {
  if (!tree || !overrides || typeof overrides !== 'object' || !Object.keys(overrides).length) return tree;
  const nowYear = opts.nowYear || new Date().getFullYear();
  const people = { ...tree.people };
  const out = { ...tree, people, meta: { ...tree.meta } };
  const touched = [];
  for (const [rawId, o] of Object.entries(overrides)) {
    const id = normId(tree, rawId);
    if (!id || !o || typeof o !== 'object') continue;
    const p = { ...people[id] };
    if (typeof o.name === 'string') {
      const name = o.name.normalize('NFC').replace(/\s+/g, ' ').trim();
      if (!p.surname && !name.includes('/')) { p.given = name; p.surname = ''; p.suffix = ''; p.name = name; }
      else {
        const sp = splitName(name);
        p.given = sp.given; p.surname = sp.surname; p.suffix = sp.suffix;
        p.name = name.includes('/') ? [sp.given, sp.surname, sp.suffix].filter(Boolean).join(' ') : name;
      }
    }
    if (typeof o.given === 'string') p.given = o.given.normalize('NFC').trim();
    if (typeof o.surname === 'string') p.surname = o.surname.normalize('NFC').trim();
    if ((typeof o.given === 'string' || typeof o.surname === 'string') && typeof o.name !== 'string') {
      p.name = [p.given, p.surname, p.suffix].filter(Boolean).join(' ');
    }
    if (o.sex === 'M' || o.sex === 'F' || o.sex === 'U') p.sex = o.sex;
    let datesChanged = false;
    if (o.birth !== undefined) { p.birth = mergeEvent(p.birth, o.birth, 'BIRT'); datesChanged = true; }
    if (o.death !== undefined) { p.death = mergeEvent(p.death, o.death, 'DEAT'); datesChanged = true; }
    if (typeof o.place === 'string') p.birth = eventWithPlace(p.birth, o.place);
    if (o.hidden !== undefined) p.hidden = !!o.hidden;
    if (o.unknown) {
      p.unknown = true;
      p.name = ''; p.given = ''; p.surname = ''; p.suffix = '';
      p.birth = null; p.death = null;
      delete p.romanized;
    }
    people[id] = p;
    if (typeof o.living === 'boolean') p.living = o.living;
    else if (datesChanged) touched.push(id);
  }
  for (const id of touched) people[id].living = isLiving(people[id], nowYear, out);
  return out;
}
