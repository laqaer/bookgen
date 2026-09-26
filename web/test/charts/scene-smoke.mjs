#!/usr/bin/env node
// Chart foundation smoke test (Playwright + PyMuPDF).
//
//   node web/test/charts/scene-smoke.mjs [--out DIR] [--port 4231]
//
// 1. Serves web/ on a local port (4200–4299) and opens test/charts/harness.html in
//    headless Chromium. The harness renders a synthetic Scene with every item type
//    (arc glyph text with diacritics and Greek, radial text, tracked small caps,
//    clipped translucent group, image, hits) to canvas, PDF, bleed PDF, tiles,
//    JPEG and the share image, and runs in-page checks.
// 2. Writes the outputs to DIR (default: $TMPDIR/gildroot-chart-smoke) and runs
//    tools/qa/pdfcheck.py: page size, embedded fonts, no Type 3, every name
//    extractable, no .notdef, min text size, raster diff against the canvas PNG.
// 3. Cross-checks Node: fonts-node.mjs must measure exactly like the browser, and
//    the same Scene rendered with npm pdfkit must pass pdfcheck too.
// Exit code 0 when everything passes.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '../..');
const REPO = resolve(WEB, '..');
const PDFCHECK = join(REPO, 'tools/qa/pdfcheck.py');

const arg = (name, dflt) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : dflt; };
const OUT = resolve(arg('--out', join(tmpdir(), 'gildroot-chart-smoke')));

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg', '.css': 'text/css', '.ged': 'text/plain; charset=utf-8' };

function serve(root, port) {
  return new Promise((res, rej) => {
    const srv = createServer(async (req, reply) => {
      try {
        const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
        const f = resolve(root, '.' + p);
        if (!f.startsWith(root)) { reply.writeHead(403); return reply.end(); }
        const st = await stat(f).catch(() => null);
        if (!st || !st.isFile()) { reply.writeHead(404); return reply.end('not found'); }
        reply.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
        reply.end(await readFile(f));
      } catch (e) { reply.writeHead(500); reply.end(String(e)); }
    });
    srv.once('error', rej);
    srv.listen(port, '127.0.0.1', () => res(srv));
  });
}

async function listen() {
  const want = Number(arg('--port', 0));
  const ports = want ? [want] : Array.from({ length: 100 }, (_, i) => 4200 + ((i * 37 + process.pid) % 100));
  for (const p of ports) {
    try { return { srv: await serve(WEB, p), port: p }; } catch { /* busy */ }
  }
  throw new Error('no free port in 4200-4299');
}

function pdfcheck(file, extra) {
  let raw;
  try {
    raw = execFileSync('python3', [PDFCHECK, file, ...extra], { encoding: 'utf8' });
  } catch (e) {
    raw = e.stdout; // exit 1 still prints the report
  }
  return JSON.parse(raw);
}

const results = [];
const record = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); };

async function main() {
  await mkdir(OUT, { recursive: true });
  const { srv, port } = await listen();
  const browser = await chromium.launch();
  const page = await browser.newPage({ acceptDownloads: true, viewport: { width: 1000, height: 1300 } });
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => consoleErrors.push(String(e)));
  page.on('requestfailed', r => consoleErrors.push(`request failed: ${r.url()}`));
  const url = `http://127.0.0.1:${port}/test/charts/harness.html`;
  await page.goto(url);
  await page.waitForFunction(() => window.__smoke && window.__smoke.done, null, { timeout: 180000 });
  const out = await page.evaluate(() => window.__smoke);

  for (const [name, c] of Object.entries(out.checks || {})) record(`browser ${name}`, c.ok, c.ok ? '' : JSON.stringify(c.detail));
  for (const e of out.errors.filter(e => e.startsWith('exception'))) record('browser exception', false, e);

  // download through <a download>
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => window.__triggerDownload())]);
  const dlName = download.suggestedFilename();
  await download.saveAs(join(OUT, 'download.pdf'));
  record('export download filename', dlName === 'gildroot-ancestors-of-victoria-weber-11x14.pdf', dlName);
  record('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  // write outputs
  const files = {
    'canvas.png': out.canvasPng, 'highlight.png': out.highlightPng, 'chart.pdf': out.pdf, 'chart-bleed.pdf': out.bleedPdf,
    'tiles.pdf': out.tiles, 'chart.jpg': out.jpegB64, 'share.png': out.shareB64,
  };
  for (const [f, b] of Object.entries(files)) if (b) await writeFile(join(OUT, f), Buffer.from(b, 'base64'));
  await writeFile(join(OUT, 'names.txt'), out.names.join('\n') + '\n');
  const { wPt, hPt } = out.scene;

  // PDF QA gate
  const main = pdfcheck(join(OUT, 'chart.pdf'), ['--size', `${wPt}x${hPt}`, '--expect-names', join(OUT, 'names.txt'), '--compare', join(OUT, 'canvas.png'), '--diff-out', join(OUT, 'diff.png')]);
  await writeFile(join(OUT, 'chart.pdfcheck.json'), JSON.stringify(main, null, 2));
  record('pdfcheck chart.pdf', main.ok, main.errors.join('; '));
  const bleed = pdfcheck(join(OUT, 'chart-bleed.pdf'), ['--size', `${wPt}x${hPt}`, '--expect-names', join(OUT, 'names.txt')]);
  record('pdfcheck chart-bleed.pdf (trim size, names)', bleed.ok, bleed.errors.join('; '));
  const expectMedia = [wPt + 2 * (9 + 3 + 18 + 6), hPt + 2 * (9 + 3 + 18 + 6)];
  record('bleed mediabox = trim + 2 × (bleed + crop-mark slug)', Math.abs(bleed.mediabox[0] - expectMedia[0]) < 0.5 && Math.abs(bleed.mediabox[1] - expectMedia[1]) < 0.5, JSON.stringify({ got: bleed.mediabox, want: expectMedia }));
  const plan = out.tilePlan;
  const tiles = pdfcheck(join(OUT, 'tiles.pdf'), ['--size', `${plan.sheetW}x${plan.sheetH}`]);
  record('pdfcheck tiles.pdf (sheet size, fonts, text size)', tiles.ok && tiles.pages === plan.tiles.length + 1, `${tiles.errors.join('; ')} pages=${tiles.pages} tiles=${plan.tiles.length}`);
  record('24x36 on Letter plan', out.bigPlan.cols * out.bigPlan.rows === 15 && out.bigPlan.labels[0] === 'Row A · Column 1', JSON.stringify(out.bigPlan));

  // Node registry measures exactly like the browser registry
  const nodeFonts = await import('../../src/app/charts/fonts-node.mjs');
  await nodeFonts.loadFonts();
  const worst = out.measures.reduce((m, [s, w]) => Math.max(m, Math.abs(nodeFonts.measure('ebg-400', 12, s) - w)), 0);
  record('node measure == browser measure', worst < 1e-9, `max |Δ| = ${worst}`);

  // Node renders the same Scene to a PDF that passes the gate
  const { setTextBackend } = await import('../../src/app/charts/text.js');
  const { sceneToPdf } = await import('../../src/app/charts/render-pdf.js');
  const { buildSyntheticScene } = await import('./synthetic-scene.js');
  setTextBackend(nodeFonts.fonts);
  const nodeScene = buildSyntheticScene({ grainSrc: out.grainSrc });
  const loadImage = async src => {
    const m = /^data:[^;]+;base64,(.*)$/.exec(src);
    return m ? new Uint8Array(Buffer.from(m[1], 'base64')) : null;
  };
  const nodePdf = await sceneToPdf(nodeScene, { fonts: nodeFonts.fonts, PDFDocument: nodeFonts.nodePdfKit(), loadImage });
  await writeFile(join(OUT, 'chart-node.pdf'), nodePdf);
  const nodeCheck = pdfcheck(join(OUT, 'chart-node.pdf'), ['--size', `${wPt}x${hPt}`, '--expect-names', join(OUT, 'names.txt'), '--compare', join(OUT, 'canvas.png')]);
  record('pdfcheck chart-node.pdf (Node render)', nodeCheck.ok, nodeCheck.errors.join('; '));
  record('node scene == browser scene', JSON.stringify(nodeScene.items).length > 0 && nodeScene.items.length === out.scene.items, `${nodeScene.items.length} vs ${out.scene.items}`);

  await browser.close();
  srv.close();

  const w = Math.max(...results.map(r => r.name.length));
  for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name.padEnd(w)}  ${r.ok ? '' : r.detail}`);
  console.log(`\ntimings: fonts ${out.fontLoadMs} ms, canvas redraw ${out.canvasMs} ms, PDF ${out.pdfMs} ms, tiles ${out.tilesMs} ms`);
  console.log(`8-gen 24×36 fan (${out.bench.items} items): layout ${out.bench.layoutMs} ms (cold), canvas ${out.bench.canvasMedianMs} ms (median of 5, 2× dpr), PDF ${out.bench.pdfMs} ms, ${Math.round(out.bench.pdfBytes / 1024)} KB`);
  console.log(`canvas vs fontkit width: max relative difference ${(out.maxWidthRel * 100).toFixed(4)}%`);
  console.log(`pdf: ${main.pages} page, fonts ${main.fonts.map(f => `${f.name} (${f.type}/${f.ext})`).join(', ')}`);
  console.log(`pdf: min text ${main.min_font_size} pt, strokes ${main.strokes}, names ${main.names_checked - main.missing_names.length}/${main.names_checked}, raster diff ${JSON.stringify(main.diff)}`);
  console.log(`outputs: ${OUT}`);
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? `\n${failed} check(s) failed` : `\nall ${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
