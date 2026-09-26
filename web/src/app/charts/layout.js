// Layout entry point: opts -> Scene (docs/ARCHITECTURE.md "Layout entry point").
//
//   import { layout } from './charts/layout.js';
//   import { fonts } from './charts/fonts.js';           // or fonts-node.mjs in Node
//   await fonts.loadFonts();
//   const scene = layout({ tree, chart: 'fan', rootId: 'I1', size: '24x36', style: 'ivory',
//                          colorMode: 'tones', ...fonts });  // measure, metrics, hasGlyphs
//
// This module owns everything that is not the chart itself: option defaults and
// limits, page size and automatic orientation, margins, the style's page frame
// and ornaments, and the page furniture — the title cartouche (hairline double
// rule, title, subtitle "Seven generations · 1791–1962", dedication), the Atlas
// legend with its one-line migration summary, the pedigree-collapse legend, the
// compass rose and the colophon. Furniture is measured here and handed to the
// chart engine as blocks; the engine decides where they go (a 270° fan sets its
// title in the open wedge under the medallion) and returns its artwork.
//
// Chart engine protocol (layout-fan.js; layout-bowtie.js / layout-pedigree.js
// plug in the same way through registerChart or loadChartEngines):
//
//   engine(ctx) -> { items, hits, counts: { slots, placed, abbreviated, missing },
//                    warnings: string[], names: string[], people: Person[] }
//   ctx = { opts, tree, rootId, generations, sweep, keepsake, page, style, kit }
//     page: { wPt, hPt, orientation, size, unit, margin, live: { x, y, w, h } }
//           live is the area inside the margins and the style's frame
//     kit:  block builders, each returning { w, h, draw(x, y) -> Item[] } with (x, y)
//           the block's top-left corner:
//             kit.head({ maxW, maxSize, laurel }) (+ rows: [{ top, bottom, half }] for notch fitting)
//             kit.atlas(people, { maxW, generationOf }) -> block & { atlas }, or null when Atlas is off
//             kit.collapse(entries, { maxW })   entries: [{ n, names: string[], times }]
//             kit.colophon() / kit.compass(size) (null when the option or style does not use them)
//             kit.unit, kit.textSizes: base sizes for this page
//   Items and hits are in page points. Everything the engine draws must stay
//   inside page.live; layout.js adds the ground, frame and colophon.

import { PAPER, SIZE_LIMITS, pageSize, marginPt, MIN_GENERATIONS } from './sizes.js';
import { setTextBackend, textWidth, smallCapsText, MIN_TEXT_PT } from './text.js';
import { getStyle, STYLE_KEYS, COLOR_MODES } from './styles.js';
import { buildAtlas, pctLabel } from './atlas.js';
import {
  paint, rule, frame, frameInset, cornerFlourish, graticule, compassRose, laurelBase, circle,
} from './ornaments.js';
import { rectPath } from './path.js';
import { layoutFan } from './layout-fan.js';
import { applyOverrides, suggestRoot, autoGenerations } from '../engine/tree.js';

export const CHARTS = Object.freeze(['fan', 'bowtie', 'pedigree']);
export const SWEEPS = Object.freeze([180, 270, 360]);
export const PRIVACY = Object.freeze(['hide-dates', 'living-only', 'show-all']);
/** Keepsake layout (large type, full places, ornamental frame) at this many generations or fewer. */
export const KEEPSAKE_MAX_GENERATIONS = 4;
export const COLOPHON = 'Made with Gildroot · gildroot.com';

const ENGINES = { fan: layoutFan };

/**
 * Register a chart engine (see the protocol above).
 * @param {'fan'|'bowtie'|'pedigree'} name
 * @param {(ctx: object) => object} engine
 */
export function registerChart(name, engine) {
  if (typeof engine !== 'function') throw new TypeError('registerChart needs a function');
  ENGINES[name] = engine;
}

/** True when an engine is available for this chart. */
export function hasChart(name) {
  return typeof ENGINES[name] === 'function';
}

/**
 * Load the bowtie and pedigree engines when their modules exist
 * (layout-bowtie.js exports layoutBowtie, layout-pedigree.js exports layoutPedigree).
 * @returns {Promise<string[]>} the charts now available
 */
export async function loadChartEngines() {
  const wanted = [['bowtie', './layout-bowtie.js', 'layoutBowtie'], ['pedigree', './layout-pedigree.js', 'layoutPedigree']];
  await Promise.all(wanted.map(async ([name, path, fn]) => {
    if (ENGINES[name]) return;
    try {
      const mod = await import(path);
      const eng = mod[fn] || mod.default;
      if (typeof eng === 'function') ENGINES[name] = eng;
    } catch { /* not built yet */ }
  }));
  return Object.keys(ENGINES);
}

const NUMBER_WORDS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/** "Seven generations" */
export function generationsLabel(n) {
  if (n === 1) return 'One generation';
  return `${NUMBER_WORDS[n] || n} generations`;
}

/**
 * Default sweep (BRIEF §4.3): 180° at 5 or fewer generations, 270° at 6–8.
 * @param {number} generations
 */
export function defaultSweep(generations) {
  return generations <= 5 ? 180 : 270;
}

/**
 * Normalise options: defaults, limits, overrides applied, root and depth chosen.
 * @returns {object} normalised opts (a new object)
 */
export function normalizeOptions(opts) {
  if (!opts || !opts.tree) throw new Error('layout needs opts.tree');
  const o = { ...opts };
  o.chart = CHARTS.includes(o.chart) ? o.chart : 'fan';
  o.size = PAPER[o.size] ? o.size : 'letter';
  o.style = STYLE_KEYS.includes(o.style) ? o.style : 'ivory';
  o.colorMode = COLOR_MODES.includes(o.colorMode) ? o.colorMode : 'tones';
  o.privacy = PRIVACY.includes(o.privacy) ? o.privacy : 'hide-dates';
  o.orientation = ['portrait', 'landscape', 'auto'].includes(o.orientation) ? o.orientation : 'auto';
  o.showPlaces = o.showPlaces !== false;
  o.trimEmpty = !!o.trimEmpty;
  o.bleed = !!o.bleed;
  o.colophon = !!o.colophon;
  o.title = typeof o.title === 'string' ? o.title.trim() : '';
  o.subtitle = typeof o.subtitle === 'string' ? o.subtitle.trim() : '';
  o.dedication = typeof o.dedication === 'string' ? o.dedication.trim() : '';
  o.tree = applyOverrides(opts.tree, opts.overrides || {});
  const warnings = [];
  if (o.chart !== 'bowtie') {
    const rid = o.rootId && o.tree.people[String(o.rootId).replace(/^@(.+)@$/, '$1')] ? String(o.rootId).replace(/^@(.+)@$/, '$1') : suggestRoot(o.tree);
    if (o.rootId && rid !== String(o.rootId).replace(/^@(.+)@$/, '$1')) warnings.push(`root ${o.rootId} not found; using ${rid}`);
    o.rootId = rid;
    if (!o.rootId) throw new Error('the tree has no people');
  }
  const cap = SIZE_LIMITS[o.size][o.chart];
  const lo = MIN_GENERATIONS[o.chart];
  let g = Number(o.generations);
  if (!Number.isFinite(g) || g <= 0) g = o.chart === 'bowtie' ? Math.min(cap, 4) : Math.max(lo, autoGenerations(o.tree, o.rootId, cap));
  g = Math.round(g);
  if (g > cap) warnings.push(`${g} generations do not fit ${PAPER[o.size].label}; showing ${cap}`);
  o.generations = Math.max(lo, Math.min(cap, g));
  if (o.chart === 'fan') o.sweep = SWEEPS.includes(Number(o.sweep)) ? Number(o.sweep) : defaultSweep(o.generations);
  o._warnings = warnings;
  return o;
}

/**
 * Lay out a chart.
 * @param {object} opts see docs/ARCHITECTURE.md (Layout entry point)
 * @returns {object} Scene
 */
export function layout(opts) {
  if (opts && typeof opts.measure === 'function') {
    setTextBackend({ measure: opts.measure, metrics: opts.metrics, hasGlyphs: opts.hasGlyphs });
  }
  glyphProbe = opts && typeof opts.hasGlyphs === 'function' ? opts.hasGlyphs : null;
  const o = normalizeOptions(opts);
  const engine = ENGINES[o.chart];
  if (!engine) throw new Error(`the ${o.chart} layout is not loaded (await loadChartEngines())`);
  const st = getStyle(o.style, o.colorMode);
  const keepsake = o.chart === 'fan' && o.generations <= KEEPSAKE_MAX_GENERATIONS;

  // Orientation: explicit, or the one that gives the chart the most room.
  const candidates = o.orientation === 'auto' ? autoOrientations(o) : [o.chart === 'fan' && o.sweep === 180 ? 'landscape' : o.orientation];
  let best = null;
  for (const orientation of candidates) {
    const res = runEngine(engine, o, st, orientation, keepsake);
    if (!best || res.score > best.score * 1.04) best = res;
  }
  return best.scene;
}

function autoOrientations(o) {
  if (o.chart !== 'fan') return ['landscape'];
  if (o.sweep === 180) return ['landscape'];
  if (o.sweep === 360) return ['portrait', 'landscape'];
  return ['landscape', 'portrait'];
}

function runEngine(engine, o, st, orientation, keepsake) {
  const { wPt, hPt } = pageSize(o.size, orientation);
  const short = Math.min(wPt, hPt);
  const unit = short / 612; // 1 on Letter/A4-ish, 2.82 on 24×36
  const margin = marginPt(wPt, hPt);
  const frameOpts = frameOptions(st, unit);
  const hasFrame = st.frame !== 'none' || keepsake;
  const frameKind = st.frame !== 'none' ? st.frame : 'double';
  const inset = hasFrame ? frameInset(frameKind, frameOpts) + 14 * unit ** 0.8 : 0;
  const live = { x: margin + inset, y: margin + inset, w: wPt - 2 * (margin + inset), h: hPt - 2 * (margin + inset) };
  const page = { wPt, hPt, orientation, size: o.size, unit, margin, live };
  const sizes = textSizes(unit, keepsake);

  // colophon reserves a line at the bottom of the live area
  const colophon = o.colophon ? colophonBlock(st, sizes) : null;
  if (colophon) live.h -= colophon.h + sizes.gap;

  const kit = makeKit(o, st, page, sizes, keepsake);
  const ctx = { opts: o, tree: o.tree, rootId: o.rootId, generations: o.generations, sweep: o.sweep, keepsake, page, style: st, kit, hasGlyphs: glyphProbe };
  const res = engine(ctx);

  const items = [];
  const decor = [];
  // background ornaments (graticule) sit under the chart
  if (st.ornaments.graticule) {
    const area = { x: margin + inset * 0.3, y: margin + inset * 0.3, w: wPt - 2 * (margin + inset * 0.3), h: hPt - 2 * (margin + inset * 0.3) };
    decor.push({ t: 'group', clip: rectPath(area.x, area.y, area.w, area.h), opacity: 0.32, items: paint(graticule(area.x, area.y, area.w, area.h, { step: 46 * unit, sw: 0.35 }), st.accent) });
  }
  items.push(...decor);
  items.push(...res.items);
  if (hasFrame) {
    const fx = margin, fy = margin, fw = wPt - 2 * margin, fh = hPt - 2 * margin;
    items.push(...paint(frame(frameKind, fx, fy, fw, fh, frameOpts), st.accent));
    if (keepsake && st.ornaments.corners !== false) {
      const cs = Math.min(fw, fh) * 0.075;
      const ci = frameInset(frameKind, frameOpts) + 2.5 * unit;
      const corners = [
        [fx + ci, fy + ci, 'tl'], [fx + fw - ci, fy + ci, 'tr'], [fx + ci, fy + fh - ci, 'bl'], [fx + fw - ci, fy + fh - ci, 'br'],
      ];
      for (const [x, y, c] of corners) items.push(...paint(cornerFlourish(x, y, cs, c, { width: Math.max(0.8, cs * 0.02) }), st.accent));
    }
  }
  if (colophon) {
    const y = live.y + live.h + sizes.gap;
    items.push(...colophon.draw(wPt / 2 - colophon.w / 2, y));
  }

  const warnings = [...o._warnings, ...(res.warnings || [])];
  if (st.paperNote) warnings.push(st.paperNote);
  const title = kit.titleText();
  const subtitle = kit.subtitleText(res.people || []);
  const scene = {
    wPt, hPt, bg: st.ground, items, hits: res.hits || [],
    meta: {
      chart: o.chart, style: o.style, colorMode: o.colorMode, generations: o.generations,
      fonts: sceneFonts(items),
      counts: res.counts || { slots: 0, placed: 0, abbreviated: 0, missing: 0 },
      warnings,
      title, subtitle,
      orientation, size: o.size, sweep: o.sweep, keepsake,
      names: res.names || [],
    },
  };
  if (kit.lastAtlas) {
    const a = kit.lastAtlas;
    scene.meta.legend = a.legend.map(e => ({ label: e.label, color: e.color, count: e.count }));
    scene.meta.atlas = { coverage: a.coverage, unresolved: a.unresolved, summary: a.summary, countries: a.countries };
  }
  if (res.collapse && res.collapse.length) scene.meta.collapse = res.collapse;
  return { scene, score: res.score ?? 1 };
}

function sceneFonts(items) {
  const set = new Set();
  const walk = list => { for (const it of list) { if (it.t === 'text' || it.t === 'glyphs') set.add(it.font); else if (it.t === 'group') walk(it.items || []); } };
  walk(items);
  return [...set].sort();
}

function frameOptions(st, unit) {
  const u = unit ** 0.85;
  switch (st.frame) {
    case 'thickthin': return { gap: 2.6 * u, sw: 0.5, thick: 2.2 * u };
    case 'neatline': return { gap: 2.5 * u, sw: 0.45, band: 4.2 * u };
    case 'gilt': return { gap: 3.2 * u, sw: 0.45 };
    default: return { gap: 3 * u, sw: 0.5 };
  }
}

/** Base type sizes for a page (points). */
export function textSizes(unit, keepsake = false) {
  const k = keepsake ? 1.12 : 1;
  const legend = Math.max(MIN_TEXT_PT + 0.5, 7 * unit ** 0.72);
  return {
    unit,
    title: 22 * unit ** 0.92 * k,
    root: 30 * unit ** 0.92 * k,
    legend,
    legendHead: legend * 0.92,
    colophon: Math.max(MIN_TEXT_PT, 6.2 * unit ** 0.6),
    gap: 10 * unit ** 0.8,
  };
}

// ---------------------------------------------------------------------------
// Page furniture

function makeKit(o, st, page, sizes, keepsake) {
  const kit = {
    unit: page.unit,
    textSizes: sizes,
    lastAtlas: null,
    titleText: () => titleText(o),
    subtitleText: people => subtitleText(o, people),
    head: (args = {}) => headBlock(o, st, sizes, keepsake, args, kit),
    atlas: (people, args = {}) => {
      if (o.colorMode !== 'atlas') return null;
      const atlas = buildAtlas(people, {
        palette: st.atlasPalette, other: st.atlasOther, placeOverrides: o.placeOverrides, usStates: !!o.usStates,
        generationOf: args.generationOf, generations: o.generations,
      });
      kit.lastAtlas = atlas;
      const block = atlasBlock(atlas, st, sizes, args.maxW ?? page.live.w, args.columns);
      return block ? Object.assign(block, { atlas }) : { atlas, w: 0, h: 0, draw: () => [], empty: true };
    },
    collapse: (entries, args = {}) => (entries && entries.length ? collapseBlock(entries, st, sizes, args.maxW ?? page.live.w, args) : null),
    colophon: () => (o.colophon ? colophonBlock(st, sizes) : null),
    compass: size => (st.ornaments.compass ? compassBlock(st, size ?? 70 * page.unit ** 0.9) : null),
  };
  kit.subtitleCache = null;
  return kit;
}

/** Auto title (BRIEF §4.3): "The Ancestors of Margaret Rose Kowalski". */
export function titleText(o) {
  if (o.title) return o.title;
  const p = o.tree.people[o.rootId];
  const living = p && p.living && o.privacy === 'living-only';
  const name = p && !living ? (p.name || '').trim() : '';
  return name ? `The Ancestors of ${name}` : "Our Family's Ancestors";
}

/** Auto subtitle: "Seven generations · 1791–1962" (years only from people whose dates are shown). */
export function subtitleText(o, people) {
  if (o.subtitle) return o.subtitle;
  let lo = Infinity, hi = -Infinity;
  for (const p of people) {
    if (!p || (p.living && o.privacy !== 'show-all')) continue;
    const y = p.birth && p.birth.date && typeof p.birth.date.year === 'number' ? p.birth.date.year : null;
    if (y === null) continue;
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  const gens = generationsLabel(o.generations);
  if (lo === Infinity) return gens;
  return lo === hi ? `${gens} · ${lo}` : `${gens} · ${lo}–${hi}`;
}

/** Text drawn in a style's title treatment. Returns { items(x, y, anchor), width }. */
function titleRun(str, font, size, st, color, tracking) {
  const kind = st.title.case;
  if (kind === 'smallcaps') {
    const probe = smallCapsText(str, font, size, 0, 0, { tracking, anchor: 'start' });
    const w = runWidth(probe, font, tracking);
    return { width: w, items: (x, y) => smallCapsText(str, font, size, x, y, { tracking, anchor: 'middle', color }) };
  }
  const s = kind === 'caps' ? str.toLocaleUpperCase('en-US') : str;
  const w = textWidth(s, font, size, tracking);
  return {
    width: w,
    items: (x, y) => [{ t: 'text', x: r3(x), y: r3(y), str: s, font, size: r3(size), color, anchor: 'middle', ...(tracking ? { tracking: r3(tracking) } : {}) }],
  };
}

function runWidth(items, font, tracking) {
  if (!items.length) return 0;
  const last = items[items.length - 1];
  return last.x + textWidth(last.str, last.font, last.size, tracking) - items[0].x;
}

const r3 = v => Math.round(v * 1000) / 1000;

let glyphProbe = null;
/** The font itself, or `fallback` when it lacks a glyph in str (Cormorant has no Greek). */
function safeFont(font, str, fallback) {
  if (!glyphProbe || !str) return font;
  try { return glyphProbe(font, str).ok ? font : fallback; } catch { return font; }
}

function splitTitle(title) {
  const m = title.match(/^((?:the\s+)?(?:ancestors|family|descendants|forebears)\s+of)\s+(.+)$/i);
  if (m) return { small: m[1], big: m[2] };
  return { small: '', big: title };
}

/**
 * The title cartouche: hairline double rule, title (small lead line + large line),
 * rule with fleuron, subtitle and dedication. Centred on x; draw(x, y) takes the
 * block's top-left corner.
 */
function headBlock(o, st, sizes, keepsake, args, kit) {
  const maxW = args.maxW ?? 1e9;
  const maxSize = Math.min(args.maxSize ?? Infinity, sizes.title * (args.scale ?? 1));
  const title = titleText(o);
  const subtitle = kit.subtitleText(args.people || []);
  const { small, big } = splitTitle(title);
  const tr = st.title.tracking;
  const bigFont = safeFont(st.fonts.title, big, 'ebg-400');
  const smallFont = safeFont(st.fonts.titleSmall, small, 'ebg-400');
  // size the big line to fit, allowing two balanced lines for long titles
  let S = maxSize;
  const widthAt = (str, font, s) => titleRun(str, font, s, st, st.ink, tr * s).width;
  let bigLines = [big];
  const fitW = maxW * 0.96;
  if (widthAt(big, bigFont, S) > fitW) {
    const words = big.split(/\s+/);
    let bestSplit = null;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
      const w = Math.max(widthAt(a, bigFont, S), widthAt(b, bigFont, S));
      if (!bestSplit || w < bestSplit.w) bestSplit = { lines: [a, b], w };
    }
    const one = widthAt(big, bigFont, S);
    if (bestSplit && S * fitW / one < S * 0.72) bigLines = bestSplit.lines;
    const wMax = Math.max(...bigLines.map(l => widthAt(l, bigFont, S)));
    if (wMax > fitW) S = Math.max(MIN_TEXT_PT + 2, S * fitW / wMax);
  }
  const smallS = Math.max(MIN_TEXT_PT, S * (st.title.case === 'italic' ? 0.46 : 0.4));
  const subS = Math.max(MIN_TEXT_PT, Math.min(S * 0.42, sizes.legend * 1.35));
  const dedS = Math.max(MIN_TEXT_PT, subS * 0.96);
  const smallRun = small ? titleRun(st.title.case === 'italic' ? small : small, smallFont, smallS, st, st.inkSoft, tr * 1.25 * smallS + (st.title.case === 'italic' ? smallS * 0.12 : 0)) : null;
  const bigRuns = bigLines.map(l => titleRun(l, bigFont, S, st, st.ink, tr * S));
  const subFont = safeFont(st.fonts.subtitle, subtitle, 'ebg-400i');
  const subIsSans = /^sans/.test(st.fonts.subtitle);
  const subStr = subIsSans ? subtitle.toLocaleUpperCase('en-US') : subtitle;
  const subTrack = subIsSans ? 0.14 * subS : 0.02 * subS;
  let subW = subtitle ? textWidth(subStr, subFont, subS, subTrack) : 0;
  let subSize = subS;
  if (subW > fitW) { subSize = Math.max(MIN_TEXT_PT, subS * fitW / subW); subW = textWidth(subStr, subFont, subSize, subTrack * subSize / subS); }
  const ded = o.dedication;
  const dedFont = safeFont(st.fonts.dedication, ded, 'ebg-400i');
  let dedSize = dedS;
  let dedW = ded ? textWidth(ded, dedFont, dedS) : 0;
  if (dedW > fitW) { dedSize = Math.max(MIN_TEXT_PT, dedS * fitW / dedW); dedW = textWidth(ded, dedFont, dedSize); }

  const textW = Math.max(smallRun ? smallRun.width : 0, ...bigRuns.map(r => r.width));
  const ruleW = Math.min(maxW, Math.max(textW + S * 2.2, subW + S * 1.6, S * 9));
  const gap = Math.max(2, S * 0.1);
  const fl = st.fleuron;
  const fls = Math.max(6, S * 0.55);
  const lineGapBig = S * 1.12;
  // vertical stack (y = top of block)
  const rows = [];
  let y = 0;
  const topRuleY = y + gap + 1;
  y = topRuleY + gap / 2 + S * 0.72;
  let smallY = null;
  if (smallRun) { smallY = y + smallS * 0.7; y = smallY + S * 0.34; }
  const bigYs = [];
  for (let i = 0; i < bigRuns.length; i++) { const by = y + S * 0.68; bigYs.push(by); y = by + (i < bigRuns.length - 1 ? lineGapBig - S * 0.68 : 0); }
  y += S * 0.42;
  const botRuleY = y + gap / 2;
  y = botRuleY + gap / 2 + (fl !== 'none' ? fls * 0.3 : 0);
  let subY = null;
  if (subtitle) { subY = y + subSize * 1.3; y = subY + subSize * 0.35; }
  let dedY = null;
  if (ded) { dedY = y + dedSize * 1.35; y = dedY + dedSize * 0.35; }
  let laurel = null;
  if (args.laurel && st.ornaments.laurel) {
    const lw = Math.min(maxW, Math.max(ruleW * 0.82, S * 8));
    const lh = lw * 0.2;
    laurel = { top: y + S * 0.35, w: lw, h: lh };
    y = laurel.top + lh + S * 0.15;
  }
  const h = y + gap;
  const w = Math.max(ruleW, subW, dedW, laurel ? laurel.w : 0);
  rows.push({ top: 0, bottom: botRuleY + fls * 0.4, half: ruleW / 2 });
  if (subtitle) rows.push({ top: subY - subSize, bottom: subY + subSize * 0.3, half: subW / 2 });
  if (ded) rows.push({ top: dedY - dedSize, bottom: dedY + dedSize * 0.3, half: dedW / 2 });
  if (laurel) rows.push({ top: laurel.top, bottom: laurel.top + laurel.h, half: laurel.w / 2 });

  const ruleKind = st.rule;
  const ruleSw = 0.45;
  const draw = (x0, y0) => {
    const cx = x0 + w / 2;
    const out = [];
    const rx0 = cx - ruleW / 2, rx1 = cx + ruleW / 2;
    out.push(...paint(rule(ruleKind, rx0, rx1, y0 + topRuleY, { gap: Math.max(2, S * 0.09), sw: ruleSw, thick: Math.max(1.4, S * 0.07), below: true }), st.accent));
    if (smallRun) out.push(...smallRun.items(cx, y0 + smallY));
    bigRuns.forEach((r, i) => out.push(...r.items(cx, y0 + bigYs[i])));
    out.push(...paint(rule(ruleKind, rx0, rx1, y0 + botRuleY, { gap: Math.max(2, S * 0.09), sw: ruleSw, fleuron: fl, fleuronSize: fls, thick: Math.max(1.4, S * 0.07), below: false }), st.accent));
    if (subtitle) out.push({ t: 'text', x: r3(cx), y: r3(y0 + subY), str: subStr, font: subFont, size: r3(subSize), color: st.inkSoft, anchor: 'middle', ...(subTrack ? { tracking: r3(subTrack * subSize / subS) } : {}) });
    if (ded) out.push({ t: 'text', x: r3(cx), y: r3(y0 + dedY), str: ded, font: dedFont, size: r3(dedSize), color: st.ink, anchor: 'middle' });
    if (laurel) out.push(...paint(laurelBase(cx, y0 + laurel.top + laurel.h * 0.92, laurel.w, laurel.h * 0.9, { size: laurel.h * 0.42 }), st.accent));
    return out;
  };
  return { id: 'head', w, h, rows, draw, titleSize: S, title, subtitle };
}

/** Swatch + label grid for the Atlas legend, heading and migration summary. */
function atlasBlock(atlas, st, sizes, maxW, forceCols) {
  const entries = atlas.legend;
  if (!entries.length) return null;
  const s = sizes.legend;
  const font = st.fonts.legend;
  const headFont = st.fonts.legendHead;
  const sw = s * 0.95; // swatch size
  const labels = entries.map(e => `${e.label} ${pctLabel(e.pct)}`);
  const ws = labels.map(l => textWidth(l, font, s));
  const colGap = s * 1.6;
  const cellW = Math.max(...ws) + sw + s * 0.55;
  let cols = forceCols || Math.max(1, Math.min(entries.length, Math.floor((maxW + colGap) / (cellW + colGap))));
  if (!forceCols) {
    // balance rows: fewest rows at the chosen column count, then the fewest columns for that row count
    const rowsN = Math.ceil(entries.length / cols);
    cols = Math.ceil(entries.length / rowsN);
  }
  const rowsN = Math.ceil(entries.length / cols);
  const head = atlas.heading.toLocaleUpperCase('en-US');
  const headTrack = s * 0.14;
  const headW = textWidth(head, headFont, sizes.legendHead, headTrack);
  const summary = atlas.summary ? atlas.summary + '.' : '';
  const sumFont = st.fonts.subtitle;
  let sumSize = s;
  let sumW = summary ? textWidth(summary, sumFont, sumSize) : 0;
  const gridW = cols * cellW + (cols - 1) * colGap;
  const w0 = Math.max(gridW, headW);
  if (sumW > Math.max(w0, maxW)) { sumSize = Math.max(MIN_TEXT_PT, sumSize * Math.max(w0, maxW) / sumW); sumW = textWidth(summary, sumFont, sumSize); }
  const w = Math.max(w0, sumW);
  const pitch = s * 1.55;
  const headY = sizes.legendHead;
  const gridTop = headY + s * 0.95;
  const sumY = gridTop + rowsN * pitch + s * 0.55;
  const h = sumY + (summary ? s * 0.4 : -s * 0.4);
  const draw = (x0, y0) => {
    const out = [];
    const cx = x0 + w / 2;
    out.push({ t: 'text', x: r3(cx), y: r3(y0 + headY), str: head, font: headFont, size: r3(sizes.legendHead), color: st.inkSoft, anchor: 'middle', tracking: r3(headTrack) });
    const gx = cx - gridW / 2;
    const swatches = new Map();
    entries.forEach((e, i) => {
      const c = Math.floor(i / rowsN), r = i % rowsN;
      const x = gx + c * (cellW + colGap);
      const yMid = y0 + gridTop + r * pitch + pitch / 2;
      const d = rectPath(x, yMid - sw / 2, sw, sw, sw * 0.18);
      if (!swatches.has(e.color)) swatches.set(e.color, []);
      swatches.get(e.color).push(d);
      out.push({ t: 'text', x: r3(x + sw + s * 0.55), y: r3(yMid), str: labels[i], font, size: r3(s), color: st.ink, anchor: 'start', baseline: 'middle' });
    });
    for (const [color, ds] of swatches) out.push({ t: 'path', d: ds.join(' '), fill: color, stroke: st.dark ? st.accent : st.line.color === '#ffffff' ? st.inkSoft : st.line.color, sw: 0.35, opacity: 1 });
    if (summary) out.push({ t: 'text', x: r3(cx), y: r3(y0 + sumY), str: summary, font: sumFont, size: r3(sumSize), color: st.inkSoft, anchor: 'middle' });
    return out;
  };
  return { id: 'atlas', w, h, draw, rows: [{ top: 0, bottom: h, half: w / 2 }] };
}

/**
 * Pedigree-collapse legend: numbered marks with "appears 3 times" lines.
 * entries: [{ n, names: string[], times }]
 */
function collapseBlock(entries, st, sizes, maxW, args = {}) {
  const s = sizes.legend * 0.94;
  const font = st.fonts.legend;
  const headFont = st.fonts.legendHead;
  const mr = s * 0.62;
  const head = 'PEDIGREE COLLAPSE';
  const headTrack = s * 0.14;
  const lead = 'The same ancestor reached through more than one line.';
  const leadFont = st.fonts.subtitle;
  const texts = entries.map(e => {
    const who = e.names.join(' & ');
    const verb = e.names.length > 1 ? 'appear' : 'appears';
    return { who, tail: ` ${verb} ${e.times} times` };
  });
  const cellFor = t => textWidth(t.who + t.tail, font, s) + mr * 2 + s * 0.5;
  const colGap = s * 1.8;
  let cells = texts.map(cellFor);
  const maxCell = Math.min(maxW, Math.max(...cells));
  let cols = Math.max(1, Math.min(entries.length, Math.floor((maxW + colGap) / (maxCell + colGap))));
  if (args.maxCols) cols = Math.min(cols, args.maxCols);
  const rowsN = Math.ceil(entries.length / cols);
  cols = Math.ceil(entries.length / rowsN);
  const cellW = Math.min(maxCell, (maxW - (cols - 1) * colGap) / cols);
  // fit each line into the cell (shrink a little, then use short names)
  const lines = texts.map((t, i) => {
    const avail = cellW - mr * 2 - s * 0.5;
    let str = t.who + t.tail;
    let size = s;
    const w = textWidth(str, font, size);
    if (w > avail) {
      const shortWho = (entries[i].short || entries[i].names).join(' & ');
      str = shortWho + t.tail;
      const w2 = textWidth(str, font, size);
      if (w2 > avail) size = Math.max(MIN_TEXT_PT, size * avail / w2);
    }
    return { str, size };
  });
  const gridW = cols * cellW + (cols - 1) * colGap;
  const headW = textWidth(head, headFont, sizes.legendHead, headTrack);
  let leadSize = s;
  let leadW = textWidth(lead, leadFont, leadSize);
  if (leadW > maxW) { leadSize = Math.max(MIN_TEXT_PT, leadSize * maxW / leadW); leadW = textWidth(lead, leadFont, leadSize); }
  const w = Math.max(gridW, headW, leadW);
  const pitch = s * 1.6;
  const headY = sizes.legendHead;
  const leadY = headY + s * 1.45;
  const gridTop = leadY + s * 0.5;
  const h = gridTop + rowsN * pitch;
  const draw = (x0, y0) => {
    const out = [];
    const cx = x0 + w / 2;
    out.push({ t: 'text', x: r3(cx), y: r3(y0 + headY), str: head, font: headFont, size: r3(sizes.legendHead), color: st.inkSoft, anchor: 'middle', tracking: r3(headTrack) });
    out.push({ t: 'text', x: r3(cx), y: r3(y0 + leadY), str: lead, font: leadFont, size: r3(leadSize), color: st.inkSoft, anchor: 'middle' });
    const gx = cx - gridW / 2;
    entries.forEach((e, i) => {
      const c = Math.floor(i / rowsN), r = i % rowsN;
      const x = gx + c * (cellW + colGap);
      const yMid = y0 + gridTop + r * pitch + pitch / 2;
      out.push(...markerItems(e.n, x + mr, yMid, s, st));
      out.push({ t: 'text', x: r3(x + mr * 2 + s * 0.5), y: r3(yMid), str: lines[i].str, font, size: r3(lines[i].size), color: st.ink, anchor: 'start', baseline: 'middle' });
    });
    return out;
  };
  return { id: 'collapse', w, h, draw, rows: [{ top: 0, bottom: h, half: w / 2 }] };
}

/**
 * A pedigree-collapse marker: small ring with the number, centred at (x, y).
 * Shared by the chart and the legend so both look the same.
 * @param {number} n
 * @param {number} x
 * @param {number} y
 * @param {number} size number size (pt)
 * @param {object} st style
 */
export function markerItems(n, x, y, size, st) {
  const s = Math.max(MIN_TEXT_PT, size * (String(n).length > 1 ? 0.78 : 0.86));
  const r = size * 0.62;
  const fill = st.dark ? st.ground : st.medallion.fill || st.ground;
  return [
    { t: 'path', d: circle(x, y, r), fill, stroke: st.accent, sw: 0.5 },
    { t: 'text', x: r3(x), y: r3(y), str: String(n), font: st.fonts.marker, size: r3(s), color: st.dark ? st.ink : st.accent === '#ffffff' ? st.ink : st.ink, anchor: 'middle', baseline: 'middle' },
  ];
}

function colophonBlock(st, sizes) {
  const s = sizes.colophon;
  const font = st.fonts.colophon;
  const w = textWidth(COLOPHON, font, s);
  const h = s * 1.2;
  return { id: 'colophon', w, h, draw: (x0, y0) => [{ t: 'text', x: r3(x0 + w / 2), y: r3(y0 + s), str: COLOPHON, font, size: r3(s), color: st.inkFaint, anchor: 'middle' }] };
}

function compassBlock(st, size) {
  const r = size / 2;
  const h = size * 1.2;
  const draw = (x0, y0) => {
    const cx = x0 + size / 2, cy = y0 + h - r;
    const c = compassRose(cx, cy, r * 0.96, { sw: Math.max(0.35, r * 0.012) });
    const out = paint(c.marks, st.accent);
    out.push({ t: 'text', x: r3(c.north.x), y: r3(c.north.y), str: 'N', font: st.fonts.label, size: r3(Math.max(MIN_TEXT_PT, c.north.size)), color: st.accent, anchor: 'middle', baseline: 'alphabetic' });
    return out;
  };
  return { id: 'compass', w: size, h, draw, rows: [{ top: 0, bottom: h, half: size / 2 }] };
}

