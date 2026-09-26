// Canvas renderer for the Scene IR (preview, JPEG and share images).
//
// Geometry and text positions are computed exactly as in render-pdf.js:
//   * paths are parsed once by path.js (arcs -> cubics) and replayed into Path2D;
//   * text is anchored with widths from fonts.js (fontkit), never measureText;
//   * tracked text and arc glyphs are placed glyph by glyph from cumulative
//     (kerned) prefix widths;
//   * baseline 'middle' centres capital letters (text.js baselineOffset).
// Fonts are the FontFace families registered by fonts.js from the same patched
// bytes that go into the PDF, so HarfBuzz and fontkit shape the same glyphs.
//
// Group opacity multiplies into each child (no isolated transparency group), the
// same model the PDF renderer uses, so overlapping children look identical.

import { parsePathCached, tracePath, sectorPath, rectPath } from './path.js';
import { fonts as defaultFonts } from './fonts.js';
import { baselineOffset, glyphOffsets } from './text.js';

const DEG = Math.PI / 180;
const WS = /^\s+$/u;

const path2dCache = new Map();
function path2d(d) {
  let p = path2dCache.get(d);
  if (!p) {
    p = new Path2D();
    tracePath(p, parsePathCached(d));
    if (path2dCache.size > 20000) path2dCache.clear();
    path2dCache.set(d, p);
  }
  return p;
}

const imageCache = new Map(); // src -> { img, ok, promise }

/**
 * Load every ImageItem's src so drawScene can draw it synchronously.
 * @param {object} scene
 * @returns {Promise<string[]>} srcs that failed to load
 */
export async function preloadImages(scene) {
  const srcs = new Set();
  const walk = items => { for (const it of items) { if (it.t === 'image') srcs.add(it.src); else if (it.t === 'group') walk(it.items || []); } };
  walk(scene.items || []);
  const failed = [];
  await Promise.all([...srcs].map(src => {
    let e = imageCache.get(src);
    if (!e) {
      const img = new Image();
      img.decoding = 'async';
      e = { img, ok: false };
      e.promise = new Promise(resolve => {
        img.onload = () => { e.ok = true; resolve(); };
        img.onerror = () => resolve();
      });
      img.src = src;
      imageCache.set(src, e);
    }
    return e.promise.then(() => { if (!e.ok) failed.push(src); });
  }));
  return failed;
}

/**
 * Draw a Scene.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} scene
 * @param {{ scale?: number, dpr?: number, offsetX?: number, offsetY?: number,
 *           highlightPersonIds?: Iterable<string>, highlightColor?: string,
 *           background?: boolean, fonts?: object }} [opts]
 *   scale: CSS px per point; dpr: device pixels per CSS px; offsetX/Y: pan in CSS px.
 * @returns {{ items: number, glyphs: number, missingImages: string[], ms: number }}
 */
export function drawScene(ctx, scene, opts = {}) {
  const t0 = (globalThis.performance || Date).now();
  const scale = opts.scale ?? 1;
  const dpr = opts.dpr ?? 1;
  const fonts = opts.fonts || defaultFonts;
  const k = scale * dpr;
  const ox = (opts.offsetX || 0) * dpr, oy = (opts.offsetY || 0) * dpr;
  const env = { ctx, fonts, k, ox, oy, items: 0, glyphs: 0, missingImages: [] };

  ctx.save();
  ctx.setTransform(k, 0, 0, k, ox, oy);
  if ('fontKerning' in ctx) ctx.fontKerning = 'normal';
  if ('textRendering' in ctx) ctx.textRendering = 'geometricPrecision';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.miterLimit = 10;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.imageSmoothingQuality = 'high';
  if (opts.background !== false && scene.bg) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = scene.bg;
    ctx.fillRect(0, 0, scene.wPt, scene.hPt);
  }
  drawItems(env, scene.items || [], 1);

  if (opts.highlightPersonIds) {
    const ids = new Set(opts.highlightPersonIds);
    if (ids.size) {
      ctx.setTransform(k, 0, 0, k, ox, oy);
      const color = opts.highlightColor || '#c8962e';
      for (const h of scene.hits || []) {
        if (!ids.has(h.personId)) continue;
        const p = path2d(hitPath(h));
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = color;
        ctx.fill(p);
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5 / scale;
        ctx.lineJoin = 'round';
        ctx.stroke(p);
      }
    }
  }
  ctx.restore();
  return { items: env.items, glyphs: env.glyphs, missingImages: env.missingImages, ms: (globalThis.performance || Date).now() - t0 };
}

function hitPath(h) {
  return h.shape === 'sector' ? sectorPath(h.cx, h.cy, h.r0, h.r1, h.a0, h.a1) : rectPath(h.x, h.y, h.w, h.h);
}

function setT(env, x, y, rotDeg) {
  const { ctx, k, ox, oy } = env;
  if (!rotDeg) { ctx.setTransform(k, 0, 0, k, k * x + ox, k * y + oy); return; }
  const c = Math.cos(rotDeg * DEG), s = Math.sin(rotDeg * DEG);
  ctx.setTransform(k * c, k * s, -k * s, k * c, k * x + ox, k * y + oy);
}

function fontCss(env, key, size) {
  return `${size}px "${env.fonts.fontFaceName(key)}"`;
}

function drawItems(env, items, alpha) {
  for (const it of items) {
    env.items++;
    switch (it.t) {
      case 'path': drawPath(env, it, alpha); break;
      case 'text': drawText(env, it, alpha); break;
      case 'glyphs': drawGlyphs(env, it, alpha); break;
      case 'image': drawImage(env, it, alpha); break;
      case 'group': drawGroup(env, it, alpha); break;
      default: throw new Error(`unknown scene item type "${it.t}"`);
    }
  }
}

const painted = c => c && c !== 'none' && c !== 'transparent';

function drawPath(env, it, alpha) {
  const { ctx } = env;
  const a = alpha * (it.opacity ?? 1);
  if (a <= 0) return;
  const p = path2d(it.d);
  setT(env, 0, 0, 0);
  ctx.globalAlpha = a;
  if (painted(it.fill)) {
    ctx.fillStyle = it.fill;
    ctx.fill(p);
  }
  const sw = it.sw ?? 1;
  if (painted(it.stroke) && sw > 0) {
    ctx.strokeStyle = it.stroke;
    ctx.lineWidth = sw;
    ctx.lineCap = it.cap || 'butt';
    ctx.lineJoin = it.join || 'miter';
    ctx.stroke(p);
  }
}

function drawText(env, it, alpha) {
  const { ctx, fonts } = env;
  const a = alpha * (it.opacity ?? 1);
  if (a <= 0 || !it.str) return;
  const size = it.size;
  const tracking = it.tracking || 0;
  const m = fonts.metrics(it.font);
  const dy = baselineOffset(m, size, it.baseline);
  let offs = null, width;
  if (tracking) {
    offs = glyphOffsets(it.str, it.font, size, tracking, { fonts });
    width = offs.width;
  } else width = fonts.measure(it.font, size, it.str);
  const x0 = it.anchor === 'middle' ? -width / 2 : it.anchor === 'end' ? -width : 0;
  ctx.font = fontCss(env, it.font, size);
  ctx.fillStyle = it.color;
  ctx.globalAlpha = a;
  setT(env, it.x, it.y, it.rot || 0);
  if (!offs) {
    ctx.fillText(it.str, x0, dy);
    env.glyphs += it.str.length;
  } else {
    for (let i = 0; i < offs.chars.length; i++) {
      if (WS.test(offs.chars[i])) continue;
      ctx.fillText(offs.chars[i], x0 + offs.xs[i], dy);
      env.glyphs++;
    }
  }
}

function drawGlyphs(env, it, alpha) {
  const { ctx } = env;
  const a = alpha * (it.opacity ?? 1);
  if (a <= 0) return;
  env.fonts.metrics(it.font); // throws if the font is not loaded (canvas would silently substitute)
  ctx.font = fontCss(env, it.font, it.size);
  ctx.fillStyle = it.color;
  ctx.globalAlpha = a;
  for (const g of it.g) {
    if (!g.ch || WS.test(g.ch)) continue;
    setT(env, g.x, g.y, g.rot || 0);
    ctx.fillText(g.ch, 0, 0);
    env.glyphs++;
  }
}

function drawImage(env, it, alpha) {
  const { ctx } = env;
  const a = alpha * (it.opacity ?? 1);
  const e = imageCache.get(it.src);
  if (!e || !e.ok) { env.missingImages.push(it.src); return; }
  setT(env, 0, 0, 0);
  ctx.globalAlpha = a;
  ctx.drawImage(e.img, it.x, it.y, it.w, it.h);
}

function drawGroup(env, it, alpha) {
  const { ctx } = env;
  const a = alpha * (it.opacity ?? 1);
  if (a <= 0) return;
  ctx.save();
  if (it.clip) {
    setT(env, 0, 0, 0);
    ctx.clip(path2d(it.clip));
  }
  drawItems(env, it.items || [], a);
  ctx.restore();
}

/**
 * Topmost hit region under a point (points, scene coordinates).
 * @param {object} scene
 * @param {number} xPt
 * @param {number} yPt
 * @returns {object|null} Hit
 */
export function hitTest(scene, xPt, yPt) {
  const hits = scene.hits || [];
  for (let i = hits.length - 1; i >= 0; i--) {
    const h = hits[i];
    if (h.shape === 'rect') {
      if (xPt >= h.x && xPt <= h.x + h.w && yPt >= h.y && yPt <= h.y + h.h) return h;
    } else if (h.shape === 'sector') {
      const dx = xPt - h.cx, dy = yPt - h.cy;
      const r = Math.hypot(dx, dy);
      if (r < h.r0 || r > h.r1) continue;
      if (h.a1 - h.a0 >= 360) return h;
      let ang = Math.atan2(dx, -dy) / DEG; // 0 = up, clockwise
      ang = h.a0 + ((((ang - h.a0) % 360) + 360) % 360);
      if (ang <= h.a1) return h;
    }
  }
  return null;
}

/**
 * Scale (CSS px per pt) that fits the scene into a box with padding.
 * @returns {{ scale: number, offsetX: number, offsetY: number }}
 */
export function fitToBox(scene, boxW, boxH, pad = 0) {
  const scale = Math.min((boxW - 2 * pad) / scene.wPt, (boxH - 2 * pad) / scene.hPt);
  return { scale, offsetX: (boxW - scene.wPt * scale) / 2, offsetY: (boxH - scene.hPt * scale) / 2 };
}
