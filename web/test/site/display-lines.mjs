#!/usr/bin/env node
// Display-type leading check: lines of a wrapped display heading must never touch.
//
//   node web/test/site/display-lines.mjs http://localhost:4710 / /pricing/ /gift/ ...
//
// For every h1, h2, .display and .sign-off p on each page, at widths from 320 to 1440px,
// it screenshots the element in black on white and, for each pair of lines, looks for one
// fully blank pixel row between the upper line's baseline and the lower line's x-height.
// No blank row means a descender reaches an ascender (strict: it counts any shared row,
// even when the two glyphs are far apart horizontally). Also reports how far the hero H1's lowest ink sits above the hero chart.
// Exit 1 on any collision.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';

const [base, ...paths] = process.argv.slice(2);
if (!base) { console.error('usage: display-lines.mjs <base-url> [paths...]'); process.exit(2); }
const WIDTHS = [320, 360, 375, 390, 414, 600, 768, 900, 1000, 1024, 1280, 1366, 1440];
const SEL = 'h1, h2, .display, .sign-off p';
const browser = await chromium.launch();
let failures = 0;
for (const path of paths.length ? paths : ['/']) {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.goto(base.replace(/\/$/, '') + path, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    if (process.env.EXTRA_CSS) await page.addStyleTag({ content: process.env.EXTRA_CSS }); // self-test hook
    // flatten colors so ink detection is exact; hide decorations that aren't glyphs
    await page.addStyleTag({ content: `${SEL} { color: #000 !important; background: #fff !important; text-decoration: none !important; }
      ${SEL.split(',').map(s => s.trim() + ' *').join(',')} { color: #000 !important; text-decoration: none !important; }` });
    const handles = await page.$$(SEL);
    for (const h of handles) {
      const info = await h.evaluate(el => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return null;
        const cs = getComputedStyle(el);
        const fs = parseFloat(cs.fontSize);
        // the font's own ascent: text client rects are content areas, so baseline = rect.top + ascent
        const cv = document.createElement('canvas').getContext('2d');
        cv.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const asc = cv.measureText('Hxgp').fontBoundingBoxAscent;
        const range = document.createRange();
        range.selectNodeContents(el);
        const tops = [...range.getClientRects()].filter(q => q.width > 1).map(q => q.top).sort((a, b) => a - b);
        const lineTops = tops.filter((t, i) => i === 0 || t - tops[i - 1] > 4);
        return { fs, baselines: lineTops.map(t => t + asc - r.top), text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) };
      });
      if (!info || info.baselines.length < 2) continue;
      // make the element's own box tall enough to hold overhanging ink
      const PAD = await h.evaluate(el => { el.style.paddingBlock = '0.4em'; el.style.marginBlock = '-0.4em'; el.style.position = 'relative'; el.style.zIndex = '99'; return 0.4 * parseFloat(getComputedStyle(el).fontSize); });
      const buf = await h.screenshot();
      await h.evaluate(el => { el.style.paddingBlock = ''; el.style.marginBlock = ''; el.style.position = ''; el.style.zIndex = ''; });
      // Between one line's baseline and the next line's x-height there is only descender and
      // ascender ink. A fully blank row anywhere in that window means the two lines don't touch.
      const touching = await page.evaluate(async ({ b64, baselines, fs, pad }) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const x = c.getContext('2d');
        x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        const E = 3; // skip a 3px frame: neighbouring plates and rules bleed into edge pixels
        const blank = y => { for (let i = (y * c.width + E) * 4; i < ((y + 1) * c.width - E) * 4; i += 4) if (d[i] < 160 && d[i + 1] < 160 && d[i + 2] < 160) return false; return true; };
        const out = [];
        for (let k = 0; k + 1 < baselines.length; k++) {
          const y0 = Math.ceil(baselines[k] + pad) + 1, y1 = Math.floor(baselines[k + 1] + pad - 0.55 * fs);
          let clear = false;
          for (let y = Math.max(E, y0); y <= Math.min(c.height - E - 1, y1); y++) if (blank(y)) { clear = true; break; }
          if (!clear) out.push(k + 1);
        }
        return out;
      }, { b64: buf.toString('base64'), baselines: info.baselines, fs: info.fs, pad: PAD });
      if (touching.length) {
        failures++;
        console.log(`TOUCH ${path} @${width}px: "${info.text}" line ${touching.join(', ')} touches the next line`);
      }
    }
    if (path === '/') {
      const gap = await page.evaluate(() => {
        const h1 = document.querySelector('.home-hero h1'), chart = document.querySelector('.hero-chart');
        if (!h1 || !chart) return null;
        // lowest ink of the H1 ~ last line box bottom + 0.09em (descender overhang at 1.05 leading)
        const fs = parseFloat(getComputedStyle(h1).fontSize);
        const inkBottom = h1.getBoundingClientRect().bottom + 0.09 * fs;
        const c = chart.getBoundingClientRect();
        const copy = document.querySelector('.home-hero__copy').getBoundingClientRect();
        const btn = document.querySelector('#dropzone-choose').getBoundingClientRect();
        return { chartGap: Math.round(c.top - inkBottom), copyGap: Math.round(copy.top - inkBottom), buttonBottom: Math.round(btn.bottom + scrollY) };
      });
      if (gap) {
        const lowest = Math.min(gap.chartGap, gap.copyGap);
        const fold = width >= 1000 ? 900 : 844;
        const note = `hero @${width}px: descender clearance ${lowest}px, button bottom ${gap.buttonBottom}px`;
        if (lowest < 8) { failures++; console.log('TOUCH ' + note); } else console.log('ok    ' + note + (gap.buttonBottom > fold ? ` (below a ${fold}px fold)` : ''));
      }
    }
    await ctx.close();
  }
}
await browser.close();
console.log(failures ? `${failures} collision(s)` : 'no display lines touch');
process.exit(failures ? 1 : 0);
