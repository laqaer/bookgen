#!/usr/bin/env node
// Site-wide quality check over the built site (web/dist).
//
//   node web/build.mjs && node tools/qa/sitecheck.mjs [--no-browser] [--only=/pricing/]
//
// Static checks (every page): <title>, meta description (50-170 chars), canonical, exactly one <h1>,
// lang attribute, internal links and assets resolve, images have alt, no "lorem", no "TODO", no emoji
// in headings, no exclamation marks in headings/buttons (voice rule).
// Browser checks (Playwright, 390px and 1440px): console errors, failed requests, horizontal overflow,
// requests to third-party hosts (privacy: only api.lemonsqueezy.com and plausible.io allowed).
// Exit code 1 if any page has errors. Writes web/test/out/sitecheck.md.
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative, dirname, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIST = join(ROOT, 'web', 'dist');
const OUT = join(ROOT, 'web', 'test', 'out');
const args = process.argv.slice(2);
const noBrowser = args.includes('--no-browser');
const only = args.find(a => a.startsWith('--only='))?.slice(7);
const ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'api.lemonsqueezy.com', 'plausible.io'];

if (!existsSync(DIST)) { console.error('web/dist missing: run node web/build.mjs first'); process.exit(2); }
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = walk(DIST);
const fileSet = new Set(files.map(f => '/' + relative(DIST, f).split(sep).join('/')));
const pages = files.filter(f => f.endsWith('.html')).map(f => '/' + relative(DIST, f).split(sep).join('/'))
  .filter(p => !only || p.startsWith(only) || p.replace(/index\.html$/, '') === only);

const resolves = (href, from) => {
  let u;
  try { u = new URL(href, 'http://site' + from); } catch { return false; }
  if (u.host !== 'site') return true; // external: not checked here
  let p = decodeURIComponent(u.pathname);
  if (fileSet.has(p)) return true;
  if (p.endsWith('/') && fileSet.has(p + 'index.html')) return true;
  if (fileSet.has(p + '.html') || fileSet.has(p + '/index.html')) return true;
  return false;
};
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const report = {};
const add = (page, level, msg) => { (report[page] ??= []).push({ level, msg }); };

for (const page of pages) {
  const html = readFileSync(join(DIST, page), 'utf8');
  const isFragment = !/<html[\s>]/i.test(html);
  if (isFragment) continue; // partial/test pages without a document shell
  const noindex = /<meta[^>]+name="robots"[^>]+noindex/i.test(html);
  if (!/<html[^>]+lang="/i.test(html)) add(page, 'error', 'missing <html lang>');
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  if (!title) add(page, 'error', 'missing <title>');
  else if (title.length > 70) add(page, 'warn', `title is ${title.length} chars (keep under 70)`);
  const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]*)"/i)?.[1];
  if (!desc && !noindex) add(page, 'error', 'missing meta description');
  else if (desc && (desc.length < 50 || desc.length > 170) && !noindex) add(page, 'warn', `meta description is ${desc.length} chars (aim for 50-170)`);
  if (!/<link[^>]+rel="canonical"/i.test(html) && !noindex) add(page, 'warn', 'missing canonical link');
  const h1s = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1s !== 1) add(page, 'error', `expected exactly one <h1>, found ${h1s}`);
  for (const m of html.matchAll(/<(a|link|script|img|source)\b[^>]*?\s(?:href|src)="([^"#][^"]*)"/gi)) {
    const href = m[2];
    if (/^(mailto:|tel:|data:|javascript:|https?:\/\/(?!localhost))/i.test(href)) continue;
    if (href.includes('{{')) { add(page, 'error', `unrendered template token in link: ${href}`); continue; }
    if (!resolves(href, page)) add(page, 'error', `broken ${m[1]} link: ${href}`);
  }
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) if (!/\salt="/i.test(m[0])) add(page, 'error', `img without alt: ${m[0].slice(0, 80)}`);
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
  if (/lorem ipsum/i.test(text)) add(page, 'error', 'lorem ipsum found');
  if (/\bTODO\b|\bTBD\b|\bFIXME\b/.test(text)) add(page, 'warn', 'TODO/TBD/FIXME text found');
  for (const m of text.matchAll(/<(h[1-6]|button)[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const inner = m[2].replace(/<[^>]+>/g, '');
    if (EMOJI.test(inner)) add(page, 'error', `emoji in ${m[1]}: "${inner.trim().slice(0, 60)}"`);
    if (/!/.test(inner)) add(page, 'warn', `exclamation mark in ${m[1]}: "${inner.trim().slice(0, 60)}"`);
  }
}

if (!noBrowser) {
  const { chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
  const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ged': 'text/plain', '.pdf': 'application/pdf', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
  const server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = join(DIST, p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
    if (!existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
    res.end(readFileSync(f));
  });
  await new Promise(r => server.listen(0, r));
  const port = server.address().port;
  const browser = await chromium.launch();
  for (const page of pages) {
    const html = readFileSync(join(DIST, page), 'utf8');
    if (!/<html[\s>]/i.test(html)) continue;
    const url = `http://localhost:${port}${page.replace(/index\.html$/, '')}`;
    for (const [name, vp] of [['mobile', { width: 390, height: 844 }], ['desktop', { width: 1440, height: 900 }]]) {
      const ctx = await browser.newContext({ viewport: vp });
      const tab = await ctx.newPage();
      tab.on('console', m => { if (m.type() === 'error') add(page, 'error', `[${name}] console error: ${m.text().slice(0, 160)}`); });
      tab.on('pageerror', e => add(page, 'error', `[${name}] page error: ${e.message.slice(0, 160)}`));
      tab.on('request', r => {
        const h = new URL(r.url()).hostname;
        if (r.url().startsWith('data:') || r.url().startsWith('blob:')) return;
        if (!ALLOWED_HOSTS.includes(h)) add(page, 'error', `[${name}] third-party request: ${r.url().slice(0, 120)}`);
      });
      tab.on('requestfailed', r => { if (new URL(r.url()).hostname === 'localhost') add(page, 'error', `[${name}] failed request: ${r.url().slice(0, 120)}`); });
      tab.on('response', r => { if (r.status() >= 400 && new URL(r.url()).hostname === 'localhost') add(page, 'error', `[${name}] HTTP ${r.status()}: ${r.url().slice(0, 120)}`); });
      await tab.goto(url, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => add(page, 'error', `[${name}] load failed: ${e.message.slice(0, 120)}`));
      await tab.waitForTimeout(300);
      const overflow = await tab.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0);
      if (overflow > 1) add(page, 'error', `[${name}] horizontal overflow ${overflow}px`);
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
}

const errors = Object.values(report).flat().filter(x => x.level === 'error').length;
const warns = Object.values(report).flat().filter(x => x.level === 'warn').length;
const lines = [`# Site check`, ``, `${pages.length} pages · ${errors} errors · ${warns} warnings`, ``];
for (const [page, items] of Object.entries(report).sort()) {
  lines.push(`## ${page}`);
  for (const i of items) lines.push(`- ${i.level.toUpperCase()}: ${i.msg}`);
  lines.push('');
}
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, 'sitecheck.md'), lines.join('\n'));
console.log(lines.slice(0, 3).join('\n'));
for (const [page, items] of Object.entries(report)) for (const i of items) if (i.level === 'error') console.log(`${page}: ${i.msg}`);
process.exit(errors ? 1 : 0);
