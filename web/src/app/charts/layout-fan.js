// Fan chart engine (company/BRIEF.md §4.3 "Fan", §4.7 craft rules).
//
// Called by layout.js with a prepared context (see the protocol at the top of
// layout.js). Produces the fan artwork, places the page furniture blocks around
// it, and returns hits for every placed person.
//
// How the fan is built:
//   1. Slots: Ahnentafel numbers 1 … 2^G − 1 from engine/tree.js. Father (2n) on
//      the left, mother (2n+1) on the right; for same-sex parents the first
//      partner takes the left.
//   2. Composition: the largest outer radius R for which the fan, the title
//      cartouche and the legends fit inside the live area without touching.
//      Candidates: title in the open wedge under the medallion (270°), below the
//      fan, or above it (360°); legends in free corners or in a row. The winner is
//      the one with the largest R.
//   3. Medallion: the root's name, dates and birthplace in the largest type on
//      the page; its radius comes from the text it has to hold.
//   4. Ring depths are solved from the text: arc rings (1–3) need the height of
//      their stacked lines, radial rings (4+) the length of the names they hold
//      (85th percentile; longer names use the abbreviation ladder). One scale
//      factor λ sets every ring's type size; it is bisected until the rings fill
//      exactly the space between the medallion and R.
//   5. Each person is then fitted into their own wedge: fullest ladder rung first,
//      one line or a balanced two-line split, at most 15% smaller than the ring's
//      size, never below 6 pt (5.5 pt floor); dates and places are dropped before
//      the name is shortened past its first useful rung.
//   6. Empty slots draw as faint hairline wedges (or nothing with trimEmpty);
//      people who appear more than once get a numbered marker and a legend line.

import { ancestors, collapse as collapseMap } from '../engine/tree.js';
import { nameLadder, splitName } from '../engine/names.js';
import { displayFor } from '../engine/living.js';
import { formatYearRange } from '../engine/dates.js';
import { cleanPlace } from '../engine/places.js';
import { arcGlyphs, radialRotation, polar, textWidth, MIN_TEXT_PT, FLOOR_TEXT_PT, FIT_SLACK } from './text.js';
import { sectorPath, circlePath, fmt } from './path.js';
import { wedgeFill } from './styles.js';
import { paint, medallionRing, laurelArc, fleuron } from './ornaments.js';
import { markerItems } from './layout.js';

const DEG = Math.PI / 180;
const r3 = v => Math.round(v * 1000) / 1000;
const q25 = v => Math.floor(v * 4 + 1e-9) / 4;

// Visual extents of a line around its cap-middle, as fractions of the size.
const EXT_TOP = 0.54;
const EXT_BOT = 0.56;
// Line pitch factors (× mean size of the two lines).
const PITCH = { nn: 1.04, nd: 1.26, dp: 1.16, np: 1.26, dd: 1.1 };
/** Ring type sizes relative to the page's reference root size (λ = 1). */
const RING_BASE = [0.54, 0.44, 0.36, 0.3, 0.255, 0.22, 0.19, 0.17];
/** Medallion radius limits as a fraction of R, by generations. */
const MED_FRACTION = { 2: [0.34, 0.5], 3: [0.3, 0.44], 4: [0.24, 0.36], 5: [0.19, 0.28], 6: [0.155, 0.23], 7: [0.135, 0.2], 8: [0.12, 0.175] };

/**
 * Lay out a fan chart. See layout.js for ctx and the return shape.
 * @param {object} ctx
 */
export function layoutFan(ctx) {
  const { opts: o, tree, rootId, page, style: st, kit, keepsake } = ctx;
  const G = ctx.generations;
  const S = ctx.sweep || 270;
  const K = G - 1;
  const aStart = -S / 2;
  const sizes = kit.textSizes;
  const warnings = [];
  const W = unitWidths();

  // ---- 1. slots and display text -----------------------------------------
  const ahnen = ancestors(tree, rootId, G, { adoptive: o.adoptive });
  const slots = new Array(2 ** G).fill(null);
  const shown = new Map();
  for (const [a, id] of ahnen) {
    const p = tree.people[id];
    if (!p) continue;
    slots[a] = makeSlot(a, p, o, st, keepsake, warnings, ctx.hasGlyphs);
    shown.set(id, p);
  }
  const people = [...shown.values()];
  const genById = new Map();
  for (const [a, id] of ahnen) if (!genById.has(id)) genById.set(id, Math.floor(Math.log2(a)) + 1);
  const generationOf = id => genById.get(id) || 0;

  // ---- pedigree collapse -------------------------------------------------
  const { entries: collapseEntries } = collapseMarkers(ahnen, tree, slots);

  // ---- furniture blocks --------------------------------------------------
  const live = page.live;
  const atlasProbe = kit.atlas(people, { maxW: live.w, generationOf });
  const atlas = atlasProbe ? atlasProbe.atlas : null;
  const noteBlocks = (maxW, cols) => {
    const list = [];
    if (atlas) {
      const b = kit.atlas(people, { maxW, generationOf, columns: cols });
      if (b && !b.empty) list.push({ block: b, prefer: ['bl', 'br', 'tl', 'tr'] });
    }
    const cb = kit.collapse(collapseEntries, { maxW });
    if (cb) list.push({ block: cb, prefer: ['br', 'bl', 'tr', 'tl'] });
    const comp = kit.compass(Math.min(live.w, live.h) * (S === 180 ? 0.12 : 0.14));
    if (comp) list.push({ block: comp, prefer: ['tl', 'tr', 'bl', 'br'], compass: true });
    return list;
  };

  // ---- 2. root medallion text (unit sizes) -------------------------------
  const root = slots[1];
  const rootFont = st.fonts.root;
  const medText = medallionText(root, rootFont, st, keepsake, W, S === 180);
  const fr = MED_FRACTION[Math.min(8, Math.max(2, G))];
  const medScale = S === 180 ? 1.18 : 1;
  const Sref = sizes.root;
  const medallionFor = R => {
    const lo = fr[0] * R * medScale, hi = fr[1] * R * medScale;
    const want = Sref * medText.r1;
    let r = Math.min(hi, Math.max(lo, want));
    let s = r / medText.r1;
    s = Math.min(s, Sref * 1.45);
    r = Math.max(lo, Math.min(r, s * medText.r1));
    return { r, s: q25(s) };
  };

  // ---- 3. composition -----------------------------------------------------
  const people4head = people;
  let head = kit.head({ maxW: live.w, laurel: S < 360, people: people4head });
  let comp = solveComposition();
  const med0 = medallionFor(comp.R);
  if (head.titleSize > med0.s * 0.9) {
    head = kit.head({ maxW: live.w, maxSize: med0.s * 0.88, laurel: S < 360, people: people4head });
    comp = solveComposition();
  }

  function solveComposition() {
    const heads = [head];
    const narrow = kit.head({ maxW: live.w * 0.5, maxSize: head.titleSize, laurel: S < 360, people: people4head });
    if (narrow.w < head.w * 0.92) heads.push(narrow);
    const noteSets = [noteBlocks(live.w * 0.5), noteBlocks(live.w * 0.34, 1), noteBlocks(live.w)];
    let best = null;
    const headModes = S === 360 ? ['above', 'below'] : S === 180 ? ['below'] : ['notch', 'below'];
    for (const hb of heads) {
      for (const hm of headModes) {
        for (const notes of noteSets) {
          for (const nm of notes.length ? ['corners', 'row'] : ['row']) {
            const res = maximise(R => place(R, hb, hm, notes, nm));
            if (!res) continue;
            let score = res.R * (hm === 'notch' ? 1.03 : 1) * (nm === 'corners' ? 1.01 : 1) * (hb === head ? 1.005 : 1);
            if (!best || score > best.score) best = { ...res, score, head: hb };
          }
        }
      }
    }
    if (!best) {
      // nothing fits (tiny page): fan alone, furniture below it as far as it goes
      const R = Math.min(live.w / 2, live.h / (S >= 360 ? 2 : 1.75)) * 0.9;
      best = { R, cx: live.x + live.w / 2, cy: live.y + R, headPos: { x: live.x + live.w / 2 - head.w / 2, y: live.y + live.h - head.h }, notes: [], score: 0, head };
      warnings.push('The title and legends are crowded at this size.');
    }
    return best;
  }

  function maximise(fit) {
    let hi = Math.min(live.w / 2, S >= 360 ? live.h / 2 : live.h);
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

  function place(R, hb, headMode, notes, notesMode) {
    const beta = ((360 - S) / 2) * DEG; // half-angle of the open wedge, from straight down
    const med = medallionFor(R);
    const gap = sizes.gap;
    const pad = Math.max(gap, R * 0.03);
    let top = -R;
    let bottom = S >= 360 ? R : S > 180 ? R * Math.cos(beta) : gap * 0.5;
    let headY;
    if (headMode === 'notch') {
      let y = med.r + pad;
      const tb = Math.tan(beta);
      for (const row of hb.rows) {
        const needDepth = Math.min((row.half + pad) / tb, R * Math.cos(beta) + pad);
        y = Math.max(y, needDepth - row.top);
      }
      headY = y;
      bottom = Math.max(bottom, headY + hb.h);
    } else if (headMode === 'below') {
      headY = bottom + pad * (S === 180 ? 0.8 : 1);
      bottom = headY + hb.h;
    } else {
      headY = top - pad - hb.h;
      top = headY;
    }
    if (2 * R > live.w + 0.01 || hb.w > live.w + 0.01) return null;
    const rowItems = notesMode === 'row' ? notes : [];
    let rowsH = 0;
    const rowLayout = [];
    if (rowItems.length) {
      let line = [], lineW = 0, lineH = 0;
      const flush = () => { if (line.length) { rowLayout.push({ items: line, w: lineW, h: lineH }); rowsH += lineH + gap; } line = []; lineW = 0; lineH = 0; };
      for (const n of rowItems) {
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
    let rowY = cy + (bottom - rowsH);
    for (const r of rowLayout) {
      let x = cx - r.w / 2;
      for (const n of r.items) { placed.push({ block: n.block, x, y: rowY + (r.h - n.block.h) / 2 }); x += n.block.w + gap * 3; }
      rowY += r.h + gap;
    }
    if (notesMode === 'corners') {
      const taken = [headRect];
      for (const n of notes) {
        let ok = null;
        for (const c of n.prefer) {
          const b = n.block;
          const x = c[1] === 'l' ? live.x : live.x + live.w - b.w;
          const y = c[0] === 't' ? live.y : live.y + live.h - b.h;
          const rect = { x, y, w: b.w, h: b.h };
          if (rectHitsFan(rect, cx, cy, R, med.r, pad * 0.9)) continue;
          if (taken.some(t => overlaps(t, rect, gap))) continue;
          ok = rect; break;
        }
        if (!ok) return null;
        taken.push(ok);
        placed.push({ block: n.block, x: ok.x, y: ok.y });
      }
    }
    return { R, cx, cy, headPos: { x: headRect.x, y: headRect.y }, notes: placed, med };
  }

  function rectHitsFan(rect, cx, cy, R, rMed, pad) {
    const nx = 14, ny = 8;
    for (let i = 0; i <= nx; i++) {
      for (let j = 0; j <= ny; j++) {
        const x = rect.x + (rect.w * i) / nx, y = rect.y + (rect.h * j) / ny;
        if (inFan(x - cx, y - cy, R, rMed, pad)) return true;
      }
    }
    return false;
  }

  function inFan(dx, dy, R, rMed, pad) {
    const d = Math.hypot(dx, dy);
    if (d > R + pad) return false;
    if (S === 180 ? d < rMed + pad && dy < pad : d < rMed + pad) return true;
    if (S >= 360) return true;
    const ang = Math.atan2(dx, -dy) / DEG; // 0 = up, clockwise, −180..180
    const padAng = (pad / Math.max(d, 1)) / DEG;
    return ang >= aStart - padAng && ang <= aStart + S + padAng;
  }

  // ---- 4. geometry --------------------------------------------------------
  const { R, cx, cy } = comp;
  head = comp.head;
  const med = medallionFor(R);
  const rMed = med.r;
  const Sroot = med.s;

  const rings = solveRings({ R, rMed, Sroot, Sref, G, K, S, slots, st, o, W, keepsake });

  // ---- 5. draw ------------------------------------------------------------
  const items = [];
  const hits = [];
  const names = [];
  let abbreviated = 0, placedCount = 0, missing = 0;

  // slot states: 2 person, 1 faint (empty but drawn), 0 nothing
  const state = new Uint8Array(2 ** G);
  state[1] = 2;
  for (let a = 2; a < 2 ** G; a++) {
    if (slots[a]) state[a] = slots[a].unknown ? 1 : 2;
    else state[a] = !o.trimEmpty && state[a >> 1] ? 1 : 0;
    if (!slots[a]) missing++;
  }

  // fills
  const fills = new Map();
  const addFill = (color, d) => { if (!color) return; if (!fills.has(color)) fills.set(color, []); fills.get(color).push(d); };
  for (let k = 1; k <= K; k++) {
    const n = 2 ** k;
    const { r0, r1 } = rings[k];
    for (let j = 0; j < n; j++) {
      const a = n + j;
      if (!state[a]) continue;
      const a0 = aStart + (S * j) / n, a1 = aStart + (S * (j + 1)) / n;
      const quarter = k >= 2 ? (a >> (k - 2)) - 4 : -1;
      const side = (a >> (k - 1)) === 2 ? 'a' : 'b';
      const slot = slots[a];
      let atlasColor;
      if (st.mode === 'atlas' && slot && !slot.unknown) atlasColor = atlas ? atlas.colorOf(slot.id) : null;
      const color = wedgeFill(st, { ring: k, rings: G, index: j, quarter, side, atlasColor, empty: state[a] === 1 });
      addFill(color, sectorPath(cx, cy, r0, r1, a0, a1));
    }
  }
  for (const [color, ds] of fills) items.push({ t: 'path', d: ds.join(' '), fill: color });

  // line work
  items.push(...lineWork({ cx, cy, rings, K, S, aStart, state, st, rMed }));

  // 180°: a double base rule under the half fan
  if (S === 180) {
    const yb = cy + Math.max(2.2, sizes.gap * 0.28);
    items.push({ t: 'path', d: `M${fmt(cx - R)} ${fmt(yb)} L${fmt(cx + R)} ${fmt(yb)}`, stroke: st.line.color === '#ffffff' ? st.accent2 : st.accent, sw: 0.45, opacity: Math.min(1, st.line.opacity + 0.15) });
  }

  // medallion
  items.push(...drawMedallion({ cx, cy, r: rMed, s: Sroot, text: medText, st, half: S === 180, root }));
  if (root) {
    names.push(...medText.nameLines);
    hits.push({ personId: root.id, ahnen: 1, shape: 'sector', cx: r3(cx), cy: r3(cy), r0: 0, r1: r3(rMed), a0: S === 180 ? -90 : -180, a1: S === 180 ? 90 : 180 });
    placedCount++;
  }

  // people
  const textItems = [];
  const markerList = [];
  for (let k = 1; k <= K; k++) {
    const n = 2 ** k;
    const ring = rings[k];
    for (let j = 0; j < n; j++) {
      const a = n + j;
      const slot = slots[a];
      if (!slot) continue;
      const a0 = aStart + (S * j) / n, a1 = aStart + (S * (j + 1)) / n;
      hits.push({ personId: slot.id, ahnen: a, shape: 'sector', cx: r3(cx), cy: r3(cy), r0: r3(ring.r0), r1: r3(ring.r1), a0: r3(a0), a1: r3(a1) });
      if (slot.unknown) continue;
      const fit = ring.kind === 'arc'
        ? fitArcSlot(slot, ring, (a0 + a1) / 2, a1 - a0, { cx, cy, st, W, o })
        : fitRadialSlot(slot, ring, (a0 + a1) / 2, a1 - a0, { cx, cy, st, W, o });
      if (!fit) { warnings.push(`No room for ${slot.ladder[0] || slot.id} (slot ${a})`); continue; }
      placedCount++;
      if (fit.rung > 0) abbreviated++;
      textItems.push(...fit.items);
      names.push(...fit.nameLines);
      if (fit.marker) markerList.push(fit.marker);
    }
  }
  items.push(...textItems);
  for (const m of markerList) items.push(...markerItems(m.n, m.x, m.y, m.size, st));

  // botanical: laurel cradling a full circle
  if (S === 360 && st.ornaments.laurel) {
    const rr = R + Math.max(sizes.gap * 0.6, R * 0.018);
    const size = R * 0.07;
    items.push(...paint([...laurelArc(cx, cy, rr, 178, 118, { size, leaves: 8 }), ...laurelArc(cx, cy, rr, 182, 242, { size, leaves: 8, flip: true })], st.accent));
  }

  // furniture
  items.push(...head.draw(comp.headPos.x, comp.headPos.y));
  for (const n of comp.notes) items.push(...n.block.draw(n.x, n.y));

  const slotsTotal = 2 ** G - 1;
  return {
    items,
    hits,
    names,
    people,
    counts: { slots: slotsTotal, placed: placedCount, abbreviated, missing },
    warnings,
    collapse: collapseEntries.map(e => ({ n: e.n, ids: e.ids, names: e.names, times: e.times })),
    score: R,
    geometry: { cx, cy, R, rMed, sweep: S, rings: rings.slice(1).map(r => ({ r0: r.r0, r1: r.r1, size: r.s, kind: r.kind, plan: r.plan })) },
  };
}

// ---------------------------------------------------------------------------
// Slots

function unitWidths() {
  const caches = new Map();
  return {
    w(font, str) {
      if (!str) return 0;
      let c = caches.get(font);
      if (!c) { c = new Map(); caches.set(font, c); }
      let v = c.get(str);
      if (v === undefined) { v = measureUnit(font, str); c.set(str, v); }
      return v;
    },
  };
}

const measureUnit = (font, str) => textWidth(str, font, 1);

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

/** Place ladder: "Ribeira Grande, São Miguel, Azores, Portugal" → "Ribeira Grande, Portugal" → "Ribeira Grande". */
export function placeLadder(place) {
  const c = cleanPlace(place);
  if (!c) return [];
  const parts = [];
  for (const p of c.split(',').map(s => s.trim()).filter(Boolean)) {
    if (!parts.length || parts[parts.length - 1].toLowerCase() !== p.toLowerCase()) parts.push(p);
  }
  const out = [parts.join(', ')];
  if (parts.length > 2) out.push(`${parts[0]}, ${parts[parts.length - 1]}`);
  if (parts.length > 1) out.push(parts[0]);
  return [...new Set(out)];
}

function makeSlot(a, p, o, st, keepsake, warnings, glyphCheck) {
  const gen = Math.floor(Math.log2(a)) + 1;
  const slot = { a, gen, ring: gen - 1, id: p.id, person: p, unknown: !!p.unknown, ladder: [], dates: [], places: [], marker: null };
  if (slot.unknown) return slot;
  const disp = displayFor(p, o.privacy);
  if (p.living && o.privacy === 'living-only') {
    slot.ladder = ['Living'];
    return slot;
  }
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
    // plain year range as the default in rings; full dates only in the keepsake layout
    if (!keepsake && slot.dates.length > 1) slot.dates = [slot.dates[1]];
  }
  if (o.showPlaces && disp.place) slot.places = placeLadder(disp.place);
  return slot;
}

/**
 * Numbered markers for people who appear more than once. A person gets a number
 * when the repetition starts with them (not merely because their child repeats);
 * couples who always repeat together share a number.
 */
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
    // father first
    ids.sort((x, y) => coll.get(x)[0] - coll.get(y)[0]);
    const n = entries.length + 1;
    const people = ids.map(i => tree.people[i]);
    entries.push({
      n, ids, times: arr.length,
      names: people.map(p => (p && p.name) || '—'),
      short: people.map(p => { const l = nameLadder(p); return l[Math.min(l.length - 1, l.length > 3 ? 3 : 1)] || p.name; }),
    });
    for (const i of ids) for (const a of coll.get(i)) if (slots[a]) slots[a].marker = n;
  }
  return { entries };
}

// ---------------------------------------------------------------------------
// Medallion

function medallionText(root, font, st, keepsake, W, half) {
  // lines at unit root size; returns the radius needed per point of root size (r1)
  if (!root) return { lines: [], r1: 3, nameLines: [] };
  const name = root.ladder[0] || '';
  const words = name.split(/\s+/).filter(Boolean);
  const dateStr = root.dates[0] || '';
  const place = root.places.length ? root.places[Math.min(root.places.length - 1, keepsake ? 0 : 1)] : '';
  const dRatio = 0.4, pRatio = 0.34;
  const variants = [[name]];
  if (words.length >= 2) {
    let best = null;
    for (let k = 1; k < words.length; k++) {
      const l = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
      const w = Math.max(W.w(font, l[0]), W.w(font, l[1]));
      if (!best || w < best.w) best = { l, w };
    }
    variants.push(best.l);
  }
  let best = null;
  for (const nameLines of variants) {
    const lines = nameLines.map(s => ({ str: s, font, rel: 1, color: 'name' }));
    if (dateStr) lines.push({ str: dateStr, font: st.fonts.dates, rel: dRatio, color: 'dates' });
    if (place) lines.push({ str: place, font: st.fonts.place, rel: pRatio, color: 'place' });
    const geo = stackGeometry(lines.map(l => l.rel), lines.map(l => l.color === 'name' ? 'n' : l.color === 'dates' ? 'd' : 'p'));
    // extra breathing room between the name and the dates: a small rule sits there
    let r1 = 0;
    const offs = geo.offsets;
    const H = geo.height;
    lines.forEach((l, i) => {
      const hw = W.w(l.font, l.str) * l.rel / 2;
      const yTop = half ? H - (offs[i] - EXT_TOP * l.rel) : Math.abs(offs[i] - H / 2) + EXT_TOP * l.rel;
      const yFar = half ? H - offs[i] + EXT_TOP * l.rel + 0.25 : Math.max(Math.abs(offs[i] - EXT_TOP * l.rel - H / 2), Math.abs(offs[i] + EXT_BOT * l.rel - H / 2));
      r1 = Math.max(r1, Math.hypot(hw, half ? yTop : yFar));
    });
    r1 = r1 * 1.12 + 0.35; // padding inside the rings
    if (!best || r1 < best.r1 * 0.97) best = { lines, geo, r1, nameLines };
  }
  return best;
}

/** Offsets (cap-middle of each line) from the block top, and total height, for relative sizes. */
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

function drawMedallion({ cx, cy, r, s, text, st, half, root }) {
  const out = [];
  const m = st.medallion;
  const fillD = half ? sectorPath(cx, cy, 0, r, -90, 90) : circlePath(cx, cy, r);
  out.push({ t: 'path', d: fillD, fill: m.fill });
  if (m.ring === 'solid') {
    // a hairline ring of ground colour just inside keeps the edge crisp
    out.push(...paint(medallionRing('single', cx, cy, r * 0.93, { sw: 0.4, half }), m.name, { opacity: 0.35 }));
  } else {
    out.push(...paint(medallionRing(m.ring, cx, cy, r, { sw: 0.5, gap: Math.max(2, r * 0.035), half }), m.stroke));
  }
  if (!root || !text || !text.lines.length) return out;
  const { lines, geo } = text;
  const H = geo.height * s;
  const top = half ? cy - Math.max(3, r * 0.1) - H : cy - H / 2 + s * 0.02;
  lines.forEach((l, i) => {
    const size = Math.max(MIN_TEXT_PT, q25(l.rel * s));
    const color = l.color === 'name' ? m.name : l.color === 'dates' ? m.dates : m.place;
    out.push({ t: 'text', x: r3(cx), y: r3(top + geo.offsets[i] * s), str: l.str, font: l.font, size, color, anchor: 'middle', baseline: 'middle' });
  });
  // a short rule between the name and the dates
  const nNames = lines.filter(l => l.color === 'name').length;
  if (nNames < lines.length && st.fleuron !== 'none') {
    const yA = top + geo.offsets[nNames - 1] * s + EXT_BOT * s;
    const yB = top + geo.offsets[nNames] * s - EXT_TOP * lines[nNames].rel * s;
    const y = (yA + yB) / 2;
    const w = s * 1.1;
    const fl = fleuron('diamond', cx, y, Math.max(4, s * 0.16), 0.35);
    out.push(...paint([{ d: `M${fmt(cx - w)} ${fmt(y)} L${fmt(cx - s * 0.16)} ${fmt(y)} M${fmt(cx + s * 0.16)} ${fmt(y)} L${fmt(cx + w)} ${fmt(y)}`, sw: 0.4 }, ...fl], m.stroke === m.fill ? m.dates : m.stroke));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Ring solver

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

/** Best two-line split of a name: shortest longer line, prefer breaking after a comma, never leave "of" dangling. */
export function splitTwo(str, widthOf) {
  const words = String(str).trim().split(/\s+/);
  if (words.length < 2) return null;
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
    let score = Math.max(widthOf(a), widthOf(b));
    const lastA = words[k - 1].toLowerCase();
    if (/,$/.test(words[k - 1])) score *= 0.86;
    if (/^(of|von|zu|de|van|der|den|da|di|du|y|and|&|la|le|af|av)$/.test(lastA)) score *= 1.3;
    if (/^\p{L}\.$/u.test(words[k - 1]) && k === words.length - 1) score *= 1.08;
    if (!best || score < best.score) best = { lines: [a, b], score };
  }
  return best.lines;
}

function ringKind(k, G) {
  return k <= 3 ? 'arc' : 'radial';
}

function solveRings({ R, rMed, Sroot, Sref, G, K, S, slots, st, o, W }) {
  const ringSlots = [];
  for (let k = 1; k <= K; k++) {
    const list = [];
    for (let a = 2 ** k; a < 2 ** (k + 1); a++) if (slots[a] && !slots[a].unknown) list.push(slots[a]);
    ringSlots[k] = list;
  }
  const anyDates = k => ringSlots[k].some(s => s.dates.length);
  const anyPlaces = k => ringSlots[k].some(s => s.places.length);
  const gutter = st.gutter || 0;

  const nameFont = k => (k <= 2 ? st.fonts.nameInner : st.fonts.nameOuter);
  const solve = lam => {
    const rings = [null];
    let r = rMed;
    let prev = Sroot * 0.86;
    for (let k = 1; k <= K; k++) {
      const kind = ringKind(k, G);
      const span = S / 2 ** k;
      const font = nameFont(k);
      const cap = Math.min(lam * Sref * (RING_BASE[k - 1] ?? 0.16), prev * (k === 1 ? 1 : 0.94));
      let s, need, plan;
      if (kind === 'arc') {
        s = Math.max(MIN_TEXT_PT, q25(cap));
        plan = ['n'];
        if (anyDates(k)) plan.push('d');
        if (anyPlaces(k)) plan.push('p');
        need = arcNeed(ringSlots[k], s, r, span, plan, font, st, W);
      } else {
        const res = radialPlan(ringSlots[k], cap, r, span, font, st, W, anyDates(k), anyPlaces(k), gutter);
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
  // scale depths to fill exactly [rMed, R]
  const rings = sol.rings;
  const sum = rings.slice(1).reduce((a, r) => a + r.need, 0) || 1;
  const f = (R - rMed) / sum;
  let r = rMed;
  for (let k = 1; k <= K; k++) {
    const d = rings[k].need * f;
    rings[k].r0 = r;
    rings[k].r1 = r + d;
    rings[k].depth = d;
    r += d;
  }
  return rings;
}

function arcPad(s) { return Math.max(1.6, s * 0.34); }
function arcSide(s) { return Math.max(1.5, s * 0.45); }

function arcNeed(list, s, r0, span, plan, font, st, W) {
  if (!list.length) return planHeight(plan, s) + 2 * arcPad(s);
  const needs = [];
  const rEst = r0 + planHeight(plan, s) * 0.6;
  const L = rEst * span * DEG * (1 - FIT_SLACK) - 2 * arcSide(s);
  for (const slot of list) {
    const p = plan.filter(k => (k === 'd' ? slot.dates.length : k === 'p' ? slot.places.length : true));
    const nw = W.w(font, slot.ladder[0]) * s;
    let lines = p;
    if (nw > L) {
      const sp = splitTwo(slot.ladder[0], x => W.w(font, x));
      if (sp) lines = ['n', ...p];
    }
    needs.push(planHeight(lines, s) + 2 * arcPad(s));
  }
  return quantile(needs, 0.9);
}

function radialAcross(r, span, s, gutter) {
  return r * span * DEG * (1 - 0.05) - gutter - 2 * Math.max(0.6, s * 0.18);
}

function radialPlan(list, cap, r0, span, font, st, W, hasDates, hasPlaces, gutter) {
  const plans = [];
  if (hasDates && hasPlaces) plans.push(['n', 'd', 'p']);
  if (hasDates) plans.push(['n', 'd']);
  plans.push(['n']);
  const pad = s => Math.max(1.5, s * 0.5);
  let chosen = null;
  for (const plan of plans) {
    // largest s ≤ cap whose block fits across the slot at the text's inner end
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
      const sp = splitTwo(slot.ladder[0], x => W.w(font, x));
      if (sp) nw = Math.min(nw, Math.max(W.w(font, sp[0]), W.w(font, sp[1])) * s);
    }
    let w = nw;
    const di = plan.indexOf('d');
    if (di >= 0 && slot.dates.length) w = Math.max(w, W.w(st.fonts.dates, slot.dates[slot.dates.length - 1]) * sz[di]);
    ws.push(w);
  }
  const q = quantile(ws, 0.85) || s * 6;
  const depth = Math.min(Math.max(q * (1 + FIT_SLACK), s * 4.2), s * 12.5) + 2 * pad(s);
  return { plan, s, need: depth, two };
}

// ---------------------------------------------------------------------------
// Fitting one person

function colorsFor(st) {
  return { n: st.ink, d: st.inkSoft, p: st.inkPlace };
}

function fitArcSlot(slot, ring, centre, span, env) {
  const { cx, cy, st, W } = env;
  const font = ring.font;
  const s0 = ring.s;
  const depth = ring.r1 - ring.r0;
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
        if (nl === 2) { const sp = splitTwo(str, x => W.w(font, x)); if (!sp) continue; nameLines = sp; }
        for (const f of tries) {
          const s = Math.max(MIN_TEXT_PT, q25(s0 * f));
          const res = tryArc(slot, nameLines, s, parts, ring, centre, span, flipped, hasMarker, env);
          if (res) return { ...res, rung };
        }
      }
    }
    // last resort on this part-set: the shortest rung at the floor size
  }
  const str = slot.ladder[slot.ladder.length - 1];
  const res = tryArc(slot, [str], FLOOR_TEXT_PT, { dates: false, place: false }, ring, centre, span, flipped, hasMarker, env, true);
  return res ? { ...res, rung: slot.ladder.length - 1 } : null;
  void depth; void cx; void cy; void st;
}

function tryArc(slot, nameLines, s, parts, ring, centre, span, flipped, hasMarker, env, floor = false) {
  const { cx, cy, st, W } = env;
  const font = ring.font;
  const kinds = nameLines.map(() => 'n');
  const sz = sizesFor(['n', 'd', 'p'], s);
  const lines = nameLines.map(str => ({ str, font, size: s, kind: 'n' }));
  const pad = arcPad(s);
  const side = arcSide(s);
  const avail = r => r * span * DEG * (1 - FIT_SLACK) - 2 * side;
  // provisional geometry to pick date/place rungs that fit
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
  // radius of each line's cap-middle
  const radii = all.map((l, i) => (flipped ? rMid - H / 2 + geo.offsets[i] : rMid + H / 2 - geo.offsets[i]));
  const mr = hasMarker ? Math.max(MIN_TEXT_PT, s * 0.8) * 0.62 : 0;
  for (let i = 0; i < all.length; i++) {
    const l = all[i];
    const room = avail(radii[i]) - (i === 0 && hasMarker ? 2 * mr + s * 0.35 : 0);
    if (l.options) {
      let chosen = null;
      for (const opt of l.options) { if (W.w(l.font, opt) * l.size <= room) { chosen = opt; break; } }
      if (!chosen) {
        if (l.kind === 'd') return null; // dates must fit (or be dropped by the caller)
        all.splice(i, 1); radii.splice(i, 1); i--; // no place fits: drop it
        continue;
      }
      l.str = chosen;
    } else if (W.w(l.font, l.str) * l.size > room) return null;
  }
  const colors = colorsFor(st);
  const items = [];
  const nameLines2 = [];
  // recentre if a place line was dropped
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
  void kinds;
  return { items, nameLines: nameLines2, marker: items.markerSpec || null };
}

function fitRadialSlot(slot, ring, centre, span, env) {
  const { st, W } = env;
  const plan = ring.plan;
  const s0 = ring.s;
  const tries = [1, 0.93, 0.86];
  const planSets = [];
  // richest first: the ring's plan, then without place, then name only
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
  void st; void W;
  return null;
}

function tryRadial(slot, rung, nl, s, plan, ring, centre, span, env, floor = false) {
  const { cx, cy, st, W } = env;
  const font = ring.font;
  const str = slot.ladder[rung];
  let nameLines = [str];
  if (nl === 2) { const sp = splitTwo(str, x => W.w(font, x)); if (!sp) return null; nameLines = sp; }
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
// Line work: each boundary drawn once, runs merged, strong vs faint.

function lineWork({ cx, cy, rings, K, S, aStart, state, st, rMed }) {
  const strong = [], faint = [];
  const full = S >= 360;
  const arcSeg = (r, a0, a1) => {
    const [x0, y0] = polar(cx, cy, r, a0);
    const [x1, y1] = polar(cx, cy, r, a1);
    return `M${fmt(x0)} ${fmt(y0)} A${fmt(r)} ${fmt(r)} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${fmt(x1)} ${fmt(y1)}`;
  };
  const pushArcRuns = (r, n, strengthAt) => {
    // merge consecutive slots with the same strength into one arc (split at 180°)
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
  // circular boundaries: inner edge of ring k (k ≥ 2) and the outer edge of ring K
  for (let k = 1; k <= K; k++) {
    const n = 2 ** k;
    if (k >= 2) pushArcRuns(rings[k].r0, n, j => Math.max(state[n + j], state[(n + j) >> 1]));
    else pushArcRuns(rings[1].r0, n, j => (state[n + j] ? 2 : 0));
    if (k === K) pushArcRuns(rings[k].r1, n, j => state[n + j]);
  }
  // radial boundaries, merged across rings when the strength is the same
  const nMax = 2 ** K;
  for (let b = 0; b <= nMax; b++) {
    if (full && b === nMax) continue;
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
      let sL, sR;
      if (full) { sL = state[n + ((j - 1 + n) % n)]; sR = state[n + (j % n)]; }
      else { sL = j > 0 ? state[n + j - 1] : 0; sR = j < n ? state[n + j] : 0; }
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
  void rMed;
  return out;
}

function radialSeg(cx, cy, r0, r1, ang) {
  const [x0, y0] = polar(cx, cy, r0, ang);
  const [x1, y1] = polar(cx, cy, r1, ang);
  return `M${fmt(x0)} ${fmt(y0)} L${fmt(x1)} ${fmt(y1)}`;
}

function overlaps(a, b, gap = 0) {
  return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
}
