// Cousin calculator: pure functions (no DOM). Used by /tools/cousin-calculator/ and tested in
// web/test/site/tools.test.mjs. Relationship names come from the engine's relationshipLabel(),
// the same wording the studio uses, so the grid and "pick two people from your file" agree.

import { relationshipLabel } from '../engine/tree.js';

export const MAX_UP = 10;

const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
const NUM_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** "one generation", "three generations" */
export function generationsWord(n) {
  return `${NUM_WORDS[n] ?? n} generation${n === 1 ? '' : 's'}`;
}

/**
 * The shared ancestors, named from one side: 1 -> "parents", 2 -> "grandparents",
 * 3 -> "great-grandparents", 4 -> "great-great-grandparents", 5 -> "3rd great-grandparents".
 * Same wording as the engine's relationship labels.
 * @param {number} up generations from a person up to the common ancestor (>= 1)
 * @param {boolean} [plural=true]
 */
export function ancestorWord(up, plural = true) {
  if (up < 1) return plural ? 'selves' : 'self';
  const w = relationshipLabel(up, 0, 'U'); // "parent", "grandparent", "great-grandparent" …
  return plural ? `${w}s` : w;
}

/** Clamp a generation count from a form field to 0..MAX_UP. */
export function clampUp(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(MAX_UP, n));
}

/**
 * Describe the relationship between you (A) and a relative (B) from the number of
 * generations each of you is below your closest common ancestor.
 * @param {number} upA generations from you up to the common ancestor (0 = you are the ancestor)
 * @param {number} upB generations from your relative up to the common ancestor
 * @param {{ sexB?: 'M'|'F'|'U', sexA?: 'M'|'F'|'U', half?: boolean }} [opts]
 * @returns {{ label: string, inverse: string, kind: string, degree: number|null, removed: number,
 *   shared: string, sentence: string, detail: string }}
 */
export function describe(upA, upB, opts = {}) {
  const a = clampUp(upA), b = clampUp(upB);
  const sexB = opts.sexB || 'U', sexA = opts.sexA || 'U';
  const half = !!opts.half && a > 0 && b > 0;
  const label = relationshipLabel(a, b, sexB, half);
  const inverse = relationshipLabel(b, a, sexA, half);
  let kind = 'cousin';
  if (a === 0 && b === 0) kind = 'self';
  else if (a === 0) kind = 'descendant';
  else if (b === 0) kind = 'ancestor';
  else if (a === 1 && b === 1) kind = 'sibling';
  else if (b === 1) kind = 'aunt-uncle';
  else if (a === 1) kind = 'niece-nephew';
  const degree = kind === 'cousin' ? Math.min(a, b) - 1 : null;
  const removed = kind === 'cousin' ? Math.abs(a - b) : 0;

  let shared, sentence, detail;
  if (kind === 'self') {
    shared = '';
    sentence = 'That is you.';
    detail = 'Choose at least one generation for either of you.';
  } else if (kind === 'ancestor') {
    shared = '';
    sentence = `Your relative is your ${label}.`;
    detail = `Your relative is the common ancestor: ${generationsWord(a)} above you.`;
  } else if (kind === 'descendant') {
    shared = '';
    sentence = `Your relative is your ${label}.`;
    detail = `You are the common ancestor: your relative is ${generationsWord(b)} below you.`;
  } else {
    shared = ancestorWord(a);
    const theirs = ancestorWord(b);
    sentence = `Your relative is your ${label}.`;
    if (a === b) {
      detail = `You share ${half ? 'one' : 'the same'} ${half ? ancestorWord(a, false) : shared}: ${generationsWord(a)} above each of you.`;
    } else {
      detail = `Your ${shared} are your relative’s ${theirs}. You are ${generationsWord(a)} below ${half ? 'that ancestor' : 'them'}; your relative is ${generationsWord(b)} below.`;
    }
    if (half) detail += ' \u201CHalf\u201D means you share one of a couple, not both.';
    if (kind === 'cousin') {
      detail += removed
        ? ` “Removed” counts the generations between you: ${removed === 1 ? 'one' : NUM_WORDS[removed] ?? removed}.`
        : ` You are the same number of generations down, so you are not “removed.”`;
    }
  }
  return { label, inverse, kind, degree, removed, shared, sentence, detail, half, upA: a, upB: b };
}

/**
 * The classic cousin chart: rows are your generations below the common ancestor, columns are your
 * relative's. Cell [i][j] names relative j relative to you i (sex unknown, full relationship).
 * @param {number} [size=6]
 * @returns {{ ups: number[], rows: string[][] }}
 */
export function cousinGrid(size = 6) {
  const n = Math.max(1, Math.min(MAX_UP, Math.round(size)));
  const ups = Array.from({ length: n }, (_, i) => i + 1);
  return { ups, rows: ups.map(a => ups.map(b => relationshipLabel(a, b, 'U', false))) };
}

/**
 * The two lines of descent for the diagram: from the common ancestor down to each person.
 * @returns {{ left: string[], right: string[], top: string }}
 *   left/right list the generation names from just below the ancestor down to the person,
 *   ending in "You" and "Your relative".
 */
export function diagramLines(upA, upB) {
  const a = clampUp(upA), b = clampUp(upB);
  const line = (n, who) => {
    const out = [];
    for (let k = 1; k < n; k++) out.push(relationshipLabel(0, k, 'U').replace(/^./, c => c.toUpperCase()));
    out.push(who);
    return out;
  };
  return { top: 'Common ancestor', left: a ? line(a, 'You') : [], right: b ? line(b, 'Your relative') : [] };
}

/** Ordinal word for a cousin degree (1 -> "first"). */
export function ordinalWord(n) { return ORD[n] || `${n}th`; }

const ORD_SHORT = { first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th', sixth: '6th', seventh: '7th', eighth: '8th', ninth: '9th', tenth: '10th' };

/**
 * A shorter form of a label for the grid cells: "grandaunt or granduncle" -> "grandaunt / granduncle",
 * "second cousin once removed" -> "2nd cousin, once removed".
 * @param {string} label
 */
export function shortLabel(label) {
  let s = String(label).replace(/ or /g, ' / ');
  s = s.replace(/\b(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth) cousin\b/g, (_, w) => `${ORD_SHORT[w]} cousin`);
  s = s.replace(/ cousin (once|twice|\d+ times) removed/, ' cousin, $1 removed');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
