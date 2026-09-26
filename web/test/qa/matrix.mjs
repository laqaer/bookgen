// Chart render matrix (BRIEF §4.8): every chart type present × 6 styles × 3 colour modes ×
// sizes, on the sample corpus, exported to PDF in headless Chromium with the real product
// modules and checked with tools/qa/pdfcheck.py (PyMuPDF).
//
// Used by web/test/run-all.mjs and web/test/charts/run.mjs. Skips with a clear message
// while charts/layout.js does not exist.

import { existsSync } from 'node:fs';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { availableParallelism } from 'node:os';
import { WEB } from './env.mjs';
import { pdfcheck } from './pdfcheck.mjs';
import { PAPER, maxGenerations } from '../../src/app/charts/sizes.js';
import { CROP_MARK } from '../../src/app/charts/render-pdf.js';

const CROP_MARK_SLUG = CROP_MARK.gap + CROP_MARK.length + CROP_MARK.margin;

export const CHARTS = ['fan', 'bowtie', 'pedigree'];
export const STYLES = ['ivory', 'midnight', 'botanical', 'letterpress', 'nordic', 'cartographer'];
export const COLOR_MODES = ['tones', 'lines', 'atlas'];
export const MATRIX_SIZES = ['letter', '18x24', '24x36'];
const CHARTS_DIR = join(WEB, 'src/app/charts');

/**
 * The corpus (BRIEF §4.8). tier 'full' runs the whole matrix; 'smoke' runs one cell per
 * chart (decoding/format paths); `cases` are extra roots rendered once per chart.
 */
export const CORPUS = [
  { key: 'victoria', url: '/samples/victoria.ged', label: 'victoria.ged (Wikidata CC0, 298 people)', tier: 'full', variants: true, bench: true },
  { key: 'almeida-novak', url: '/samples/almeida-novak.ged', label: 'almeida-novak.ged (fictional sample, living people, collapse)', tier: 'full', variants: true },
  {
    key: 'edge-cases', url: '/test/fixtures/edge-cases.ged', label: 'edge-cases.ged (root E62: pedigree collapse)', tier: 'full', root: 'E62',
    cases: [
      { root: 'E1', note: 'same-sex parents' },
      { root: 'E30', note: 'adoption (birth parents by default)' },
      { root: 'E44', note: 'father with two marriages' },
      { root: 'E50', note: 'parent with no sex recorded' },
      { root: 'E80', note: 'CJK name: glyph preflight must trigger', expectPreflight: true },
      { root: 'E81', note: 'Hebrew name: glyph preflight must trigger', expectPreflight: true },
      { root: 'E90', note: 'dual date, French republican date, CONC-split name' },
    ],
  },
  { key: 'diacritics', url: '/test/fixtures/diacritics-scripts.ged', label: 'diacritics-scripts.ged (Greek, Cyrillic, Vietnamese)', tier: 'full', cases: [{ root: 'L5', note: 'Latin Extended (Þ, Ł, ś, ë)' }] },
  { key: 'sparse-3gen', url: '/test/fixtures/sparse-3gen.ged', label: 'sparse-3gen.ged (3 people)', tier: 'full' },
  { key: 'ansel', url: '/test/fixtures/ansel.ged', tier: 'smoke' },
  { key: 'utf16le', url: '/test/fixtures/utf16le-bom.ged', tier: 'smoke' },
  { key: 'utf16be', url: '/test/fixtures/utf16be-bom.ged', tier: 'smoke' },
  { key: 'cp1252', url: '/test/fixtures/cp1252-ansi.ged', tier: 'smoke' },
  { key: 'cp850', url: '/test/fixtures/cp850-ibmpc.ged', tier: 'smoke' },
  { key: 'macroman', url: '/test/fixtures/macroman.ged', tier: 'smoke' },
  { key: 'utf8-declared-ansel', url: '/test/fixtures/utf8-declared-ansel.ged', tier: 'smoke' },
  { key: 'gedcom7', url: '/test/fixtures/gedcom7.ged', tier: 'smoke' },
  { key: 'gedcom7-gdz', url: '/test/fixtures/gedcom7.gdz', tier: 'smoke' },
  { key: 'zipped-export', url: '/test/fixtures/zipped-export.zip', tier: 'smoke' },
  { key: 'ancestry-style', url: '/test/fixtures/ancestry-style.ged', tier: 'smoke' },
  { key: 'myheritage-style', url: '/test/fixtures/myheritage-style.ged', tier: 'smoke' },
];

/** Option variants rendered once per chart on files with `variants: true`. */
function variantsFor(chart) {
  const v = [
    { variant: 'living-only', privacy: 'living-only' },
    { variant: 'show-all', privacy: 'show-all' },
    { variant: 'places', showPlaces: true, size: '18x24' },
    { variant: 'trim-empty', trimEmpty: true },
    { variant: 'colophon', colophon: true },
    { variant: 'hide-father', hideAhnen: 2 },
    { variant: 'greek-title', style: 'letterpress', title: 'Η οικογένεια · The family', subtitle: 'Семья · Gia đình', dedication: 'For Mom, Christmas 2026' },
    { variant: 'bleed', output: 'bleed', size: '18x24' },
    { variant: 'tiles', output: 'tiles', size: '24x36', sheet: 'letter' },
  ];
  if (chart === 'fan') v.push({ variant: 'sweep-180', sweep: 180 }, { variant: 'sweep-270', sweep: 270 }, { variant: 'sweep-360', sweep: 360 });
  return v;
}

/**
 * Which chart types exist: layout-<chart>.js on disk, or the layout module's CHARTS export.
 * @returns {{ present: string[], missing: string[] }}
 */
export function chartsPresent(exported = null, authoritative = false) {
  const present = [], missing = [], broken = [];
  for (const c of CHARTS) {
    const file = existsSync(join(CHARTS_DIR, `layout-${c}.js`));
    if (authoritative) {
      // layout.js says which engines it has (hasChart); a module on disk it could not load is a failure
      if (exported.includes(c)) present.push(c);
      else if (file) broken.push(c);
      else missing.push(c);
    } else if (file || (exported && exported.includes(c))) present.push(c);
    else missing.push(c);
  }
  return { present, missing, broken };
}

const list = s => (s ? String(s).split(',').map(x => x.trim()).filter(Boolean) : null);

/**
 * Build the job list.
 * @param {{ charts: string[], files?: string[]|null, styles?: string[]|null, modes?: string[]|null, sizes?: string[]|null, quick?: boolean, variants?: boolean }} sel
 */
export function buildJobs(sel) {
  const styles = sel.styles || STYLES;
  const modes = sel.modes || COLOR_MODES;
  const sizes = sel.sizes || (sel.quick ? ['letter'] : MATRIX_SIZES);
  const jobs = [];
  const add = j => {
    const size = j.size;
    j.generations = j.generations ?? maxGenerations(size, j.chart);
    j.id = `${j.tree}/${j.chart}-${j.style}-${j.colorMode}-${size}${j.variant ? '-' + j.variant : ''}`;
    jobs.push(j);
  };
  for (const f of CORPUS) {
    if (sel.files && !sel.files.includes(f.key)) continue;
    const base = { tree: f.key, rootId: f.root || null };
    if (f.tier === 'full') {
      for (const chart of sel.charts) for (const style of styles) for (const colorMode of modes) for (const size of sizes) {
        add({ ...base, chart, style, colorMode, size, bench: !!(f.bench && chart === 'fan' && size === '24x36' && style === 'ivory' && colorMode === 'tones') });
      }
      if (f.variants && sel.variants !== false) {
        for (const chart of sel.charts) for (const v of variantsFor(chart)) {
          add({ ...base, chart, style: 'ivory', colorMode: 'tones', size: 'letter', ...v });
        }
      }
    }
    if (f.tier === 'smoke' && !sel.quick) {
      for (const chart of sel.charts) add({ ...base, chart, style: 'ivory', colorMode: 'tones', size: 'letter', variant: 'smoke' });
    }
    if (!sel.quick) {
      for (const c of f.cases || []) for (const chart of sel.charts) {
        add({ ...base, rootId: c.root, chart, style: 'ivory', colorMode: 'tones', size: 'letter', variant: `case-${c.root}`, note: c.note, expectPreflight: !!c.expectPreflight });
      }
    }
  }
  return jobs;
}

/** Layout used by the harness self-test (a QA test double, see stub-layout.js). */
export const STUB_LAYOUT_URL = '/test/qa/stub-layout.js';

/**
 * Harness self-test: clean cells that must pass, and cells with injected defects that
 * must fail with the listed messages (so a broken checker can never pass everything).
 */
export function selfTestJobs() {
  const jobs = [];
  const add = j => {
    j.generations = j.generations ?? maxGenerations(j.size, j.chart);
    j.id = `${j.tree}/${j.chart}-${j.style}-${j.colorMode}-${j.size}${j.variant ? '-' + j.variant : ''}`;
    jobs.push(j);
  };
  for (const chart of CHARTS) for (const style of ['ivory', 'midnight']) for (const colorMode of ['tones', 'atlas']) for (const size of ['letter', '24x36']) {
    add({ tree: 'victoria', chart, style, colorMode, size });
  }
  add({ tree: 'almeida-novak', chart: 'bowtie', style: 'botanical', colorMode: 'lines', size: '18x24' });
  add({ tree: 'almeida-novak', chart: 'fan', style: 'ivory', colorMode: 'tones', size: 'letter', variant: 'greek-title', title: 'Η οικογένεια · The family', dedication: 'For Mom, Christmas 2026' });
  add({ tree: 'victoria', chart: 'fan', style: 'ivory', colorMode: 'tones', size: '18x24', variant: 'bleed', output: 'bleed' });
  add({ tree: 'victoria', chart: 'fan', style: 'ivory', colorMode: 'tones', size: '24x36', variant: 'tiles', output: 'tiles', sheet: 'letter' });
  add({ tree: 'edge-cases', rootId: 'E80', chart: 'fan', style: 'ivory', colorMode: 'tones', size: 'letter', variant: 'case-E80', expectPreflight: true });
  add({ tree: 'victoria', chart: 'fan', style: 'ivory', colorMode: 'tones', size: '24x36', variant: 'bench', bench: true });
  add({ tree: 'victoria', chart: 'fan', style: 'ivory', colorMode: 'tones', size: 'letter', variant: 'hide-father', hideAhnen: 2 });
  add({ tree: 'victoria', chart: 'fan', style: 'ivory', colorMode: 'tones', size: 'letter', variant: 'defect-ignore-hidden', hideAhnen: 2, qaDefect: 'ignore-hidden', expectFail: ['is still on the chart'] });
  const defects = {
    'small-text': ['below the 5.5 pt floor', 'pdfcheck: 1 text span(s) below 5.5 pt'],
    'thin-stroke': ['below the 0.35 pt minimum'],
    offpage: ['anchored off the page', 'not extractable'],
    'cjk-text': ['has no glyph', 'NO GLYPH'],
    'wrong-size': ['scene is', 'MediaBox'],
    'no-root': ['is not on the chart'],
  };
  for (const [qaDefect, expectFail] of Object.entries(defects)) {
    add({ tree: 'victoria', chart: 'fan', style: 'ivory', colorMode: 'tones', size: 'letter', variant: `defect-${qaDefect}`, qaDefect, expectFail });
  }
  return jobs;
}

/** Page size the job asked for, in the orientation the chart produced. */
function expectedSize(job, res) {
  const p = PAPER[job.size];
  const land = res.wPt > res.hPt;
  const mustLand = job.chart === 'bowtie' || job.chart === 'pedigree' || job.sweep === 180;
  return { w: land ? p.h : p.w, h: land ? p.w : p.h, land, mustLand };
}

const near = (a, b, tol = 0.5) => Math.abs(a - b) <= tol;

/**
 * Evaluate one rendered cell: write the files, run pdfcheck, apply the gate.
 * @returns {Promise<object>} row for the report
 */
async function evaluate(job, res, ctx) {
  const row = {
    id: job.id, tree: job.tree, chart: job.chart, style: job.style, colorMode: job.colorMode, size: job.size,
    variant: job.variant || null, note: job.note || null, status: 'pass', failures: [], warnings: [],
  };
  const fail = m => row.failures.push(m);
  const warn = m => row.warnings.push(m);
  if (!res || !res.ok) {
    row.status = 'fail';
    fail(`render failed: ${res?.error || 'no result'}`);
    if (res?.irErrors?.length) res.irErrors.slice(0, 10).forEach(e => fail(`IR: ${e}`));
    return row;
  }
  if (res.skipped) { row.status = 'skip'; row.skipReason = res.skipped; return row; }
  row.rootId = res.rootId;
  row.timings = res.timings;
  row.counts = res.meta?.counts || null;
  row.generations = res.meta?.generations ?? null;
  row.stats = res.stats && { items: res.stats.items, texts: res.stats.texts, glyphRuns: res.stats.glyphRuns, hitPeople: res.stats.hitPeople, minText: res.stats.minText, minStroke: res.stats.minStroke };
  row.preflight = res.preflight?.triggered?.length ? res.preflight : undefined;
  if (res.bench) row.bench = res.bench;

  // Scene IR
  if (res.irErrorCount) {
    fail(`Scene IR: ${res.irErrorCount} problem(s)`);
    res.irErrors.slice(0, 12).forEach(e => fail(`IR: ${e}`));
  }
  // requested size and orientation
  const exp = expectedSize(job, res);
  if (!near(res.wPt, exp.w, 1) || !near(res.hPt, exp.h, 1)) fail(`scene is ${res.wPt}×${res.hPt} pt, requested ${job.size} is ${exp.w.toFixed(1)}×${exp.h.toFixed(1)} pt`);
  if (exp.mustLand && !exp.land) fail(`${job.chart}${job.sweep ? ' ' + job.sweep + '°' : ''} must be landscape (BRIEF §4.4), got portrait`);
  // glyph preflight
  if (job.expectPreflight && !res.preflight?.triggered?.length) fail('glyph preflight did not trigger for a name the fonts cannot draw');
  if (res.preflight?.triggered?.length && !job.expectPreflight) warn(`glyph preflight: ${res.preflight.triggered.map(p => p.name).join(', ')}`);
  if (res.unnamed?.length) warn(`${res.unnamed.length} placed people show no form of their name (e.g. ${res.unnamed.slice(0, 3).map(p => `${p.id} ${p.name}`).join('; ')})`);
  if (res.meta?.warnings?.length) warn(`layout warnings: ${res.meta.warnings.slice(0, 3).join(' | ')}`);
  if (res.missingImages?.length) fail(`images failed to load: ${res.missingImages.join(', ')}`);
  if (!res.texts?.length) fail('the chart has no text at all');

  // files
  const base = join(ctx.dir, job.id);
  await mkdir(dirname(base), { recursive: true });
  const pdfFile = base + '.pdf', namesFile = base + '.names.txt', pngFile = base + '.canvas.png', diffFile = base + '.diff.png';
  await writeFile(pdfFile, Buffer.from(res.pdfB64, 'base64'));
  await writeFile(namesFile, (res.texts || []).join('\n') + '\n');
  if (res.pngB64) await writeFile(pngFile, Buffer.from(res.pngB64, 'base64'));
  row.files = { pdf: pdfFile };

  // pdfcheck
  const args = [];
  if (job.output === 'tiles') {
    args.push('--size', `${res.tilePlan.sheetW}x${res.tilePlan.sheetH}`, '--no-require-strokes');
  } else {
    args.push('--size', `${exp.w}x${exp.h}`, '--expect-names', namesFile);
    if (res.pngB64) args.push('--compare', pngFile, '--diff-out', diffFile);
  }
  const rep = await pdfcheck(pdfFile, args);
  row.pdf = {
    bytes: res.pdfBytes, pages: rep.pages, mediabox: rep.mediabox, trimbox: rep.trimbox,
    fonts: (rep.fonts || []).map(f => `${f.name} (${f.type}${f.embedded ? '' : ', NOT embedded'})`),
    minFontSize: rep.min_font_size, strokes: rep.strokes, namesChecked: rep.names_checked, missingNames: rep.missing_names?.slice(0, 10), notdef: rep.notdef_glyphs, diff: rep.diff,
  };
  if (!rep.ok) rep.errors.forEach(e => fail(`pdfcheck: ${e}`));
  if (rep.missing_names?.length) fail(`not extractable: ${rep.missing_names.slice(0, 5).map(s => JSON.stringify(s)).join(', ')}`);
  // MediaBox (the task's gate) — trim-size PDFs only; bleed adds the slug on every side
  if (rep.mediabox) {
    if (job.output === 'bleed') {
      const slug = res.bleedPt + CROP_MARK_SLUG;
      if (!near(rep.mediabox[0], exp.w + 2 * slug) || !near(rep.mediabox[1], exp.h + 2 * slug)) fail(`bleed MediaBox ${rep.mediabox.join('×')} != trim + 2 × ${slug} pt`);
      if (!rep.trimbox || !near(rep.trimbox[0], exp.w) || !near(rep.trimbox[1], exp.h)) fail(`bleed TrimBox ${rep.trimbox?.join('×')} != ${exp.w}×${exp.h}`);
    } else if (job.output === 'tiles') {
      if (rep.pages !== res.tilePlan.tiles + 1) fail(`tiled PDF has ${rep.pages} pages, expected ${res.tilePlan.tiles} tiles + assembly map`);
    } else if (!near(rep.mediabox[0], exp.w) || !near(rep.mediabox[1], exp.h)) {
      fail(`MediaBox ${rep.mediabox.join('×')} != requested ${exp.w}×${exp.h}`);
    }
  }
  if (job.output !== 'tiles' && !(rep.strokes > 0)) fail('no stroked paths in the PDF');

  // performance budgets (BRIEF §4.6), measured on the 8-generation 24×36 fan
  if (res.bench) {
    if (res.bench.rerenderMs >= 150) fail(`re-render (layout + canvas) ${res.bench.rerenderMs} ms, budget < 150 ms`);
    if (res.bench.pdfMs >= 2000) fail(`PDF export ${res.bench.pdfMs} ms, budget < 2 s`);
  }

  row.status = row.failures.length ? 'fail' : 'pass';
  if (job.expectFail) {
    // self-test defect: the gate must have caught it with every expected message
    const caught = job.expectFail.filter(m => row.failures.some(f => f.includes(m)));
    row.expectFail = job.expectFail;
    row.caught = row.failures.slice(0, 6);
    row.failures = caught.length === job.expectFail.length ? [] : [`injected defect "${job.qaDefect}" was not caught: expected ${job.expectFail.map(m => JSON.stringify(m)).join(' and ')}, got ${JSON.stringify(row.caught)}`];
    row.warnings = [];
    row.status = row.failures.length ? 'fail' : 'pass';
  }
  if (row.status === 'pass' && !ctx.keep) {
    await Promise.all([pdfFile, namesFile, pngFile, diffFile].map(f => rm(f, { force: true })));
    delete row.files;
  } else {
    row.files = { pdf: pdfFile, names: namesFile, ...(res.pngB64 ? { canvas: pngFile } : {}), ...(existsSync(diffFile) ? { diff: diffFile } : {}) };
  }
  return row;
}

function withTimeout(p, ms, what) {
  let t;
  return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${what} timed out after ${ms / 1000} s`)), ms); })]).finally(() => clearTimeout(t));
}

/**
 * Run the matrix.
 * @param {{ browser: any, origin: string, outDir: string, log?: Function, layoutUrl?: string,
 *           charts?: string, files?: string, styles?: string, modes?: string, sizes?: string,
 *           quick?: boolean, keep?: boolean, diff?: boolean, jobs?: number, variants?: boolean }} opts
 */
export async function runMatrix(opts) {
  const log = opts.log || (() => {});
  const t0 = Date.now();
  const result = { status: 'pass', message: '', charts: [], missingCharts: [], rows: [], summary: {}, pageErrors: [] };
  const notes = []; // problems that fail the step but let the rest of the matrix run
  if (opts.selfTest) opts = { ...opts, layoutUrl: STUB_LAYOUT_URL };
  const layoutFile = join(CHARTS_DIR, 'layout.js');
  if (!opts.layoutUrl && !existsSync(layoutFile)) {
    result.status = 'skip';
    result.message = 'web/src/app/charts/layout.js does not exist yet, so there is nothing to render. The matrix runs as soon as it lands.';
    return result;
  }
  const dir = join(opts.outDir, opts.selfTest ? 'self-test' : 'matrix');
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  const url = `${opts.origin}/test/qa/matrix.html`;
  const notFound = new Set();
  const openPage = async () => {
    const page = await opts.browser.newPage({ viewport: { width: 900, height: 900 } });
    page.on('response', r => { if (r.status() === 404) notFound.add(new URL(r.url()).pathname); });
    page.on('pageerror', e => { if (result.pageErrors.length < 50) result.pageErrors.push(String(e.message || e).slice(0, 300)); });
    page.on('console', m => { if (m.type() === 'error' && result.pageErrors.length < 50) result.pageErrors.push(`console: ${m.text().slice(0, 300)}`); });
    await page.goto(url);
    await page.waitForFunction(() => window.__qaReady === true, null, { timeout: 60000 });
    const init = await page.evaluate(o => window.__qa.init(o), { layoutUrl: opts.layoutUrl });
    return { page, init };
  };

  let first;
  try {
    first = await openPage();
  } catch (e) {
    result.status = 'fail';
    result.message = `the matrix harness did not load: ${e.message}`;
    return result;
  }
  const init = first.init;
  result.init = { layout: init.layout, exports: init.layoutExports, charts: init.charts, chartsAuthoritative: !!init.chartsAuthoritative, engineLoadError: init.engineLoadError || null, ms: init.ms };
  if (!init.ok || !init.layout) {
    await first.page.close();
    const missingModules = [...notFound].filter(p => p.startsWith('/app/'));
    const onlyChartEngines = missingModules.length && missingModules.every(p => /^\/app\/charts\/layout-(fan|bowtie|pedigree)\.js$/.test(p));
    if (onlyChartEngines && !opts.layoutUrl) {
      // layouts still being written: degrade to a skip, loudly
      result.status = 'skip';
      result.message = `layout.js imports ${missingModules.map(p => p.split('/').pop()).join(', ')}, which do${missingModules.length === 1 ? 'es' : ''} not exist yet, so nothing can be rendered. The matrix runs as soon as the chart layouts land.`;
      return result;
    }
    result.status = 'fail';
    result.message = (init.error || init.layoutError || 'layout() missing').split('\n')[0] + (missingModules.length ? ` (missing modules: ${missingModules.join(', ')})` : '');
    return result;
  }
  // with a layout override (self-test) trust its CHARTS export; otherwise look for the files
  const { present, missing, broken } = opts.layoutUrl ? { present: init.charts || CHARTS, missing: [], broken: [] } : chartsPresent(init.charts, !!init.chartsAuthoritative);
  if (broken.length) {
    result.status = 'fail';
    notes.push(`layout-${broken.join('.js, layout-')}.js exist${broken.length === 1 ? 's' : ''} but layout.js has no engine for ${broken.join(', ')}${init.engineLoadError ? `: ${init.engineLoadError.split('\n')[0]}` : ''}`);
  }
  const forced = list(opts.charts);
  result.charts = forced ? forced.filter(c => CHARTS.includes(c)) : present;
  result.missingCharts = forced ? [] : missing;
  if (!result.charts.length) {
    result.status = broken.length ? 'fail' : 'skip';
    result.message = ['layout.js exists but no chart engine (layout-fan.js, layout-bowtie.js, layout-pedigree.js) is available yet', ...notes].join('; ');
    await first.page.close();
    return result;
  }
  const jobs = opts.selfTest ? selfTestJobs() : buildJobs({
    charts: result.charts, files: list(opts.files), styles: list(opts.styles), modes: list(opts.modes), sizes: list(opts.sizes),
    quick: !!opts.quick, variants: opts.variants,
  });
  const diff = opts.diff !== false;
  for (const j of jobs) {
    if (diff && (!j.output || j.output === 'plain')) {
      const p = PAPER[j.size];
      j.diffScale = Math.min(2, 1800 / Math.max(p.w, p.h));
    }
  }
  const trees = [...new Set(jobs.map(j => j.tree))].map(k => CORPUS.find(c => c.key === k));
  log(`matrix: ${jobs.length} renders — charts ${result.charts.join(', ')}${missing.length && !forced ? ` (no engine yet: ${missing.join(', ')})` : ''}; ${trees.length} corpus files`);

  // parse the corpus in every page
  const loadTrees = async page => {
    const out = {};
    for (const f of trees) out[f.key] = await page.evaluate(([k, u]) => window.__qa.loadTree(k, u), [f.key, f.url]);
    return out;
  };
  const treeInfo = await loadTrees(first.page);
  result.corpus = trees.map(f => ({ key: f.key, label: f.label || f.url.split('/').pop(), url: f.url, tier: f.tier, ...treeInfo[f.key] }));
  const badTrees = Object.values(treeInfo).filter(t => !t.ok);
  if (badTrees.length) {
    result.status = 'fail';
    notes.push(`corpus files failed to parse: ${badTrees.map(t => `${t.key}: ${t.error}`).join('; ')}`);
  }

  const queue = jobs.filter(j => treeInfo[j.tree]?.ok);
  const total = queue.length;
  const workers = Math.max(1, Math.min(opts.jobs || Math.min(3, Math.max(1, availableParallelism() - 1)), total));
  const ctx = { dir, keep: !!opts.keep };
  const pending = [];
  let done = 0, failed = 0;
  const progressEvery = Math.max(10, Math.round(total / 20));

  const runWorker = async (w) => {
    let session = w === 0 ? first : null;
    while (queue.length) {
      const job = queue.shift();
      if (!session) {
        try {
          session = await openPage();
          await loadTrees(session.page);
        } catch (e) {
          pending.push(Promise.resolve({ id: job.id, tree: job.tree, chart: job.chart, style: job.style, colorMode: job.colorMode, size: job.size, variant: job.variant || null, status: 'fail', failures: [`harness page failed: ${e.message}`], warnings: [] }));
          continue;
        }
      }
      let res;
      try {
        res = await withTimeout(session.page.evaluate(j => window.__qa.render(j), job), 180000, `render ${job.id}`);
      } catch (e) {
        res = { ok: false, error: e.message };
        await session.page.close().catch(() => {});
        session = null;
      }
      pending.push(evaluate(job, res, ctx).then(row => {
        done++;
        if (row.status === 'fail') {
          failed++;
          if (failed <= 5) log(`  FAIL ${row.id}: ${row.failures.slice(0, 2).join(' | ')}`);
        }
        if (done % progressEvery === 0 || done === total) log(`  ${done}/${total} checked, ${failed} failing`);
        return row;
      }).catch(e => ({ id: job.id, tree: job.tree, chart: job.chart, style: job.style, colorMode: job.colorMode, size: job.size, variant: job.variant || null, status: 'fail', failures: [`evaluate crashed: ${e.stack || e}`], warnings: [] })));
    }
    if (session) await session.page.close().catch(() => {});
  };
  await Promise.all(Array.from({ length: workers }, (_, w) => runWorker(w)));
  result.rows = await Promise.all(pending);
  result.rows.sort((a, b) => a.id.localeCompare(b.id));

  const count = s => result.rows.filter(r => r.status === s).length;
  result.summary = { renders: result.rows.length, pass: count('pass'), fail: count('fail'), skip: count('skip'), seconds: Math.round((Date.now() - t0) / 100) / 10, workers };
  if (result.summary.fail) result.status = 'fail';
  result.message = [
    `${result.summary.pass} of ${result.summary.renders} renders pass` + (result.summary.skip ? `, ${result.summary.skip} skipped (no couple for a bowtie)` : ''),
    ...(result.missingCharts.length ? [`${result.missingCharts.join(' and ')} not rendered: no layout-${result.missingCharts.join('.js / layout-')}.js yet`] : []),
    ...notes,
  ].join('; ');
  return result;
}
