// QA TEST DOUBLE — not the product layout.
//
// A deliberately plain implementation of the charts/layout.js contract (fan, bowtie,
// pedigree) used only to self-test the QA matrix harness: `node web/test/run-all.mjs`
// renders a few cells with it, and with injected defects (opts.qaDefect), to prove that
// the gate passes a clean chart and catches small text, thin strokes, off-page text,
// unrenderable glyphs, wrong page sizes and a missing root. It follows the same craft
// limits (6 pt / 5.5 pt floor, 0.35 pt strokes) with the shared text.js helpers.

import { setTextBackend, fitArc, arcText, fitText, radialText, fitBlock, smallCapsText, arcLength } from '/app/charts/text.js';
import { sectorPath, rectPath } from '/app/charts/path.js';
import { pageSize, margins, resolveOrientation, clampGenerations } from '/app/charts/sizes.js';
import { ancestors } from '/app/engine/tree.js';
import { nameLadder } from '/app/engine/names.js';
import { formatYearRange } from '/app/engine/dates.js';

export const CHARTS = ['fan', 'bowtie', 'pedigree'];

const STYLES = {
  ivory: { bg: '#f7f1e3', ink: '#3a2a14', line: '#8a6a3a', faint: '#d9ccb0', tone: '#efe4cc', a: '#e8dcc0', b: '#efe0d6' },
  midnight: { bg: '#141a2e', ink: '#e6cf8f', line: '#b8963e', faint: '#3a4260', tone: '#1c2440', a: '#1e2a48', b: '#2a2240' },
  botanical: { bg: '#fbf8f1', ink: '#3b3a22', line: '#7a7a3a', faint: '#dcd8c0', tone: '#eef0dc', a: '#e7ecd2', b: '#f3e2dc' },
  letterpress: { bg: '#f8f3e6', ink: '#1a1a1a', line: '#c0392b', faint: '#d8d0c0', tone: '#f1eadb', a: '#ece4d2', b: '#f4e0da' },
  nordic: { bg: '#ffffff', ink: '#2b2f33', line: '#7d8a96', faint: '#dde3e8', tone: '#eef2f5', a: '#e6edf2', b: '#f1ecef' },
  cartographer: { bg: '#e9f0f2', ink: '#23384a', line: '#5b7a8f', faint: '#c4d3da', tone: '#dfe9ec', a: '#d6e4ea', b: '#e8e0e2' },
};
const ATLAS = ['#c9a86a', '#8fb3a0', '#c98f7a', '#8fa3c9', '#b79ac4', '#a8b86a', '#c9b87a'];
const OTHER = '#bdb5a6';

function styleFor(opts) {
  const s = STYLES[opts.style];
  if (!s) throw new Error(`unknown style "${opts.style}"`);
  if (!['tones', 'lines', 'atlas'].includes(opts.colorMode)) throw new Error(`unknown colour mode "${opts.colorMode}"`);
  return s;
}

function titleFont(key, str, hasGlyphs) {
  const fb = { 'cg-600': 'ebg-600', 'cg-500': 'ebg-400', 'cg-500i': 'ebg-400i' }[key];
  return hasGlyphs(key, str).ok || !fb ? key : fb;
}

function palette(tree, ids) {
  const counts = new Map();
  for (const id of ids) {
    const c = tree.people[id]?.birth?.country;
    if (c) counts.set(c, (counts.get(c) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const colors = new Map(top.slice(0, 7).map(([c], i) => [c, ATLAS[i]]));
  const legend = top.slice(0, 7).map(([label, count]) => ({ label, color: colors.get(label), count }));
  const other = top.slice(7).reduce((s, [, n]) => s + n, 0);
  if (other) legend.push({ label: 'Other', color: OTHER, count: other });
  return { colors, legend };
}

function fillFor(opts, st, tree, id, n, gen, pal) {
  if (opts.colorMode === 'tones') return st.tone;
  if (opts.colorMode === 'lines') return gen <= 1 ? st.tone : (Math.floor(n / 2 ** (gen - 2)) === 2 ? st.a : st.b);
  const c = tree.people[id]?.birth?.country;
  return (c && pal.colors.get(c)) || OTHER;
}

function ladderFor(tree, id, opts) {
  const p = tree.people[id];
  const o = opts.overrides?.[id] || {};
  const person = o.name ? { ...p, name: o.name, given: '', surname: '' } : p;
  const ladder = o.name ? [o.name] : nameLadder(person);
  if (opts.privacy === 'living-only' && p.living) return ['Living'];
  return ladder.length ? ladder : ['Unknown'];
}

function header(items, opts, st, W, m, rootName, gens, hasGlyphs) {
  const maxW = m.w * 0.8;
  const candidates = opts.title ? [opts.title] : [`The Ancestors of ${rootName}`, 'The Family Tree'];
  let title = candidates[candidates.length - 1], tf = titleFont('cg-600', title, hasGlyphs), size = 8;
  for (const c of candidates) {
    const f = titleFont('cg-600', c, hasGlyphs);
    // small caps with tracking run about 25% wider than the plain string
    const fit = fitText([c], maxW / 1.25, f, Math.max(14, m.w / 22), 8);
    if (fit) { title = c; tf = f; size = fit.size; break; }
  }
  const subtitle = opts.subtitle || `${gens} generations`;
  items.push(...smallCapsText(title, tf, size, W / 2, m.y + size, { anchor: 'middle', tracking: 0.8, color: st.ink }));
  const sf = titleFont('cg-500i', subtitle, hasGlyphs);
  const sfit = fitText([subtitle], maxW, sf, size * 0.55, 7);
  if (sfit) items.push({ t: 'text', x: W / 2, y: m.y + size * 1.9, str: sfit.str, font: sf, size: sfit.size, color: st.ink, anchor: 'middle' });
  if (opts.dedication) {
    const df = titleFont('cg-500i', opts.dedication, hasGlyphs);
    items.push({ t: 'text', x: W / 2, y: m.y + size * 2.7, str: opts.dedication, font: df, size: Math.max(7, size * 0.4), color: st.ink, anchor: 'middle' });
  }
  return { title, subtitle, height: size * 3.1 };
}

function frame(items, st, W, H, m) {
  items.push({ t: 'path', d: rectPath(m.x * 0.5, m.y * 0.5, W - m.x, H - m.y), stroke: st.line, sw: 0.5 });
  items.push({ t: 'path', d: rectPath(m.x * 0.5 + 3, m.y * 0.5 + 3, W - m.x - 6, H - m.y - 6), stroke: st.line, sw: 0.35 });
}

function footer(items, opts, st, W, H, m, legend) {
  let y = H - m.y * 0.5 - 8;
  if (opts.colophon) {
    items.push({ t: 'text', x: W / 2, y, str: 'Made with Gildroot · gildroot.com', font: 'ebg-400', size: 7, color: st.ink, anchor: 'middle' });
    y -= 12;
  }
  if (legend && legend.length) {
    const total = legend.reduce((s, l) => s + l.count, 0) || 1;
    let x = m.x;
    for (const l of legend) {
      items.push({ t: 'path', d: rectPath(x, y - 6, 7, 7), fill: l.color, stroke: st.line, sw: 0.35 });
      const str = `${l.label} ${Math.round((100 * l.count) / total)}%`;
      items.push({ t: 'text', x: x + 10, y, str, font: 'ebg-400', size: 7, color: st.ink });
      x += 16 + str.length * 3.8;
      if (x > W - m.x - 60) { x = m.x; y -= 11; }
    }
  }
}

/** One fan wedge set: generations 1..G of `amap` over [start, start + sweep]. */
function fanRings(ctx, amap, side, start, sweep, gFirst, G, r0, ringW, stats) {
  const { items, hits, tree, opts, st, cx, cy, pal } = ctx;
  for (let g = gFirst; g <= G; g++) {
    const slots = 2 ** (g - 1);
    const span = sweep / slots;
    const rIn = r0 + (g - gFirst) * ringW, rOut = rIn + ringW, rMid = (rIn + rOut) / 2;
    for (let k = 0; k < slots; k++) {
      const n = slots + k;
      const a0 = start + k * span, a1 = a0 + span, mid = (a0 + a1) / 2;
      const id = amap.get(n);
      stats.slots++;
      if (!id || (opts.overrides?.[id]?.hidden && opts.qaDefect !== 'ignore-hidden')) {
        stats.missing++;
        items.push({ t: 'path', d: sectorPath(cx, cy, rIn, rOut, a0, a1), stroke: st.faint, sw: 0.35 });
        continue;
      }
      items.push({ t: 'path', d: sectorPath(cx, cy, rIn, rOut, a0, a1), fill: fillFor(opts, st, tree, id, n, g, pal), stroke: st.line, sw: 0.4 });
      hits.push({ personId: id, ahnen: n, ...(side ? { side } : {}), shape: 'sector', cx, cy, r0: rIn, r1: rOut, a0, a1 });
      const ladder = ladderFor(tree, id, opts);
      let fit;
      if (g - gFirst < 3) {
        fit = fitArc(ladder, 'ebg-400', rMid, span * 0.9, Math.min(14, ringW * 0.45));
        if (fit) items.push(arcText(fit.str, 'ebg-400', fit.size, st.ink, cx, cy, rMid, mid, { valign: 'middle' }));
      } else {
        const across = arcLength(span, rMid);
        fit = fitText(ladder, ringW * 0.9, 'ebg-400', Math.min(11, across * 0.7));
        if (fit && fit.size <= across * 0.95) items.push(...radialText([fit.str], 'ebg-400', fit.size, cx, cy, rMid, mid, { color: st.ink }));
        else fit = null;
      }
      if (fit) { stats.placed++; if (fit.abbreviated) stats.abbreviated++; } else stats.abbreviated++;
    }
  }
}

function rootMedallion(ctx, lines, r0, fontKey = 'ebg-600') {
  const { items, st, cx, cy } = ctx;
  items.push({ t: 'path', d: sectorPath(cx, cy, 0, r0, 0, 360), fill: st.bg, stroke: st.line, sw: 0.5 });
  const fit = fitBlock(lines, r0 * 1.6, r0 * 1.1, fontKey, 18);
  if (!fit) return;
  const gap = fit.size * 1.15;
  fit.lines.forEach((l, i) => items.push({ t: 'text', x: cx, y: cy + (i - (fit.lines.length - 1) / 2) * gap, str: l, font: fontKey, size: fit.size, color: st.ink, anchor: 'middle', baseline: 'middle' }));
}

function layoutFan(opts, env) {
  const { tree, st, W, H, m } = env;
  const G = clampGenerations(opts.size, 'fan', opts.generations);
  const sweep = opts.sweep || (G <= 5 ? 180 : 270);
  const amap = ancestors(tree, opts.rootId, G);
  const pal = palette(tree, amap.values());
  const items = [], hits = [];
  frame(items, st, W, H, m);
  const head = header(items, opts, st, W, m, ladderFor(tree, opts.rootId, opts)[0], G, opts.hasGlyphs);
  const top = m.y + head.height, bottom = H - m.y - 40;
  const availH = bottom - top, availW = m.w;
  let R, cy;
  if (sweep === 180) { R = Math.min(availW / 2, availH * 0.95); cy = top + R; }
  else if (sweep === 270) { R = Math.min(availW / 2, availH / (1 + Math.SQRT1_2)); cy = top + R; }
  else { R = Math.min(availW, availH) / 2; cy = top + availH / 2; }
  const cx = W / 2;
  const r0 = R * 0.16, ringW = (R - r0) / Math.max(1, G - 1);
  const ctx = { items, hits, tree, opts, st, cx, cy, pal };
  const stats = { slots: 1, placed: 1, abbreviated: 0, missing: 0 };
  fanRings(ctx, amap, null, -sweep / 2, sweep, 2, G, r0, ringW, stats);
  const root = tree.people[opts.rootId];
  rootMedallion(ctx, ladderFor(tree, opts.rootId, opts), r0);
  hits.push({ personId: opts.rootId, ahnen: 1, shape: 'sector', cx, cy, r0: 0, r1: r0, a0: 0, a1: 360 });
  const dates = formatYearRange(root.birth, root.death);
  if (dates && !(opts.privacy !== 'show-all' && root.living)) items.push({ t: 'text', x: cx, y: cy + r0 + 12, str: dates, font: 'ebg-400', size: 9, color: st.ink, anchor: 'middle' });
  footer(items, opts, st, W, H, m, opts.colorMode === 'atlas' ? pal.legend : null);
  return { items, hits, G, head, stats, legend: pal.legend };
}

function layoutBowtie(opts, env) {
  const { tree, st, W, H, m } = env;
  const G = clampGenerations(opts.size, 'bowtie', opts.generations);
  const [aId, bId] = opts.coupleIds;
  const aMap = ancestors(tree, aId, G), bMap = ancestors(tree, bId, G);
  const pal = palette(tree, [...aMap.values(), ...bMap.values()]);
  const items = [], hits = [];
  frame(items, st, W, H, m);
  const head = header(items, opts, st, W, m, `${ladderFor(tree, aId, opts)[0]} & ${ladderFor(tree, bId, opts)[0]}`, G, opts.hasGlyphs);
  const top = m.y + head.height, bottom = H - m.y - 40;
  const R = Math.min(m.w / 2, (bottom - top) / 2);
  const cx = W / 2, cy = top + (bottom - top) / 2;
  const r0 = R * 0.2, ringW = (R - r0) / G;
  const ctx = { items, hits, tree, opts, st, cx, cy, pal };
  const stats = { slots: 0, placed: 0, abbreviated: 0, missing: 0 };
  fanRings(ctx, aMap, 'a', 180, 180, 1, G, r0, ringW, stats);
  fanRings(ctx, bMap, 'b', 0, 180, 1, G, r0, ringW, stats);
  items.push({ t: 'path', d: sectorPath(cx, cy, 0, r0, 0, 360), fill: st.bg, stroke: st.line, sw: 0.5 });
  const la = fitText(ladderFor(tree, aId, opts), r0 * 1.7, 'ebg-600', 12), lb = fitText(ladderFor(tree, bId, opts), r0 * 1.7, 'ebg-600', 12);
  if (la) items.push({ t: 'text', x: cx, y: cy - r0 * 0.35, str: la.str, font: 'ebg-600', size: la.size, color: st.ink, anchor: 'middle', baseline: 'middle' });
  items.push({ t: 'text', x: cx, y: cy, str: '&', font: 'ebg-400i', size: 12, color: st.ink, anchor: 'middle', baseline: 'middle' });
  if (lb) items.push({ t: 'text', x: cx, y: cy + r0 * 0.35, str: lb.str, font: 'ebg-600', size: lb.size, color: st.ink, anchor: 'middle', baseline: 'middle' });
  footer(items, opts, st, W, H, m, opts.colorMode === 'atlas' ? pal.legend : null);
  return { items, hits, G, head, stats, legend: pal.legend };
}

function layoutPedigree(opts, env) {
  const { tree, st, W, H, m } = env;
  const G = clampGenerations(opts.size, 'pedigree', opts.generations);
  const amap = ancestors(tree, opts.rootId, G);
  const pal = palette(tree, amap.values());
  const items = [], hits = [];
  frame(items, st, W, H, m);
  const head = header(items, opts, st, W, m, ladderFor(tree, opts.rootId, opts)[0], G, opts.hasGlyphs);
  const top = m.y + head.height, bottom = H - m.y - 40, colW = m.w / G;
  const stats = { slots: 0, placed: 0, abbreviated: 0, missing: 0 };
  const boxes = new Map();
  for (let g = 1; g <= G; g++) {
    const rows = 2 ** (g - 1), rowH = (bottom - top) / rows;
    for (let k = 0; k < rows; k++) {
      const n = rows + k, id = amap.get(n);
      const x = m.x + (g - 1) * colW + colW * 0.06, w = colW * 0.82, h = Math.min(rowH * 0.8, 60), y = top + (k + 0.5) * rowH - h / 2;
      boxes.set(n, { x, y, w, h });
      stats.slots++;
      if (!id || opts.overrides?.[id]?.hidden) { stats.missing++; items.push({ t: 'path', d: rectPath(x, y, w, h), stroke: st.faint, sw: 0.35 }); continue; }
      items.push({ t: 'path', d: rectPath(x, y, w, h, 2), fill: fillFor(opts, st, tree, id, n, g, pal), stroke: st.line, sw: 0.4 });
      hits.push({ personId: id, ahnen: n, shape: 'rect', x, y, w, h });
      const fit = fitBlock(ladderFor(tree, id, opts), w * 0.92, h * 0.9, 'ebg-400', 12);
      if (!fit) { stats.abbreviated++; continue; }
      stats.placed++;
      if (fit.abbreviated) stats.abbreviated++;
      const gap = fit.size * 1.15;
      fit.lines.forEach((l, i) => items.push({ t: 'text', x: x + w / 2, y: y + h / 2 + (i - (fit.lines.length - 1) / 2) * gap, str: l, font: 'ebg-400', size: fit.size, color: st.ink, anchor: 'middle', baseline: 'middle' }));
    }
  }
  for (const [n, b] of boxes) {
    const f = boxes.get(2 * n), mo = boxes.get(2 * n + 1);
    if (!f || !mo || !amap.get(n)) continue;
    const x0 = b.x + b.w, xm = (x0 + f.x) / 2, y0 = b.y + b.h / 2;
    items.push({ t: 'path', d: `M${x0} ${y0} H${xm} M${xm} ${f.y + f.h / 2} V${mo.y + mo.h / 2} M${xm} ${f.y + f.h / 2} H${f.x} M${xm} ${mo.y + mo.h / 2} H${mo.x}`, stroke: st.line, sw: 0.4 });
  }
  footer(items, opts, st, W, H, m, opts.colorMode === 'atlas' ? pal.legend : null);
  return { items, hits, G, head, stats, legend: pal.legend };
}

/**
 * Same signature as charts/layout.js (docs/ARCHITECTURE.md).
 * @param {object} opts
 * @returns {object} Scene
 */
export function layout(opts) {
  setTextBackend({ measure: opts.measure, metrics: opts.metrics, hasGlyphs: opts.hasGlyphs });
  const st = styleFor(opts);
  const chart = opts.chart;
  if (!CHARTS.includes(chart)) throw new Error(`unknown chart "${chart}"`);
  const orientation = resolveOrientation(chart, opts.orientation || 'auto', opts.sweep || (clampGenerations(opts.size, 'fan', opts.generations) <= 5 ? 180 : 270));
  let { wPt: W, hPt: H } = pageSize(opts.qaDefect === 'wrong-size' ? (opts.size === 'letter' ? 'a4' : 'letter') : opts.size, orientation);
  const m = margins(W, H);
  const env = { tree: opts.tree, st, W, H, m };
  const r = chart === 'fan' ? layoutFan(opts, env) : chart === 'bowtie' ? layoutBowtie(opts, env) : layoutPedigree(opts, env);

  // injected defects for the harness self-test
  const d = opts.qaDefect;
  if (d === 'small-text') r.items.push({ t: 'text', x: m.x, y: H - m.y, str: 'Too small to read', font: 'ebg-400', size: 4, color: st.ink });
  if (d === 'thin-stroke') r.items.push({ t: 'path', d: `M${m.x} ${m.y} H${W - m.x}`, stroke: st.line, sw: 0.2 });
  if (d === 'offpage') r.items.push({ t: 'text', x: W + 40, y: H / 2, str: 'Lost Name', font: 'ebg-400', size: 9, color: st.ink });
  if (d === 'cjk-text') r.items.push({ t: 'text', x: W / 2, y: H - m.y, str: '王秀英', font: 'ebg-400', size: 9, color: st.ink, anchor: 'middle' });
  if (d === 'no-root') r.hits = r.hits.filter(h => h.personId !== opts.rootId && !(opts.coupleIds || []).includes(h.personId));

  return {
    wPt: W, hPt: H, bg: st.bg, items: r.items, hits: r.hits,
    meta: {
      chart, style: opts.style, colorMode: opts.colorMode, generations: r.G,
      fonts: [...new Set(['ebg-400', 'ebg-600', 'cg-600', 'cg-500i'])],
      counts: r.stats, warnings: [],
      ...(opts.colorMode === 'atlas' ? { legend: r.legend } : {}),
      title: r.head.title, subtitle: r.head.subtitle,
    },
  };
}
