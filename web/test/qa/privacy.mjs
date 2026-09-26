// Privacy gate (BRIEF §4.6 "Privacy enforcement", §4.8 "Privacy test"; CLAUDE.md red line 1).
//
// Opens the studio (/make/), every free tool (/tools/...) and the chart harnesses in
// headless Chromium with every request intercepted, and fails when:
//   * any request goes to a host other than this site, api.lemonsqueezy.com
//     (+ its api-cors-anywhere CORS host, listed in the brief's CSP) or plausible.io;
//   * a request to this site is not a static GET/HEAD (there is no server to receive data);
//   * any request URL or body carries family-tree content (names from the loaded files,
//     or GEDCOM records), even to an allowed host;
//   * a WebSocket opens to anywhere but this site;
//   * /make/ or a /tools/ page lacks a Content-Security-Policy meta tag, or its CSP lets
//     scripts or connections reach other hosts.
// Allowed third-party calls are answered locally with an empty 200, so the test never
// sends anything to Lemon Squeezy or Plausible. Service workers are blocked so every
// request is visible to the interceptor.
//
// Studio hook: if a page defines `window.__gildrootQaSession()` (async), the test calls
// it after load so the studio can drive a full session (load sample, render, export).

import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { WEB } from './env.mjs';
import { DIST } from './serve.mjs';

export const ALLOWED_HOSTS = Object.freeze(['api.lemonsqueezy.com', 'api-cors-anywhere.lemonsqueezy.com', 'plausible.io']);
const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1']);
const SAMPLE = join(WEB, 'src/samples/almeida-novak.ged');

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir).catch(() => [])) {
    const p = join(dir, name);
    const st = await stat(p);
    if (st.isDirectory()) out.push(...await walk(p));
    else out.push(p);
  }
  return out;
}

/** Built pages: /make/ and /tools/ block the gate; the rest are reported only. */
export async function discoverPages(dist = DIST) {
  const files = (await walk(dist)).filter(f => f.endsWith('.html'));
  const pages = [];
  for (const f of files) {
    const rel = relative(dist, f).split(sep).join('/');
    const url = '/' + rel.replace(/index\.html$/, '').replace(/\.html$/, '');
    const blocking = /^\/(make|tools)(\/|$)/.test(url);
    pages.push({ path: url, file: f, blocking, kind: blocking ? (url.startsWith('/make') ? 'studio' : 'tool') : 'site' });
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}

/** Words that would reveal tree content if they left the browser. */
export async function treeTokens() {
  const tokens = new Set(['0 HEAD', '1 NAME ', '0 @I', ' INDI', 'GEDC']);
  const { parseGedcom } = await import('../../src/app/engine/gedcom.js');
  for (const f of [SAMPLE, join(WEB, 'src/samples/victoria.ged')]) {
    try {
      const tree = parseGedcom(new Uint8Array(await readFile(f)));
      for (const p of Object.values(tree.people)) {
        for (const w of String(p.name || '').split(/[\s,()]+/u)) if (w.length >= 5 && /^\p{Lu}/u.test(w)) tokens.add(w.normalize('NFC'));
      }
    } catch { /* the engine tests report parse problems */ }
  }
  try {
    const { SYNTHETIC_NAMES } = await import('../charts/synthetic-scene.js');
    for (const n of SYNTHETIC_NAMES) for (const w of n.split(/\s+/u)) if (w.length >= 5) tokens.add(w.normalize('NFC'));
  } catch { /* harness names are optional */ }
  // generic words that also appear in page chrome would be false alarms
  for (const w of ['Prince', 'Princess', 'Queen', 'Duchess', 'Duke', 'Emperor', 'Empress', 'Countess', 'Unknown']) tokens.delete(w);
  return [...tokens];
}

function leaks(text, tokens) {
  if (!text) return [];
  let s = String(text);
  try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch { /* keep raw */ }
  s = s.normalize('NFC');
  const hits = [];
  for (const t of tokens) if (s.includes(t)) { hits.push(t); if (hits.length >= 5) break; }
  return hits;
}

/**
 * Check a page's CSP meta tag (studio and tools only).
 * @returns {{ ok: boolean, csp: string|null, errors: string[] }}
 */
export function checkCsp(html) {
  const errors = [];
  const tag = [...html.matchAll(/<meta\b[^>]*>/gi)].map(m => m[0]).find(t => /http-equiv\s*=\s*["']?content-security-policy/i.test(t));
  if (!tag) return { ok: false, csp: null, errors: ['no <meta http-equiv="Content-Security-Policy"> (BRIEF §4.6 requires one on /make/ and every tool page)'] };
  const m = tag.match(/content\s*=\s*"([^"]*)"/i) || tag.match(/content\s*=\s*'([^']*)'/i);
  const csp = m ? m[1].replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&') : '';
  const dirs = new Map();
  for (const part of csp.split(';')) {
    const [name, ...src] = part.trim().split(/\s+/);
    if (name) dirs.set(name.toLowerCase(), src);
  }
  const hostOk = src => {
    if (/^'.*'$/.test(src) || /^(blob|data|mediastream|filesystem):$/i.test(src)) return true;
    if (src === '*' || /^(https?|wss?):?$/i.test(src)) return false;
    const host = src.replace(/^[a-z]+:\/\//i, '').replace(/[/:].*$/, '').toLowerCase();
    return ALLOWED_HOSTS.includes(host);
  };
  for (const d of ['script-src', 'connect-src']) {
    const src = dirs.get(d) || dirs.get('default-src');
    if (!src) { errors.push(`CSP has no ${d} (or default-src)`); continue; }
    const bad = src.filter(s => !hostOk(s));
    if (bad.length) errors.push(`CSP ${d} allows ${bad.join(' ')}`);
    if (d === 'script-src' && src.some(s => /^data:$/i.test(s))) errors.push('CSP script-src allows data:');
  }
  return { ok: errors.length === 0, csp, errors };
}

/**
 * Visit one page with full interception.
 * @returns {Promise<object>} page report
 */
async function visit(browser, origin, page, tokens, log) {
  const rep = { path: page.path, kind: page.kind, blocking: page.blocking, loaded: false, requests: 0, local: 0, external: [], violations: [], notes: [] };
  const violation = m => { if (!rep.violations.includes(m)) rep.violations.push(m); };
  const context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: true, viewport: { width: 1280, height: 900 } });
  await context.route('**/*', async route => {
    const req = route.request();
    rep.requests++;
    let u;
    try { u = new URL(req.url()); } catch { return route.abort(); }
    const method = req.method();
    const body = req.postData() || '';
    if (u.protocol === 'data:' || u.protocol === 'blob:') return route.continue();
    if (LOCAL_HOSTS.has(u.hostname)) {
      rep.local++;
      if (method !== 'GET' && method !== 'HEAD') violation(`${method} ${u.pathname} to this site: the site is static, nothing may be sent to it`);
      const l = leaks(u.pathname + u.search, tokens);
      if (l.length) violation(`request URL carries tree data (${l.join(', ')}): ${u.pathname}${u.search.slice(0, 80)}`);
      return route.continue();
    }
    const allowed = ALLOWED_HOSTS.includes(u.hostname);
    rep.external.push({ host: u.hostname, method, url: `${u.origin}${u.pathname}`, type: req.resourceType(), allowed });
    if (!allowed) {
      violation(`request to ${u.hostname} (${method} ${u.origin}${u.pathname}, ${req.resourceType()})`);
      return route.abort('blockedbyclient');
    }
    const l = leaks(u.pathname + u.search + ' ' + body, tokens);
    if (l.length) violation(`${u.hostname} request carries tree data (${l.join(', ')})`);
    return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{}' });
  });
  const p = await context.newPage();
  p.on('websocket', ws => { try { const h = new URL(ws.url()).hostname; if (!LOCAL_HOSTS.has(h)) violation(`WebSocket to ${h}`); } catch { violation(`WebSocket to ${ws.url()}`); } });
  p.on('pageerror', e => { if (rep.notes.length < 5) rep.notes.push(`page error: ${String(e.message || e).slice(0, 200)}`); });
  p.on('download', d => d.cancel().catch(() => {}));
  try {
    const res = await p.goto(origin + page.path, { waitUntil: 'load', timeout: 60000 });
    rep.status = res ? res.status() : null;
    rep.loaded = !!res && res.ok();
    if (!rep.loaded) rep.notes.push(`HTTP ${rep.status}`);
    if (page.waitFor) {
      try {
        await p.waitForFunction(page.waitFor, null, { timeout: 180000 });
        if (page.result) rep.session = await p.evaluate(page.result);
      } catch (e) { rep.notes.push(`session did not finish: ${e.message.split('\n')[0]}`); rep.loaded = false; }
    }
    if (page.kind === 'studio' || page.kind === 'tool') {
      // drive what we can without knowing the UI: a studio hook, then any file input
      const hook = await p.evaluate(() => typeof window.__gildrootQaSession === 'function').catch(() => false);
      if (hook) {
        rep.session = await p.evaluate(() => window.__gildrootQaSession()).catch(e => ({ ok: false, error: String(e) }));
        rep.notes.push('ran window.__gildrootQaSession()');
      }
      const input = await p.$('input[type=file]');
      if (input) {
        await input.setInputFiles(SAMPLE).catch(e => rep.notes.push(`file input: ${e.message.split('\n')[0]}`));
        rep.notes.push('loaded almeida-novak.ged through the file input');
      }
    }
    await p.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await p.waitForTimeout(500);
  } catch (e) {
    rep.notes.push(`navigation failed: ${e.message.split('\n')[0]}`);
  }
  await context.close();
  if (page.blocking && !rep.loaded) violation('page did not load, so the privacy check could not run on it');
  if (page.csp) {
    const c = checkCsp(await readFile(page.file, 'utf8'));
    rep.csp = c.csp;
    c.errors.forEach(violation);
  }
  rep.status = rep.violations.length ? (page.blocking ? 'fail' : 'warn') : 'pass';
  if (page.expect) {
    // canary: every planted leak must have been caught
    const missed = page.expect.filter(m => !rep.violations.some(v => v.includes(m)));
    rep.caught = rep.violations;
    rep.violations = missed.length ? [`canary leak(s) not caught: ${missed.join('; ')}`] : [];
    rep.status = missed.length ? 'fail' : 'pass';
  }
  log?.(`  ${rep.status.toUpperCase().padEnd(4)} ${page.path}  ${rep.requests} requests, ${rep.external.length} third-party${rep.violations.length ? ' — ' + rep.violations[0] : ''}`);
  return rep;
}

/**
 * Run the privacy gate.
 * @param {{ browser: any, origin: string, log?: Function, distBuilt?: boolean }} opts
 */
export async function runPrivacy(opts) {
  const t0 = Date.now();
  const tokens = await treeTokens();
  const targets = [
    { path: '/test/charts/harness.html', kind: 'harness', blocking: true, waitFor: () => window.__smoke && window.__smoke.done, result: () => ({ errors: window.__smoke.errors.length }) },
    { path: '/test/qa/matrix.html?session', kind: 'harness', blocking: true, waitFor: () => window.__qaSession && window.__qaSession.done, result: () => window.__qaSession },
  ];
  // self-test: a page that plants each kind of leak; the gate passes only if all are caught
  targets.push({
    path: '/test/qa/privacy-canary.html', file: join(WEB, 'test/qa/privacy-canary.html'), kind: 'canary', blocking: true, csp: true,
    waitFor: () => window.__canaryDone === true,
    expect: ['request to cdn.example.com', 'plausible.io request carries tree data', 'POST /api/upload to this site', 'request to tracker.example.net', 'CSP connect-src allows *', 'CSP script-src allows'],
  });
  const site = opts.distBuilt ? await discoverPages() : [];
  for (const pg of site) targets.push({ ...pg, csp: pg.blocking });
  const result = { status: 'pass', pages: [], allowedHosts: ALLOWED_HOSTS, tokens: tokens.length, message: '' };
  for (const t of targets) result.pages.push(await visit(opts.browser, opts.origin, t, tokens, opts.log));
  const blockingFails = result.pages.filter(p => p.blocking && p.status === 'fail');
  const warns = result.pages.filter(p => !p.blocking && p.violations.length);
  const studio = site.filter(p => p.kind === 'studio').length, tools = site.filter(p => p.kind === 'tool').length;
  result.status = blockingFails.length ? 'fail' : 'pass';
  const hosts = [...new Set(result.pages.filter(p => p.kind !== 'canary').flatMap(p => p.external.map(e => e.host)))];
  result.thirdPartyHosts = hosts;
  result.message = `${result.pages.length} pages (${studio ? 'studio' : 'no studio yet'}, ${tools} tool page${tools === 1 ? '' : 's'}, 2 harnesses, 1 leak canary${site.length - studio - tools ? `, ${site.length - studio - tools} other site pages reported only` : ''}); ` +
    (blockingFails.length ? `${blockingFails.length} failing: ${blockingFails.map(p => p.path).join(', ')}` : 'no data left the browser') +
    (hosts.length ? `; third-party hosts seen: ${hosts.join(', ')}` : '; no third-party requests') +
    (warns.length ? `; ${warns.length} non-studio page(s) with warnings` : '');
  if (!site.length) result.message += opts.distBuilt ? '' : ' (site not built, so studio/tool pages were not checked)';
  result.seconds = Math.round((Date.now() - t0) / 100) / 10;
  return result;
}
