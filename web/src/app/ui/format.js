// Small formatting helpers for studio copy (company/BRIEF.md §2 voice rules:
// numbers, not adjectives; sentence case; US English).

import { PAPER } from '../charts/sizes.js';

const NF = new Intl.NumberFormat('en-US');

/** 4212 -> "4,212" */
export function num(n) {
  return NF.format(Math.round(Number(n) || 0));
}

/** plural(3, 'person', 'people') -> "3 people" */
export function plural(n, one, many = one + 's') {
  return `${num(n)} ${n === 1 ? one : many}`;
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** Small numbers as words in running text ("six generations"). */
export function word(n) {
  return WORDS[n] ?? num(n);
}

export const CHART_LABEL = Object.freeze({ fan: 'Fan', bowtie: 'Two families', pedigree: 'Pedigree' });
export const CHART_HINT = Object.freeze({
  fan: 'Ancestors in rings around one person.',
  bowtie: 'Two people’s ancestors, side by side.',
  pedigree: 'The classic chart, boxes left to right.',
});
export const COLOR_LABEL = Object.freeze({ tones: 'Style tones', lines: 'Family line', atlas: 'Where they were born' });
export const COLOR_HINT = Object.freeze({
  tones: 'The style’s own colors.',
  lines: 'Father’s side and mother’s side in two tints.',
  atlas: 'Each person colored by the country they were born in.',
});
export const SWEEP_LABEL = Object.freeze({ 180: 'Half circle', 270: 'Three-quarter circle', 360: 'Full circle' });
export const PRIVACY_LABEL = Object.freeze({
  'hide-dates': 'Show names, hide dates',
  'living-only': 'Show only the word “Living”',
  'show-all': 'Show everything',
});

/** "Letter", "11 × 14 in", "A2" */
export function sizeLabel(size) {
  return PAPER[size] ? PAPER[size].label : String(size);
}

/** "Letter (8.5 × 11 in)", "A2 (420 × 594 mm)", "24 × 36 in" */
export function sizeLong(size) {
  const p = PAPER[size];
  if (!p) return String(size);
  if (size === 'letter') return 'Letter (8.5 × 11 in)';
  if (p.unit === 'mm') {
    const mm = v => Math.round(v / 72 * 25.4);
    return `${p.label} (${mm(p.w)} × ${mm(p.h)} mm)`;
  }
  return p.label;
}

/** Print size in inches, rounded, for the wall mockup ("24 × 36 in"). */
export function sizeInches(size, orientation = 'portrait') {
  const p = PAPER[size];
  if (!p) return { w: 8.5, h: 11 };
  const w = p.w / 72, h = p.h / 72;
  return orientation === 'landscape' ? { w: h, h: w } : { w, h };
}

/** "just now", "4 minutes ago", "yesterday", "on 12 September" */
export function timeAgo(ts, now = Date.now()) {
  const s = Math.max(0, (now - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${plural(m, 'minute')} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${plural(h, 'hour')} ago`;
  const d = Math.round(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return 'on ' + new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'long' });
}

/** Buckets for analytics: never the exact count. */
export function bucketPeople(n) {
  if (n < 100) return '<100';
  if (n < 1000) return '100-1k';
  if (n < 5000) return '1k-5k';
  if (n < 20000) return '5k-20k';
  return '20k+';
}

/** First name for running text ("Margaret"), or the whole name. */
export function firstName(person) {
  if (!person) return '';
  const g = String(person.given || '').trim().split(/\s+/)[0];
  return g || String(person.name || '').trim().split(/\s+/)[0] || '';
}

/** Possessive: "Margaret’s", "James’s". */
export function possessive(name) {
  return name ? `${name}’s` : 'their';
}
