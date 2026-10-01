#!/usr/bin/env node
// Renders the sample chart images used by the chart, occasion, print and guide pages.
//
//   node web/test/site/render-charts.mjs [name ...]     (default: every image)
//
// Every image is drawn by the production chart engine (web/src/app/charts/) from one of the
// two sample files: web/src/samples/victoria.ged (Wikidata, CC0) or
// web/src/samples/almeida-novak.ged (the fictional sample family). Nothing is hand-drawn,
// retouched or invented. Output: web/src/assets/img/charts/<name>.jpg, plus
// web/test/site/out/charts-manifest.json with each image's pixel size and the chart's
// real facts (size in inches, generations, people placed) for the page copy.
//
// Uses port 4731 (this workstream's range is 4700-4799) and the QA gate's static server.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../qa/serve.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const IMG = join(HERE, '../../src/assets/img/charts');
const OUT = join(HERE, 'out');
mkdirSync(IMG, { recursive: true });
mkdirSync(OUT, { recursive: true });

const AN = 'almeida-novak', VIC = 'victoria';
// Almeida–Novak: I1 Margaret Rose Almeida-Novak; I2 Thomas Frank Novak & I3 Rosa Maria Almeida (m. 1955).
// Victoria: I1 Victoria; I2 Prince Edward, Duke of Kent & I3 Princess Victoria of Saxe-Coburg-Saalfeld.
export const JOBS = {
  // /charts/fan-chart/
  'fan-letter': { tree: AN, chart: 'fan', rootId: 'I1', size: 'letter', generations: 5, style: 'ivory' },
  'fan-18x24': { tree: VIC, chart: 'fan', rootId: 'I1', size: '18x24', generations: 7, style: 'ivory' },
  'fan-24x36': { tree: VIC, chart: 'fan', rootId: 'I1', size: '24x36', generations: 8, style: 'midnight' },
  'fan-detail': { tree: VIC, chart: 'fan', rootId: 'I1', size: '24x36', generations: 8, style: 'ivory', crop: { x: 0.27, y: 0.12, w: 0.30, h: 0.40 } },
  // /charts/bowtie-chart/
  'bowtie-letter': { tree: AN, chart: 'bowtie', coupleIds: ['I2', 'I3'], size: 'letter', generations: 4, style: 'ivory' },
  'bowtie-11x14': { tree: AN, chart: 'bowtie', coupleIds: ['I2', 'I3'], size: '11x14', generations: 5, style: 'botanical' },
  'bowtie-24x36': { tree: VIC, chart: 'bowtie', coupleIds: ['I2', 'I3'], size: '24x36', generations: 6, style: 'midnight' },
  // /charts/pedigree-chart/
  'pedigree-letter': { tree: AN, chart: 'pedigree', rootId: 'I1', size: 'letter', generations: 5, style: 'letterpress' },
  'pedigree-18x24': { tree: VIC, chart: 'pedigree', rootId: 'I1', size: '18x24', generations: 6, style: 'ivory' },
  'pedigree-24x36': { tree: AN, chart: 'pedigree', rootId: 'I1', size: '24x36', generations: 6, style: 'nordic' },
  // /charts/atlas-birthplace-map/
  // Cartographer (the style made for Atlas) is left out until its neatline border stops overrunning
  // the frame on odd segment counts (web/src/app/charts/ornaments.js frame('neatline')).
  'atlas-letter': { tree: AN, chart: 'fan', rootId: 'I1', size: 'letter', generations: 5, style: 'nordic', colorMode: 'atlas' },
  'atlas-18x24': { tree: AN, chart: 'fan', rootId: 'I1', size: '18x24', generations: 6, style: 'ivory', colorMode: 'atlas' },
  'atlas-24x36': { tree: VIC, chart: 'fan', rootId: 'I1', size: '24x36', generations: 8, style: 'botanical', colorMode: 'atlas' },
  // /occasions/
  'occasion-wedding': { tree: AN, chart: 'bowtie', coupleIds: ['I2', 'I3'], size: '16x20', generations: 5, style: 'letterpress' },
  'occasion-anniversary': { tree: AN, chart: 'bowtie', coupleIds: ['I2', 'I3'], size: '18x24', generations: 5, style: 'midnight' },
  'occasion-reunion': { tree: AN, chart: 'fan', rootId: 'I1', size: '20x30', generations: 6, style: 'botanical', colorMode: 'lines' },
  'occasion-christmas': { tree: AN, chart: 'fan', rootId: 'I1', size: '11x14', generations: 4, style: 'botanical', dedication: 'For Mom, Christmas 2026' },
  // /guides/thanksgiving-family-tree/ (a keepsake chart: 4 generations, large type)
  'keepsake-letter': { tree: AN, chart: 'fan', rootId: 'I1', size: 'letter', generations: 4, style: 'ivory' },
};

const want = process.argv.slice(2);
const names = want.length ? want : Object.keys(JOBS);
const manifestFile = join(OUT, 'charts-manifest.json');
const manifest = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, 'utf8')) : {};

const srv = await startServer({ port: 4731 });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${srv.origin}/test/site/render-charts.html`);
  await page.waitForFunction(() => window.__render, null, { timeout: 30000 });
  const info = await page.evaluate(() => window.__render.init());
  console.log('engines:', info.engines.join(', '));
  for (const name of names) {
    const job = { width: 1400, ...JOBS[name] };
    if (!JOBS[name]) { console.error('unknown image', name); continue; }
    const t0 = Date.now();
    const res = await page.evaluate(j => window.__render.render(j), job);
    const b64 = res.dataUrl.split(',')[1];
    const file = join(IMG, `${name}.jpg`);
    writeFileSync(file, Buffer.from(b64, 'base64'));
    manifest[name] = { file: `/assets/img/charts/${name}.jpg`, width: res.width, height: res.height, bytes: Math.round(b64.length * 0.75), job: JOBS[name], meta: res.meta };
    console.log(`${name}: ${res.width}x${res.height}, ${Math.round(b64.length * 0.75 / 1024)} KB, ${res.meta.chart} ${res.meta.generations} gen ${res.meta.size} ${res.meta.orientation} ${res.meta.wIn}x${res.meta.hIn}in, placed ${res.meta.counts.placed}/${res.meta.counts.slots}, ${Date.now() - t0} ms`);
    if (res.meta.warnings?.length) console.log('   warnings:', res.meta.warnings.join(' | '));
  }
  if (errors.length) console.error('page errors:\n' + errors.join('\n'));
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
} finally {
  await browser.close();
  await srv.close();
}
