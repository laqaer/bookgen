#!/usr/bin/env node
// Gildroot static site builder. Zero dependencies.
//
//   node web/build.mjs            build web/src -> web/dist
//   node web/build.mjs --serve    build, then serve web/dist on http://localhost:4173 (rebuilds on change)
//
// Pages are .html files under web/src. Directories starting with "_" are not published.
// A page may start with front matter:
//
//   ---
//   title: Print your Ancestry tree
//   description: One sentence for search results and link previews.
//   layout: base            (default "base"; "none" publishes the file as-is)
//   noindex: true           (optional; keeps the page out of sitemap.xml)
//   ---
//
// Templating (deliberately tiny):
//   {{> header}}          include web/src/_partials/header.html (recursive, max depth 8)
//   {{content}}           the page body (layouts only)
//   {{title}} {{description}} {{url}} {{canonical}} {{build}} {{year}}  page/site variables
//   {{site.KEY}}          values from web/src/_data/site.json (nested keys with dots)
//   {{page.KEY}}          any front-matter key
// Unknown {{...}} tokens fail the build so typos never ship.
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync, copyFileSync, existsSync, watch } from 'node:fs';
import { join, dirname, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execSync } from 'node:child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, 'src');
const DIST = join(ROOT, 'dist');

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function parseFrontMatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: text };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (v === 'true') v = true; else if (v === 'false') v = false;
    else if (/^".*"$/.test(v)) v = v.slice(1, -1);
    data[kv[1]] = v;
  }
  return { data, body: text.slice(m[0].length) };
}

const escapeAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function build() {
  const t0 = Date.now();
  const site = JSON.parse(readFileSync(join(SRC, '_data', 'site.json'), 'utf8'));
  let buildId = String(Date.now().toString(36));
  try { buildId = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() || buildId; } catch {}
  const partialCache = new Map();
  const partial = name => {
    if (!partialCache.has(name)) {
      const f = join(SRC, '_partials', name + '.html');
      if (!existsSync(f)) throw new Error(`missing partial: ${name}`);
      partialCache.set(name, readFileSync(f, 'utf8'));
    }
    return partialCache.get(name);
  };
  const lookup = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

  function render(tpl, vars, file, depth = 0) {
    if (depth > 8) throw new Error(`partial recursion too deep in ${file}`);
    tpl = tpl.replace(/\{\{>\s*([\w\-/]+)\s*\}\}/g, (_, n) => render(partial(n), vars, `_partials/${n}`, depth + 1));
    return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (all, key) => {
      if (key === 'content') return vars.content ?? all;
      let v;
      if (key.startsWith('site.')) v = lookup(site, key.slice(5));
      else if (key.startsWith('page.')) v = lookup(vars.page, key.slice(5));
      else v = vars[key];
      if (v === undefined) throw new Error(`unknown template variable {{${key}}} in ${file}`);
      return key === 'content' ? v : (typeof v === 'string' && /^(title|description|canonical|url)$/.test(key) ? escapeAttr(v) : String(v));
    });
  }

  rmSync(DIST, { recursive: true, force: true });
  mkdirSync(DIST, { recursive: true });
  const pages = [];
  for (const file of walk(SRC)) {
    const rel = relative(SRC, file);
    if (rel.split(sep).some(part => part.startsWith('_'))) continue;
    const out = join(DIST, rel);
    mkdirSync(dirname(out), { recursive: true });
    if (extname(file) !== '.html') { copyFileSync(file, out); continue; }
    const { data, body } = parseFrontMatter(readFileSync(file, 'utf8'));
    const urlPath = '/' + rel.split(sep).join('/').replace(/index\.html$/, '').replace(/\.html$/, '');
    const vars = {
      page: data,
      title: data.title ?? site.name,
      description: data.description ?? site.description,
      url: urlPath,
      canonical: site.url.replace(/\/$/, '') + urlPath,
      build: buildId,
      year: String(new Date().getFullYear()),
    };
    const layout = data.layout ?? 'base';
    let html;
    if (layout === 'none') html = render(body, vars, rel);
    else {
      const lf = join(SRC, '_layouts', layout + '.html');
      if (!existsSync(lf)) throw new Error(`missing layout ${layout} for ${rel}`);
      vars.content = render(body, vars, rel);
      html = render(readFileSync(lf, 'utf8'), vars, `_layouts/${layout}`);
    }
    writeFileSync(out, html);
    if (!data.noindex && !rel.endsWith('404.html')) pages.push(urlPath);
  }
  const today = new Date().toISOString().slice(0, 10);
  writeFileSync(join(DIST, 'sitemap.xml'),
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    pages.sort().map(u => `  <url><loc>${site.url.replace(/\/$/, '')}${u}</loc><lastmod>${today}</lastmod></url>`).join('\n') +
    '\n</urlset>\n');
  if (site.domain) writeFileSync(join(DIST, 'CNAME'), site.domain + '\n');
  console.log(`built ${pages.length} pages in ${Date.now() - t0}ms -> ${relative(process.cwd(), DIST) || DIST}`);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ged': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.xml': 'application/xml', '.txt': 'text/plain', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };

function serve(port = Number(process.env.PORT) || 4173) {
  createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = join(DIST, p);
    if (!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f) && existsSync(f + '.html')) f += '.html';
    if (!existsSync(f)) { res.writeHead(404, { 'content-type': TYPES['.html'] }); return res.end(existsSync(join(DIST, '404.html')) ? readFileSync(join(DIST, '404.html')) : 'not found'); }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(f));
  }).listen(port, () => console.log(`serving web/dist at http://localhost:${port}`));
}

try { build(); } catch (e) { console.error('BUILD FAILED:', e.message); process.exit(1); }
if (process.argv.includes('--serve')) {
  serve();
  let timer;
  watch(SRC, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(() => { try { build(); } catch (e) { console.error('BUILD FAILED:', e.message); } }, 150); });
}
