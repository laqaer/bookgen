// Screenshot harness for design review.
// Usage: node .harness/shoot.mjs <url-or-path> <outprefix> [--full] [--dark] [--wait=ms] [--click=selector]
// Writes <outprefix>-desktop.png (1440w) and <outprefix>-mobile.png (390w), and prints console errors.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [, , target, out, ...flags] = process.argv;
if (!target || !out) { console.error('usage: shoot.mjs <url> <outprefix> [--full] [--dark] [--wait=ms] [--click=sel]'); process.exit(1); }
const full = flags.includes('--full');
const dark = flags.includes('--dark');
const wait = +(flags.find(f => f.startsWith('--wait='))?.split('=')[1] ?? 800);
const click = flags.find(f => f.startsWith('--click='))?.slice(8);
const url = /^https?:|^file:/.test(target) ? target : 'http://localhost:4173/' + target.replace(/^\//, '');
const browser = await chromium.launch();
const errors = [];
for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, colorScheme: dark ? 'dark' : 'light' });
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`[${name}] pageerror: ${e.message}`));
  page.on('requestfailed', r => errors.push(`[${name}] requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(e => errors.push(`[${name}] goto: ${e.message}`));
  if (click) await page.click(click).catch(e => errors.push(`[${name}] click: ${e.message}`));
  await page.waitForTimeout(wait);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth).catch(() => 0);
  if (overflow > 1) errors.push(`[${name}] horizontal overflow: ${overflow}px`);
  await page.screenshot({ path: `${out}-${name}.png`, fullPage: full });
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join('\n') : 'no errors');
