// Bowtie chart engine (company/BRIEF.md §4.3 "Bowtie ('Two families')", §4.7 craft rules).
//
// Called by layout.js with a prepared context (see the protocol at the top of layout.js).
// Two 180° half-fans, back to back, form a single circle of radius R: the west half
// (angles 180°..360°, i.e. down -> left -> up) fans out the ancestors of the first
// partner (coupleIds[0], "side a"), the east half (0°..180°, up -> right -> down) the
// ancestors of the second (coupleIds[1], "side b"). Angles follow the Scene IR / text.js
// convention: 0 = up (12 o'clock), clockwise. Between the two halves, a shared centre
// medallion carries both partners' names, an ampersand, and their marriage date and place.
//
// This file follows the exact patterns layout-fan.js established (and the same Bug 1/2/3
// fixes it verified): per-ring type sizing solved by bisecting one scale factor λ, arc
// names on rings 1-3 with one glyph placed at a time (text.js arcGlyphs), radial names
// beyond that, the abbreviation ladder with a 6pt minimum / 5.5pt floor, safeFont's
// Greek/Cyrillic fallback for styles that assign Cormorant Garamond to a name role,
// pedigree-collapse markers, and Atlas colouring. Because both halves must share one set
// of ring radii (so the chart reads as one symmetric bowtie, not two mismatched fans),
// ring depths are solved once from the *combined* per-ring slot lists of both sides —
// exactly as a single fan chart already solves one ring from both its paternal (left) and
// maternal (right) slots. layout-fan.js does not export its internal fitting helpers (they
// close over fan-only geometry in places), so the generic ones (arc/radial fitting, line
// work, the abbreviation/date/place fitting) are reproduced here; only the two genuinely
// shared, exported helpers (placeLadder, splitTwo) are imported from it.

import { ancestors, collapse as collapseMap } from '../engine/tree.js';
import { nameLadder, splitName } from '../engine/names.js';
import { displayFor } from '../engine/living.js';
import { arcGlyphs, radialRotation, polar, textWidth, safeFont, MIN_TEXT_PT, FLOOR_TEXT_PT, FIT_SLACK } from './text.js';
import { sectorPath, circlePath, fmt } from './path.js';
import { wedgeFill } from './styles.js';
import { paint, medallionRing } from './ornaments.js';
import { markerItems } from './layout.js';
import { placeLadder, splitTwo } from './layout-fan.js';

const DEG = Math.PI / 180;
const r3 = v => Math.round(v * 1000) / 1000;
const q25 = v => Math.floor(v * 4 + 1e-9) / 4;

const EXT_TOP = 0.54;
const EXT_BOT = 0.56;
const PITCH = { nn: 1.04, na: 1.15, an: 1.15, nd: 1.26, ad: 1.2, dp: 1.16, np: 1.26, ap: 1.2, dd: 1.1, aa: 1.1 };
/** Ring type sizes relative to the medallion's reference size (λ = 1); same table as the fan. */
const RING_BASE = [0.54, 0.44, 0.36, 0.3, 0.255];
/** Medallion radius limits as a fraction of R, by generations per side (bigger than the fan's:
 * this medallion carries two names, an ampersand and a marriage line, not one). */
const MED_FRACTION = { 3: [0.24, 0.36], 4: [0.2, 0.3], 5: [0.17, 0.26], 6: [0.145, 0.22] };

/**
 * Lay out a bowtie chart. See layout.js for ctx and the return shape.
 * @param {object} ctx
 */
export function layoutBowtie(ctx) {
  const { opts: o, tree, page, style: st, kit } = ctx;
  const G = ctx.generations;
  const K = G - 1;
  const sizes = kit.textSizes;
  const live = page.live;
  const [aId, bId] = o.coupleIds;
  const warnings = [];
  const W = unitWidths();

  const sideA = buildSide(tree, aId, G, o, st, warnings, ctx.hasGlyphs, W);
  const sideB = buildSide(tree, bId, G, o, st, warnings, ctx.hasGlyphs, W);
  const peopleById = new Map();
  for (const p of [...sideA.people, ...sideB.people]) peopleById.set(p.id, p);
  const people = [...peopleById.values()];
  const genById = new Map();
  for (const g of [sideA.genById, sideB.genById]) for (const [id, gen] of g) if (!genById.has(id)) genById.set(id, gen);
  const generationOf = id => genById.get(id) || 0;

  // ---- furniture blocks ---------------------------------------------------
  const atlasProbe = kit.atlas(people, { maxW: live.w, generationOf });
  const atlas = atlasProbe ? atlasProbe.atlas : null;
  const collapseA = collapseMarkers(sideA.ahnen, tree, sideA.slots, 0);
  const collapseB = collapseMarkers(sideB.ahnen, tree, sideB.slots, collapseA.entries.length);
  const collapseEntries = [...collapseA.entries, ...collapseB.entries];
  const sideLabelFont = safeFont(st.fonts.legendHead, [shortLabel(sideA.root), shortLabel(sideB.root)], 'ebg-600');
  const labelA = sideLabelBlock(shortLabel(sideA.root), sideLabelFont, st, sizes);
  const labelB = sideLabelBlock(shortLabel(sideB.root), sideLabelFont, st, sizes);
  const noteBlocks = (maxW, cols) => {
    const list = [];
    if (labelA) list.push({ block: labelA, prefer: ['tl', 'bl', 'tr', 'br'] });
    if (labelB) list.push({ block: labelB, prefer: ['tr', 'br', 'tl', 'bl'] });
    if (atlas) {
      const b = kit.atlas(people, { maxW, generationOf, columns: cols });
      if (b && !b.empty) list.push({ block: b, prefer: ['bl', 'br', 'tl', 'tr'] });
    }
    const cb = kit.collapse(collapseEntries, { maxW });
    if (cb) list.push({ block: cb, prefer: ['br', 'bl', 'tr', 'tl'] });
    const comp = kit.compass(Math.min(live.w, live.h) * 0.13);
    if (comp) list.push({ block: comp, prefer: ['tl', 'tr', 'bl', 'br'], compass: true });
    return list;
  };

  // ---- medallion text (unit sizes) ----------------------------------------
  const rootFont = /^cg-/.test(st.fonts.root) ? safeFont(st.fonts.root, [sideA.root.ladder[0], sideB.root.ladder[0]], 'ebg-600') : st.fonts.root;
  const marriage = marriageInfo(tree, aId, bId, o);
  const medText = buildMedallionText(sideA.root, sideB.root, marriage, rootFont, st, o, W);
  const fr = MED_FRACTION[Math.min(6, Math.max(3, G))];
  const Sref = sizes.root * 0.86;
  const medallionFor = R => {
    const lo = fr[0] * R, hi = fr[1] * R;
    const want = Sref * medText.r1;
    let r = Math.min(hi, Math.max(lo, want));
    let s = r / medText.r1;
    s = Math.min(s, Sref * 1.5);
    r = Math.max(lo, Math.min(r, s * medText.r1));
    return { r, s: q25(s) };
  };

  // ---- composition: largest R that fits the title and legends -------------
  let head = kit.head({ maxW: live.w, laurel: true, people });
  let comp = composeBowtie(live, sizes, head, noteBlocks);
  const med0 = medallionFor(comp.R);
  if (head.titleSize > med0.s * 1.05) {
    head = kit.head({ maxW: live.w, maxSize: med0.s * 1.0, laurel: true, people });
    comp = composeBowtie(live, sizes, head, noteBlocks);
  }
  const { R, cx, cy } = comp;
  const med = medallionFor(R);
  const rMed = med.r, Sroot = med.s;

  const rings = solveRingsTwoSided({ R, rMed, Sroot, Sref, K, ringsA: sideA.ringSlots, ringsB: sideB.ringSlots, st, W });

  // ---- draw -----------------------------------------------------------------
  const items = [];
  const hits = [];
  const names = [];
  let abbreviated = 0, placedCount = 0, missing = 0;
  const fills = new Map();
  const addFill = (color, d) => { if (!color) return; if (!fills.has(color)) fills.set(color, []); fills.get(color).push(d); };
  const env = { cx, cy, st, W };

  const sides = [{ data: sideA, aStart: 180, key: 'a' }, { data: sideB, aStart: 0, key: 'b' }];
  for (const side of sides) {
    const S = 180;
    const state = new Uint8Array(2 ** G);
    state[1] = 2;
    for (let a = 2; a < 2 ** G; a++) {
      const slot = side.data.slots.get(a);
      if (slot) state[a] = slot.unknown ? 1 : 2;
      else state[a] = !o.trimEmpty && state[a >> 1] ? 1 : 0;
      if (!slot) missing++;
    }
    for (let k = 1; k <= K; k++) {
      const n = 2 ** k;
      const { r0, r1 } = rings[k];
      for (let j = 0; j < n; j++) {
        const a = n + j;
        if (!state[a]) continue;
        const a0 = side.aStart + (S * j) / n, a1 = side.aStart + (S * (j + 1)) / n;
        const quarter = k >= 2 ? (a >> (k - 2)) - 4 : -1;
        const slot = side.data.slots.get(a);
        let atlasColor;
        if (st.mode === 'atlas' && slot && !slot.unknown) atlasColor = atlas ? atlas.colorOf(slot.id) : null;
        const color = wedgeFill(st, { ring: k, rings: G, index: j, quarter, side: side.key, atlasColor, empty: state[a] === 1 });
        addFill(color, sectorPath(cx, cy, r0, r1, a0, a1));
      }
    }
    items.push(...lineWork({ cx, cy, rings, K, S, aStart: side.aStart, state, st }));
  }
  for (const [color, ds] of fills) items.push({ t: 'path', d: ds.join(' '), fill: color });

  // people text (after fills/line work so glyphs sit on top)
  const textItems = [];
  const markerList = [];
  for (const side of sides) {
    for (let k = 1; k <= K; k++) {
      const n = 2 ** k;
      const ring = rings[k];
      for (let j = 0; j < n; j++) {
        const a = n + j;
        const slot = side.data.slots.get(a);
        if (!slot) continue;
        const a0 = side.aStart + (180 * j) / n, a1 = side.aStart + (180 * (j + 1)) / n;
        hits.push({ personId: slot.id, ahnen: a, side: side.key, shape: 'sector', cx: r3(cx), cy: r3(cy), r0: r3(ring.r0), r1: r3(ring.r1), a0: r3(a0), a1: r3(a1) });
        if (slot.unknown) continue;
        const fit = ring.kind === 'arc'
          ? fitArcSlot(slot, ring, (a0 + a1) / 2, a1 - a0, env)
          : fitRadialSlot(slot, ring, (a0 + a1) / 2, a1 - a0, env);
        if (!fit) { warnings.push(`No room for ${slot.ladder[0] || slot.id} (slot ${side.key}${a})`); continue; }
        placedCount++;
        if (fit.rung > 0) abbreviated++;
        textItems.push(...fit.items);
        names.push(...fit.nameLines);
        if (fit.marker) markerList.push(fit.marker);
      }
    }
  }
  items.push(...textItems);
  for (const m of markerList) items.push(...markerItems(m.n, m.x, m.y, m.size, st));

  // medallion (drawn after both halves so it sits cleanly on the seam)
  items.push(...drawMedallion({ cx, cy, r: rMed, s: Sroot, text: medText, st }));
  names.push(...medText.nameLines);
  hits.push({ personId: aId, shape: 'sector', cx: r3(cx), cy: r3(cy), r0: 0, r1: r3(rMed), a0: -90, a1: 90 });
  hits.push({ personId: bId, shape: 'sector', cx: r3(cx), cy: r3(cy), r0: 0, r1: r3(rMed), a0: 90, a1: 270 });
  placedCount += 2;

  // furniture
  items.push(...head.draw(comp.headPos.x, comp.headPos.y));
  for (const n of comp.notes) items.push(...n.block.draw(n.x, n.y));

  const slotsTotal = 2 * (2 ** G - 2); // both sides, excluding each side's own root
  return {
    items, hits, names, people,
    counts: { slots: slotsTotal, placed: placedCount, abbreviated, missing },
    warnings,
    collapse: collapseEntries.map(e => ({ n: e.n, ids: e.ids, names: e.names, times: e.times })),
    score: R,
  };
}

// ---------------------------------------------------------------------------
// Slots (adapted from layout-fan.js's makeSlot/collapseMarkers/unitWidths)

function unitWidths() {
  const caches = new Map();
  const splitCaches = new Map();
  const self = {
    w(font, str) {
      if (!str) return 0;
      let c = caches.get(font);
      if (!c) { c = new Map(); caches.set(font, c); }
      let v = c.get(str);
      if (v === undefined) { v = textWidth(str, font, 1); c.set(str, v); }
      return v;
    },
    split(font, str) {
      if (!str) return null;
      let c = splitCaches.get(font);
      if (!c) { c = new Map(); splitCaches.set(font, c); }
      if (c.has(str)) return c.get(str);
      const v = splitTwo(str, x => self.w(font, x));
      c.set(str, v);
      return v;
    },
  };
  return self;
}

function fullDateRange(p) {
  const b = p.birth && p.birth.date, d = p.death && p.death.date;
  const rich = x => x && x.display && (x.day || x.month);
  if (!rich(b) && !rich(d)) return '';
  const bs = b && b.display ? b.display : '', ds = d && d.display ? d.display : '';
  if (bs && ds) return `${bs} – ${ds}`;
  if (bs) return `b. ${bs}`;
  if (ds) return `d. ${ds}`;
  return '';
}

function makeSlot(p, o, st, warnings, glyphCheck) {
  const slot = { id: p.id, person: p, unknown: !!p.unknown, ladder: [], dates: [], places: [], marker: null };
  if (slot.unknown) return slot;
  const disp = displayFor(p, o.privacy);
  if (p.living && o.privacy === 'living-only') { slot.ladder = ['Living']; return slot; }
  let person = p;
  const probeFont = st.fonts.nameOuter;
  if (glyphCheck && p.name) {
    const g = glyphCheck(probeFont, p.name);
    if (!g.ok) {
      if (p.romanized) {
        const sp = splitName(p.romanized);
        person = { ...p, name: p.romanized, given: sp.given, surname: sp.surname, suffix: sp.suffix };
      } else warnings.push(`${p.name} has characters the chart fonts cannot print (${g.missing.join(' ')}); enter a romanized form`);
    }
  }
  slot.ladder = nameLadder(person);
  if (!slot.ladder.length) slot.ladder = [disp.name || '—'];
  if (disp.dates) {
    const full = fullDateRange(p);
    slot.dates = full && full !== disp.dates ? [full, disp.dates] : [disp.dates];
    if (slot.dates.length > 1) slot.dates = [slot.dates[1]]; // bowtie never uses the keepsake full-date form
  }
  if (o.showPlaces && disp.place) slot.places = placeLadder(disp.place);
  return slot;
}

/** One side's slot data: the root's own slot (folded into the shared medallion), every
 * descendant slot keyed by its own Ahnentafel number, and per-ring lists for the solver. */
function buildSide(tree, personId, G, o, st, warnings, hasGlyphs, W) {
  const ahnen = ancestors(tree, personId, G, { adoptive: o.adoptive });
  const slots = new Map();
  const shown = new Map();
  const genById = new Map();
  let root = null;
  for (const [a, id] of ahnen) {
    const p = tree.people[id];
    if (!p) continue;
    shown.set(id, p);
    if (!genById.has(id)) genById.set(id, Math.floor(Math.log2(a)) + 1);
    const slot = makeSlot(p, o, st, warnings, hasGlyphs);
    if (a === 1) root = slot;
    else slots.set(a, slot);
  }
  if (!root) root = { id: personId, person: tree.people[personId], unknown: false, ladder: ['—'], dates: [], places: [] };
  const K = G - 1;
  const ringSlots = [];
  for (let k = 1; k <= K; k++) {
    const list = [];
    for (let a = 2 ** k; a < 2 ** (k + 1); a++) { const s = slots.get(a); if (s && !s.unknown) list.push(s); }
    ringSlots[k] = list;
  }
  void W;
  return { id: personId, root, ahnen, slots, people: [...shown.values()], genById, ringSlots };
}

/** Short label for a "surname-line" side title: a moderately abbreviated ladder rung. */
function shortLabel(slot) {
  const l = slot.ladder;
  if (!l || !l.length) return '';
  return l[Math.min(l.length - 1, l.length > 3 ? 3 : 1)] || l[0] || '';
}

function sideLabelBlock(str, font, st, sizes) {
  if (!str) return null;
  const size = sizes.legendHead;
  const track = size * 0.14;
  const up = str.toLocaleUpperCase('en-US');
  const w = textWidth(up, font, size, track);
  const h = size * 1.35;
  return { w, h, draw: (x0, y0) => [{ t: 'text', x: r3(x0 + w / 2), y: r3(y0 + size), str: up, font, size: r3(size), color: st.inkSoft, anchor: 'middle', tracking: r3(track) }] };
}

/**
 * Numbered markers for people who appear more than once within one side's own ancestry
 * (adapted from layout-fan.js's collapseMarkers: a Map<ahnen, slot> in place of an array,
 * and a marker-number offset so the two sides' entries share one numbering).
 */
function collapseMarkers(ahnen, tree, slots, startN) {
  const coll = collapseMap(ahnen);
  if (!coll.size) return { entries: [] };
  const count = id => (coll.get(id) || [0]).length || 1;
  const marked = [];
  for (const [id, arr] of coll) {
    const childMin = Math.min(...arr.map(a => (a > 1 ? count(ahnen.get(a >> 1)) : 1)));
    if (arr.length > childMin) marked.push([id, arr]);
  }
  marked.sort((x, y) => x[1][0] - y[1][0]);
  const used = new Set();
  const entries = [];
  for (const [id, arr] of marked) {
    if (used.has(id)) continue;
    used.add(id);
    const ids = [id];
    const spouseA = arr.map(a => a ^ 1);
    const spouse = ahnen.get(spouseA[0]);
    if (spouse && !used.has(spouse)) {
      const sArr = coll.get(spouse) || [];
      if (sArr.length === arr.length && spouseA.every(a => ahnen.get(a) === spouse)) { ids.push(spouse); used.add(spouse); }
    }
    ids.sort((x, y) => coll.get(x)[0] - coll.get(y)[0]);
    const n = startN + entries.length + 1;
    const people = ids.map(i => tree.people[i]);
    entries.push({
      n, ids, times: arr.length,
      names: people.map(p => (p && p.name) || '—'),
      short: people.map(p => { const l = nameLadder(p); return l[Math.min(l.length - 1, l.length > 3 ? 3 : 1)] || p.name; }),
    });
    for (const i of ids) for (const a of coll.get(i)) { const s = slots.get(a); if (s) s.marker = n; }
  }
  return { entries };
}

// ---------------------------------------------------------------------------
// Medallion: both partners' names, an ampersand, marriage date and place.

/** The couple's marriage date/place: an explicit override, else the family linking them. */
function marriageInfo(tree, aId, bId, o) {
  let date = '', place = '';
  const m = o.marriage;
  if (m) {
    if (typeof m.date === 'string') date = m.date;
    else if (m.date && typeof m.date.display === 'string') date = m.date.display;
    if (typeof m.place === 'string') place = m.place;
  }
  if (!date || !place) {
    const A = tree.people[aId];
    for (const fid of (A && A.fams) || []) {
      const fam = tree.families[fid];
      if (fam && fam.partners.includes(bId)) {
        if (!date && fam.marriage && fam.marriage.date && fam.marriage.date.display) date = fam.marriage.date.display;
        if (!place && fam.marriage && fam.marriage.place) place = fam.marriage.place;
        break;
      }
    }
  }
  return { date, place: o.showPlaces ? place : '' };
}

/** One name (1 line, or 2 when that meaningfully narrows the block) for the medallion. */
function nameBlockLines(slot, font, W) {
  const name = slot.ladder[0] || '';
  if (!name) return [];
  const oneW = W.w(font, name);
  const two = /\s/.test(name.trim()) ? W.split(font, name) : null;
  if (two) {
    const twoW = Math.max(W.w(font, two[0]), W.w(font, two[1]));
    if (twoW < oneW * 0.72) return two;
  }
  return [name];
}

function buildMedallionText(rootA, rootB, marriage, font, st, o, W) {
  const lines = [];
  for (const s of nameBlockLines(rootA, font, W)) lines.push({ str: s, font, rel: 1, kind: 'n' });
  lines.push({ str: '&', font: 'ebg-400i', rel: 0.42, kind: 'a' });
  for (const s of nameBlockLines(rootB, font, W)) lines.push({ str: s, font, rel: 1, kind: 'n' });
  if (marriage.date) lines.push({ str: marriage.date, font: st.fonts.dates, rel: 0.4, kind: 'd' });
  if (marriage.place) {
    const ladder = placeLadder(marriage.place);
    if (ladder.length) lines.push({ str: ladder[Math.min(1, ladder.length - 1)], font: st.fonts.place, rel: 0.34, kind: 'p' });
  }
  const geo = stackGeometry(lines.map(l => l.rel), lines.map(l => l.kind));
  const H = geo.height;
  let r1 = 0;
  lines.forEach((l, i) => {
    const hw = W.w(l.font, l.str) * l.rel / 2;
    const yFar = Math.max(Math.abs(geo.offsets[i] - EXT_TOP * l.rel - H / 2), Math.abs(geo.offsets[i] + EXT_BOT * l.rel - H / 2));
    r1 = Math.max(r1, Math.hypot(hw, yFar));
  });
  r1 = r1 * 1.12 + 0.35;
  const nameLines = lines.filter(l => l.kind === 'n').map(l => l.str);
  void o;
  return { lines, geo, r1, nameLines };
}

function drawMedallion({ cx, cy, r, s, text, st }) {
  const out = [];
  const m = st.medallion;
  out.push({ t: 'path', d: circlePath(cx, cy, r), fill: m.fill });
  if (m.ring === 'solid') out.push(...paint(medallionRing('single', cx, cy, r * 0.93, { sw: 0.4 }), m.name, { opacity: 0.35 }));
  else out.push(...paint(medallionRing(m.ring, cx, cy, r, { sw: 0.5, gap: Math.max(2, r * 0.035) }), m.stroke));
  if (!text || !text.lines.length) return out;
  const { lines, geo } = text;
  const H = geo.height * s;
  const top = cy - H / 2 + s * 0.02;
  const colorFor = k => (k === 'n' ? m.name : k === 'a' ? m.stroke : k === 'd' ? m.dates : m.place);
  lines.forEach((l, i) => {
    const size = Math.max(MIN_TEXT_PT, q25(l.rel * s));
    out.push({ t: 'text', x: r3(cx), y: r3(top + geo.offsets[i] * s), str: l.str, font: l.font, size, color: colorFor(l.kind), anchor: 'middle', baseline: 'middle' });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Composition: the largest circle (medallion + both half-fans) that leaves room
// for the title cartouche and the legends (adapted from layout-fan.js's S = 360 case,
// which already places a small medallion inside a full circle with the title above
// or below and legends in the corners or a row — exactly this chart's shape).

function composeBowtie(live, sizes, head0, noteBlocksFn) {
  const gap = sizes.gap;
  function place(R, hb, headMode, notes, notesMode) {
    const pad = Math.max(gap, R * 0.03);
    let top = -R, bottom = R, headY;
    if (headMode === 'above') { headY = top - pad - hb.h; top = headY; }
    else { headY = bottom + pad; bottom = headY + hb.h; }
    if (2 * R > live.w + 0.01 || hb.w > live.w + 0.01) return null;
    let rowsH = 0;
    const rowLayout = [];
    if (notesMode === 'row' && notes.length) {
      let line = [], lineW = 0, lineH = 0;
      const flush = () => { if (line.length) { rowLayout.push({ items: line, w: lineW, h: lineH }); rowsH += lineH + gap; } line = []; lineW = 0; lineH = 0; };
      for (const n of notes) {
        const add = n.block.w + (line.length ? gap * 3 : 0);
        if (line.length && lineW + add > live.w) flush();
        line.push(n); lineW += n.block.w + (line.length > 1 ? gap * 3 : 0); lineH = Math.max(lineH, n.block.h);
      }
      flush();
      if (rowLayout.some(r => r.w > live.w + 0.01)) return null;
      bottom += gap * 1.6 + rowsH - gap;
    }
    const height = bottom - top;
    if (height > live.h + 0.01) return null;
    const cx = live.x + live.w / 2;
    const cy = live.y + (live.h - height) / 2 - top;
    const headRect = { x: cx - hb.w / 2, y: cy + headY, w: hb.w, h: hb.h };
    const placed = [];
    if (notesMode === 'row' && notes.length) {
      let rowY = cy + (bottom - rowsH);
      for (const r of rowLayout) {
        let x = cx - r.w / 2;
        for (const n of r.items) { placed.push({ block: n.block, x, y: rowY + (r.h - n.block.h) / 2 }); x += n.block.w + gap * 3; }
        rowY += r.h + gap;
      }
    } else if (notesMode === 'corners' && notes.length) {
      const taken = [headRect];
      for (const n of notes) {
        let ok = null;
        for (const c of n.prefer) {
          const b = n.block;
          const x = c[1] === 'l' ? live.x : live.x + live.w - b.w;
          const y = c[0] === 't' ? live.y : live.y + live.h - b.h;
          const rect = { x, y, w: b.w, h: b.h };
          if (rectHitsCircle(rect, cx, cy, R, pad * 0.9)) continue;
          if (taken.some(t => overlaps(t, rect, gap))) continue;
          ok = rect; break;
        }
        if (!ok) return null;
        taken.push(ok);
        placed.push({ block: n.block, x: ok.x, y: ok.y });
      }
    }
    return { R, cx, cy, headPos: { x: headRect.x, y: headRect.y }, notes: placed };
  }
  function maximise(fit) {
    let hi = Math.min(live.w / 2, live.h / 2);
    let lo = hi * 0.18;
    let bestFit = fit(lo);
    if (!bestFit) return null;
    const top = fit(hi);
    if (top) return top;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      const f = fit(mid);
      if (f) { lo = mid; bestFit = f; } else hi = mid;
    }
    return bestFit;
  }
  const notesSets = [noteBlocksFn(live.w * 0.5), noteBlocksFn(live.w * 0.34, 1), noteBlocksFn(live.w)];
  let best = null;
  for (const headMode of ['above', 'below']) {
    for (const notes of notesSets) {
      for (const notesMode of notes.length ? ['corners', 'row'] : ['row']) {
        const res = maximise(R => place(R, head0, headMode, notes, notesMode));
        if (!res) continue;
        const score = res.R * (notesMode === 'corners' ? 1.01 : 1);
        if (!best || score > best.score) best = { ...res, score };
      }
    }
  }
  if (!best) {
    const R = Math.min(live.w / 2, live.h / 2) * 0.85;
    best = { R, cx: live.x + live.w / 2, cy: live.y + live.h / 2, headPos: { x: live.x + live.w / 2 - head0.w / 2, y: live.y + live.h - head0.h }, notes: [] };
  }
  return best;
}

function rectHitsCircle(rect, cx, cy, R, pad) {
  const nx = 10, ny = 6;
  for (let i = 0; i <= nx; i++) {
    for (let j = 0; j <= ny; j++) {
      const x = rect.x + (rect.w * i) / nx, y = rect.y + (rect.h * j) / ny;
      if (Math.hypot(x - cx, y - cy) <= R + pad) return true;
    }
  }
  return false;
}

function overlaps(a, b, gap = 0) {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}

// ---------------------------------------------------------------------------
// Ring solver (adapted from layout-fan.js's solveRings: one λ scales every ring, but here
// each ring's need is taken from the *combined* slot lists of both sides, so both halves
// share identical ring radii).

function stackGeometry(sizes, kinds) {
  const offsets = [];
  let y = EXT_TOP * sizes[0];
  offsets.push(y);
  for (let i = 1; i < sizes.length; i++) {
    const key = kinds[i - 1] + kinds[i];
    const f = PITCH[key] ?? PITCH.nd;
    y += f * (sizes[i - 1] + sizes[i]) / 2;
    offsets.push(y);
  }
  return { offsets, height: y + EXT_BOT * sizes[sizes.length - 1] };
}

function sizesFor(plan, s) {
  const out = [];
  for (const k of plan) {
    if (k === 'n') out.push(s);
    else if (k === 'd') out.push(Math.min(s, Math.max(MIN_TEXT_PT, s * 0.78)));
    else if (k === 'p') out.push(Math.min(s, Math.max(MIN_TEXT_PT, s * 0.74)));
  }
  return out;
}

function planHeight(plan, s) {
  return stackGeometry(sizesFor(plan, s), plan).height;
}

function quantile(arr, q) {
  if (!arr.length) return 0;
  const a = [...arr].sort((x, y) => x - y);
  const i = Math.min(a.length - 1, Math.max(0, Math.ceil(q * a.length) - 1));
  return a[i];
}

function arcPad(s) { return Math.max(1.6, s * 0.34); }
function arcSide(s) { return Math.max(1.5, s * 0.45); }

function arcNeed(list, s, r0, span, plan, font, W) {
  if (!list.length) return planHeight(plan, s) + 2 * arcPad(s);
  const needs = [];
  const rEst = r0 + planHeight(plan, s) * 0.6;
  const L = rEst * span * DEG * (1 - FIT_SLACK) - 2 * arcSide(s);
  for (const slot of list) {
    const p = plan.filter(k => (k === 'd' ? slot.dates.length : k === 'p' ? slot.places.length : true));
    const nw = W.w(font, slot.ladder[0]) * s;
    let lines = p;
    if (nw > L) {
      const sp = W.split(font, slot.ladder[0]);
      if (sp) lines = ['n', ...p];
    }
    needs.push(planHeight(lines, s) + 2 * arcPad(s));
  }
  return quantile(needs, 0.9);
}

function radialAcross(r, span, s, gutter) {
  return r * span * DEG * (1 - 0.05) - gutter - 2 * Math.max(0.6, s * 0.18);
}

function radialPlan(list, cap, r0, span, font, W, hasDates, hasPlaces, gutter) {
  const plans = [];
  if (hasDates && hasPlaces) plans.push(['n', 'd', 'p']);
  if (hasDates) plans.push(['n', 'd']);
  plans.push(['n']);
  const pad = s => Math.max(1.5, s * 0.5);
  let chosen = null;
  for (const plan of plans) {
    let s = cap;
    for (let i = 0; i < 60 && s > FLOOR_TEXT_PT; i++) {
      if (planHeight(plan, s) <= radialAcross(r0 + pad(s), span, s, gutter)) break;
      s -= 0.25;
    }
    s = q25(s);
    const okSize = plan.length === 1 ? s >= FLOOR_TEXT_PT : s >= Math.max(MIN_TEXT_PT + 0.5, cap * 0.8) || (plan.length === 2 && s >= 7);
    if (okSize && planHeight(plan, s) <= radialAcross(r0 + pad(s), span, s, gutter) + 0.01) { chosen = { plan, s }; break; }
  }
  if (!chosen) chosen = { plan: ['n'], s: Math.max(FLOOR_TEXT_PT, q25(cap)) };
  const { plan, s } = chosen;
  const two = planHeight(['n', ...plan], s) <= radialAcross(r0 + pad(s), span, s, gutter);
  const sz = sizesFor(plan, s);
  const ws = [];
  for (const slot of list) {
    let nw = W.w(font, slot.ladder[0]) * s;
    if (two) {
      const sp = W.split(font, slot.ladder[0]);
      if (sp) nw = Math.min(nw, Math.max(W.w(font, sp[0]), W.w(font, sp[1])) * s);
    }
    let w = nw;
    const di = plan.indexOf('d');
    if (di >= 0 && slot.dates.length) w = Math.max(w, W.w('ebg-400', slot.dates[slot.dates.length - 1]) * sz[di]);
    ws.push(w);
  }
  const q = quantile(ws, 0.85) || s * 6;
  const depth = Math.min(Math.max(q * (1 + FIT_SLACK), s * 4.2), s * 12.5) + 2 * pad(s);
  return { plan, s, need: depth, two };
}

function solveRingsTwoSided({ R, rMed, Sroot, Sref, K, ringsA, ringsB, st, W }) {
  const ringSlots = [];
  for (let k = 1; k <= K; k++) ringSlots[k] = [...(ringsA[k] || []), ...(ringsB[k] || [])];
  const anyDates = k => ringSlots[k].some(s => s.dates.length);
  const anyPlaces = k => ringSlots[k].some(s => s.places.length);
  const gutter = st.gutter || 0;
  const CG_FONT = /^cg-/;
  const namesFor = ks => ks.flatMap(k => (ringSlots[k] || []).map(s => s.ladder[0]));
  const innerFont = CG_FONT.test(st.fonts.nameInner) ? safeFont(st.fonts.nameInner, namesFor([1, 2]), 'ebg-600') : st.fonts.nameInner;
  const outerKs = []; for (let k = 3; k <= K; k++) outerKs.push(k);
  const outerFont = CG_FONT.test(st.fonts.nameOuter) ? safeFont(st.fonts.nameOuter, namesFor(outerKs), 'ebg-400') : st.fonts.nameOuter;
  const nameFont = k => (k <= 2 ? innerFont : outerFont);
  const solve = lam => {
    const rings = [null];
    let r = rMed;
    let prev = Sroot * 0.86;
    for (let k = 1; k <= K; k++) {
      const kind = k <= 3 ? 'arc' : 'radial';
      const span = 180 / 2 ** k;
      const font = nameFont(k);
      const cap = Math.min(lam * Sref * (RING_BASE[k - 1] ?? 0.16), prev * (k === 1 ? 1 : 0.94));
      let s, need, plan;
      if (kind === 'arc') {
        s = Math.max(MIN_TEXT_PT, q25(cap));
        plan = ['n'];
        if (anyDates(k)) plan.push('d');
        if (anyPlaces(k)) plan.push('p');
        need = arcNeed(ringSlots[k], s, r, span, plan, font, W);
      } else {
        const res = radialPlan(ringSlots[k], cap, r, span, font, W, anyDates(k), anyPlaces(k), gutter);
        s = res.s; plan = res.plan; need = res.need;
      }
      rings.push({ k, kind, span, font, s, plan, need, r0: r, r1: r + need });
      r += need;
      prev = s;
    }
    return { total: r, rings };
  };
  let lo = 0.15, hi = 3.2;
  let sol = solve(hi);
  if (sol.total > R) {
    let solLo = solve(lo);
    if (solLo.total > R) sol = solLo;
    else {
      for (let i = 0; i < 28; i++) {
        const mid = (lo + hi) / 2;
        const t = solve(mid);
        if (t.total > R) hi = mid; else { lo = mid; solLo = t; }
      }
      sol = solLo;
    }
  }
  const rings = sol.rings;
  const sum = rings.slice(1).reduce((a, r) => a + r.need, 0) || 1;
  const f = (R - rMed) / sum;
  let r = rMed;
  for (let k = 1; k <= K; k++) {
    const d = rings[k].need * f;
    rings[k].r0 = r; rings[k].r1 = r + d; rings[k].depth = d; r += d;
  }
  return rings;
}

// ---------------------------------------------------------------------------
// Fitting one person (verbatim from layout-fan.js: these close only over the
// generic {cx, cy, st, W} env and a ring's own {r0, r1, font, s}, so they work
// unchanged for a bowtie half — the same reason layout-fan.js's own paternal and
// maternal sides already share this code within one ring).

function colorsFor(st) {
  return { n: st.ink, d: st.inkSoft, p: st.inkPlace };
}

function fitArcSlot(slot, ring, centre, span, env) {
  const { W } = env;
  const font = ring.font;
  const s0 = ring.s;
  const flipped = Math.cos(centre * DEG) < -0.2;
  const hasMarker = slot.marker != null;
  const tries = [1, 0.93, 0.86];
  const dateOptions = slot.dates.length ? slot.dates : [];
  const placeOptions = slot.places;
  const wantParts = [
    { dates: true, place: true },
    { dates: true, place: false },
    { dates: false, place: false },
  ];
  for (const parts of wantParts) {
    if (parts.place && !placeOptions.length) continue;
    if (parts.dates && !dateOptions.length && parts.place) continue;
    for (let rung = 0; rung < slot.ladder.length; rung++) {
      const str = slot.ladder[rung];
      for (const nl of [1, 2]) {
        let nameLines = [str];
        if (nl === 2) { const sp = W.split(font, str); if (!sp) continue; nameLines = sp; }
        for (const f of tries) {
          const s = Math.max(MIN_TEXT_PT, q25(s0 * f));
          const res = tryArc(slot, nameLines, s, parts, ring, centre, span, flipped, hasMarker, env);
          if (res) return { ...res, rung };
        }
      }
    }
  }
  const str = slot.ladder[slot.ladder.length - 1];
  const res = tryArc(slot, [str], FLOOR_TEXT_PT, { dates: false, place: false }, ring, centre, span, flipped, hasMarker, env, true);
  return res ? { ...res, rung: slot.ladder.length - 1 } : null;
}

function tryArc(slot, nameLines, s, parts, ring, centre, span, flipped, hasMarker, env, floor = false) {
  const { cx, cy, st, W } = env;
  const font = ring.font;
  const sz = sizesFor(['n', 'd', 'p'], s);
  const lines = nameLines.map(str => ({ str, font, size: s, kind: 'n' }));
  const pad = arcPad(s);
  const side = arcSide(s);
  const avail = r => r * span * DEG * (1 - FIT_SLACK) - 2 * side;
  const build = extra => {
    const all = [...lines, ...extra];
    const geo = stackGeometry(all.map(l => l.size), all.map(l => l.kind));
    return { all, geo };
  };
  const extra = [];
  if (parts.dates && slot.dates.length) extra.push({ str: slot.dates[0], font: st.fonts.dates, size: sz[1], kind: 'd', options: slot.dates });
  if (parts.place && slot.places.length) extra.push({ str: slot.places[0], font: st.fonts.place, size: sz[2], kind: 'p', options: slot.places });
  const { all, geo } = build(extra);
  const H = geo.height;
  if (H > ring.r1 - ring.r0 - 2 * pad + 0.01 && !floor) return null;
  const rMid = (ring.r0 + ring.r1) / 2;
  const radii = all.map((l, i) => (flipped ? rMid - H / 2 + geo.offsets[i] : rMid + H / 2 - geo.offsets[i]));
  const mr = hasMarker ? Math.max(MIN_TEXT_PT, s * 0.8) * 0.62 : 0;
  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    const room = avail(radii[i]) - (i === 0 && hasMarker ? 2 * mr + s * 0.35 : 0);
    if (l.options) {
      let chosen = null;
      for (const opt of l.options) { if (W.w(l.font, opt) * l.size <= room) { chosen = opt; break; } }
      if (!chosen) {
        if (l.kind === 'd') return null;
        all.splice(i, 1); radii.splice(i, 1); i--;
        continue;
      }
      l.str = chosen;
    } else if (W.w(l.font, l.str) * l.size > room) return null;
  }
  const colors = colorsFor(st);
  const items = [];
  const nameLines2 = [];
  const geo2 = stackGeometry(all.map(l => l.size), all.map(l => l.kind));
  const H2 = geo2.height;
  all.forEach((l, i) => {
    const rad = flipped ? rMid - H2 / 2 + geo2.offsets[i] : rMid + H2 / 2 - geo2.offsets[i];
    let ang = centre;
    if (i === 0 && hasMarker) {
      const w = W.w(l.font, l.str) * l.size;
      const shift = ((2 * mr + s * 0.35) / 2) / rad / DEG;
      ang = centre + (flipped ? shift : -shift);
      const mAng = ang + (flipped ? -1 : 1) * ((w / 2 + s * 0.35 + mr) / rad / DEG);
      const [mx, my] = polar(cx, cy, rad, mAng);
      items.markerSpec = { n: slot.marker, x: r3(mx), y: r3(my), size: Math.max(MIN_TEXT_PT, s * 0.8) };
    }
    const g = arcGlyphs(l.str, l.font, l.size, cx, cy, rad, ang, { flip: flipped, valign: 'middle' });
    items.push({ t: 'glyphs', font: l.font, size: l.size, color: colors[l.kind], g: [...g] });
    if (l.kind === 'n') nameLines2.push(l.str);
  });
  return { items, nameLines: nameLines2, marker: items.markerSpec || null };
}

function fitRadialSlot(slot, ring, centre, span, env) {
  const { st, W } = env;
  const plan = ring.plan;
  const s0 = ring.s;
  const tries = [1, 0.93, 0.86];
  const planSets = [];
  const base = plan.filter(k => (k === 'd' ? slot.dates.length : k === 'p' ? slot.places.length : true));
  planSets.push(base);
  if (base.includes('p')) planSets.push(base.filter(k => k !== 'p'));
  if (base.includes('d')) planSets.push(['n']);
  for (const ps of planSets) {
    for (let rung = 0; rung < slot.ladder.length; rung++) {
      for (const nl of [1, 2]) {
        for (const f of tries) {
          const s = Math.max(MIN_TEXT_PT, q25(s0 * f));
          const res = tryRadial(slot, rung, nl, s, ps, ring, centre, span, env);
          if (res) return { ...res, rung };
        }
      }
    }
  }
  for (let rung = slot.ladder.length - 1; rung >= 0; rung--) {
    const res = tryRadial(slot, rung, 1, FLOOR_TEXT_PT, ['n'], ring, centre, span, env, true);
    if (res) return { ...res, rung };
  }
  return null;
}

function tryRadial(slot, rung, nl, s, plan, ring, centre, span, env, floor = false) {
  const { cx, cy, st, W } = env;
  const font = ring.font;
  const str = slot.ladder[rung];
  let nameLines = [str];
  if (nl === 2) { const sp = W.split(font, str); if (!sp) return null; nameLines = sp; }
  const sz = sizesFor(['n', 'd', 'p'], s);
  const lines = nameLines.map(t => ({ str: t, font, size: s, kind: 'n' }));
  const hasMarker = slot.marker != null;
  const mr = hasMarker ? Math.max(MIN_TEXT_PT, s * 0.8) * 0.62 : 0;
  const pad = Math.max(1.5, s * 0.5);
  const depth = ring.r1 - ring.r0;
  const along = depth * (1 - FIT_SLACK) - 2 * pad - (hasMarker ? 2 * mr + s * 0.3 : 0);
  const nameW = Math.max(...lines.map(l => W.w(l.font, l.str) * l.size));
  if (nameW > along + 0.01) return null;
  let maxW = nameW;
  if (plan.includes('d')) {
    let chosen = null;
    for (const opt of slot.dates) { if (W.w(st.fonts.dates, opt) * sz[1] <= along) { chosen = opt; break; } }
    if (!chosen) return null;
    lines.push({ str: chosen, font: st.fonts.dates, size: sz[1], kind: 'd' });
    maxW = Math.max(maxW, W.w(st.fonts.dates, chosen) * sz[1]);
  }
  if (plan.includes('p')) {
    let chosen = null;
    for (const opt of slot.places) { if (W.w(st.fonts.place, opt) * sz[2] <= Math.min(along, Math.max(maxW, along * 0.9))) { chosen = opt; break; } }
    if (chosen) { lines.push({ str: chosen, font: st.fonts.place, size: sz[2], kind: 'p' }); maxW = Math.max(maxW, W.w(st.fonts.place, chosen) * sz[2]); }
  }
  const geo = stackGeometry(lines.map(l => l.size), lines.map(l => l.kind));
  const H = geo.height;
  const shift = hasMarker ? -(2 * mr + s * 0.3) / 2 : 0;
  const rc = (ring.r0 + ring.r1) / 2 + shift;
  const innerEnd = rc - maxW / 2;
  const across = radialAcross(innerEnd, span, s, st.gutter || 0);
  if (H > across + 0.01 && !floor) return null;
  if (floor && H > across * 1.08) return null;
  const { rot } = radialRotation(centre);
  const phi = rot * DEG;
  const nx = -Math.sin(phi), ny = Math.cos(phi);
  const [px, py] = polar(cx, cy, rc, centre);
  const colors = colorsFor(st);
  const items = lines.map((l, i) => {
    const off = geo.offsets[i] - H / 2;
    return { t: 'text', x: r3(px + nx * off), y: r3(py + ny * off), rot: r3(rot), str: l.str, font: l.font, size: l.size, color: colors[l.kind], anchor: 'middle', baseline: 'middle' };
  });
  let marker = null;
  if (hasMarker) {
    const [mx, my] = polar(cx, cy, rc + maxW / 2 + s * 0.3 + mr, centre);
    marker = { n: slot.marker, x: r3(mx), y: r3(my), size: Math.max(MIN_TEXT_PT, s * 0.8) };
  }
  return { items, nameLines: lines.filter(l => l.kind === 'n').map(l => l.str), marker };
}

// ---------------------------------------------------------------------------
// Line work (verbatim from layout-fan.js: generic over aStart/S/state/rings).

function lineWork({ cx, cy, rings, K, S, aStart, state, st }) {
  const strong = [], faint = [];
  const arcSeg = (r, a0, a1) => {
    const [x0, y0] = polar(cx, cy, r, a0);
    const [x1, y1] = polar(cx, cy, r, a1);
    return `M${fmt(x0)} ${fmt(y0)} A${fmt(r)} ${fmt(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${fmt(x1)} ${fmt(y1)}`;
  };
  const pushArcRuns = (r, n, strengthAt) => {
    let j = 0;
    while (j < n) {
      const s = strengthAt(j);
      let e = j + 1;
      while (e < n && strengthAt(e) === s) e++;
      if (s) {
        let a0 = aStart + (S * j) / n;
        const a1 = aStart + (S * e) / n;
        const target = s === 2 ? strong : faint;
        while (a1 - a0 > 179.999) { target.push(arcSeg(r, a0, a0 + 179.99)); a0 += 179.99; }
        if (a1 - a0 > 1e-6) target.push(arcSeg(r, a0, a1));
      }
      j = e;
    }
  };
  for (let k = 1; k <= K; k++) {
    const n = 2 ** k;
    if (k >= 2) pushArcRuns(rings[k].r0, n, j => Math.max(state[n + j], state[(n + j) >> 1]));
    else pushArcRuns(rings[1].r0, n, j => (state[n + j] ? 2 : 0));
    if (k === K) pushArcRuns(rings[k].r1, n, j => state[n + j]);
  }
  const nMax = 2 ** K;
  for (let b = 0; b <= nMax; b++) {
    const ang = aStart + (S * b) / nMax;
    let runStart = null, runStrength = 0, runEnd = null;
    const flush = () => {
      if (runStrength) (runStrength === 2 ? strong : faint).push(radialSeg(cx, cy, runStart, runEnd, ang));
      runStart = null; runStrength = 0;
    };
    for (let k = 1; k <= K; k++) {
      const n = 2 ** k;
      const step = nMax / n;
      if (b % step !== 0) { flush(); continue; }
      const j = b / step;
      const sL = j > 0 ? state[n + j - 1] : 0;
      const sR = j < n ? state[n + j] : 0;
      const s = Math.max(sL, sR);
      if (s === runStrength && runStart != null) runEnd = rings[k].r1;
      else { flush(); if (s) { runStart = rings[k].r0; runEnd = rings[k].r1; runStrength = s; } }
    }
    flush();
  }
  const out = [];
  const L = st.line, F = st.faint;
  if (faint.length) out.push({ t: 'path', d: faint.join(' '), stroke: F.color, sw: Math.max(0.35, F.width), opacity: F.opacity, cap: 'butt' });
  if (strong.length) out.push({ t: 'path', d: strong.join(' '), stroke: L.color, sw: Math.max(0.35, L.width), opacity: L.opacity, cap: 'butt' });
  return out;
}

function radialSeg(cx, cy, r0, r1, ang) {
  const [x0, y0] = polar(cx, cy, r0, ang);
  const [x1, y1] = polar(cx, cy, r1, ang);
  return `M${fmt(x0)} ${fmt(y0)} L${fmt(x1)} ${fmt(y1)}`;
}
