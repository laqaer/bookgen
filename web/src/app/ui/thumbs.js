// Style swatches drawn from the real chart: each of the six styles laid out with the
// visitor's own tree (at Letter size, up to 5 generations, so it stays quick) and
// painted into a small canvas. Work is spread over idle time and cancelled when the
// options change again.

import { layout } from '../charts/layout.js';
import { drawScene, fitToBox, preloadImages } from '../charts/render-canvas.js';
import { STYLE_KEYS } from '../charts/styles.js';
import { fonts } from '../charts/fonts.js';

let token = 0;

const idle = () => new Promise(r => (typeof requestIdleCallback === 'function' ? requestIdleCallback(() => r(), { timeout: 400 }) : setTimeout(r, 30)));

/**
 * Render thumbnails for every style.
 * @param {object} baseOpts layout options (style is replaced per thumbnail)
 * @param {(style: string) => HTMLCanvasElement|null} canvasFor
 * @returns {Promise<void>}
 */
export async function renderStyleThumbs(baseOpts, canvasFor) {
  const my = ++token;
  for (const style of STYLE_KEYS) {
    await idle();
    if (my !== token) return;
    const cv = canvasFor(style);
    if (!cv) continue;
    let scene;
    try {
      scene = layout({
        ...baseOpts,
        style,
        size: 'letter',
        generations: Math.min(baseOpts.generations || 5, 5),
        colophon: false,
        measure: fonts.measure, metrics: fonts.metrics, hasGlyphs: fonts.hasGlyphs,
      });
    } catch {
      continue;
    }
    await preloadImages(scene);
    if (my !== token) return;
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(40, Math.round(r.width || 120)), h = Math.max(30, Math.round(r.height || 90));
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    const ctx = cv.getContext('2d');
    // the swatch is the paper itself: fill with the ground, then the chart edge to edge
    const f = fitToBox(scene, w, h, 0);
    const k = Math.max(w / scene.wPt, h / scene.hPt) > f.scale * 1.15 ? f.scale * 1.08 : f.scale;
    ctx.fillStyle = scene.bg;
    ctx.fillRect(0, 0, cv.width, cv.height);
    try {
      drawScene(ctx, scene, { scale: k, dpr, offsetX: (w - scene.wPt * k) / 2, offsetY: (h - scene.hPt * k) / 2 });
    } catch { /* a missing font: leave the ground */ }
  }
}

/** Stop any thumbnail work in progress. */
export function cancelThumbs() {
  token++;
}
