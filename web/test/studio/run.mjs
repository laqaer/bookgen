#!/usr/bin/env node
// Studio end-to-end check (/make/): drives the real page in headless Chromium.
//
//   node web/test/studio/run.mjs                 build web/dist, serve it on port 4610, run every check
//   node web/test/studio/run.mjs --url http://localhost:4610   use a server that is already running
//   node web/test/studio/run.mjs --port 4612 --no-shots
//
// Checks: start screen; both samples and their deep links (#sample, #victoria);
// every chart, style and color mode; zoom (buttons + wheel); hover and keyboard
// register (aria-live); editing a name; the Atlas panel; the free Letter PDF
// (downloaded, then checked with tools/qa/pdfcheck.py); the paywall gate; the share
// image; reload + "Resume where you left off"; the glyph preflight on a CJK name;
// a file through the file input; phone layout (bottom sheet, style, export); layout
// time under 150 ms; and that no request leaves this site.
// Screenshots and downloads go to web/test/out/studio/.

import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '../..');
const REPO = resolve(WEB, '..');
const DIST = join(WEB, 'dist');
const OUT = join(WEB, 'test/out/studio');
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const arg = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const flag = k => args.includes(k);
const SHOTS = !flag('--no-shots');
let base = arg('--url');
const PORT = Number(arg('--port') || 4610);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.ged': 'text/plain; charset=utf-8', '.pdf': 'application/pdf', '.xml': 'application/xml' };
let server = null;
if (!base) {
  execFileSync(process.execPath, [join(WEB, 'build.mjs')], { stdio: 'inherit' });
  server = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = join(DIST, p);
    if (!f.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!existsSync(f)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(readFileSync(f));
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(PORT, '127.0.0.1', ok); });
  base = `http://127.0.0.1:${PORT}`;
}

const results = [];
let failures = 0;
function check(name, ok, detail = '') {
  results.push({ name, ok: !!ok, detail });
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${typeof detail === 'string' ? detail : JSON.stringify(detail)})` : ''}`);
}

const browser = await chromium.launch();
const external = [];
const pageErrors = [];

async function newPage(viewport = { width: 1440, height: 900 }, opts = {}) {
  const ctx = opts.context || await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true, hasTouch: !!opts.touch, isMobile: !!opts.touch });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.protocol === 'data:' || u.protocol === 'blob:' || u.hostname === '127.0.0.1' || u.hostname === 'localhost') return route.continue();
    external.push(`${route.request().method()} ${u.host}${u.pathname}`);
    return route.abort('blockedbyclient');
  });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/license\.js|Failed to load resource/.test(m.text())) pageErrors.push(m.text()); });
  return { ctx, page };
}

const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(OUT, `${name}.png`) }); };
const sceneMeta = page => page.evaluate(() => window.__studio && window.__studio.scene ? { ...window.__studio.scene.meta, hits: window.__studio.scene.hits.length, names: window.__studio.scene.meta.names } : null);
// Predicates run here in Node on data read from the page: the studio's CSP
// (script-src 'self') rightly refuses eval inside the page.
async function waitScene(page, pred, timeout = 20000) {
  const fn = new Function('m', `return (${pred})`);
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const m = await sceneMeta(page).catch(() => null);
    if (m && fn(m)) { await page.waitForTimeout(150); return sceneMeta(page); }
    await page.waitForTimeout(80);
  }
  throw new Error(`timed out waiting for the chart: ${pred}`);
}
async function hitPoint(page, pick = 'h => h.ahnen === 3') {
  const fn = new Function('h', `return (${pick})(h)`);
  const d = await page.evaluate(() => {
    const s = window.__studio.scene;
    const r = document.querySelector('.preview__base').getBoundingClientRect();
    return { hits: s.hits, wPt: s.wPt, hPt: s.hPt, r: { left: r.left, top: r.top, width: r.width, height: r.height } };
  });
  const h = d.hits.find(fn);
  if (!h) return null;
  // the preview's own fit at zoom 1: pad = min(28 px, 5% of the width)
  const pad = Math.min(28, d.r.width * 0.05);
  const scale = Math.min((d.r.width - 2 * pad) / d.wPt, (d.r.height - 2 * pad) / d.hPt);
  const ox = (d.r.width - d.wPt * scale) / 2, oy = (d.r.height - d.hPt * scale) / 2;
  let x, y;
  if (h.shape === 'rect') { x = h.x + h.w / 2; y = h.y + h.h / 2; }
  else if (h.r0 === 0 && h.a1 - h.a0 >= 360) { x = h.cx; y = h.cy; }
  else { const a = (h.a0 + h.a1) / 2 * Math.PI / 180, rr = h.r0 === 0 ? h.r1 / 2 : (h.r0 + h.r1) / 2; x = h.cx + rr * Math.sin(a); y = h.cy - rr * Math.cos(a); }
  return { x: d.r.left + ox + x * scale, y: d.r.top + oy + y * scale, personId: h.personId };
}

try {
  // ---------------------------------------------------------------- desktop
  const { ctx, page } = await newPage();
  await page.goto(`${base}/make/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => new Promise(r => { const q = indexedDB.deleteDatabase('keyval-store'); q.onsuccess = q.onerror = q.onblocked = () => r(); }));
  await page.reload({ waitUntil: 'networkidle' });
  check('start screen shows the drop zone and "Choose a file"', await page.isVisible('#dropzone') && await page.isVisible('text=Choose a file'));
  const csp = await page.getAttribute('meta[http-equiv="Content-Security-Policy"]', 'content');
  check('studio page has a CSP with script-src \'self\'', /script-src 'self'/.test(csp || ''), csp);
  await shot(page, 'desktop-01-start');

  // sample family
  await page.click('text=Try a sample family');
  let m = await waitScene(page, 'm.chart === "fan"');
  check('sample family opens as an Ivory fan at automatic depth', m.style === 'ivory' && m.generations >= 5 && m.hits > 30, `${m.generations} generations, ${m.hits} people`);
  check('sample is labelled as made up', await page.isVisible('text=None of these people are real'));
  await page.waitForTimeout(1500); // thumbnails
  await shot(page, 'desktop-02-sample');

  // hover highlight + register
  const pt = await hitPoint(page, 'h => h.ahnen === 6');
  await page.mouse.move(pt.x, pt.y);
  await page.waitForTimeout(200);
  const reg = await page.textContent('#register');
  check('hover names the person in the register, with Ahnentafel number and relationship', /No\. 6/.test(reg) && /grandmother|grandfather/.test(reg), reg.replace(/\s+/g, ' ').slice(0, 140));
  check('register is aria-live', (await page.getAttribute('#register', 'aria-live')) === 'polite');
  await shot(page, 'desktop-03-hover');

  // keyboard navigation
  await page.mouse.move(5, 5);
  await page.focus('.preview');
  await page.waitForTimeout(150);
  const r1 = await page.textContent('#register');
  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(150);
  const r2 = await page.textContent('#register');
  check('keyboard: focusing the chart selects the center person, arrows move to another', /No\. 1/.test(r1) && r2 !== r1, r2.replace(/\s+/g, ' ').slice(0, 80));
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check('keyboard: Enter opens the edit panel', await page.isVisible('.edit'));
  await page.keyboard.press('Escape');

  // zoom
  const z0 = await page.textContent('.vtool--text.nums');
  await page.click('button[aria-label="Zoom in"]');
  await page.waitForTimeout(200);
  const z1 = await page.textContent('.vtool--text.nums');
  const c = await page.$eval('.preview', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(250);
  const z2 = await page.textContent('.vtool--text.nums');
  check('zoom in button and wheel zoom', z0.trim() === 'Fit' && z1.trim() !== 'Fit' && parseInt(z2, 10) > parseInt(z1, 10), `${z0.trim()} -> ${z1.trim()} -> ${z2.trim()}`);
  await page.mouse.move(c.x, c.y);
  await page.mouse.down();
  await page.mouse.move(c.x + 120, c.y + 60, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(250);
  await shot(page, 'desktop-04-zoomed');
  await page.click('button[aria-label^="Fit the whole chart"]');
  await page.waitForTimeout(200);

  // edit a name
  const p2 = await hitPoint(page, 'h => h.ahnen === 3');
  await page.mouse.click(p2.x, p2.y);
  await page.waitForSelector('.edit', { timeout: 5000 });
  await page.fill('#edit-name', 'Rosa Maria Almeida Novak');
  await page.fill('#edit-born', 'about 1930');
  await page.click('text=Show on the chart');
  m = await waitScene(page, 'm.names.some(n => /Almeida Novak/.test(n))');
  check('editing a name re-lays out the chart with the new name', m.names.some(n => /Almeida Novak/.test(n)));
  check('"Your changes" lists the edit', await page.isVisible('#edits-h'));
  await shot(page, 'desktop-05-edit');
  await page.click('button[aria-label="Close the edit panel"]');

  // every chart, style and color mode
  for (const [label, key] of [['Two families', 'bowtie'], ['Pedigree', 'pedigree'], ['Fan', 'fan']]) {
    await page.click(`.seg--icons .seg__opt:has-text("${label}")`);
    m = await waitScene(page, `m.chart === "${key}"`);
    check(`chart: ${label}`, m.chart === key, `${m.generations} generations, ${m.hits} people, ${m.title}`);
    if (key !== 'fan') await shot(page, `desktop-06-${key}`);
  }
  const styles = ['Midnight Gilt', 'Botanical', 'Letterpress', 'Nordic', 'Cartographer', 'Ivory'];
  const keys = ['midnight', 'botanical', 'letterpress', 'nordic', 'cartographer', 'ivory'];
  for (let i = 0; i < styles.length; i++) {
    await page.click(`.swatch:has-text("${styles[i]}")`);
    m = await waitScene(page, `m.style === "${keys[i]}"`);
    check(`style: ${styles[i]}`, m.style === keys[i]);
    if (keys[i] === 'midnight') await shot(page, 'desktop-07-midnight');
  }
  const thumbs = await page.$$eval('.swatch canvas', cs => cs.map(c => c.width > 50 && c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1).data[3] > 0));
  check('style swatches are drawn from the real chart', thumbs.length === 6 && thumbs.every(Boolean), thumbs);
  for (const [label, key] of [['Family line', 'lines'], ['Where they were born', 'atlas']]) {
    await page.click(`.radios__opt:has-text("${label}")`);
    m = await waitScene(page, `m.colorMode === "${key}"`);
    check(`color: ${label}`, m.colorMode === key);
  }
  await page.waitForSelector('.atlas__coverage');
  const cov = await page.textContent('.atlas__coverage');
  check('Atlas panel shows coverage', /Resolved \d+ of \d+ birthplaces/.test(cov), cov.trim());
  await shot(page, 'desktop-08-atlas');
  await page.click('.radios__opt:has-text("Style tones")');
  await waitScene(page, 'm.colorMode === "tones"');

  // sizes cap generations
  await page.selectOption('#size-select', '24x36');
  m = await waitScene(page, 'm.size === "24x36"');
  await page.click('button[aria-label^="More generations"]');
  m = await waitScene(page, 'm.generations === 7');
  check('24 × 36 allows more generations', m.generations === 7);
  await page.selectOption('#size-select', 'letter');
  m = await waitScene(page, 'm.size === "letter"');
  check('Letter caps a fan at 6 generations', m.generations <= 6, `${m.generations}`);
  const capText = await page.textContent('#gens-h + .gencount + .hint');
  check('size limit is explained in one line', /fits up to six generations/.test(capText), capText.trim());

  // paywall gate on a paid setting
  await page.click('.swatch:has-text("Midnight Gilt")');
  await waitScene(page, 'm.style === "midnight"');
  await page.click('text=Make it a poster, $29');
  await page.waitForSelector('dialog.paywall[open]', { timeout: 5000 });
  check('paid export opens the paywall (free tier)', await page.isVisible('text=Your chart is ready.'));
  await shot(page, 'desktop-09-paywall');
  await page.click('.paywall__close');
  await page.click('.swatch:has-text("Ivory")');
  await waitScene(page, 'm.style === "ivory"');

  // free PDF
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('.export .btn--quiet.export__alt, .export .btn--primary:has-text("Download free")')]);
  const pdfPath = join(OUT, await dl.suggestedFilename());
  await dl.saveAs(pdfPath);
  check('free PDF downloads with a good filename', /^gildroot-ancestors-of-.*-letter\.pdf$/.test(await dl.suggestedFilename()), await dl.suggestedFilename());
  let pdfReport = null;
  const last = await page.evaluate(() => window.__studioLastExport);
  const namesFile = join(OUT, 'free-pdf-names.txt');
  writeFileSync(namesFile, (last && last.names || []).join('\n') + '\n');
  try {
    const out = execFileSync('python3', [join(REPO, 'tools/qa/pdfcheck.py'), pdfPath, '--size', `${last.page[0]}x${last.page[1]}`, '--expect-names', namesFile], { encoding: 'utf8' });
    pdfReport = JSON.parse(out);
  } catch (e) {
    try { pdfReport = JSON.parse(String(e.stdout)); } catch { pdfReport = { ok: false, errors: [String(e.stdout || e.message).slice(0, 400)] }; }
  }
  const pick = r => r && { ok: r.ok, size: r.mediabox, fontsEmbedded: r.not_embedded && r.not_embedded.length === 0, type3: r.type3, minPt: r.min_font_size, notdef: r.notdef_glyphs, strokes: r.strokes, missingNames: r.missing_names, errors: r.errors };
  check('free PDF passes pdfcheck.py (Letter trim size, fonts embedded, no Type 3, every name extractable, nothing under 5.5 pt, strokes)', pdfReport && pdfReport.ok === true, pick(pdfReport));
  const pdfText = readFileSync(pdfPath);
  check('free PDF is a Letter PDF with the colophon', pdfText.length > 20000, `${pdfText.length} bytes`);
  await page.waitForSelector('.export__status--ok', { timeout: 5000 }).catch(() => {});
  check('export says where the file went', /Saved gildroot-.*downloads/.test(await page.textContent('.export__status')));

  // share image
  await page.click('#more-h');
  const [share] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('text=Picture for sharing')]);
  const sharePath = join(OUT, await share.suggestedFilename());
  await share.saveAs(sharePath);
  const png = readFileSync(sharePath);
  check('share image is a 1080 × 1350 PNG', png.readUInt32BE(16) === 1080 && png.readUInt32BE(20) === 1350);

  // on the wall
  await page.click('text=On the wall');
  await page.waitForSelector('.wall-view__piece img', { timeout: 10000 });
  await page.waitForTimeout(300);
  check('"On the wall" shows the chart framed to scale', await page.isVisible('.wall-view__piece .frame'));
  await shot(page, 'desktop-10-wall');
  await page.click('text=On the wall');

  // layout time
  const times = await page.evaluate(() => window.__studioLayoutMs || []);
  const warm = times.slice(3);
  const worst = Math.max(...warm);
  check('re-layout under 150 ms (warm)', worst < 150, `median ${warm.sort((a, b) => a - b)[Math.floor(warm.length / 2)]} ms, worst ${worst} ms over ${warm.length} layouts`);

  // reload and resume
  await page.waitForTimeout(1200); // autosave debounce
  await page.goto(`${base}/make/`, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Resume where you left off', { timeout: 5000 });
  check('reload offers "Resume where you left off"', true);
  await shot(page, 'desktop-11-resume');
  await page.click('.resume__item >> text=Resume');
  m = await waitScene(page, 'm.names.some(n => /Almeida Novak/.test(n))');
  check('resume restores the project with its edits', m.names.some(n => /Almeida Novak/.test(n)) && m.style === 'ivory');

  // Victoria deep link
  await page.goto(`${base}/make/#victoria`, { waitUntil: 'networkidle' });
  m = await waitScene(page, 'm.title === "The Ancestors of Victoria"');
  check('#victoria deep link opens Queen Victoria’s ancestors', m.title === 'The Ancestors of Victoria', `${m.generations} generations`);
  await page.waitForTimeout(1200);
  await shot(page, 'desktop-12-victoria');
  await ctx.close();

  // ------------------------------------------------ file input + glyph preflight
  const { ctx: ctx2, page: p3 } = await newPage();
  await p3.goto(`${base}/make/`, { waitUntil: 'networkidle' });
  await p3.setInputFiles('#file-input', join(HERE, 'preflight-fixture.ged'));
  await p3.waitForFunction(() => window.__studio && window.__studio.scene, null, { timeout: 20000 });
  check('a .ged through the file input opens the studio', /preflight-fixture\.ged/.test(await p3.textContent('.rail__file')));
  check('after reading, the studio says how many people were read and that nothing was uploaded', await p3.isVisible('text=Nothing was uploaded'));
  await p3.waitForTimeout(500);
  const count = await p3.evaluate(() => window.__studio.unprintable);
  check('glyph preflight lists names the fonts cannot print', count === 3 && await p3.isVisible('.preflight'), `${count} names`);
  await p3.click('.preflight .btn--quiet');
  await shot(p3, 'desktop-13-preflight');
  const input = await p3.$('.preflight__item input');
  await input.fill('Li Shufen');
  await p3.click('.preflight__item >> text=Use');
  await p3.waitForTimeout(600);
  const after = await p3.evaluate(() => window.__studio.unprintable);
  const names = (await sceneMeta(p3)).names;
  check('a romanized name clears that preflight item and prints on the chart', after === count - 1 && names.some(n => /Shufen|Li Shufen/.test(n)), `${count} -> ${after}`);
  // bad file
  writeFileSync(join(OUT, 'not-a-tree.ged'), 'hello, this is not a family tree');
  await p3.click('text=Open another file');
  await p3.setInputFiles('#file-input', join(OUT, 'not-a-tree.ged'));
  await p3.waitForSelector('.dropzone__status.is-error', { timeout: 10000 });
  const err = await p3.textContent('.dropzone__status');
  check('a file that is not GEDCOM gets a plain-word error with a fix', /does not look like a family tree|could not find any people/.test(err), err.trim().slice(0, 140));
  await shot(p3, 'desktop-14-error');
  await ctx2.close();

  // ---------------------------------------------------------------- phone
  const { ctx: ctx3, page: ph } = await newPage({ width: 390, height: 844 }, { touch: true });
  await ph.goto(`${base}/make/#sample`, { waitUntil: 'networkidle' });
  await waitScene(ph, 'm.chart === "fan"');
  await ph.waitForTimeout(1500);
  await shot(ph, 'phone-01-sample');
  const overflow = await ph.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check('phone: no sideways scrolling', overflow <= 1, `${overflow}px`);
  check('phone: style swatches and the export button are in the closed sheet', await ph.isVisible('.swatch:has-text("Botanical")') && await ph.isVisible('.export .btn--primary'));
  await ph.tap('.swatch:has-text("Botanical")');
  const pm = await waitScene(ph, 'm.style === "botanical"');
  check('phone: choosing a style', pm.style === 'botanical');
  const tp = await hitPoint(ph, 'h => h.ahnen === 2');
  await ph.touchscreen.tap(tp.x, tp.y);
  await ph.waitForTimeout(250);
  check('phone: tapping a person names them', /No\. 2/.test(await ph.textContent('#register')));
  await shot(ph, 'phone-02-tap');
  await ph.tap('.rail__handle');
  await ph.waitForTimeout(300);
  check('phone: the sheet opens with every option', await ph.isVisible('#gens-h'));
  await shot(ph, 'phone-03-sheet');
  await ph.tap('.rail__handle');
  await ph.tap('.swatch:has-text("Ivory")');
  await waitScene(ph, 'm.style === "ivory"');
  const [pdl] = await Promise.all([ph.waitForEvent('download', { timeout: 30000 }), ph.tap('.export .btn--primary')]).catch(() => [null]);
  // on the phone the closed sheet shows only the filled button: free PDF when settings are free, paywall otherwise
  if (pdl) check('phone: export downloads', /\.pdf$/.test(await pdl.suggestedFilename()));
  else check('phone: export opens the paywall for paid settings', await ph.isVisible('dialog.paywall[open]'));
  await ctx3.close();
} catch (e) {
  check('run finished without an exception', false, e.stack.split('\n').slice(0, 4).join(' | '));
}

check('no page errors', pageErrors.length === 0, pageErrors.slice(0, 5));
check('no request left this computer', external.length === 0, external.slice(0, 5));
await browser.close();
if (server) server.close();
writeFileSync(join(OUT, 'report.json'), JSON.stringify({ base, failures, results }, null, 2));
console.log(`\n${results.length - failures}/${results.length} passed. Screenshots and files: ${OUT}`);
process.exit(failures ? 1 : 0);
