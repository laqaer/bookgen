// Unit tests for the QA gate's own logic (run by the "unit" step of web/test/run-all.mjs):
//   node --test web/test/qa/qa.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { checkCsp, ALLOWED_HOSTS } from './privacy.mjs';
import { resolveFile, WEB } from './serve.mjs';
import { buildJobs, selfTestJobs, chartsPresent, CORPUS, STYLES, COLOR_MODES, MATRIX_SIZES } from './matrix.mjs';
import { pool } from './pdfcheck.mjs';
import { renderMarkdown } from './report.mjs';
import { SIZE_LIMITS } from '../../src/app/charts/sizes.js';

const meta = csp => `<meta http-equiv="Content-Security-Policy" content="${csp}">`;

test('CSP: the brief\'s policy passes', () => {
  const r = checkCsp(meta("default-src 'self'; connect-src 'self' https://api.lemonsqueezy.com https://api-cors-anywhere.lemonsqueezy.com https://plausible.io; script-src 'self'; img-src 'self' data: blob:"));
  assert.equal(r.ok, true, r.errors.join('; '));
});

test('CSP: missing tag, wildcards and third-party hosts fail', () => {
  assert.equal(checkCsp('<html><head></head></html>').ok, false);
  assert.match(checkCsp(meta("default-src 'self'; connect-src *")).errors.join(), /connect-src allows \*/);
  assert.match(checkCsp(meta("default-src 'self'; script-src 'self' https://cdn.jsdelivr.net")).errors.join(), /script-src allows https:\/\/cdn\.jsdelivr\.net/);
  assert.match(checkCsp(meta("default-src 'self'; connect-src https:")).errors.join(), /connect-src allows https:/);
  assert.match(checkCsp(meta("img-src 'self'")).errors.join(), /no script-src/);
  // default-src covers both directives when they are absent
  assert.equal(checkCsp(meta("default-src 'self'")).ok, true);
  assert.match(checkCsp(meta("default-src 'self' https://evil.example")).errors.join(), /evil\.example/);
});

test('privacy allow-list is exactly the brief\'s third parties', () => {
  assert.deepEqual([...ALLOWED_HOSTS].sort(), ['api-cors-anywhere.lemonsqueezy.com', 'api.lemonsqueezy.com', 'plausible.io']);
});

test('server resolves live sources first, pages from dist, and refuses traversal', async () => {
  assert.equal(await resolveFile('/app/charts/sizes.js'), join(WEB, 'src/app/charts/sizes.js'));
  assert.equal(await resolveFile('/samples/victoria.ged'), join(WEB, 'src/samples/victoria.ged'));
  assert.equal(await resolveFile('/test/qa/matrix.html'), join(WEB, 'test/qa/matrix.html'));
  assert.equal(await resolveFile('/test/fixtures/edge-cases.ged'), join(WEB, 'test/fixtures/edge-cases.ged'));
  assert.equal(await resolveFile('/../../etc/passwd'), null);
  assert.equal(await resolveFile('/no/such/file.js'), null);
});

test('matrix: every chart × 6 styles × 3 colour modes × 3 sizes on each full-tier file', () => {
  const charts = ['fan', 'bowtie', 'pedigree'];
  const jobs = buildJobs({ charts, variants: false });
  const full = CORPUS.filter(c => c.tier === 'full');
  const smoke = CORPUS.filter(c => c.tier === 'smoke');
  const cases = CORPUS.reduce((n, c) => n + (c.cases?.length || 0), 0);
  assert.equal(STYLES.length, 6);
  assert.equal(COLOR_MODES.length, 3);
  assert.deepEqual(MATRIX_SIZES, ['letter', '18x24', '24x36']);
  assert.equal(jobs.length, charts.length * (full.length * 6 * 3 * 3 + smoke.length + cases));
  assert.ok(full.some(c => c.key === 'victoria') && full.some(c => c.key === 'almeida-novak') && full.some(c => c.key === 'edge-cases'));
  assert.equal(new Set(jobs.map(j => j.id)).size, jobs.length, 'job ids are unique');
  for (const j of jobs) assert.equal(j.generations, SIZE_LIMITS[j.size][j.chart], `${j.id} asks for the size's maximum generations`);
  assert.equal(jobs.filter(j => j.bench).length, 1);
  assert.ok(jobs.some(j => j.expectPreflight && j.rootId === 'E80'), 'the CJK name must be in the corpus');
});

test('matrix: variants and quick mode', () => {
  const withVariants = buildJobs({ charts: ['fan'] });
  for (const v of ['sweep-180', 'sweep-360', 'bleed', 'tiles', 'living-only', 'greek-title', 'hide-father']) {
    assert.ok(withVariants.some(j => j.variant === v), v);
  }
  const quick = buildJobs({ charts: ['fan'], quick: true, variants: false });
  assert.ok(quick.every(j => j.size === 'letter' && !j.variant));
  const filtered = buildJobs({ charts: ['pedigree'], files: ['victoria'], styles: ['ivory'], modes: ['atlas'], sizes: ['24x36'], variants: false });
  assert.deepEqual(filtered.map(j => j.id), ['victoria/pedigree-ivory-atlas-24x36']);
});

test('self-test injects defects that must be caught', () => {
  const jobs = selfTestJobs();
  const defects = jobs.filter(j => j.expectFail);
  assert.ok(defects.length >= 7);
  for (const d of defects) assert.ok(d.qaDefect && d.expectFail.length, d.id);
  assert.ok(jobs.filter(j => !j.expectFail).length >= 20);
});

test('chart detection trusts hasChart and flags engines it could not load', () => {
  const r = chartsPresent(['fan'], true);
  assert.deepEqual(r.present, ['fan']);
  assert.equal(r.present.length + r.missing.length + r.broken.length, 3);
});

test('pool never runs more than its size at once', async () => {
  const limit = pool(2);
  let active = 0, peak = 0;
  const task = () => limit(async () => { active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 5)); active--; });
  await Promise.all(Array.from({ length: 8 }, task));
  assert.equal(peak, 2);
});

test('report renders failures, skips and privacy rows', () => {
  const md = renderMarkdown({
    status: 'fail', generatedAt: '2026-09-25T12:00:00.000Z', seconds: 1, commit: 'abc1234', branch: 'main', dirty: false, command: 'node web/test/run-all.mjs',
    env: { node: 'v22', ci: false, chromium: '141', pymupdf: '1.28.2', platform: 'linux-x64' },
    steps: [{ name: 'matrix', label: 'Chart render matrix', status: 'fail', message: '1 of 2 renders pass', seconds: 1 }],
    matrix: {
      status: 'fail', message: '1 of 2 renders pass', charts: ['fan'], missingCharts: ['bowtie'], summary: { renders: 2, pass: 1, fail: 1, skip: 0, seconds: 1, workers: 1 },
      rows: [
        { id: 'victoria/fan-ivory-tones-letter', tree: 'victoria', chart: 'fan', style: 'ivory', colorMode: 'tones', size: 'letter', status: 'pass', failures: [], warnings: [], pdf: { minFontSize: 6, namesChecked: 10, diff: { meanAbs: 0.2, changedPct: 0 } }, stats: { minStroke: 0.35 } },
        { id: 'victoria/fan-ivory-atlas-letter', tree: 'victoria', chart: 'fan', style: 'ivory', colorMode: 'atlas', size: 'letter', status: 'fail', failures: ['pdfcheck: 2 text span(s) below 5.5 pt'], warnings: [] },
      ],
    },
    selfTest: null,
    privacy: { status: 'pass', message: 'ok', allowedHosts: ALLOWED_HOSTS, tokens: 3, pages: [{ path: '/make/', kind: 'studio', blocking: true, requests: 4, external: [], violations: [], notes: [], status: 'pass' }] },
  }, { outDir: '/tmp', repo: '/tmp' });
  assert.match(md, /\*\*Result: FAIL\*\*/);
  assert.match(md, /below 5\.5 pt/);
  assert.match(md, /not present yet, skipped: bowtie/);
  assert.match(md, /`\/make\/` \| studio/);
});
