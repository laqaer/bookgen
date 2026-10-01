// Ancestor calculator: pure functions (no DOM). Used by /tools/ancestor-calculator/ and tested
// in web/test/site/tools.test.mjs. The "with a file" numbers come from the engine's ancestors()
// and collapse(), the same Ahnentafel walk the charts use.

import { ancestors, collapse, generationOf } from '../engine/tree.js';

export const MAX_GENERATIONS = 20;
export const DEFAULT_GAP = Object.freeze({ min: 25, max: 35 });

const SMALL = ['', 'parents', 'grandparents', 'great-grandparents'];

/** "3rd", "22nd" */
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Name of the ancestors g generations back: 1 parents, 2 grandparents, 3 great-grandparents,
 * 4 2nd great-grandparents, 7 5th great-grandparents.
 * @param {number} g >= 1
 * @param {boolean} [plural=true]
 */
export function generationName(g, plural = true) {
  const n = Math.max(1, Math.round(g));
  const word = n < SMALL.length ? SMALL[n] : `${ordinal(n - 2)} great-grandparents`;
  return plural ? word : word.replace(/s$/, '');
}

/** 2^g: how many ancestor slots there are g generations back. */
export function ancestorsAt(g) { return 2 ** g; }

/** 2^(g+1) - 2: all ancestor slots from parents up to and including generation g. */
export function ancestorsThrough(g) { return 2 ** (g + 1) - 2; }

/** Format a whole number with thousands separators ("1,048,576"). */
export function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

/**
 * The table: one row per generation back.
 * @param {number} generations how many generations to list (1..MAX_GENERATIONS)
 * @param {{ birthYear?: number|null, gap?: { min: number, max: number } }} [opts]
 *   birthYear: the starting person's birth year; gap: years per generation (default 25–35)
 * @returns {{ g: number, name: string, count: number, total: number, from: number|null, to: number|null }[]}
 *   from/to: the rough range of birth years for that generation (null without a birth year)
 */
export function ancestorRows(generations = 10, opts = {}) {
  const G = Math.max(1, Math.min(MAX_GENERATIONS, Math.round(generations) || 10));
  const gap = normalizeGap(opts.gap);
  const y = Number.isFinite(opts.birthYear) ? Math.round(opts.birthYear) : null;
  const rows = [];
  for (let g = 1; g <= G; g++) {
    rows.push({
      g, name: generationName(g), count: ancestorsAt(g), total: ancestorsThrough(g),
      from: y === null ? null : y - g * gap.max,
      to: y === null ? null : y - g * gap.min,
    });
  }
  return rows;
}

/** A sane generation gap: whole years, 15..50, min <= max. */
export function normalizeGap(gap) {
  let min = Math.round(Number(gap?.min)), max = Math.round(Number(gap?.max));
  if (!Number.isFinite(min)) min = DEFAULT_GAP.min;
  if (!Number.isFinite(max)) max = DEFAULT_GAP.max;
  min = Math.max(15, Math.min(50, min));
  max = Math.max(15, Math.min(50, max));
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

/**
 * How many ancestor slots a file fills, generation by generation, for one starting person.
 * @param {object} tree engine Tree
 * @param {string} rootId
 * @param {number} [generations=10] generations back to count (1..MAX_GENERATIONS)
 * @returns {{ rows: { g: number, name: string, slots: number, known: number, distinct: number, pct: number }[],
 *   knownTotal: number, distinctTotal: number, repeated: { id: string, name: string, times: number }[], deepest: number }}
 *   known: filled slots; distinct: different people in them; pct: known / slots (0..1)
 */
export function knownAncestors(tree, rootId, generations = 10) {
  const G = Math.max(1, Math.min(MAX_GENERATIONS, Math.round(generations) || 10));
  const map = ancestors(tree, rootId, G + 1); // engine generations count the root as 1
  const rows = [];
  for (let g = 1; g <= G; g++) rows.push({ g, name: generationName(g), slots: ancestorsAt(g), known: 0, distinct: 0, pct: 0 });
  const seen = rows.map(() => new Set());
  for (const [ahnen, id] of map) {
    const g = generationOf(ahnen) - 1;
    if (g < 1 || g > G) continue;
    rows[g - 1].known++;
    seen[g - 1].add(id);
  }
  let deepest = 0;
  rows.forEach((r, i) => { r.distinct = seen[i].size; r.pct = r.known / r.slots; if (r.known) deepest = r.g; });
  const withoutRoot = new Map([...map].filter(([a]) => a > 1));
  const repeated = [...collapse(withoutRoot)].map(([id, nums]) => ({ id, name: tree.people[id]?.name || id, times: nums.length }))
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
  const all = new Set(withoutRoot.values());
  return { rows, knownTotal: withoutRoot.size, distinctTotal: all.size, repeated, deepest };
}

/**
 * One plain sentence about the first generation with gaps: where the known tree stops being
 * complete. If that generation is empty, the sentence is about the last complete one instead.
 * @param {ReturnType<typeof knownAncestors>} known
 * @param {string} [who="your"] possessive, e.g. "your" or "Margaret\u2019s"
 * @returns {{ g: number, pct: number, known: number, slots: number, text: string }|null}
 */
export function headline(known, who = 'your') {
  const rows = known.rows;
  if (!rows.length || !rows[0].known) return null;
  const firstGap = rows.findIndex(r => r.known < r.slots);
  let row;
  if (firstGap === -1) row = rows[rows.length - 1];
  else if (rows[firstGap].known > 0) row = rows[firstGap];
  else row = rows[firstGap - 1];
  const pct = Math.round(row.pct * 100);
  const lead = who === 'your' ? 'You know' : 'This file names';
  let text;
  if (row.known === row.slots) text = `${lead} all ${fmt(row.slots)} of ${who} ${row.name}.`;
  else text = `${lead} ${pct < 1 ? 'less than 1' : pct}% of ${who} ${row.name}: ${fmt(row.known)} of ${fmt(row.slots)}.`;
  return { g: row.g, pct, known: row.known, slots: row.slots, text };
}
