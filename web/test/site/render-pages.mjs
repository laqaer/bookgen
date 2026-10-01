#!/usr/bin/env node
// Renders the sample chart images used by the conversion and trust pages
// (/print-ancestry-tree/, /gift/).
//
//   node web/test/site/render-pages.mjs [name ...]     (default: every image)
//
// Every image is drawn by the production chart engine (web/src/app/charts/) from the
// fictional sample family in web/src/samples/almeida-novak.ged, through the same browser
// module as web/test/site/render-charts.mjs (render-charts.html). Nothing is hand-drawn,
// retouched or invented. Output: web/src/assets/img/pages/<name>.jpg, plus
// web/test/site/out/pages-manifest.json with each chart's real facts for the page copy.
//
// Uses port 4711 (this workstream's range is 4710-4719) and the QA gate's static server.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../qa/serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMG = join(HERE, '../../src/assets/img/pages');
const OUT = join(HERE, 'out');
mkdirSync(IMG, { recursive: true });
mkdirSync(OUT, { recursive: true });

// Almeida–Novak (fictional): I1 Margaret Rose Almeida-Novak.
export const JOBS = {
  // /print-ancestry-tree/: the free Letter PDF and a poster, both from one file
  'ancestry-letter-ivory': { tree: 'almeida-novak', chart: 'fan', rootId: 'I1', size: 'letter', generations: 5, style: 'ivory', width: 1400 },
  'ancestry-18x24-botanical': { tree: 'almeida-novak', chart: 'fan', rootId: 'I1', size: '18x24', generations: 6, style: 'botanical', colorMode: 'lines', width: 1400 },
  // /gift/: a keepsake chart (4 generations, large type) with a dedication line
  'gift-keepsake-11x14': { tree: 'almeida-novak', chart: 'fan', rootId: 'I1', size: '11x14', generations: 4, style: 'ivory', dedication: 'For Mom, Christmas 2026', width: 1400 },
};

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(JOBS);
const manifest = {};
const srv = await startServer({ port: 4711 });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${srv.origin}/test/site/render-charts.html`);
  await page.waitForFunction(() => window.__render, null, { timeout: 30000 });
  await page.evaluate(() => window.__render.init());
  for (const name of names) {
    if (!JOBS[name]) { console.error('unknown image', name); continue; }
    const res = await page.evaluate(j => window.__render.render(j), JOBS[name]);
    const b64 = res.dataUrl.split(',')[1];
    writeFileSync(join(IMG, `${name}.jpg`), Buffer.from(b64, 'base64'));
    manifest[name] = { file: `/assets/img/pages/${name}.jpg`, width: res.width, height: res.height, job: JOBS[name], meta: res.meta };
    console.log(`${name}: ${res.width}x${res.height}, ${Math.round(b64.length * 0.75 / 1024)} KB, ${res.meta.chart} ${res.meta.generations} gen ${res.meta.size} ${res.meta.orientation}, placed ${res.meta.counts.placed}/${res.meta.counts.slots}; "${res.meta.title}" / "${res.meta.subtitle}"`);
    if (res.meta.warnings?.length) console.log('   warnings:', res.meta.warnings.join(' | '));
  }
  if (errors.length) console.error('page errors:\n' + errors.join('\n'));
  writeFileSync(join(OUT, 'pages-manifest.json'), JSON.stringify(manifest, null, 2));
} finally {
  await browser.close();
  await srv.close();
}
