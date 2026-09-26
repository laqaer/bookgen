// Tiny static server for the QA gate (Playwright pages). Zero dependencies.
//
// URL resolution mirrors production and still reaches test files:
//   * pages (.html, directories): web/dist first (built site), then web/ (test harnesses)
//   * everything else: web/src first (always fresh; the builder copies these verbatim),
//     then web/dist, then web/ (so /test/fixtures/*.ged and /src/app/... resolve too)
// So /app/charts/layout.js, /assets/fonts/*, /vendor/*, /samples/* are the live sources,
// /make/ is the built studio, and /test/qa/matrix.html is a harness page.
//
//   const { server, port, origin, close } = await startServer();

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const WEB = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const SRC = join(WEB, 'src');
export const DIST = join(WEB, 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ged': 'text/plain; charset=utf-8', '.gdz': 'application/zip', '.zip': 'application/zip', '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.map': 'application/json',
};

async function fileAt(root, urlPath) {
  const f = resolve(root, '.' + urlPath);
  if (f !== root && !f.startsWith(root + sep)) return null;
  const st = await stat(f).catch(() => null);
  if (st && st.isFile()) return f;
  if (st && st.isDirectory()) {
    const idx = join(f, 'index.html');
    if ((await stat(idx).catch(() => null))?.isFile()) return idx;
    return null;
  }
  if (!extname(f)) {
    const html = f + '.html';
    if ((await stat(html).catch(() => null))?.isFile()) return html;
  }
  return null;
}

/** Resolve a URL path to a file on disk, or null. */
export async function resolveFile(urlPath, { dist = DIST, src = SRC, web = WEB } = {}) {
  const isPage = urlPath.endsWith('/') || !extname(urlPath) || extname(urlPath) === '.html';
  const roots = isPage ? [dist, web] : [src, dist, web];
  for (const r of roots) {
    const f = await fileAt(r, urlPath);
    if (f) return f;
  }
  return null;
}

function listen(srv, port, host) {
  return new Promise((res, rej) => {
    const onErr = e => { srv.off('listening', onOk); rej(e); };
    const onOk = () => { srv.off('error', onErr); res(); };
    srv.once('error', onErr);
    srv.once('listening', onOk);
    srv.listen(port, host);
  });
}

/**
 * Start the server on a free port in 4200-4299 (or `port`).
 * @param {{ port?: number, host?: string, log?: (line: string) => void }} [opts]
 * @returns {Promise<{ server: import('node:http').Server, port: number, origin: string, close: () => Promise<void>, requests: string[] }>}
 */
export async function startServer(opts = {}) {
  const host = opts.host || '127.0.0.1';
  const requests = [];
  const server = createServer(async (req, res) => {
    try {
      const u = new URL(req.url, 'http://x');
      const p = decodeURIComponent(u.pathname);
      requests.push(`${req.method} ${p}`);
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { allow: 'GET, HEAD' }); return res.end(); }
      const f = await resolveFile(p);
      if (!f) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('not found'); }
      const body = await readFile(f);
      res.writeHead(200, { 'content-type': TYPES[extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store', 'content-length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch (e) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(e && e.message || e));
    }
  });
  const ports = opts.port ? [opts.port] : Array.from({ length: 100 }, (_, i) => 4200 + ((i * 37 + process.pid) % 100));
  for (const port of ports) {
    try {
      await listen(server, port, host);
      const origin = `http://${host}:${port}`;
      return { server, port, origin, requests, close: () => new Promise(r => { server.closeAllConnections?.(); server.close(() => r()); }) };
    } catch (e) {
      if (e.code !== 'EADDRINUSE' && e.code !== 'EACCES') throw e;
    }
  }
  throw new Error('no free port in 4200-4299');
}
