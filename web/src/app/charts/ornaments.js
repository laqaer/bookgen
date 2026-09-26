// Single-colour ornaments as SVG path data (Scene IR PathItems).
//
// Every ornament is built from "marks" — { d, fill: true } or { d, sw } — and
// painted in one colour with paint(marks, color). All geometry is drawn here
// from first principles (Béziers, tapered strokes, polar construction); nothing
// is traced from artwork. Paths use only M L C A Z, so path.js, Path2D and the
// PDF writer all accept them.
//
//   import { paint, laurelSprig, compassRose, doubleRule } from './ornaments.js';
//   items.push(...paint(compassRose(cx, cy, 60).marks, '#3f5663'));
//
// Hairlines never go below 0.35 pt (BRIEF §4.7 rule 3).

import { fmt, circlePath, rectPath } from './path.js';

const DEG = Math.PI / 180;
export const MIN_SW = 0.35;

// ---------------------------------------------------------------------------
// Primitives

/** Paint marks in one colour. @returns {object[]} PathItems */
export function paint(marks, color, opts = {}) {
  const out = [];
  const fills = [], strokes = new Map();
  for (const m of marks) {
    if (!m || !m.d) continue;
    if (m.fill) fills.push(m.d);
    else {
      const sw = Math.max(MIN_SW, m.sw ?? MIN_SW);
      const key = `${sw}|${m.cap || 'butt'}|${m.join || 'miter'}`;
      if (!strokes.has(key)) strokes.set(key, { sw, cap: m.cap, join: m.join, ds: [] });
      strokes.get(key).ds.push(m.d);
    }
  }
  const op = opts.opacity != null && opts.opacity < 1 ? { opacity: opts.opacity } : {};
  if (fills.length) out.push({ t: 'path', d: fills.join(' '), fill: color, ...op });
  for (const s of strokes.values()) {
    const it = { t: 'path', d: s.ds.join(' '), stroke: color, sw: Math.round(s.sw * 1000) / 1000, ...op };
    if (s.cap) it.cap = s.cap;
    if (s.join) it.join = s.join;
    out.push(it);
  }
  return out;
}

const P = (x, y) => `${fmt(x)} ${fmt(y)}`;

/** Polygon through points (closed). */
export function polygon(pts) {
  return 'M' + pts.map(([x, y]) => P(x, y)).join(' L') + ' Z';
}

/** Open polyline. */
export function polyline(pts) {
  return 'M' + pts.map(([x, y]) => P(x, y)).join(' L');
}

/** Circle as a closed path (for fills and strokes). */
export function circle(cx, cy, r) {
  return circlePath(cx, cy, r);
}

function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}
function bezD(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
    3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]),
  ];
}

/**
 * Sample a chain of cubic segments [[p0,p1,p2,p3], ...] (each starts where the
 * previous ended) into points with unit normals and arc-length parameter u ∈ [0,1].
 */
export function sampleCubics(segs, perSeg = 18) {
  const pts = [];
  segs.forEach((s, si) => {
    for (let i = si ? 1 : 0; i <= perSeg; i++) {
      const t = i / perSeg;
      const p = bez(s[0], s[1], s[2], s[3], t);
      let d = bezD(s[0], s[1], s[2], s[3], t);
      let len = Math.hypot(d[0], d[1]);
      if (len < 1e-9) { d = bezD(s[0], s[1], s[2], s[3], Math.min(1, Math.max(0, t + (t < 0.5 ? 1e-3 : -1e-3)))); len = Math.hypot(d[0], d[1]) || 1; }
      pts.push({ x: p[0], y: p[1], nx: -d[1] / len, ny: d[0] / len });
    }
  });
  let acc = 0;
  pts[0].s = 0;
  for (let i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); pts[i].s = acc; }
  for (const p of pts) p.u = acc ? p.s / acc : 0;
  return pts;
}

/**
 * A calligraphic stroke: the centre line (cubic chain) swollen by width(u) and
 * returned as a filled outline. This is what makes rules, stems and flourishes
 * look engraved rather than drawn with a constant pen.
 * @param {number[][][]} segs cubic segments
 * @param {(u:number)=>number} width full width at u ∈ [0,1]
 * @returns {string} path d (fill)
 */
export function taper(segs, width, perSeg = 18) {
  const pts = sampleCubics(segs, perSeg);
  const left = [], right = [];
  for (const p of pts) {
    const h = Math.max(0.12, width(p.u)) / 2;
    left.push([p.x + p.nx * h, p.y + p.ny * h]);
    right.push([p.x - p.nx * h, p.y - p.ny * h]);
  }
  return polygon([...left, ...right.reverse()]);
}

/** Width profiles for taper(). */
export const swell = (wMax, wMin = wMax * 0.15, k = 0.8) => u => wMin + (wMax - wMin) * Math.sin(Math.PI * u) ** k;
export const fade = (wMax, wMin = wMax * 0.1, k = 1) => u => wMin + (wMax - wMin) * (1 - u) ** k;

function xf(ox, oy, ang, sx = 1, sy = 1) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return ([x, y]) => [ox + (x * sx) * c - (y * sy) * s, oy + (x * sx) * s + (y * sy) * c];
}
const mapSeg = (seg, f) => seg.map(f);

// ---------------------------------------------------------------------------
// Leaves, laurel

/**
 * One leaf as two filled halves with a hairline vein left as paper between
 * them (the engraved look in a single colour).
 * @param {number} bx base x
 * @param {number} by base y
 * @param {number} len
 * @param {number} wid full width
 * @param {number} angDeg direction from base to tip (0 = +x, clockwise on screen)
 * @param {{ vein?: number, bend?: number }} [o] bend: curve the leaf (−1..1)
 * @returns {object[]} marks
 */
export function leaf(bx, by, len, wid, angDeg, o = {}) {
  const f = xf(bx, by, angDeg * DEG);
  const g = (o.vein ?? Math.max(0.3, wid * 0.09)) / 2;
  const b = (o.bend ?? 0.12) * wid;
  const hw = wid / 2;
  // upper half (y < 0), lower half (y > 0); the midrib bows by `b`
  const mid = t => [len * t, -b * Math.sin(Math.PI * t)];
  const up = [[0.03 * len, -g], [0.22 * len, -hw * 1.08 - b], [0.68 * len, -hw * 0.95 - b * 1.1], [len, 0]];
  const lo = [[0.03 * len, g], [0.24 * len, hw * 0.98 - b], [0.7 * len, hw * 0.78 - b * 0.9], [len, 0]];
  const ribUp = [], ribLo = [];
  for (let i = 10; i >= 0; i--) {
    const t = i / 10, [x, y] = mid(t);
    const gg = g * (1 - t) * 1.0;
    ribUp.push([x, y - gg]); ribLo.push([x, y + gg]);
  }
  const half = (seg, rib) => {
    const pts = sampleCubics([seg], 16).map(p => [p.x, p.y]);
    return polygon([...pts, ...rib.slice(1)].map(f));
  };
  return [{ d: half(up, ribUp), fill: true }, { d: half(lo, ribLo), fill: true }];
}

/**
 * A laurel sprig along a cubic stem.
 * @param {number[][]} stem [p0, p1, p2, p3] base → tip
 * @param {{ leaves?: number, size?: number, stemWidth?: number, berries?: boolean, spread?: number, flip?: boolean }} [o]
 *   size: leaf length at the base; leaves: pairs of leaves; spread: leaf angle from the stem (deg)
 * @returns {object[]} marks
 */
export function laurelSprig(stem, o = {}) {
  const n = o.leaves ?? 7;
  const size = o.size ?? 20;
  const spread = o.spread ?? 38;
  const marks = [];
  const sw = o.stemWidth ?? size * 0.09;
  marks.push({ d: taper([stem], u => sw * (1 - 0.75 * u) + 0.15), fill: true });
  for (let i = 0; i < n; i++) {
    const t = 0.1 + 0.8 * (i / Math.max(1, n - 1)) ** 0.92;
    for (const side of [-1, 1]) {
      const tt = Math.min(0.97, t + (side > 0 ? 0.045 : 0));
      const p = bez(stem[0], stem[1], stem[2], stem[3], tt);
      const d = bezD(stem[0], stem[1], stem[2], stem[3], tt);
      const ang = Math.atan2(d[1], d[0]) / DEG + side * spread * (1 - 0.25 * tt);
      const L = size * (1 - 0.42 * tt);
      marks.push(...leaf(p[0], p[1], L, L * 0.36, ang, { bend: side * 0.14 * (o.flip ? -1 : 1) }));
      if (o.berries && i % 3 === 1 && side === (o.flip ? 1 : -1)) {
        const ba = (ang + side * 28) * DEG;
        const r = L * 0.1;
        marks.push({ d: circle(p[0] + Math.cos(ba) * L * 0.42, p[1] + Math.sin(ba) * L * 0.42, r), fill: true });
      }
    }
  }
  // tip leaf
  const tip = stem[3];
  const d = bezD(stem[0], stem[1], stem[2], stem[3], 1);
  marks.push(...leaf(tip[0], tip[1], size * 0.62, size * 0.62 * 0.34, Math.atan2(d[1], d[0]) / DEG, { bend: 0.05 }));
  return marks;
}

/**
 * Laurel base: two sprigs rising from a crossed tie at (cx, cy), curving out and
 * up like the lower half of a wreath.
 * @param {number} cx
 * @param {number} cy bottom of the wreath (the tie)
 * @param {number} width total width
 * @param {number} height rise of the tips above cy
 * @returns {object[]} marks
 */
export function laurelBase(cx, cy, width, height, o = {}) {
  const w = width / 2;
  const size = o.size ?? Math.min(width * 0.085, height * 0.55);
  const marks = [];
  for (const s of [-1, 1]) {
    const stem = [
      [cx + s * w * 0.03, cy + height * 0.02],
      [cx + s * w * 0.38, cy + height * 0.12],
      [cx + s * w * 0.82, cy - height * 0.18],
      [cx + s * w * 0.98, cy - height],
    ];
    marks.push(...laurelSprig(stem, { leaves: o.leaves ?? 8, size, berries: o.berries ?? true, flip: s < 0 }));
  }
  // the tie: two short crossing stems and a small knot
  const k = size * 0.22;
  marks.push({ d: taper([[[cx - k * 2.2, cy + k * 1.6], [cx - k, cy + k * 0.5], [cx + k * 0.5, cy - k * 0.2], [cx + k * 1.6, cy - k * 0.6]]], swell(k * 0.55, 0.3)), fill: true });
  marks.push({ d: taper([[[cx + k * 2.2, cy + k * 1.6], [cx + k, cy + k * 0.5], [cx - k * 0.5, cy - k * 0.2], [cx - k * 1.6, cy - k * 0.6]]], swell(k * 0.55, 0.3)), fill: true });
  marks.push({ d: circle(cx, cy + k * 0.1, k * 0.42), fill: true });
  return marks;
}

/**
 * Laurel sprigs hugging a circle: from angle `from` towards `to` (degrees, 0 = up,
 * clockwise), just outside radius r. Used to cradle a full-circle fan.
 */
export function laurelArc(cx, cy, r, from, to, o = {}) {
  const pts = [0, 1 / 3, 2 / 3, 1].map(t => {
    const a = (from + (to - from) * t) * DEG;
    return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  });
  // turn 4 points on the arc into a cubic that approximates it
  const a0 = from * DEG, a1 = to * DEG;
  const k = (4 / 3) * Math.tan((a1 - a0) / 4) * r;
  const p0 = pts[0], p3 = pts[3];
  const t0 = [Math.cos(a0), Math.sin(a0)], t1 = [Math.cos(a1), Math.sin(a1)];
  const stem = [p0, [p0[0] + t0[0] * k, p0[1] + t0[1] * k], [p3[0] - t1[0] * k, p3[1] - t1[1] * k], p3];
  return laurelSprig(stem, { leaves: o.leaves ?? 9, size: o.size ?? r * 0.08, berries: o.berries ?? true, flip: o.flip });
}

// ---------------------------------------------------------------------------
// Rules and fleurons

/**
 * Small fleuron centred at (cx, cy): 'diamond' | 'medallion' | 'dot' | 'star' | 'none'.
 * size = overall width. @returns {object[]} marks
 */
export function fleuron(kind, cx, cy, size, sw = MIN_SW) {
  const s = size / 2;
  switch (kind) {
    case 'diamond':
      return [
        { d: polygon([[cx - s * 0.52, cy], [cx, cy - s * 0.3], [cx + s * 0.52, cy], [cx, cy + s * 0.3]]), fill: true },
        { d: polygon([[cx - s, cy], [cx, cy - s * 0.56], [cx + s, cy], [cx, cy + s * 0.56]]), sw },
      ];
    case 'medallion': return smallMedallion(cx, cy, s * 0.72, sw);
    case 'dot': return [{ d: circle(cx, cy, s * 0.22), fill: true }];
    case 'star': return star4(cx, cy, s, s * 0.2);
    default: return [];
  }
}

/** Four-point star (a compass point without the rings). */
export function star4(cx, cy, r, waist = r * 0.2, rot = 0) {
  const marks = [];
  for (let i = 0; i < 4; i++) {
    const a = (rot + i * 90) * DEG;
    const tip = [cx + r * Math.sin(a), cy - r * Math.cos(a)];
    const l = [cx + waist * Math.sin(a - Math.PI / 4), cy - waist * Math.cos(a - Math.PI / 4)];
    const rr = [cx + waist * Math.sin(a + Math.PI / 4), cy - waist * Math.cos(a + Math.PI / 4)];
    marks.push({ d: polygon([tip, l, [cx, cy], rr]), fill: true });
  }
  return marks;
}

/**
 * A small medallion: double ring, four-petal rosette and a centre dot.
 * @returns {object[]} marks
 */
export function smallMedallion(cx, cy, r, sw = MIN_SW) {
  const marks = [
    { d: circle(cx, cy, r), sw: Math.max(sw, r * 0.06) },
    { d: circle(cx, cy, r * 0.8), sw },
    { d: circle(cx, cy, r * 0.12), fill: true },
  ];
  for (let i = 0; i < 4; i++) {
    const a = i * 90 - 90;
    const bx = cx + Math.cos(a * DEG) * r * 0.16, by = cy + Math.sin(a * DEG) * r * 0.16;
    marks.push(...leaf(bx, by, r * 0.52, r * 0.3, a, { bend: 0, vein: r * 0.05 }));
  }
  for (let i = 0; i < 4; i++) {
    const a = (45 + i * 90) * DEG;
    marks.push({ d: circle(cx + Math.cos(a) * r * 0.5, cy + Math.sin(a) * r * 0.5, r * 0.07), fill: true });
  }
  return marks;
}

/**
 * Horizontal rule from x0 to x1 at y with an optional fleuron gap in the middle.
 * kind: 'double' (two hairlines), 'thickthin' (Oxford rule), 'single'.
 * The rule ends in fine tapered points so it reads as engraved.
 * @param {{ gap?: number, fleuron?: string, fleuronSize?: number, sw?: number, thick?: number, below?: boolean }} [o]
 *   below: for 'thickthin', put the thin line below the thick one (default) or above
 * @returns {object[]} marks
 */
export function rule(kind, x0, x1, y, o = {}) {
  const sw = Math.max(MIN_SW, o.sw ?? 0.45);
  const gap = o.gap ?? 2.4;
  const fl = o.fleuron && o.fleuron !== 'none' ? o.fleuron : null;
  const fs = o.fleuronSize ?? 10;
  const cx = (x0 + x1) / 2;
  const hole = fl ? fs * 0.95 : 0;
  const spans = fl ? [[x0, cx - hole], [cx + hole, x1]] : [[x0, x1]];
  const marks = [];
  const line = (a, b, yy, w) => marks.push({ d: `M${P(a, yy)} L${P(b, yy)}`, sw: w });
  const tapered = (a, b, yy, w, towardsCentre) => {
    // a hairline that thins to a point at its outer end
    const len = b - a;
    const segs = [[[a, yy], [a + len / 3, yy], [a + 2 * len / 3, yy], [b, yy]]];
    const prof = towardsCentre ? (u => Math.max(0.12, w * Math.min(1, u * 6))) : (u => Math.max(0.12, w * Math.min(1, (1 - u) * 6)));
    marks.push({ d: taper(segs, prof, 8), fill: true });
  };
  for (const [a, b] of spans) {
    if (b - a <= 0.5) continue;
    const leftSide = b <= cx + 1e-6 && fl;
    const outerTaper = (yy, w) => (fl ? (leftSide ? tapered(a, b, yy, w, true) : tapered(a, b, yy, w, false)) : line(a, b, yy, w));
    if (kind === 'double') {
      outerTaper(y - gap / 2, sw * 1.35);
      outerTaper(y + gap / 2, sw);
    } else if (kind === 'thickthin') {
      const th = o.thick ?? Math.max(1.2, sw * 3.2);
      const yT = o.below === false ? y + gap / 2 : y - gap / 2;
      const yt = o.below === false ? y - gap / 2 - th / 2 : y + gap / 2 + th / 2;
      marks.push({ d: rectPath(a, yT - th / 2, b - a, th), fill: true });
      line(a, b, yt, sw);
    } else {
      outerTaper(y, sw * 1.2);
    }
  }
  if (fl) marks.push(...fleuron(fl, cx, y, fs, sw));
  return marks;
}

// ---------------------------------------------------------------------------
// Compass rose

/**
 * Compass rose: 8-point star (cardinal points half filled, half outlined),
 * double ring with degree ticks, centre boss. Returns marks and a label spec
 * for the "N" (drawn as text by the caller so it stays real, selectable type).
 * @returns {{ marks: object[], north: { x: number, y: number, size: number } }}
 */
export function compassRose(cx, cy, r, o = {}) {
  const sw = Math.max(MIN_SW, o.sw ?? r * 0.012);
  const marks = [];
  const rr = r * 0.74; // ring
  marks.push({ d: circle(cx, cy, rr), sw: sw * 1.4 });
  marks.push({ d: circle(cx, cy, rr * 0.93), sw });
  marks.push({ d: circle(cx, cy, rr * 0.5), sw });
  // ticks between the rings every 5°, longer every 45°
  const ticks = [];
  for (let a = 0; a < 360; a += 5) {
    const long = a % 45 === 0;
    const r0 = rr * 0.93, r1 = long ? rr * 1.0 : rr * 0.965;
    const s = Math.sin(a * DEG), c = Math.cos(a * DEG);
    ticks.push(`M${P(cx + r0 * s, cy - r0 * c)} L${P(cx + r1 * s, cy - r1 * c)}`);
  }
  marks.push({ d: ticks.join(' '), sw });
  const point = (angDeg, len, waist, solidLeft) => {
    const a = angDeg * DEG;
    const tip = [cx + len * Math.sin(a), cy - len * Math.cos(a)];
    const L = [cx + waist * Math.sin(a - Math.PI / 4), cy - waist * Math.cos(a - Math.PI / 4)];
    const R = [cx + waist * Math.sin(a + Math.PI / 4), cy - waist * Math.cos(a + Math.PI / 4)];
    const C = [cx, cy];
    marks.push({ d: polygon(solidLeft ? [tip, L, C] : [tip, C, R]), fill: true });
    marks.push({ d: polygon([tip, L, C, R]), sw, join: 'miter' });
  };
  // minor 16-point hairlines
  const minor = [];
  for (let a = 22.5; a < 360; a += 45) {
    const s = Math.sin(a * DEG), c = Math.cos(a * DEG);
    minor.push(`M${P(cx + rr * 0.5 * s, cy - rr * 0.5 * c)} L${P(cx + rr * 0.9 * s, cy - rr * 0.9 * c)}`);
  }
  marks.push({ d: minor.join(' '), sw });
  for (const a of [45, 135, 225, 315]) point(a, r * 0.6, r * 0.1, true);
  for (const a of [0, 90, 180, 270]) point(a, r * (a === 0 ? 1.0 : 0.92), r * 0.13, true);
  marks.push({ d: circle(cx, cy, r * 0.055), fill: true });
  marks.push({ d: circle(cx, cy, r * 0.09), sw });
  return { marks, north: { x: cx, y: cy - r * 1.06, size: r * 0.26 } };
}

// ---------------------------------------------------------------------------
// Medallion rings (the fan's centre)

/** A ring of small beads between radii (Midnight's gilt medallion). */
export function beadRing(cx, cy, r, beadR, n) {
  const count = n ?? Math.max(24, Math.round((2 * Math.PI * r) / (beadR * 3.1)));
  const ds = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * 2 * Math.PI;
    ds.push(circle(cx + r * Math.sin(a), cy - r * Math.cos(a), beadR));
  }
  return [{ d: ds.join(' '), fill: true }];
}

/**
 * Medallion border: 'double' (two hairlines), 'beaded' (hairline, beads, hairline),
 * 'single'. `half` draws only the upper half (for 180° fans) with a base line.
 * @returns {object[]} marks
 */
export function medallionRing(kind, cx, cy, r, o = {}) {
  const sw = Math.max(MIN_SW, o.sw ?? 0.5);
  const gap = o.gap ?? Math.max(2, r * 0.035);
  const marks = [];
  const ring = (rad, w) => marks.push({ d: o.half ? halfCircle(cx, cy, rad) : circle(cx, cy, rad), sw: w });
  if (kind === 'double') { ring(r, sw * 1.6); ring(r - gap, sw); }
  else if (kind === 'beaded') {
    ring(r, sw * 1.4);
    ring(r - gap * 2.2, sw);
    const beads = beadRing(cx, cy, r - gap * 1.1, gap * 0.34);
    if (o.half) {
      // keep only upper-half beads
      const n = Math.max(24, Math.round((2 * Math.PI * (r - gap * 1.1)) / (gap * 0.34 * 3.1)));
      const ds = [];
      for (let i = 0; i <= n / 2; i++) {
        const a = -Math.PI / 2 + (i / (n / 2)) * Math.PI;
        ds.push(circle(cx + (r - gap * 1.1) * Math.sin(a), cy - (r - gap * 1.1) * Math.cos(a), gap * 0.34));
      }
      marks.push({ d: ds.join(' '), fill: true });
    } else marks.push(...beads);
  } else if (kind === 'single') ring(r, sw * 1.4);
  return marks;
}

function halfCircle(cx, cy, r) {
  return `M${P(cx - r, cy)} A${fmt(r)} ${fmt(r)} 0 0 1 ${P(cx + r, cy)}`;
}

// ---------------------------------------------------------------------------
// Corner flourish and frames

/**
 * Engraved corner flourish, symmetric about the corner's diagonal.
 * (x, y) is the corner point; the flourish grows into the page by `size`.
 * corner: 'tl' | 'tr' | 'bl' | 'br'.
 * @returns {object[]} marks
 */
export function cornerFlourish(x, y, size, corner = 'tl', o = {}) {
  const sx = corner === 'tr' || corner === 'br' ? -1 : 1;
  const sy = corner === 'bl' || corner === 'br' ? -1 : 1;
  const S = size;
  const T = ([u, v]) => [x + sx * u * S, y + sy * v * S];
  const Tswap = ([u, v]) => T([v, u]);
  const w = o.width ?? Math.max(0.9, S * 0.022);
  // one arm, along the top edge (u = along edge, v = into the page), in unit space
  const arm = [
    [[0.13, 0.13], [0.24, 0.035], [0.5, 0.03], [0.76, 0.085]],
    [[0.76, 0.085], [0.9, 0.115], [0.93, 0.24], [0.83, 0.25]],
    [[0.83, 0.25], [0.76, 0.255], [0.745, 0.18], [0.805, 0.175]],
  ];
  const inner = [
    [[0.2, 0.2], [0.3, 0.13], [0.43, 0.12], [0.52, 0.17]],
    [[0.52, 0.17], [0.58, 0.2], [0.56, 0.27], [0.5, 0.255]],
  ];
  const marks = [];
  for (const f of [T, Tswap]) {
    marks.push({ d: taper(arm.map(seg => mapSeg(seg, f)), u => (u < 0.62 ? swell(w * 1.6, w * 0.25, 0.9)(u / 0.62) : w * (0.5 - 0.35 * (u - 0.62) / 0.38)) + 0.12, 22), fill: true });
    marks.push({ d: taper(inner.map(seg => mapSeg(seg, f)), swell(w * 0.95, w * 0.2), 16), fill: true });
    // a small leaf off the main arm
    const [lx, ly] = f([0.42, 0.058]);
    const [tx, ty] = f([0.5, 0.2]);
    const ang = Math.atan2(ty - ly, tx - lx) / DEG;
    marks.push(...leaf(lx, ly, S * 0.13, S * 0.045, ang, { bend: 0.1 }));
  }
  // corner boss: diamond on the diagonal and a teardrop pointing inward
  const c = T([0.07, 0.07]);
  const d = S * 0.045;
  marks.push({ d: polygon([[c[0] - d, c[1]], [c[0], c[1] - d], [c[0] + d, c[1]], [c[0], c[1] + d]]), fill: true });
  const [bx, by] = T([0.2, 0.2]);
  const [ex, ey] = T([0.36, 0.36]);
  marks.push(...leaf(bx, by, Math.hypot(ex - bx, ey - by), S * 0.07, Math.atan2(ey - by, ex - bx) / DEG, { bend: 0 }));
  return marks;
}

/**
 * Page frame around a rectangle.
 * kind: 'double' | 'gilt' | 'thickthin' | 'neatline' | 'none'.
 * @param {{ gap?: number, sw?: number, thick?: number, band?: number, segments?: number }} [o]
 * @returns {object[]} marks
 */
export function frame(kind, x, y, w, h, o = {}) {
  const sw = Math.max(MIN_SW, o.sw ?? 0.5);
  const gap = o.gap ?? 3;
  const marks = [];
  const box = (inset, width) => marks.push({ d: rectPath(x + inset, y + inset, w - 2 * inset, h - 2 * inset), sw: width, join: 'miter' });
  switch (kind) {
    case 'double':
      box(0, sw * 1.5); box(gap, sw);
      break;
    case 'gilt': {
      box(0, sw * 1.2); box(gap, sw);
      const d = gap * 1.1;
      for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
        marks.push({ d: polygon([[cx - d, cy], [cx, cy - d], [cx + d, cy], [cx, cy + d]]), fill: true });
      }
      break;
    }
    case 'thickthin': {
      const th = o.thick ?? Math.max(1.5, sw * 3.5);
      marks.push({ d: `${rectPath(x, y, w, h)} ${reverseRect(x + th, y + th, w - 2 * th, h - 2 * th)}`, fill: true });
      box(th + gap, sw);
      break;
    }
    case 'neatline': {
      const band = o.band ?? Math.max(3, gap * 1.4);
      box(0, sw * 1.4);
      box(band, sw);
      // alternating filled segments in the band, like a map's degree border
      const seg = o.segments ?? Math.max(8, Math.round(w / (band * 9)));
      const segLen = (w - 2 * band) / seg;
      const ds = [];
      for (let i = 0; i < seg; i += 2) {
        ds.push(rectPath(x + band + i * segLen, y, segLen, band));
        ds.push(rectPath(x + band + (i + 1) * segLen, y + h - band, segLen, band));
      }
      const segV = Math.max(8, Math.round((h - 2 * band) / segLen));
      const segLenV = (h - 2 * band) / segV;
      for (let i = 0; i < segV; i += 2) {
        ds.push(rectPath(x, y + band + (i + 1) * segLenV, band, segLenV));
        ds.push(rectPath(x + w - band, y + band + i * segLenV, band, segLenV));
      }
      // corner squares
      for (const [cx, cy] of [[x, y], [x + w - band, y], [x, y + h - band], [x + w - band, y + h - band]]) ds.push(rectPath(cx, cy, band, band));
      marks.push({ d: ds.join(' '), fill: true });
      box(band + gap * 0.8, sw);
      break;
    }
    default: break;
  }
  return marks;
}

/** Rectangle drawn counter-clockwise (a hole under the nonzero rule). */
function reverseRect(x, y, w, h) {
  return `M${P(x, y)} V${fmt(y + h)} H${fmt(x + w)} V${fmt(y)} Z`;
}

/** How far inside a frame the content must start (pt). */
export function frameInset(kind, o = {}) {
  const gap = o.gap ?? 3;
  switch (kind) {
    case 'double': case 'gilt': return gap;
    case 'thickthin': return (o.thick ?? 1.75) + gap;
    case 'neatline': return (o.band ?? Math.max(3, gap * 1.4)) + gap * 0.8;
    default: return 0;
  }
}

// ---------------------------------------------------------------------------
// Graticule (Cartographer)

/**
 * A faint conic graticule over a rectangle: parallels as concentric arcs about a
 * point far below the page, meridians as rays from it. Clip it to the rectangle.
 * @returns {object[]} marks (strokes)
 */
export function graticule(x, y, w, h, o = {}) {
  const sw = Math.max(MIN_SW, o.sw ?? 0.35);
  const step = o.step ?? Math.min(w, h) / 9;
  const cx = x + w / 2, cy = y + h + (o.depth ?? h * 1.9);
  const rTop = Math.hypot(w / 2, cy - y) + step;
  const rBot = cy - (y + h) - step;
  const ds = [];
  // parallels
  const r0 = Math.ceil(rBot / step) * step;
  const halfAng = Math.asin(Math.min(1, (w / 2 + step) / rBot)) + 0.05;
  for (let r = r0; r <= rTop; r += step) {
    const a = Math.min(halfAng, Math.asin(Math.min(1, (w / 2 + step) / r)) + 0.02);
    const x0 = cx - r * Math.sin(a), y0 = cy - r * Math.cos(a);
    const x1 = cx + r * Math.sin(a), y1 = y0;
    ds.push(`M${P(x0, y0)} A${fmt(r)} ${fmt(r)} 0 0 1 ${P(x1, y1)}`);
  }
  // meridians: equal angles, spaced about `step` at the page's vertical middle
  const rm = cy - (y + h / 2);
  const dAng = step / rm;
  const nM = Math.ceil(Math.asin(Math.min(1, (w / 2 + step) / rBot)) / dAng) + 1;
  for (let i = -nM; i <= nM; i++) {
    const a = i * dAng;
    ds.push(`M${P(cx + rBot * Math.sin(a), cy - rBot * Math.cos(a))} L${P(cx + rTop * Math.sin(a), cy - rTop * Math.cos(a))}`);
  }
  return [{ d: ds.join(' '), sw }];
}
