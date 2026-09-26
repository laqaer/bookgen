// Atlas colour mode: ancestors coloured by birthplace (company/BRIEF.md §4.3).
//
//   import { buildAtlas } from './atlas.js';
//   const atlas = buildAtlas(people, { palette: st.atlasPalette, other: st.atlasOther, placeOverrides });
//   atlas.colorOf(personId)   // fill colour, the "other" colour, or null (no birthplace)
//   atlas.legend              // [{ label, color, count, pct }] most frequent first, "Other" last
//   atlas.coverage            // { total, resolved, pct } over people with a birthplace
//   atlas.unresolved          // [{ place, count, ambiguous, candidates }] by frequency (for the studio panel)
//   atlas.summary             // "Born in 6 countries across 7 generations"
//
// Country resolution order: the user's manual assignment (placeOverrides, keyed by
// the place text) → the country the engine resolved at parse time → resolveCountry().
// Seven hues plus "other"; hues follow the entity (a country keeps its colour when
// others are added or removed only through rank, never through cycling).
// cvdReport() is the colour-blindness check used by the tests.

import { resolveCountry, cleanPlace } from '../engine/places.js';

export const ATLAS_HUES = 7;
export const OTHER_LABEL = 'Other';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
/** Spell small numbers ("7" -> "seven"). */
export function numberWord(n) {
  return WORDS[n] ?? String(n);
}

function normKey(s) {
  return String(s || '').normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Index manual assignments so a place matches however it was keyed
 * (raw text, cleaned text, or case/space-insensitive).
 */
export function overrideIndex(placeOverrides) {
  const idx = new Map();
  if (!placeOverrides) return idx;
  for (const [place, country] of Object.entries(placeOverrides)) {
    idx.set(normKey(place), country);
    idx.set(normKey(cleanPlace(place)), country);
  }
  return idx;
}

/**
 * Birthplace country for one person.
 * @param {object} person
 * @param {{ overrides?: Map<string,string>, usStates?: boolean }} [o]
 * @returns {{ place: string, key: string|null, label: string|null, source: 'override'|'file'|'resolved'|null, ambiguous: boolean, candidates?: string[] }}
 */
export function birthCountry(person, o = {}) {
  const place = person && person.birth && person.birth.place ? String(person.birth.place) : '';
  if (!place) return { place: '', key: null, label: null, source: null, ambiguous: false };
  const idx = o.overrides || new Map();
  let country = null, source = null, region = null, ambiguous = false, candidates;
  const manual = idx.get(normKey(place)) ?? idx.get(normKey(cleanPlace(place)));
  if (manual !== undefined && manual !== null && String(manual).trim() !== '') { country = String(manual).trim(); source = 'override'; }
  else {
    const r = resolveCountry(place);
    region = r.region;
    if (person.birth.country) { country = person.birth.country; source = 'file'; region = person.birth.region ?? region; }
    else if (r.country) { country = r.country; source = 'resolved'; }
    else { ambiguous = !!r.ambiguous; candidates = r.candidates; }
  }
  if (!country) return { place, key: null, label: null, source: null, ambiguous, candidates };
  if (o.usStates && country === 'United States' && region && source !== 'override') {
    return { place, key: `US:${region}`, label: region, source, ambiguous: false };
  }
  return { place, key: country, label: country, source, ambiguous: false };
}

/**
 * Build the Atlas colouring for a set of people.
 * @param {Array<object>} people unique Person objects shown on the chart
 * @param {{ palette: string[], other: string, placeOverrides?: object, usStates?: boolean,
 *           generationOf?: (personId: string) => number, generations?: number }} opts
 * @returns {{ colorOf: (id: string) => string|null, labelOf: (id: string) => string|null, legend: object[],
 *   coverage: { total: number, resolved: number, pct: number }, unresolved: object[],
 *   countries: number, generations: number, summary: string, heading: string }}
 */
export function buildAtlas(people, opts) {
  const palette = opts.palette || [];
  const other = opts.other || '#cccccc';
  const overrides = overrideIndex(opts.placeOverrides);
  const byId = new Map();
  const counts = new Map();
  const labels = new Map();
  const unresolved = new Map();
  const gensWithPlace = new Set();
  let total = 0, resolved = 0;
  for (const p of people) {
    if (!p || byId.has(p.id)) continue;
    const bc = birthCountry(p, { overrides, usStates: opts.usStates });
    byId.set(p.id, bc);
    if (!bc.place) continue;
    total++;
    if (bc.key) {
      resolved++;
      counts.set(bc.key, (counts.get(bc.key) || 0) + 1);
      labels.set(bc.key, bc.label);
      if (opts.generationOf) gensWithPlace.add(opts.generationOf(p.id));
    } else {
      const key = cleanPlace(bc.place) || bc.place;
      const u = unresolved.get(key) || { place: key, count: 0, ambiguous: bc.ambiguous, candidates: bc.candidates || [] };
      u.count++;
      unresolved.set(key, u);
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || String(labels.get(a[0])).localeCompare(String(labels.get(b[0]))));
  const colorByKey = new Map();
  const legend = [];
  let otherCount = 0;
  ranked.forEach(([key, count], i) => {
    if (i < Math.min(ATLAS_HUES, palette.length)) {
      colorByKey.set(key, palette[i]);
      legend.push({ key, label: labels.get(key), color: palette[i], count });
    } else {
      colorByKey.set(key, other);
      otherCount += count;
    }
  });
  if (otherCount) legend.push({ key: '__other__', label: OTHER_LABEL, color: other, count: otherCount });
  for (const e of legend) e.pct = resolved ? e.count / resolved : 0;
  const countries = ranked.length;
  const generations = gensWithPlace.size || opts.generations || 0;
  return {
    colorOf(id) { const bc = byId.get(id); return bc && bc.key ? colorByKey.get(bc.key) : null; },
    labelOf(id) { const bc = byId.get(id); return bc ? bc.label : null; },
    placeOf(id) { const bc = byId.get(id); return bc ? bc.place : ''; },
    legend,
    coverage: { total, resolved, pct: total ? resolved / total : 0 },
    unresolved: [...unresolved.values()].sort((a, b) => b.count - a.count || a.place.localeCompare(b.place)),
    countries,
    generations,
    summary: migrationSummary(countries, generations, ranked.length === 1 ? labels.get(ranked[0][0]) : null, !!opts.usStates),
    heading: 'Where they were born',
  };
}

/**
 * One-line migration summary (BRIEF §4.7 rule 6): "Born in 6 countries across 7 generations".
 * @param {number} countries
 * @param {number} generations
 * @param {string|null} [only] the single place when countries === 1
 */
export function migrationSummary(countries, generations, only = null, usStates = false) {
  const g = generations === 1 ? 'one generation' : `${numberWord(generations)} generations`;
  if (!countries) return '';
  if (countries === 1 && only) return `All born in ${only}, across ${g}`;
  const unit = usStates ? 'places' : 'countries';
  return `Born in ${numberWord(countries)} ${unit} across ${g}`;
}

/** Percent label: "41%", "<1%". */
export function pctLabel(p) {
  const v = p * 100;
  if (v > 0 && v < 1) return '<1%';
  return `${Math.round(v)}%`;
}

// ---------------------------------------------------------------------------
// Colour-blindness check (Machado, Oliveira & Fernandes 2009, severity 1.0;
// distances in OKLab × 100). Used by the tests and available to the studio.

const MACHADO = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const s2lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin = h => [0, 2, 4].map(i => s2lin(parseInt(h.replace('#', '').slice(i, i + 2), 16) / 255));
function oklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
function sim(rgb, kind) {
  if (!kind) return rgb;
  const M = MACHADO[kind];
  return M.map(r => Math.max(0, Math.min(1, r[0] * rgb[0] + r[1] * rgb[1] + r[2] * rgb[2])));
}
/** OKLab ΔE × 100 between two colours, optionally under a simulated deficiency. */
export function deltaE(a, b, kind) {
  const A = oklab(sim(lin(a), kind)), B = oklab(sim(lin(b), kind));
  return 100 * Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]);
}

/**
 * Worst pairwise separation of a palette (+ other) under normal vision and each
 * deficiency, over all pairs (any two wedges can touch) and over the first three
 * slots plus "other" (the most frequent countries).
 */
export function cvdReport(palette, other) {
  const all = other ? [...palette, other] : [...palette];
  const worst = (list, kind) => {
    let m = Infinity;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) m = Math.min(m, deltaE(list[i], list[j], kind));
    return m;
  };
  const top = other ? [...palette.slice(0, 3), other] : palette.slice(0, 3);
  return {
    normal: worst(all), protan: worst(all, 'protan'), deutan: worst(all, 'deutan'), tritan: worst(all, 'tritan'),
    top3: Math.min(worst(top, 'protan'), worst(top, 'deutan')),
  };
}
