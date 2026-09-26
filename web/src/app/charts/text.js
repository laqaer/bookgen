// Text fitting and placement for chart layouts. Pure functions, no DOM.
//
// All measurement goes through an injected font backend with the fonts.js API
// ({ measure, metrics, hasGlyphs }), so layout code runs unchanged in the
// browser (fonts.js) and in Node tests (fonts-node.mjs):
//
//   import { setTextBackend } from './text.js';
//   setTextBackend({ measure: opts.measure, metrics: opts.metrics, hasGlyphs: opts.hasGlyphs });
//
// Every function also accepts `opts.fonts` to override the backend per call.
// Craft rules (BRIEF §4.7): min 6 pt, hard floor 5.5 pt, ≥ 4% slack on fitted
// text, names never hyphenated, balanced two-line splits, arc names placed one
// glyph at a time with kerning from cumulative (prefix) widths.

export const MIN_TEXT_PT = 6;
export const FLOOR_TEXT_PT = 5.5;
export const FIT_SLACK = 0.04;

let backend = null;

/**
 * Install the font backend used by every function in this module.
 * @param {{ measure: Function, metrics?: Function, hasGlyphs?: Function }} b
 */
export function setTextBackend(b) {
  if (!b || typeof b.measure !== 'function') throw new TypeError('setTextBackend needs { measure, metrics }');
  backend = b;
}

function be(opts) {
  const b = (opts && opts.fonts) || backend;
  if (!b) throw new Error('text.js: no font backend; call setTextBackend({ measure, metrics }) first');
  return b;
}

const round3 = v => Math.round(v * 1000) / 1000;
const DEG = Math.PI / 180;

let segmenter = null;
/**
 * Split into user-perceived characters (a base letter keeps its combining marks).
 * @param {string} str
 * @returns {string[]}
 */
export function graphemes(str) {
  str = String(str ?? '');
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    segmenter ||= new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(str), s => s.segment);
  }
  // Fallback: attach combining marks (U+0300–036F, U+1AB0–1AFF, U+1DC0–1DFF, U+20D0–20FF, U+FE20–FE2F)
  const out = [];
  for (const ch of str) {
    if (out.length && /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/u.test(ch)) out[out.length - 1] += ch;
    else out.push(ch);
  }
  return out;
}

/**
 * Offset from the anchor y to the alphabetic baseline for a TextItem baseline.
 * 'middle' centres capital letters on y (shared by both renderers).
 * @param {{capHeight:number, unitsPerEm:number}} m font metrics
 * @param {number} size
 * @param {'alphabetic'|'middle'|undefined} baseline
 */
export function baselineOffset(m, size, baseline) {
  if (baseline === 'middle') return (m.capHeight / m.unitsPerEm) * size / 2;
  return 0;
}

/**
 * Width of a string with optional tracking (extra pt between glyphs, not after the last).
 * @param {string} str @param {string} fontKey @param {number} size @param {number} [tracking=0]
 */
export function textWidth(str, fontKey, size, tracking = 0, opts) {
  if (!str) return 0;
  const w = be(opts).measure(fontKey, size, str);
  return tracking ? w + tracking * (graphemes(str).length - 1) : w;
}

/**
 * Left edge of every grapheme along the baseline, kerning included:
 * x_i = w(str[0..i]) − w(str[i]) + i·tracking, so it matches the PDF's cumulative advances.
 * @returns {{ chars: string[], xs: number[], ws: number[], width: number }}
 */
export function glyphOffsets(str, fontKey, size, tracking = 0, opts) {
  const { measure } = be(opts);
  const chars = graphemes(str);
  const xs = new Array(chars.length), ws = new Array(chars.length);
  let prefix = '';
  for (let i = 0; i < chars.length; i++) {
    prefix += chars[i];
    ws[i] = measure(fontKey, size, chars[i]);
    xs[i] = measure(fontKey, size, prefix) - ws[i] + i * tracking;
  }
  const width = chars.length ? measure(fontKey, size, prefix) + tracking * (chars.length - 1) : 0;
  return { chars, xs, ws, width };
}

/**
 * Fit the fullest ladder entry that fits maxWidth at ≥ minSize; otherwise the
 * first that fits at the floor (5.5 pt). Sizes are multiples of `step`.
 * @param {string|string[]} ladder full → shortest (see engine/names.js nameLadder)
 * @param {number} maxWidth
 * @param {string} fontKey
 * @param {number} maxSize
 * @param {number} [minSize=6]
 * @param {number} [floor=5.5]
 * @param {{ slack?: number, step?: number, tracking?: number, fonts?: object }} [opts]
 * @returns {{ str: string, size: number, index: number, width: number, abbreviated: boolean, belowMin: boolean }|null}
 */
export function fitText(ladder, maxWidth, fontKey, maxSize, minSize = MIN_TEXT_PT, floor = FLOOR_TEXT_PT, opts = {}) {
  const list = (Array.isArray(ladder) ? ladder : [ladder]).filter(s => s != null && String(s).trim() !== '');
  const slack = opts.slack ?? FIT_SLACK;
  const step = opts.step ?? 0.25;
  const tracking = opts.tracking ?? 0;
  const capacity = maxWidth * (1 - slack);
  const b = be(opts);
  let floorHit = null;
  for (let index = 0; index < list.length; index++) {
    const str = String(list[index]);
    const unit = b.measure(fontKey, 1, str); // width is linear in size
    const gaps = tracking ? graphemes(str).length - 1 : 0;
    if (unit <= 0) continue;
    let size = Math.min(maxSize, (capacity - tracking * gaps) / unit);
    size = Math.floor(size / step + 1e-9) * step;
    if (size >= minSize) {
      return { str, size, index, width: unit * size + tracking * gaps, abbreviated: index > 0, belowMin: false };
    }
    if (!floorHit && size >= floor) {
      floorHit = { str, size, index, width: unit * size + tracking * gaps, abbreviated: index > 0, belowMin: true };
    }
  }
  return floorHit;
}

/**
 * Split a name into two lines at a space so the longer line is as short as
 * possible (never hyphenates; one word stays one line).
 * @returns {{ lines: string[], width: number, widths: number[] }}
 */
export function balancedSplit(str, fontKey, size, tracking = 0, opts) {
  const words = String(str).trim().split(/\s+/).filter(Boolean);
  const w = s => textWidth(s, fontKey, size, tracking, opts);
  if (words.length < 2) { const ww = w(words[0] || ''); return { lines: [words[0] || ''], width: ww, widths: [ww] }; }
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const a = words.slice(0, k).join(' '), b = words.slice(k).join(' ');
    const wa = w(a), wb = w(b);
    let score = Math.max(wa, wb);
    // gentle penalties: a lone initial ending line one, or a line of one short particle
    if (/^\p{L}\.$/u.test(words[k - 1]) && k < words.length) score *= 1.04;
    if (k === 1 && words[0].length <= 3) score *= 1.03;
    if (!best || score < best.score - 1e-9) best = { score, lines: [a, b], widths: [wa, wb] };
  }
  return { lines: best.lines, width: Math.max(...best.widths), widths: best.widths };
}

/**
 * Fit one or two balanced lines into a box. Tries each ladder entry as one line
 * and as a balanced two-line split, keeps the larger size, and walks the ladder
 * only when neither reaches minSize.
 * @param {string|string[]} ladder
 * @param {number} maxWidth
 * @param {number} maxHeight  available height (lines stack at size × lineGap)
 * @param {string} fontKey
 * @param {number} maxSize
 * @param {number} [minSize=6]
 * @param {number} [floor=5.5]
 * @param {{ lineGap?: number, slack?: number, step?: number, tracking?: number, maxLines?: 1|2, fonts?: object }} [opts]
 * @returns {{ lines: string[], size: number, index: number, width: number, abbreviated: boolean, belowMin: boolean }|null}
 */
export function fitBlock(ladder, maxWidth, maxHeight, fontKey, maxSize, minSize = MIN_TEXT_PT, floor = FLOOR_TEXT_PT, opts = {}) {
  const list = (Array.isArray(ladder) ? ladder : [ladder]).filter(s => s != null && String(s).trim() !== '');
  const lineGap = opts.lineGap ?? 1.15;
  const slack = opts.slack ?? FIT_SLACK;
  const step = opts.step ?? 0.25;
  const tracking = opts.tracking ?? 0;
  const maxLines = opts.maxLines ?? 2;
  const q = s => Math.floor(s / step + 1e-9) * step;
  let floorHit = null;
  for (let index = 0; index < list.length; index++) {
    const str = String(list[index]);
    const cands = [];
    const one = fitText([str], maxWidth, fontKey, Math.min(maxSize, maxHeight / 1.0), 0, 0, { ...opts, slack, step, tracking });
    if (one) cands.push({ lines: [str], size: one.size, width: one.width });
    if (maxLines >= 2 && /\s/.test(str.trim())) {
      const split = balancedSplit(str, fontKey, 1, 0, opts);
      const unit = split.width; // at size 1, no tracking
      const gaps = tracking ? Math.max(...split.lines.map(l => graphemes(l).length - 1)) : 0;
      let size = Math.min(maxSize, (maxWidth * (1 - slack) - tracking * gaps) / unit, maxHeight / (1 + lineGap));
      size = q(size);
      if (size > 0) cands.push({ lines: split.lines, size, width: unit * size + tracking * gaps });
    }
    if (!cands.length) continue;
    // prefer one line unless two lines buy ≥ 12% more size
    cands.sort((a, b) => b.size - a.size);
    let pick = cands[0];
    const single = cands.find(c => c.lines.length === 1);
    if (single && pick !== single && pick.size < single.size * 1.12) pick = single;
    if (pick.size >= minSize) return { ...pick, index, abbreviated: index > 0, belowMin: false };
    if (!floorHit && pick.size >= floor) floorHit = { ...pick, index, abbreviated: index > 0, belowMin: true };
  }
  return floorHit;
}

/** Arc length (pt) → angular span (deg) at radius r. */
export const arcSpanDeg = (length, r) => (length / r) / DEG;
/** Angular span (deg) → arc length (pt) at radius r. */
export const arcLength = (spanDeg, r) => spanDeg * DEG * r;

/** Point on a circle; degrees, 0 = up (12 o'clock), clockwise (Scene IR convention). */
export function polar(cx, cy, r, angleDeg) {
  const a = angleDeg * DEG;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/** Should text centred at this angle be flipped to read left-to-right? */
export function isBottomHalf(angleDeg, threshold = -1e-6) {
  threshold ??= -1e-6;
  return Math.cos(angleDeg * DEG) < threshold;
}

/**
 * Place a string on a circular arc, one glyph at a time.
 * Top half reads clockwise with glyph tops outward; with flipBottom, text centred
 * on the bottom half reads counter-clockwise (left to right) with tops inward.
 * @param {string} str
 * @param {string} fontKey
 * @param {number} size
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius baseline radius, or the radius of the text's vertical middle with valign 'middle'
 * @param {number} centerAngleDeg 0 = up, clockwise
 * @param {{ flipBottom?: boolean, flip?: boolean, flipThreshold?: number, tracking?: number, valign?: 'baseline'|'middle', fonts?: object }} [opts]
 *   flip forces the orientation; otherwise text flips when cos(centre) < flipThreshold
 *   (default just below 0; the Victoria spike used -0.2 so near-horizontal side names stay unflipped).
 * @returns {{ ch: string, x: number, y: number, rot: number }[] & { flipped: boolean, spanDeg: number, width: number, baselineRadius: number }}
 */
export function arcGlyphs(str, fontKey, size, cx, cy, radius, centerAngleDeg, opts = {}) {
  const { flipBottom = true, tracking = 0, valign = 'baseline' } = opts;
  const flipped = opts.flip ?? (flipBottom && isBottomHalf(centerAngleDeg, opts.flipThreshold));
  const b = be(opts);
  let rb = radius;
  if (valign === 'middle') {
    const m = b.metrics(fontKey);
    const mid = baselineOffset(m, size, 'middle');
    rb = flipped ? radius + mid : radius - mid;
  }
  const { chars, xs, ws, width } = glyphOffsets(str, fontKey, size, tracking, opts);
  const span = width / rb; // radians
  const c0 = centerAngleDeg * DEG;
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    const along = (xs[i] + ws[i] / 2) / rb;
    const th = flipped ? c0 + span / 2 - along : c0 - span / 2 + along;
    const px = cx + rb * Math.sin(th), py = cy - rb * Math.cos(th);
    // reading direction (unit tangent)
    const tx = flipped ? -Math.cos(th) : Math.cos(th);
    const ty = flipped ? -Math.sin(th) : Math.sin(th);
    let rot = th / DEG + (flipped ? -180 : 0);
    rot = ((rot % 360) + 540) % 360 - 180;
    out.push({ ch: chars[i], x: round3(px - tx * ws[i] / 2), y: round3(py - ty * ws[i] / 2), rot: round3(rot) });
  }
  Object.defineProperties(out, {
    flipped: { value: flipped },
    spanDeg: { value: span / DEG },
    width: { value: width },
    baselineRadius: { value: rb },
  });
  return out;
}

/**
 * Convenience: a complete GlyphsItem for arc text.
 * @returns {{ t: 'glyphs', font: string, size: number, color: string, g: object[], opacity?: number }}
 */
export function arcText(str, fontKey, size, color, cx, cy, radius, centerAngleDeg, opts = {}) {
  const g = arcGlyphs(str, fontKey, size, cx, cy, radius, centerAngleDeg, opts);
  const item = { t: 'glyphs', font: fontKey, size, color, g: [...g] };
  if (opts.opacity != null && opts.opacity < 1) item.opacity = opts.opacity;
  return item;
}

/**
 * Fit a ladder onto an arc of `spanDeg` degrees at radius r (uses arc length).
 * @returns same shape as fitText
 */
export function fitArc(ladder, fontKey, radius, spanDeg, maxSize, minSize = MIN_TEXT_PT, floor = FLOOR_TEXT_PT, opts = {}) {
  return fitText(ladder, arcLength(spanDeg, radius), fontKey, maxSize, minSize, floor, opts);
}

/**
 * Rotation for text set along a radius at angle θ: reads outward on the right
 * half, inward on the left half, so it is never upside down.
 * @returns {{ rot: number, flipped: boolean }}
 */
export function radialRotation(angleDeg) {
  const flipped = Math.sin(angleDeg * DEG) < -1e-9;
  let rot = flipped ? angleDeg + 90 : angleDeg - 90;
  rot = ((rot % 360) + 540) % 360 - 180;
  return { rot: round3(rot), flipped };
}

/**
 * Lines of text set along a radius (outer fan rings). Lines stack across the
 * radius, centred on `radius` at angle θ.
 * @param {string|string[]} lines
 * @param {string|string[]} fontKey one per line or shared
 * @param {number|number[]} size one per line or shared
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius where the text block sits (see opts.anchor)
 * @param {number} angleDeg
 * @param {{ color?: string|string[], lineGap?: number, anchor?: 'middle'|'inner'|'outer', tracking?: number, opacity?: number }} [opts]
 *   anchor 'inner': text starts at `radius` and runs outward; 'outer': ends at `radius`.
 * @returns {object[]} TextItems
 */
export function radialText(lines, fontKey, size, cx, cy, radius, angleDeg, opts = {}) {
  const L = (Array.isArray(lines) ? lines : [lines]).filter(s => s != null && s !== '');
  const fontsFor = i => (Array.isArray(fontKey) ? fontKey[i] ?? fontKey[fontKey.length - 1] : fontKey);
  const sizeFor = i => (Array.isArray(size) ? size[i] ?? size[size.length - 1] : size);
  const colorFor = i => (Array.isArray(opts.color) ? opts.color[i] ?? opts.color[opts.color.length - 1] : opts.color ?? '#000000');
  const lineGap = opts.lineGap ?? 1.15;
  const { rot, flipped } = radialRotation(angleDeg);
  const [px, py] = polar(cx, cy, radius, angleDeg);
  const phi = rot * DEG;
  const nx = -Math.sin(phi), ny = Math.cos(phi); // rotated "down" axis
  // centres of successive lines, pitch = mean of adjacent sizes × lineGap, block centred on radius
  const centres = [];
  L.forEach((_, i) => centres.push(i === 0 ? 0 : centres[i - 1] + (sizeFor(i - 1) + sizeFor(i)) / 2 * lineGap));
  const shift = centres.length ? (centres[0] + centres[centres.length - 1]) / 2 : 0;
  let anchor = 'middle';
  if (opts.anchor === 'inner') anchor = flipped ? 'end' : 'start';
  else if (opts.anchor === 'outer') anchor = flipped ? 'start' : 'end';
  const items = [];
  L.forEach((str, i) => {
    const s = sizeFor(i);
    const mid = centres[i] - shift;
    const item = {
      t: 'text', x: round3(px + nx * mid), y: round3(py + ny * mid), rot, str: String(str),
      font: fontsFor(i), size: s, color: colorFor(i), anchor, baseline: 'middle',
    };
    if (opts.tracking) item.tracking = opts.tracking;
    if (opts.opacity != null && opts.opacity < 1) item.opacity = opts.opacity;
    items.push(item);
  });
  return items;
}

/**
 * Synthesised small caps (our static fonts ship no smcp): capitals at full size,
 * lower-case letters as capitals at `ratio` × size, tracked. Returns TextItems
 * positioned run by run so screen and PDF match.
 * @param {string} str
 * @param {string} fontKey
 * @param {number} size
 * @param {number} x anchor x
 * @param {number} y baseline y (or middle with baseline 'middle')
 * @param {{ color?: string, tracking?: number, anchor?: 'start'|'middle'|'end', ratio?: number, rot?: number, baseline?: 'alphabetic'|'middle', opacity?: number, fonts?: object }} [opts]
 * @returns {object[]}
 */
export function smallCapsText(str, fontKey, size, x, y, opts = {}) {
  const ratio = opts.ratio ?? 0.78;
  const tracking = opts.tracking ?? 0;
  const runs = [];
  for (const ch of graphemes(str)) {
    if (/^\s+$/u.test(ch) && runs.length) { runs[runs.length - 1].str += ch; continue; } // spaces join the current run
    const lower = ch !== ch.toUpperCase() && ch === ch.toLowerCase();
    const up = lower ? ch.toUpperCase() : ch;
    const s = lower ? size * ratio : size;
    const last = runs[runs.length - 1];
    if (last && last.size === s) last.str += up;
    else runs.push({ str: up, size: s });
  }
  const widths = runs.map(r => textWidth(r.str, fontKey, r.size, tracking, opts));
  const total = widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, runs.length - 1);
  const k = opts.anchor === 'middle' ? 0.5 : opts.anchor === 'end' ? 1 : 0;
  const rot = opts.rot || 0;
  const c = Math.cos(rot * DEG), s = Math.sin(rot * DEG);
  if (opts.baseline === 'middle') {
    // centre on the full-size capitals, then set every run on one alphabetic baseline
    const down = baselineOffset(be(opts).metrics(fontKey), size, 'middle');
    x += -s * down; y += c * down;
  }
  let along = -total * k;
  const items = [];
  runs.forEach((r, i) => {
    const item = {
      t: 'text', x: round3(x + c * along), y: round3(y + s * along), str: r.str, font: fontKey, size: round3(r.size),
      color: opts.color ?? '#000000', anchor: 'start', baseline: 'alphabetic',
    };
    if (rot) item.rot = rot;
    if (tracking) item.tracking = tracking;
    if (opts.opacity != null && opts.opacity < 1) item.opacity = opts.opacity;
    items.push(item);
    along += widths[i] + tracking;
  });
  return items;
}
