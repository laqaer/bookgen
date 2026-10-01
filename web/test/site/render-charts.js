// Browser side of web/test/site/render-charts.mjs: draws the sample images for the chart,
// occasion and guide pages with the production chart engine (the same modules the studio
// uses), from the two sample files in web/src/samples/. Nothing here is hand-drawn.

import { loadFonts, fonts, FONT_KEYS, ensurePdfKit } from '/app/charts/fonts.js';
import { setTextBackend } from '/app/charts/text.js';
import { drawScene, preloadImages } from '/app/charts/render-canvas.js';
import { layout, loadChartEngines } from '/app/charts/layout.js';
import { handleParse } from '/app/engine/worker.js';

const trees = new Map();
const status = s => { document.getElementById('status').textContent = s; };

async function init() {
  await loadFonts(FONT_KEYS);
  await ensurePdfKit();
  setTextBackend(fonts);
  const engines = await loadChartEngines();
  for (const name of ['victoria', 'almeida-novak']) {
    const res = await fetch(`/samples/${name}.ged`);
    const { tree } = handleParse({ buffer: await res.arrayBuffer(), name: `${name}.ged` });
    trees.set(name, tree);
  }
  status('Ready');
  return { engines };
}

/**
 * Lay out and draw one sample.
 * job: { tree, chart, rootId?, coupleIds?, size, style, colorMode, generations, sweep?, orientation?,
 *        dedication?, width (px of the longer output edge), crop?: { x, y, w, h } fractions, type: 'jpeg'|'png' }
 */
async function render(job) {
  const tree = trees.get(job.tree);
  const opts = {
    tree, chart: job.chart, rootId: job.rootId, coupleIds: job.coupleIds,
    generations: job.generations, size: job.size, orientation: job.orientation || 'auto',
    style: job.style || 'ivory', colorMode: job.colorMode || 'tones', privacy: 'hide-dates',
    title: '', subtitle: '', dedication: job.dedication || '',
    showPlaces: job.showPlaces !== false, trimEmpty: false, bleed: false, colophon: false,
    overrides: {}, placeOverrides: {},
    measure: fonts.measure, metrics: fonts.metrics, hasGlyphs: fonts.hasGlyphs,
  };
  if (job.sweep) opts.sweep = job.sweep;
  if (job.chart !== 'bowtie') delete opts.coupleIds;
  const scene = layout(opts);
  await preloadImages(scene);
  const crop = job.crop || { x: 0, y: 0, w: 1, h: 1 };
  const srcW = scene.wPt * crop.w, srcH = scene.hPt * crop.h;
  const scale = job.width / Math.max(srcW, srcH);
  const c = document.getElementById('c');
  c.width = Math.round(srcW * scale);
  c.height = Math.round(srcH * scale);
  const ctx = c.getContext('2d');
  if (job.crop) {
    // drawScene sets its own transform, so draw the whole page off-screen and copy the crop
    const full = document.createElement('canvas');
    full.width = Math.round(scene.wPt * scale);
    full.height = Math.round(scene.hPt * scale);
    drawScene(full.getContext('2d'), scene, { scale, dpr: 1 });
    ctx.drawImage(full, Math.round(crop.x * full.width), Math.round(crop.y * full.height), c.width, c.height, 0, 0, c.width, c.height);
  } else {
    drawScene(ctx, scene, { scale, dpr: 1 });
  }
  const type = job.type === 'png' ? 'image/png' : 'image/jpeg';
  const dataUrl = c.toDataURL(type, job.quality || 0.84);
  const m = scene.meta;
  return {
    dataUrl, width: c.width, height: c.height,
    meta: {
      chart: m.chart, style: m.style, colorMode: m.colorMode, generations: m.generations, size: m.size,
      orientation: m.orientation, sweep: m.sweep, title: m.title, subtitle: m.subtitle, counts: m.counts,
      wIn: +(scene.wPt / 72).toFixed(2), hIn: +(scene.hPt / 72).toFixed(2),
      legend: m.legend || null, atlas: m.atlas ? { coverage: m.atlas.coverage, summary: m.atlas.summary } : null,
      collapse: m.collapse ? m.collapse.length : 0, warnings: m.warnings,
    },
  };
}

window.__render = { init, render };
