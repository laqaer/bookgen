// Shared SVG path utilities for the Scene IR.
//
// Both renderers draw paths from the same parsed, normalised command list, so a
// path looks identical on canvas and in the PDF. Arcs (A/a) are converted to
// cubic Béziers here (SVG 1.1 implementation notes F.6.5/F.6.6), including the
// corner cases PDFKit's own parser gets wrong: zero radii become straight lines
// and zero-length arcs are dropped instead of producing NaN coordinates.
//
// Normalised commands (absolute, points; quadratics are raised to cubics):
//   ['M', x, y] ['L', x, y] ['C', x1, y1, x2, y2, x, y] ['Z']

const ARG_COUNT = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
const NUM_RE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;

/**
 * Tokenise and parse an SVG path string into absolute M/L/C/Z commands.
 * Throws on malformed input so bad layout output fails loudly in tests.
 * @param {string} d
 * @returns {Array<Array<string|number>>}
 */
export function parsePath(d) {
  if (typeof d !== 'string') throw new TypeError('path d must be a string');
  const out = [];
  let i = 0;
  const n = d.length;
  let cmd = null;
  let cx = 0, cy = 0; // current point
  let sx = 0, sy = 0; // subpath start
  let lastCtrl = null; // for S/T reflection: [x, y, kind]

  const skipSep = () => {
    while (i < n) {
      const c = d.charCodeAt(i);
      if (c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 44) i++;
      else break;
    }
  };
  const readNum = () => {
    skipSep();
    const m = NUM_RE.exec(d.slice(i, i + 64));
    if (!m) throw new SyntaxError(`path: expected number at ${i} in "${d.slice(Math.max(0, i - 10), i + 10)}"`);
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const readFlag = () => {
    skipSep();
    const c = d[i];
    if (c !== '0' && c !== '1') throw new SyntaxError(`path: expected arc flag at ${i}`);
    i++;
    return c === '1' ? 1 : 0;
  };
  const hasMoreNumbers = () => {
    skipSep();
    if (i >= n) return false;
    const c = d[i];
    return (c >= '0' && c <= '9') || c === '-' || c === '+' || c === '.';
  };

  skipSep();
  while (i < n) {
    const ch = d[i];
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(ch)) {
      cmd = ch;
      i++;
    } else if (cmd === null) {
      throw new SyntaxError(`path must start with a command, got "${ch}"`);
    } else if (cmd === 'Z' || cmd === 'z') {
      throw new SyntaxError(`path: unexpected "${ch}" after Z at ${i}`);
    }
    if (out.length === 0 && cmd !== 'M' && cmd !== 'm') throw new SyntaxError('path must start with M');
    // Implicit repetition: numbers after M are L, after m are l.
    const up = cmd.toUpperCase();
    const rel = cmd !== up;
    if (up === 'Z') {
      out.push(['Z']);
      cx = sx; cy = sy;
      lastCtrl = null;
      skipSep();
      continue;
    }
    let first = true;
    do {
      if (!first && !hasMoreNumbers()) break;
      const ox = rel ? cx : 0, oy = rel ? cy : 0;
      switch (up) {
        case 'M': {
          const x = readNum() + ox, y = readNum() + oy;
          if (first) {
            out.push(['M', x, y]);
            sx = x; sy = y;
          } else out.push(['L', x, y]);
          cx = x; cy = y; lastCtrl = null;
          break;
        }
        case 'L': {
          const x = readNum() + ox, y = readNum() + oy;
          out.push(['L', x, y]); cx = x; cy = y; lastCtrl = null;
          break;
        }
        case 'H': {
          const x = readNum() + ox;
          out.push(['L', x, cy]); cx = x; lastCtrl = null;
          break;
        }
        case 'V': {
          const y = readNum() + oy;
          out.push(['L', cx, y]); cy = y; lastCtrl = null;
          break;
        }
        case 'C': {
          const x1 = readNum() + ox, y1 = readNum() + oy, x2 = readNum() + ox, y2 = readNum() + oy;
          const x = readNum() + ox, y = readNum() + oy;
          out.push(['C', x1, y1, x2, y2, x, y]); cx = x; cy = y; lastCtrl = [x2, y2, 'C'];
          break;
        }
        case 'S': {
          const x2 = readNum() + ox, y2 = readNum() + oy, x = readNum() + ox, y = readNum() + oy;
          const [x1, y1] = lastCtrl && lastCtrl[2] === 'C' ? [2 * cx - lastCtrl[0], 2 * cy - lastCtrl[1]] : [cx, cy];
          out.push(['C', x1, y1, x2, y2, x, y]); cx = x; cy = y; lastCtrl = [x2, y2, 'C'];
          break;
        }
        case 'Q': {
          const x1 = readNum() + ox, y1 = readNum() + oy, x = readNum() + ox, y = readNum() + oy;
          out.push(quadToCubic(cx, cy, x1, y1, x, y)); cx = x; cy = y; lastCtrl = [x1, y1, 'Q'];
          break;
        }
        case 'T': {
          const x = readNum() + ox, y = readNum() + oy;
          const [x1, y1] = lastCtrl && lastCtrl[2] === 'Q' ? [2 * cx - lastCtrl[0], 2 * cy - lastCtrl[1]] : [cx, cy];
          out.push(quadToCubic(cx, cy, x1, y1, x, y)); cx = x; cy = y; lastCtrl = [x1, y1, 'Q'];
          break;
        }
        case 'A': {
          const rx = readNum(), ry = readNum(), rot = readNum();
          const large = readFlag(), sweep = readFlag();
          const x = readNum() + ox, y = readNum() + oy;
          for (const c of arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y)) out.push(c);
          cx = x; cy = y; lastCtrl = null;
          break;
        }
        default:
          throw new SyntaxError(`path: unsupported command ${cmd}`);
      }
      first = false;
    } while (true);
    skipSep();
  }
  return out;
}

/** Exact cubic form of a quadratic Bézier (PDF has no quadratic operator; PDFKit's 'v' is wrong). */
function quadToCubic(x0, y0, qx, qy, x, y) {
  return ['C', x0 + (2 / 3) * (qx - x0), y0 + (2 / 3) * (qy - y0), x + (2 / 3) * (qx - x), y + (2 / 3) * (qy - y), x, y];
}

/**
 * Convert one SVG elliptical arc to cubic Bézier commands (each ≤ 45°).
 * @returns {Array<Array<string|number>>} list of ['C', ...] or a single ['L', x, y]
 */
export function arcToCubics(x1, y1, rx, ry, rotDeg, large, sweep, x2, y2) {
  if (x1 === x2 && y1 === y2) return []; // F.6.2: identical endpoints -> omit
  rx = Math.abs(rx); ry = Math.abs(ry);
  if (rx === 0 || ry === 0) return [['L', x2, y2]]; // F.6.2: zero radius -> straight line
  const phi = (rotDeg % 360) * Math.PI / 180;
  const cosP = Math.cos(phi), sinP = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
  const x1p = cosP * dx + sinP * dy;
  const y1p = -sinP * dx + cosP * dy;
  // F.6.6 radii correction
  const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lambda > 1) { const s = Math.sqrt(lambda); rx *= s; ry *= s; }
  const rx2 = rx * rx, ry2 = ry * ry;
  let num = rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p;
  if (num < 0) num = 0;
  const den = rx2 * y1p * y1p + ry2 * x1p * x1p;
  let coef = den === 0 ? 0 : Math.sqrt(num / den);
  if (large === sweep) coef = -coef;
  const cxp = coef * (rx * y1p / ry);
  const cyp = coef * (-ry * x1p / rx);
  const cx = cosP * cxp - sinP * cyp + (x1 + x2) / 2;
  const cy = sinP * cxp + cosP * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const ux = (x1p - cxp) / rx, uy = (y1p - cyp) / ry;
  const vx = (-x1p - cxp) / rx, vy = (-y1p - cyp) / ry;
  const theta1 = ang(1, 0, ux, uy);
  let dTheta = ang(ux, uy, vx, vy);
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  else if (sweep && dTheta < 0) dTheta += 2 * Math.PI;
  // ≤ 45° per segment: radial error ≤ 4.2e-6 × r (0.004 pt on a 1000 pt ring)
  const segs = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 4) - 1e-9));
  const delta = dTheta / segs;
  const t = (4 / 3) * Math.tan(delta / 4);
  const out = [];
  let th = theta1;
  let px = x1, py = y1;
  for (let k = 0; k < segs; k++) {
    const th2 = th + delta;
    const c1 = Math.cos(th), s1 = Math.sin(th), c2 = Math.cos(th2), s2 = Math.sin(th2);
    // endpoint derivatives on the unit circle, scaled to the ellipse then rotated
    const e = (cxu, syu) => [cosP * rx * cxu - sinP * ry * syu + cx, sinP * rx * cxu + cosP * ry * syu + cy];
    const d = (cxu, syu) => [cosP * rx * cxu - sinP * ry * syu, sinP * rx * cxu + cosP * ry * syu];
    const [ex, ey] = k === segs - 1 ? [x2, y2] : e(c2, s2);
    const [d1x, d1y] = d(-s1, c1);
    const [d2x, d2y] = d(-s2, c2);
    out.push(['C', px + t * d1x, py + t * d1y, ex - t * d2x, ey - t * d2y, ex, ey]);
    px = ex; py = ey;
    th = th2;
  }
  return out;
}

const pathCache = new Map();
const PATH_CACHE_MAX = 20000;

/**
 * parsePath with a small memo (scenes reuse the same strings across redraws).
 * @param {string} d
 */
export function parsePathCached(d) {
  let cmds = pathCache.get(d);
  if (!cmds) {
    cmds = parsePath(d);
    if (pathCache.size >= PATH_CACHE_MAX) pathCache.clear();
    pathCache.set(d, cmds);
  }
  return cmds;
}

/**
 * Replay normalised commands onto any path sink with moveTo/lineTo/bezierCurveTo/
 * closePath (CanvasRenderingContext2D, Path2D, PDFKit document).
 */
export function tracePath(sink, cmds, tx = 0, ty = 0) {
  for (const c of cmds) {
    switch (c[0]) {
      case 'M': sink.moveTo(c[1] + tx, c[2] + ty); break;
      case 'L': sink.lineTo(c[1] + tx, c[2] + ty); break;
      case 'C': sink.bezierCurveTo(c[1] + tx, c[2] + ty, c[3] + tx, c[4] + ty, c[5] + tx, c[6] + ty); break;
      case 'Z': sink.closePath(); break;
    }
  }
}

/**
 * Conservative bounding box of normalised commands (control points included).
 * @returns {{x0:number,y0:number,x1:number,y1:number}|null}
 */
export function pathBounds(cmds) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of cmds) {
    for (let k = 1; k < c.length; k += 2) {
      const x = c[k], y = c[k + 1];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  return x0 === Infinity ? null : { x0, y0, x1, y1 };
}

/** Format a number for path strings: max 3 decimals, never exponent notation. */
export function fmt(v) {
  if (!Number.isFinite(v)) throw new RangeError(`path coordinate is not finite: ${v}`);
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Point on a circle. Angles in degrees, 0 = up (12 o'clock), clockwise. */
export function polar(cx, cy, r, angleDeg) {
  const a = angleDeg * Math.PI / 180;
  return [cx + r * Math.sin(a), cy - r * Math.cos(a)];
}

/**
 * Annulus sector (or pie slice when r0 = 0) as an SVG path string.
 * Angles in degrees, 0 = up, clockwise, a0 < a1. Sweeps ≥ 360° produce a full ring.
 */
export function sectorPath(cx, cy, r0, r1, a0, a1) {
  const sweep = a1 - a0;
  if (sweep >= 360 - 1e-9) {
    const outer = circlePath(cx, cy, r1);
    if (r0 <= 0) return outer;
    // inner circle drawn counter-clockwise so nonzero fill leaves a hole
    return `${outer} M${fmt(cx)} ${fmt(cy - r0)} A${fmt(r0)} ${fmt(r0)} 0 1 0 ${fmt(cx)} ${fmt(cy + r0)} A${fmt(r0)} ${fmt(r0)} 0 1 0 ${fmt(cx)} ${fmt(cy - r0)} Z`;
  }
  const large = sweep > 180 ? 1 : 0;
  const [ox0, oy0] = polar(cx, cy, r1, a0);
  const [ox1, oy1] = polar(cx, cy, r1, a1);
  let d = `M${fmt(ox0)} ${fmt(oy0)} A${fmt(r1)} ${fmt(r1)} 0 ${large} 1 ${fmt(ox1)} ${fmt(oy1)}`;
  if (r0 > 0) {
    const [ix1, iy1] = polar(cx, cy, r0, a1);
    const [ix0, iy0] = polar(cx, cy, r0, a0);
    d += ` L${fmt(ix1)} ${fmt(iy1)} A${fmt(r0)} ${fmt(r0)} 0 ${large} 0 ${fmt(ix0)} ${fmt(iy0)} Z`;
  } else {
    d += ` L${fmt(cx)} ${fmt(cy)} Z`;
  }
  return d;
}

/** Open circular arc (for rules and ornaments). */
export function arcPath(cx, cy, r, a0, a1) {
  const sweep = a1 - a0;
  if (sweep >= 360 - 1e-9) return circlePath(cx, cy, r);
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  return `M${fmt(x0)} ${fmt(y0)} A${fmt(r)} ${fmt(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${fmt(x1)} ${fmt(y1)}`;
}

/** Full circle as two half arcs. */
export function circlePath(cx, cy, r) {
  return `M${fmt(cx)} ${fmt(cy - r)} A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx)} ${fmt(cy + r)} A${fmt(r)} ${fmt(r)} 0 1 1 ${fmt(cx)} ${fmt(cy - r)} Z`;
}

/** Axis-aligned rectangle, optionally with rounded corners. */
export function rectPath(x, y, w, h, radius = 0) {
  if (!radius) return `M${fmt(x)} ${fmt(y)} H${fmt(x + w)} V${fmt(y + h)} H${fmt(x)} Z`;
  const r = Math.min(radius, w / 2, h / 2);
  return `M${fmt(x + r)} ${fmt(y)} H${fmt(x + w - r)} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w)} ${fmt(y + r)} ` +
    `V${fmt(y + h - r)} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + w - r)} ${fmt(y + h)} H${fmt(x + r)} ` +
    `A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x)} ${fmt(y + h - r)} V${fmt(y + r)} A${fmt(r)} ${fmt(r)} 0 0 1 ${fmt(x + r)} ${fmt(y)} Z`;
}
