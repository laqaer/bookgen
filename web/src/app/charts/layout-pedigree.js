// Pedigree chart engine (company/BRIEF.md §4.3 "Pedigree", §4.7 craft rules).
//
// Called by layout.js with a prepared context (see the protocol at the top of layout.js).
// A classic horizontal ancestor chart: boxes with elbow connectors, one column per
// generation (root's own box at the left, ancestors fanning out to the right), a plain-word
// header over each ancestor column ("Parents", "Grandparents", "Great-grandparents", ...),
// and outer columns made narrower on purpose so a deep chart still fits the page.
//
// Follows the same craft rules and helpers as layout-fan.js / layout-bowtie.js: the
// abbreviation ladder with a 6pt minimum / 5.5pt floor (here via text.js's fitBlock/fitText,
// which already implement that ladder-walk), pedigree-collapse markers, Atlas colouring,
// and the CJK/Hebrew glyph preflight (the name role used throughout, `st.fonts.nameOuter`,
// is always ebg-400 or sans-400 per every style's tokens — Latin Extended/Greek/Cyrillic/
// Vietnamese-safe — so unlike the fan's inner rings there is no Cormorant Garamond glyph
// gap to guard against here; the preflight only needs to catch scripts no chart font covers).
// Hits are rects, not sectors.

import { ancestors, collapse as collapseMap } from '../engine/tree.js';
import { nameLadder, splitName } from '../engine/names.js';
import { displayFor } from '../engine/living.js';
import { fitBlock, fitText, textWidth, MIN_TEXT_PT, FLOOR_TEXT_PT } from './text.js';
import { rectPath, fmt } from './path.js';
import { wedgeFill } from './styles.js';
import { markerItems } from './layout.js';
import { placeLadder } from './layout-fan.js';

const r3 = v => Math.round(v * 1000) / 1000;

/**
 * Lay out a pedigree chart. See layout.js for ctx and the return shape.
 * @param {object} ctx
 */
export function layoutPedigree(ctx) {
  const { opts: o, tree, rootId, style: st, kit, page } = ctx;
  const G = ctx.generations;
  const sizes = kit.textSizes;
  const live = page.live;
  const warnings = [];

  // ---- 1. ancestors and per-slot display text ------------------------------
  const ahnen = ancestors(tree, rootId, G, { adoptive: o.adoptive });
  const slots = new Map();
  const shown = new Map();
  const genById = new Map();
  for (const [a, id] of ahnen) {
    const p = tree.people[id];
    if (!p) continue;
    shown.set(id, p);
    if (!genById.has(id)) genById.set(id, Math.floor(Math.log2(a)) + 1);
    slots.set(a, makeSlot(p, o, st, warnings, ctx.hasGlyphs));
  }
  const people = [...shown.values()];
  const generationOf = id => genById.get(id) || 0;
  const { entries: collapseEntries } = collapseMarkers(ahnen, tree, slots);

  // ---- 2. furniture: title, column headers, legends ------------------------
  const atlasProbe = kit.atlas(people, { maxW: live.w, generationOf });
  const atlas = atlasProbe ? atlasProbe.atlas : null;
  const notes = [];
  if (atlas) { const b = kit.atlas(people, { maxW: live.w * 0.92, generationOf }); if (b && !b.empty) notes.push(b); }
  const cb = kit.collapse(collapseEntries, { maxW: live.w * 0.92 });
  if (cb) notes.push(cb);
  const comp = kit.compass(Math.min(live.w, live.h) * 0.1);
  if (comp) notes.push(comp);
  const notesRow = packRow(notes, live.w, sizes.gap);

  const head = kit.head({ maxW: live.w, laurel: true, people });

  const gap = sizes.gap;
  const chH = sizes.legendHead * 1.7;
  const used = head.h + gap + chH + notesRow.height + (notesRow.rows.length ? gap * 1.4 : 0);
  const gridH = Math.max(live.h * 0.32, live.h - used);
  let y = live.y;
  const headPos = { x: live.x + live.w / 2 - head.w / 2, y };
  y += head.h + gap;
  const chY = y + sizes.legendHead;
  y += chH;
  const gridTop = y;
  y += gridH;
  const notesTop = y + gap * 0.4;

  // ---- 3. column geometry: outer columns taper narrower --------------------
  const ratio = 0.86;
  const weights = []; for (let g = 1; g <= G; g++) weights.push(ratio ** (g - 1));
  const sumW = weights.reduce((a, b) => a + b, 0);
  const colW = weights.map(w => (live.w * w) / sumW);
  const leftEdge = []; { let x = live.x; for (let g = 1; g <= G; g++) { leftEdge[g] = x; x += colW[g - 1]; } }

  const items = [];
  const hits = [];
  const names = [];
  let placedCount = 0, abbreviated = 0, missing = 0;
  const colors = { n: st.ink, d: st.inkSoft, p: st.inkPlace };
  const nameFont = st.fonts.nameOuter;

  // column headers (plain words: "Parents", "Grandparents", "Great-grandparents", ...)
  const headFont = st.fonts.legendHead;
  for (let g = 2; g <= G; g++) {
    const label = genLabel(g).toLocaleUpperCase('en-US');
    const cxCol = leftEdge[g] + colW[g - 1] / 2;
    // Columns sit edge to edge with no gap, so each header must stay within its own
    // column's span (± a hair) or it collides with the next column's header.
    const maxW = colW[g - 1] * 0.9;
    const track0 = sizes.legendHead * 0.14;
    const w0 = textWidth(label, headFont, sizes.legendHead, track0);
    if (w0 <= maxW) {
      items.push({ t: 'text', x: r3(cxCol), y: r3(chY), str: label, font: headFont, size: r3(sizes.legendHead), color: st.inkSoft, anchor: 'middle', tracking: r3(track0) });
      continue;
    }
    // Shrinking alone can't always save a long label ("GREAT-GREAT-GRANDPARENTS") in a
    // narrow outer column without going below the 5.5pt floor: split onto two lines at
    // the "greats" hyphen instead, the way a long fan title already balances onto two.
    const floorTrack = FLOOR_TEXT_PT * 0.14;
    const wAtFloor = textWidth(label, headFont, FLOOR_TEXT_PT, floorTrack);
    const split = wAtFloor > maxW ? splitHeaderLabel(label) : null;
    if (!split) {
      const hs = Math.max(FLOOR_TEXT_PT, sizes.legendHead * maxW / w0);
      const track = track0 * hs / sizes.legendHead;
      items.push({ t: 'text', x: r3(cxCol), y: r3(chY), str: label, font: headFont, size: r3(hs), color: st.inkSoft, anchor: 'middle', tracking: r3(track) });
      continue;
    }
    const lineW = Math.max(...split.map(s => textWidth(s, headFont, sizes.legendHead, track0)));
    const hs = lineW > maxW ? Math.max(FLOOR_TEXT_PT, sizes.legendHead * maxW / lineW) : sizes.legendHead;
    const track = track0 * hs / sizes.legendHead;
    const pitch = hs * 1.05;
    split.forEach((line, i) => {
      items.push({ t: 'text', x: r3(cxCol), y: r3(chY - pitch * 0.55 + i * pitch), str: line, font: headFont, size: r3(hs), color: st.inkSoft, anchor: 'middle', tracking: r3(track) });
    });
  }

  // ---- 4. boxes --------------------------------------------------------------
  const boxes = new Map();
  const visible = new Map();
  const markerList = [];
  for (let g = 1; g <= G; g++) {
    const rows = 2 ** (g - 1);
    const rowH = gridH / rows;
    const boxH = Math.max(3, Math.min(rowH * 0.76, 46 * page.unit));
    const boxW = Math.max(3, colW[g - 1] * 0.8);
    const bx = leftEdge[g] + colW[g - 1] * 0.1;
    const cr = Math.min(2, boxW * 0.05, boxH * 0.08);
    for (let k = 0; k < rows; k++) {
      const a = rows + k;
      const slot = slots.get(a);
      const isVisible = a === 1 ? true : (slot ? true : !o.trimEmpty && !!visible.get(a >> 1));
      visible.set(a, isVisible);
      if (!isVisible) { if (a >= 2) missing++; continue; }
      const by = gridTop + (k + 0.5) * rowH - boxH / 2;
      const box = { x: bx, y: by, w: boxW, h: boxH };
      boxes.set(a, box);
      if (!slot) {
        missing++;
        items.push(faintBox(box, cr, st));
        continue;
      }
      hits.push({ personId: slot.id, ahnen: a, shape: 'rect', x: r3(box.x), y: r3(box.y), w: r3(box.w), h: r3(box.h) });
      placedCount++;
      if (slot.unknown) { items.push(faintBox(box, cr, st)); continue; }
      const kk = g - 1;
      const quarter = kk >= 2 ? (a >> (kk - 2)) - 4 : -1;
      const side = kk >= 1 ? ((a >> (kk - 1)) === 2 ? 'a' : 'b') : undefined;
      let atlasColor;
      if (st.mode === 'atlas') atlasColor = atlas ? atlas.colorOf(slot.id) : null;
      const fill = wedgeFill(st, { ring: g, rings: G, index: k, quarter, side, atlasColor, empty: false });
      items.push(filledBox(box, cr, fill, st));
      const hasMarker = slot.marker != null;
      const mr = hasMarker ? Math.max(MIN_TEXT_PT, boxH * 0.16) * 0.6 : 0;
      const contentH = box.h * 0.86 - (hasMarker ? mr * 2 + 2 : 0);
      const fit = fitPersonBox(slot, box.w * 0.9, contentH, nameFont);
      if (!fit) { warnings.push(`No room for ${slot.ladder[0] || slot.id} (slot ${a})`); continue; }
      if (fit.abbreviated) abbreviated++;
      names.push(...fit.lines.filter(l => l.kind === 'n').map(l => l.str));
      const shiftY = hasMarker ? -mr : 0;
      items.push(...drawBoxContent(fit, box.x + box.w / 2, box.y + box.h / 2 + shiftY, colors));
      if (hasMarker) markerList.push({ n: slot.marker, x: r3(box.x + box.w / 2), y: r3(box.y + box.h / 2 + shiftY + contentH / 2 + mr + 1), size: Math.max(MIN_TEXT_PT, boxH * 0.16) });
    }
  }
  for (const m of markerList) items.push(...markerItems(m.n, m.x, m.y, m.size, st));

  // ---- 5. elbow connectors ----------------------------------------------------
  const segs = [];
  for (let g = 1; g < G; g++) {
    const rows = 2 ** (g - 1);
    for (let k = 0; k < rows; k++) {
      const a = rows + k;
      const b = boxes.get(a);
      if (!b) continue;
      const f = boxes.get(2 * a), m = boxes.get(2 * a + 1);
      if (!f && !m) continue;
      const x0 = b.x + b.w, y0 = b.y + b.h / 2;
      const childX = (f || m).x;
      const xm = (x0 + childX) / 2;
      segs.push(`M${fmt(x0)} ${fmt(y0)} H${fmt(xm)}`);
      if (f && m) {
        const yF = f.y + f.h / 2, yM = m.y + m.h / 2;
        segs.push(`M${fmt(xm)} ${fmt(yF)} V${fmt(yM)}`);
        segs.push(`M${fmt(xm)} ${fmt(yF)} H${fmt(f.x)}`);
        segs.push(`M${fmt(xm)} ${fmt(yM)} H${fmt(m.x)}`);
      } else {
        const one = f || m;
        const y1 = one.y + one.h / 2;
        segs.push(`M${fmt(xm)} ${fmt(y0)} V${fmt(y1)} H${fmt(one.x)}`);
      }
    }
  }
  if (segs.length) items.push({ t: 'path', d: segs.join(' '), stroke: lineColor(st), sw: Math.max(0.35, st.line.width), opacity: st.line.opacity, cap: 'round' });

  // furniture (drawn last so the title cartouche and legends sit cleanly on top)
  items.push(...head.draw(headPos.x, headPos.y));
  items.push(...drawRows(notesRow.rows, live.x + live.w / 2, notesTop, gap));

  const slotsTotal = 2 ** G - 1;
  return {
    items, hits, names, people,
    counts: { slots: slotsTotal, placed: placedCount, abbreviated, missing },
    warnings,
    collapse: collapseEntries.map(e => ({ n: e.n, ids: e.ids, names: e.names, times: e.times })),
    score: gridH,
  };
}

/** "Parents", "Grandparents", "Great-grandparents", "Great-great-grandparents", "3×great-grandparents", ... */
export function genLabel(g) {
  if (g === 2) return 'Parents';
  if (g === 3) return 'Grandparents';
  const greats = g - 3;
  const word = (greats <= 2 ? 'great-'.repeat(greats) : `${greats}×great-`) + 'grandparents';
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/** Break a "…GREAT-…-GRANDPARENTS" header at its last hyphen, for a narrow outer column. */
function splitHeaderLabel(label) {
  const i = label.lastIndexOf('-');
  if (i < 0 || i > label.length - 3) return null;
  return [label.slice(0, i + 1), label.slice(i + 1)];
}

// ---------------------------------------------------------------------------
// Slots (same construction as layout-bowtie.js's makeSlot / layout-fan.js's; duplicated
// here rather than shared since none of these three engines export their internals).

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
  if (glyphCheck && p.name) {
    const g = glyphCheck(st.fonts.nameOuter, p.name);
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
    if (slot.dates.length > 1) slot.dates = [slot.dates[1]];
  }
  if (o.showPlaces && disp.place) slot.places = placeLadder(disp.place);
  return slot;
}

/** Pedigree-collapse markers, adapted from layout-fan.js's collapseMarkers for a
 * Map<ahnen, slot> in place of an array. */
function collapseMarkers(ahnen, tree, slots) {
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
    const n = entries.length + 1;
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
// Box drawing

// Box outlines and elbow connectors are standalone strokes on the page ground — unlike a
// fan's wedge boundaries, which sit between two filled wedges, a pedigree box's own edge is
// its only visible structure. Nordic's line/faint colours are white (right for the gutter
// between two coloured wedges, invisible on the page itself), so fall back to its accents,
// the same swap layout-fan.js already makes for its own standalone strokes (the 180° base
// rule, the Atlas legend swatch outline).
function lineColor(st) { return st.line.color === '#ffffff' ? st.accent : st.line.color; }
function faintColor(st) { return st.faint.color === '#ffffff' ? st.accent2 || st.accent : st.faint.color; }

function faintBox(box, cr, st) {
  const it = { t: 'path', d: rectPath(box.x, box.y, box.w, box.h, cr), stroke: faintColor(st), sw: Math.max(0.35, st.faint.width), opacity: st.faint.opacity };
  if (st.faint.fill) it.fill = st.faint.fill;
  return it;
}

function filledBox(box, cr, fill, st) {
  const it = { t: 'path', d: rectPath(box.x, box.y, box.w, box.h, cr), stroke: lineColor(st), sw: Math.max(0.35, st.line.width), opacity: st.line.opacity };
  if (fill) it.fill = fill;
  return it;
}

/**
 * Fit a person's name (and, if there is room, birth/death dates and place) into a box.
 * Richest content first — name + dates + place, then name + dates, then name + place,
 * then name alone — so dates and places are dropped before the name is abbreviated past
 * a useful rung (BRIEF §4.7). Height for the date/place lines is reserved up front (a
 * fixed, small size) and the *remaining* height is what fitBlock is asked to fill, so
 * fitBlock's own internal fit (which already never returns anything below the 5.5pt
 * floor) is trusted rather than re-checked against a second, independently-guessed
 * line-height model.
 */
function fitPersonBox(slot, w, h, font) {
  const hasDates = slot.dates.length > 0;
  const hasPlaces = slot.places.length > 0;
  const combos = [];
  if (hasDates && hasPlaces) combos.push({ d: true, p: true });
  if (hasDates) combos.push({ d: true, p: false });
  if (hasPlaces) combos.push({ d: false, p: true });
  combos.push({ d: false, p: false });
  const pitch = s => s * 1.15;
  for (const combo of combos) {
    const dSize = combo.d ? Math.max(MIN_TEXT_PT, Math.min(h * 0.22, w * 0.09)) : 0;
    const pSize = combo.p ? Math.max(MIN_TEXT_PT, Math.min(h * 0.2, w * 0.08)) : 0;
    const reserved = (combo.d ? pitch(dSize) : 0) + (combo.p ? pitch(pSize) : 0);
    const nameBudget = h - reserved;
    if (nameBudget < MIN_TEXT_PT * 1.05) continue;
    const nameMaxSize = Math.min(nameBudget * 0.62, w * 0.32);
    const nameFit = fitBlock(slot.ladder, w, nameBudget, font, nameMaxSize);
    if (!nameFit) continue;
    const lines = nameFit.lines.map(str => ({ str, font, size: nameFit.size, kind: 'n', pitch: pitch(nameFit.size) }));
    let ok = true;
    if (combo.d) {
      const dFit = fitText(slot.dates, w, 'ebg-400', dSize);
      if (dFit) lines.push({ str: dFit.str, font: 'ebg-400', size: dFit.size, kind: 'd', pitch: pitch(dSize) });
      else ok = false;
    }
    if (ok && combo.p) {
      const pFit = fitText(slot.places, w, 'ebg-400i', pSize);
      if (pFit) lines.push({ str: pFit.str, font: 'ebg-400i', size: pFit.size, kind: 'p', pitch: pitch(pSize) });
    }
    if (!ok) continue;
    return { lines, abbreviated: nameFit.index > 0 };
  }
  return null;
}

function drawBoxContent(fit, cx, cy, colors) {
  const { lines } = fit;
  const total = lines.reduce((a, l) => a + l.pitch, 0);
  let y = cy - total / 2;
  const items = [];
  for (const l of lines) {
    y += l.pitch / 2;
    items.push({ t: 'text', x: r3(cx), y: r3(y), str: l.str, font: l.font, size: r3(l.size), color: colors[l.kind], anchor: 'middle', baseline: 'middle' });
    y += l.pitch / 2;
  }
  return items;
}

// ---------------------------------------------------------------------------
// A row of furniture blocks (atlas legend, collapse legend, compass), wrapped to the
// available width and centred — the same packing layout-bowtie.js uses for its "row" mode.

function packRow(blocks, maxW, gap) {
  if (!blocks.length) return { height: 0, rows: [] };
  let line = [], lineW = 0, lineH = 0;
  const rows = [];
  const flush = () => { if (line.length) rows.push({ items: line, w: lineW, h: lineH }); line = []; lineW = 0; lineH = 0; };
  for (const b of blocks) {
    const add = b.w + (line.length ? gap * 3 : 0);
    if (line.length && lineW + add > maxW) flush();
    line.push(b); lineW += b.w + (line.length > 1 ? gap * 3 : 0); lineH = Math.max(lineH, b.h);
  }
  flush();
  const height = rows.reduce((a, r) => a + r.h, 0) + Math.max(0, rows.length - 1) * gap;
  return { height, rows };
}

function drawRows(rows, cx, topY, gap) {
  const items = [];
  let y = topY;
  for (const r of rows) {
    let x = cx - r.w / 2;
    for (const b of r.items) { items.push(...b.draw(x, y + (r.h - b.h) / 2)); x += b.w + gap * 3; }
    y += r.h + gap;
  }
  return items;
}
