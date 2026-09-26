// Raster exports drawn by the canvas renderer: photo-lab JPEGs and the share image.
//
// JPEG (BRIEF §4.3): sRGB, quality 0.92. Desktop default 200 dpi up to 18×24
// (long edge ≤ 24 in), 150 dpi above. iOS/iPadOS canvases are capped at 16.7 MP,
// so a 24×36 comes out at about 139 dpi there; the result reports the real dpi and
// whether it was capped so the UI can say so. The JFIF header carries the dpi.
// Share image: 1080×1350 PNG with a small "Made with Gildroot" mark (optional for paid).

import { drawScene, preloadImages } from './render-canvas.js';
import { fonts as defaultFonts } from './fonts.js';
import { sceneFontKeys } from './render-pdf.js';

export const IOS_MAX_MEGAPIXELS = 16.7;
export const JPEG_QUALITY = 0.92;
export const SHARE_W = 1080;
export const SHARE_H = 1350;
export const SHARE_MARK = 'Made with Gildroot · gildroot.com';

/** iPhone, iPod, iPad (including iPadOS reporting as a Mac with touch). */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/** Default photo-lab resolution for a poster: 200 dpi up to 18×24, 150 dpi above. */
export function defaultDpi(scene) {
  const longIn = Math.max(scene.wPt, scene.hPt) / 72;
  return longIn <= 24.01 ? 200 : 150;
}

/**
 * Pixel size for a raster export, honouring the megapixel cap.
 * @param {object} scene
 * @param {{ dpi?: number, maxMegapixels?: number }} [opts]
 * @returns {{ dpi: number, width: number, height: number, megapixels: number, capped: boolean, requestedDpi: number }}
 */
export function planRaster(scene, opts = {}) {
  const requestedDpi = opts.dpi || defaultDpi(scene);
  const cap = opts.maxMegapixels ?? (isIOS() ? IOS_MAX_MEGAPIXELS : Infinity);
  let dpi = requestedDpi;
  const px = d => [Math.round(scene.wPt / 72 * d), Math.round(scene.hPt / 72 * d)];
  let [width, height] = px(dpi);
  let capped = false;
  if (width * height > cap * 1e6) {
    dpi = Math.floor(Math.sqrt((cap * 1e6) / ((scene.wPt / 72) * (scene.hPt / 72))));
    [width, height] = px(dpi);
    while (width * height > cap * 1e6) { dpi -= 1; [width, height] = px(dpi); }
    capped = true;
  }
  return { dpi, width, height, megapixels: Math.round((width * height) / 1e4) / 100, capped, requestedDpi };
}

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  throw new Error('no canvas available');
}

function canvasToBlob(canvas, type, quality) {
  if (canvas.convertToBlob) return canvas.convertToBlob({ type, quality });
  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('canvas export failed (too large for this device?)'))), type, quality));
}

/**
 * Write the pixel density into a JPEG's JFIF APP0 segment (inserting one if absent).
 * @param {Uint8Array} bytes
 * @param {number} dpi
 * @returns {Uint8Array}
 */
export function setJpegDpi(bytes, dpi) {
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  const isJfif = bytes[2] === 0xff && bytes[3] === 0xe0 && bytes[6] === 0x4a && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46 && bytes[10] === 0;
  if (isJfif) {
    const out = bytes.slice();
    out[13] = 1; // dots per inch
    out[14] = d >> 8; out[15] = d & 255;
    out[16] = d >> 8; out[17] = d & 255;
    return out;
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;
  const app0 = new Uint8Array([0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, d >> 8, d & 255, d >> 8, d & 255, 0, 0]);
  const out = new Uint8Array(bytes.length + app0.length);
  out.set(bytes.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(bytes.subarray(2), 2 + app0.length);
  return out;
}

async function prepare(scene, fonts) {
  await fonts.loadFonts(sceneFontKeys(scene));
  return preloadImages(scene);
}

/**
 * Render a Scene to a JPEG for photo counters.
 * @param {object} scene
 * @param {{ dpi?: number, maxMegapixels?: number, quality?: number, fonts?: object }} [opts]
 * @returns {Promise<{ blob: Blob, dpi: number, width: number, height: number, megapixels: number, capped: boolean, requestedDpi: number }>}
 */
export async function sceneToJpeg(scene, opts = {}) {
  const fonts = opts.fonts || defaultFonts;
  await prepare(scene, fonts);
  const plan = planRaster(scene, opts);
  const canvas = makeCanvas(plan.width, plan.height);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, plan.width, plan.height);
  drawScene(ctx, scene, { scale: plan.width / scene.wPt, dpr: 1, fonts });
  const raw = await canvasToBlob(canvas, 'image/jpeg', opts.quality ?? JPEG_QUALITY);
  canvas.width = canvas.height = 0; // release the bitmap now (large on posters)
  const bytes = setJpegDpi(new Uint8Array(await raw.arrayBuffer()), plan.dpi);
  return { blob: new Blob([bytes], { type: 'image/jpeg' }), ...plan };
}

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const v = parseInt(m[1], 16);
  const ch = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(v >> 16) + 0.7152 * ch((v >> 8) & 255) + 0.0722 * ch(v & 255);
}

/**
 * 1080×1350 PNG for sharing: the chart fitted on its own background, with a
 * small mark along the bottom edge unless mark is false.
 * @param {object} scene
 * @param {{ mark?: boolean, fonts?: object, markFont?: string }} [opts]
 * @returns {Promise<Blob>}
 */
export async function shareImage(scene, opts = {}) {
  const fonts = opts.fonts || defaultFonts;
  const mark = opts.mark !== false;
  const markFont = opts.markFont || 'ebg-400';
  await fonts.loadFonts([...sceneFontKeys(scene), markFont]);
  await preloadImages(scene);
  const canvas = makeCanvas(SHARE_W, SHARE_H);
  const ctx = canvas.getContext('2d', { alpha: false });
  const bg = scene.bg || '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  const pad = 40;
  const markH = mark ? 44 : 0;
  const scale = Math.min((SHARE_W - 2 * pad) / scene.wPt, (SHARE_H - 2 * pad - markH) / scene.hPt);
  const offsetX = (SHARE_W - scene.wPt * scale) / 2;
  const offsetY = (SHARE_H - markH - scene.hPt * scale) / 2;
  drawScene(ctx, scene, { scale, dpr: 1, offsetX, offsetY, fonts });
  if (mark) {
    const dark = luminance(bg) < 0.4;
    drawScene(ctx, {
      wPt: SHARE_W, hPt: SHARE_H, bg: null, hits: [],
      items: [{ t: 'text', x: SHARE_W / 2, y: SHARE_H - 26, str: SHARE_MARK, font: markFont, size: 22, color: dark ? '#f2ead8' : '#3b3326', anchor: 'middle', opacity: 0.8, tracking: 0.5 }],
    }, { scale: 1, dpr: 1, fonts, background: false });
  }
  const blob = await canvasToBlob(canvas, 'image/png');
  canvas.width = canvas.height = 0;
  return blob;
}
