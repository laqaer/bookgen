// Gildroot render workshop: draws the marketing images in web/src/assets/img/ from real GEDCOM data.
//
//   node design/og/render.mjs            render everything
//   node design/og/render.mjs hero og    render only some targets
//
// Serves the repo root with python3 -m http.server (headless Chromium has no internet),
// renders design/og/render.html?art=<name> and design/og/og.html, and screenshots them.
// Outputs:
//   web/src/assets/img/hero-victoria.png      the homepage hero chart (inside #hero-chart)
//   web/src/assets/img/print-*.jpg            the six framed gallery prints
//   web/src/assets/img/card-front.jpg         gift card front (fictional sample family)
//   web/src/assets/img/og-default.png         1200x630 link preview
//   design/og/out/hero-data.json              register data + geometry, inlined into web/src/index.html
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const IMG = join(ROOT, 'web/src/assets/img');
const OUT = join(ROOT, 'design/og/out');
mkdirSync(IMG, { recursive: true });
mkdirSync(OUT, { recursive: true });

const PORT = 43000 + Math.floor(Math.random() * 900);
const server = spawn('python3', ['-m', 'http.server', String(PORT), '-d', ROOT], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 900));
const base = `http://localhost:${PORT}/design/og/`;

// name -> [css width, device scale, output file, format]
const GALLERY = {
  ivory: [380, 2, 'print-ivory.jpg'],
  bowtie: [620, 2, 'print-midnight-bowtie.jpg'],
  botanical: [320, 2, 'print-botanical.jpg'],
  letterpress: [300, 2, 'print-letterpress.jpg'],
  nordic: [340, 2, 'print-nordic.jpg'],
  carto: [380, 2, 'print-cartographer.jpg'],
  card: [260, 2, 'card-front.jpg'],
};
const want = process.argv.slice(2);
const on = k => !want.length || want.includes(k);

const browser = await chromium.launch();
try {
  if (on('hero')) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('console', m => m.type() === 'error' && console.error('hero:', m.text()));
    await page.goto(base + 'render.html?art=hero&w=800');
    await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    const meta = await page.evaluate(() => window.__meta);
    writeFileSync(join(OUT, 'hero-data.json'), JSON.stringify(meta));
    const raw = join(OUT, 'hero-raw.png');
    await page.locator('#stage svg').screenshot({ path: raw });
    // 1600px wide, quantised to a 256-colour palette to keep the PNG light.
    execFileSync('python3', ['-c', `
from PIL import Image
im = Image.open(${JSON.stringify(raw)}).convert('RGB')
q = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
q.save(${JSON.stringify(join(IMG, 'hero-victoria.png'))}, optimize=True)
im.save(${JSON.stringify(join(IMG, 'hero-victoria.webp'))}, quality=88, method=6)
print('hero', im.size)
`], { stdio: 'inherit' });
    console.log('hero stats', JSON.stringify(meta.stats));
    await ctx.close();
  }
  for (const [name, [w, dpr, file]] of Object.entries(GALLERY)) {
    if (!on(name) && !on('gallery')) continue;
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: dpr });
    const page = await ctx.newPage();
    page.on('console', m => m.type() === 'error' && console.error(name + ':', m.text()));
    await page.goto(base + `render.html?art=${name}&w=${w}`);
    await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    await page.locator('#stage svg').screenshot({ path: join(IMG, file), type: 'jpeg', quality: 86 });
    console.log('wrote', file);
    await ctx.close();
  }
  if (on('og')) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    page.on('console', m => m.type() === 'error' && console.error('og:', m.text()));
    await page.goto(base + 'og.html');
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(IMG, 'og-default.png') });
    console.log('wrote og-default.png');
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}
