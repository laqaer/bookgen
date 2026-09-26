#!/usr/bin/env node
// Gildroot QA gate (company/BRIEF.md §4.8): one command, blocks deploys.
//
//   node web/test/run-all.mjs [options]
//
// Steps, in order:
//   build      node web/build.mjs (the site must build)
//   engine     node --test web/test/engine/            (parser, dates, places, tree, builder …)
//   unit       node --test web/test/charts/*.test.mjs web/test/qa/*.test.mjs (text fitting, paths,
//              sizes, and the QA gate's own rules)
//   smoke      node web/test/charts/scene-smoke.mjs     (every renderer on a synthetic Scene)
//   self-test  the chart matrix harness run against a stub layout, including injected
//              defects that must be caught (proves the checker itself works)
//   matrix     every chart type present × 6 styles × 3 colour modes × Letter/18×24/24×36 on
//              the sample corpus, PDFs checked with tools/qa/pdfcheck.py (MediaBox, embedded
//              fonts, no Type 3, every displayed name extractable NFC, no text < 5.5 pt,
//              strokes > 0, raster diff against the canvas preview) — skipped with a clear
//              message while web/src/app/charts/layout.js does not exist
//   privacy    request interception on the studio, tool pages and harnesses: nothing may go
//              to a host other than this site, api.lemonsqueezy.com or plausible.io
// Writes web/test/out/report.json and web/test/out/report.md. Exit 0 only when no step fails.
//
// Options
//   --only a,b       run only these steps        --skip a,b     skip these steps
//   --quick          matrix on Letter only, no format smoke files or extra roots
//   --files victoria,almeida-novak   --charts fan   --styles ivory   --modes tones   --sizes letter
//   --no-variants    skip the option variants (sweeps, privacy modes, bleed, tiles …)
//   --no-diff        skip the canvas-vs-PDF raster diff
//   --keep           keep every PDF (by default only failing renders keep their files)
//   --jobs N         browser pages rendering in parallel (default: min(3, CPUs − 1))
//   --layout URL     use another layout module for the matrix (e.g. /test/qa/stub-layout.js)
//   --out DIR        report directory (default web/test/out)
// Missing tools (Playwright, Chromium, python3 + PyMuPDF) skip the browser steps locally and
// fail them in CI (CI=true), so the gate can never pass by not running.

import { spawn, execFileSync } from 'node:child_process';
import { mkdir, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { WEB, REPO, OUT_DEFAULT, IN_CI, loadPlaywright, launchChromium, checkPython } from './qa/env.mjs';
import { startServer } from './qa/serve.mjs';
import { runMatrix } from './qa/matrix.mjs';
import { runPrivacy } from './qa/privacy.mjs';
import { renderMarkdown } from './qa/report.mjs';

const STEPS = ['build', 'engine', 'unit', 'smoke', 'self-test', 'matrix', 'privacy'];
const LABELS = {
  build: 'Site build', engine: 'Engine unit tests', unit: 'Chart + QA unit tests', smoke: 'Renderer smoke test',
  'self-test': 'Matrix self-test (stub layout + injected defects)', matrix: 'Chart render matrix', privacy: 'Privacy test',
};

function parseArgs(argv) {
  const o = { flags: new Set() };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    if (['only', 'skip', 'files', 'charts', 'styles', 'modes', 'sizes', 'jobs', 'layout', 'out'].includes(key)) o[key] = argv[++i];
    else o.flags.add(key);
  }
  return o;
}

const args = parseArgs(process.argv.slice(2));
if (args.flags.has('help') || args.flags.has('h')) {
  const src = await import('node:fs').then(fs => fs.readFileSync(new URL(import.meta.url), 'utf8'));
  console.log(src.split('\n').slice(1).filter(l => l.startsWith('//')).map(l => l.slice(3)).join('\n'));
  process.exit(0);
}
const OUT = resolve(args.out || OUT_DEFAULT);
const only = args.only ? args.only.split(',') : null;
const skip = new Set(args.skip ? args.skip.split(',') : []);
for (const s of [...(only || []), ...skip]) if (!STEPS.includes(s)) { console.error(`unknown step "${s}" (steps: ${STEPS.join(', ')})`); process.exit(2); }
const wanted = s => (!only || only.includes(s)) && !skip.has(s);

const t00 = Date.now();
const steps = [];
const log = (...a) => console.log(...a);

function run(cmd, argv, opts = {}) {
  return new Promise(res => {
    const t0 = Date.now();
    const child = spawn(cmd, argv, { cwd: REPO, env: { ...process.env, ...opts.env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; if (opts.echo) process.stdout.write(d); });
    child.stderr.on('data', d => { out += d; if (opts.echo) process.stderr.write(d); });
    child.on('error', e => res({ code: 127, out: String(e), seconds: 0 }));
    child.on('close', code => res({ code, out, seconds: Math.round((Date.now() - t0) / 100) / 10 }));
  });
}

async function saveLog(name, text) {
  const f = join(OUT, 'logs', `${name}.log`);
  await writeFile(f, text);
  return relative(REPO, f);
}

function record(name, status, message, extra = {}) {
  const s = { name, label: LABELS[name], status, message, ...extra };
  steps.push(s);
  const tag = { pass: 'PASS', fail: 'FAIL', skip: 'SKIP' }[status];
  log(`${tag}  ${LABELS[name]}${s.seconds != null ? ` (${s.seconds} s)` : ''} — ${message}`);
  return s;
}

const tail = (text, n = 25) => text.trimEnd().split('\n').slice(-n).join('\n');

await mkdir(join(OUT, 'logs'), { recursive: true });
// keep generated output out of git without touching the repo's .gitignore
await writeFile(join(OUT, '.gitignore'), '# generated by web/test/run-all.mjs\n*\n');
log(`Gildroot QA gate — report in ${relative(process.cwd(), OUT) || OUT}${IN_CI ? ' (CI mode: missing tools fail)' : ''}\n`);

// 1. build ------------------------------------------------------------------
let distBuilt = false;
if (wanted('build')) {
  const r = await run(process.execPath, ['web/build.mjs']);
  const logFile = await saveLog('build', r.out);
  distBuilt = r.code === 0;
  const line = r.out.trim().split('\n').pop() || '';
  record('build', distBuilt ? 'pass' : 'fail', distBuilt ? line : `build failed: ${tail(r.out, 5)}`, { seconds: r.seconds, log: logFile });
} else {
  distBuilt = existsSync(join(WEB, 'dist'));
  record('build', 'skip', `skipped by option${distBuilt ? '; using the existing web/dist' : ''}`);
}

// 2. engine unit tests --------------------------------------------------------
function tapSummary(out) {
  const num = k => { const m = out.match(new RegExp(`^# ${k} (\\d+)`, 'm')); return m ? Number(m[1]) : null; };
  return { tests: num('tests'), pass: num('pass'), fail: num('fail'), skipped: num('skipped'), todo: num('todo'), cancelled: num('cancelled') };
}
function failingTests(out) {
  return [...out.matchAll(/^\s*not ok \d+ - (.+)$/gm)].map(m => m[1]).slice(0, 20);
}
if (wanted('engine')) {
  const r = await run(process.execPath, ['--test', 'web/test/engine/']);
  const logFile = await saveLog('engine', r.out);
  const s = tapSummary(r.out);
  const ok = r.code === 0 && s.tests > 0 && s.fail === 0;
  record('engine', ok ? 'pass' : 'fail', s.tests != null ? `${s.pass}/${s.tests} tests pass${s.fail ? `, ${s.fail} fail` : ''}` : `node --test did not run: ${tail(r.out, 5)}`,
    { seconds: r.seconds, log: logFile, tests: s, failing: ok ? [] : failingTests(r.out), output: ok ? undefined : tail(r.out, 40) });
} else record('engine', 'skip', 'skipped by option');

// 3. chart unit tests ---------------------------------------------------------
if (wanted('unit')) {
  const files = [];
  for (const sub of ['charts', 'qa']) {
    const dir = join(WEB, 'test', sub);
    if (existsSync(dir)) files.push(...(await readdir(dir)).filter(f => f.endsWith('.test.mjs')).sort().map(f => `web/test/${sub}/${f}`));
  }
  if (!files.length) record('unit', 'skip', 'no web/test/charts/*.test.mjs or web/test/qa/*.test.mjs files');
  else {
    const r = await run(process.execPath, ['--test', ...files]);
    const logFile = await saveLog('unit', r.out);
    const s = tapSummary(r.out);
    const ok = r.code === 0 && s.tests > 0 && s.fail === 0;
    record('unit', ok ? 'pass' : 'fail', s.tests != null ? `${s.pass}/${s.tests} tests pass in ${files.length} file(s)${s.fail ? `, ${s.fail} fail` : ''}` : `node --test did not run: ${tail(r.out, 5)}`,
      { seconds: r.seconds, log: logFile, tests: s, files, failing: ok ? [] : failingTests(r.out), output: ok ? undefined : tail(r.out, 40) });
  }
} else record('unit', 'skip', 'skipped by option');

// Browser tooling ---------------------------------------------------------------
// smoke, self-test and matrix need Chromium + python3/PyMuPDF; privacy needs Chromium only.
const browserSteps = ['smoke', 'self-test', 'matrix', 'privacy'].filter(wanted);
const tooling = { browserProblems: [], pythonProblems: [] };
if (browserSteps.length) {
  const pw = await loadPlaywright();
  if (pw.error) tooling.browserProblems.push(pw.error);
  else {
    const b = await launchChromium(pw.chromium);
    if (b.error) tooling.browserProblems.push(b.error);
    else { tooling.browser = b.browser; tooling.chromium = b.browser.version(); tooling.playwright = pw.source; }
  }
  if (browserSteps.some(s => s !== 'privacy')) {
    const py = await checkPython();
    if (py.ok) tooling.pymupdf = py.version;
    else tooling.pythonProblems.push(py.error);
  }
}
const problemsFor = name => [...tooling.browserProblems, ...(name === 'privacy' ? [] : tooling.pythonProblems)];
const ready = name => !problemsFor(name).length;
const toolSkip = name => {
  const msg = `missing tools: ${problemsFor(name).join('; ')}`;
  return record(name, IN_CI ? 'fail' : 'skip', IN_CI ? `could not run in CI: ${msg}` : `skipped: ${msg}`);
};

// 4. renderer smoke -----------------------------------------------------------
if (wanted('smoke')) {
  if (!ready('smoke')) toolSkip('smoke');
  else {
    const r = await run(process.execPath, ['web/test/charts/scene-smoke.mjs', '--out', join(OUT, 'smoke')]);
    const logFile = await saveLog('smoke', r.out);
    const passed = r.out.match(/all (\d+) checks passed/);
    const failed = r.out.match(/(\d+) check\(s\) failed/);
    const ok = r.code === 0 && !!passed;
    record('smoke', ok ? 'pass' : 'fail', ok ? `${passed[1]} renderer checks pass (canvas, PDF, bleed, tiles, JPEG, share image)` : (failed ? `${failed[1]} renderer check(s) fail` : `scene-smoke.mjs crashed: ${tail(r.out, 3)}`),
      { seconds: r.seconds, log: logFile, failing: ok ? [] : r.out.split('\n').filter(l => l.startsWith('FAIL')).slice(0, 20), output: ok ? undefined : tail(r.out, 30) });
  }
} else record('smoke', 'skip', 'skipped by option');

// 5–7. browser steps on one local server --------------------------------------------
let server = null;
const results = {};
if (tooling.browser && ['self-test', 'matrix', 'privacy'].some(wanted)) {
  try {
    server = await startServer();
  } catch (e) {
    tooling.browserProblems.push(`a local port for the test server (${e.message})`);
  }
}
const matrixOpts = {
  browser: tooling.browser, origin: server?.origin, outDir: OUT, log: m => log(m),
  files: args.files, charts: args.charts, styles: args.styles, modes: args.modes, sizes: args.sizes,
  quick: args.flags.has('quick'), keep: args.flags.has('keep'), diff: !args.flags.has('no-diff'),
  variants: !args.flags.has('no-variants'), jobs: args.jobs ? Number(args.jobs) : undefined, layoutUrl: args.layout,
};

if (wanted('self-test')) {
  if (!ready('self-test')) toolSkip('self-test');
  else {
    const t0 = Date.now();
    const r = await runMatrix({ ...matrixOpts, selfTest: true, files: null, charts: null, styles: null, modes: null, sizes: null, quick: false, layoutUrl: null, log: () => {} });
    results.selfTest = r;
    const defects = r.rows.filter(x => x.expectFail);
    const caught = defects.filter(x => x.status === 'pass').length;
    const clean = r.rows.filter(x => !x.expectFail);
    const msg = r.summary.renders
      ? `${clean.filter(x => x.status === 'pass').length}/${clean.length} clean renders pass, ${caught}/${defects.length} injected defects caught`
      : r.message;
    record('self-test', r.status === 'pass' ? 'pass' : 'fail', msg, { seconds: Math.round((Date.now() - t0) / 100) / 10 });
  }
} else record('self-test', 'skip', 'skipped by option');

if (wanted('matrix')) {
  if (!ready('matrix')) toolSkip('matrix');
  else {
    const t0 = Date.now();
    const r = await runMatrix(matrixOpts);
    results.matrix = r;
    record('matrix', r.status, r.message, { seconds: Math.round((Date.now() - t0) / 100) / 10 });
  }
} else record('matrix', 'skip', 'skipped by option');

if (wanted('privacy')) {
  if (!ready('privacy')) toolSkip('privacy');
  else {
    const t0 = Date.now();
    log('privacy:');
    const r = await runPrivacy({ browser: tooling.browser, origin: server.origin, log: m => log(m), distBuilt });
    results.privacy = r;
    record('privacy', r.status, r.message, { seconds: Math.round((Date.now() - t0) / 100) / 10 });
  }
} else record('privacy', 'skip', 'skipped by option');

if (tooling.browser) await tooling.browser.close().catch(() => {});
if (server) await server.close();

// Report --------------------------------------------------------------------------
const git = (...a) => { try { return execFileSync('git', a, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const failedSteps = steps.filter(s => s.status === 'fail');
const report = {
  status: failedSteps.length ? 'fail' : 'pass',
  generatedAt: new Date().toISOString(),
  seconds: Math.round((Date.now() - t00) / 100) / 10,
  commit: git('rev-parse', '--short', 'HEAD'),
  branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
  dirty: !!git('status', '--porcelain'),
  command: `node web/test/run-all.mjs ${process.argv.slice(2).join(' ')}`.trim(),
  env: { node: process.version, ci: IN_CI, chromium: tooling.chromium || null, playwright: tooling.playwright || null, pymupdf: tooling.pymupdf || null, platform: `${process.platform}-${process.arch}` },
  steps,
  matrix: results.matrix || null,
  selfTest: results.selfTest || null,
  privacy: results.privacy || null,
};
await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 1));
await writeFile(join(OUT, 'report.md'), renderMarkdown(report, { outDir: OUT, repo: REPO }));
log(`\n${report.status === 'pass' ? 'QA gate PASSED' : `QA gate FAILED (${failedSteps.map(s => s.name).join(', ')})`} in ${report.seconds} s — ${relative(process.cwd(), join(OUT, 'report.md'))}`);
process.exit(report.status === 'pass' ? 0 : 1);
