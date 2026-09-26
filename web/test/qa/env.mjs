// Tooling discovery for the QA gate: Playwright, Python + PyMuPDF, paths.

import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const WEB = resolve(fileURLToPath(new URL('../..', import.meta.url)));
export const REPO = resolve(WEB, '..');
export const PDFCHECK = join(REPO, 'tools/qa/pdfcheck.py');
export const OUT_DEFAULT = join(WEB, 'test/out');
export const IN_CI = !!process.env.CI;

// The global install used on the build machines (see CLAUDE.md); CI uses the devDependency.
const GLOBAL_PLAYWRIGHT = '/opt/node22/lib/node_modules/playwright/index.mjs';

/**
 * Import Playwright. Order: $GILDROOT_PLAYWRIGHT, the global install, then the
 * `playwright` devDependency in web/node_modules.
 * @returns {Promise<{ chromium: any, source: string } | { error: string }>}
 */
export async function loadPlaywright() {
  const tries = [];
  if (process.env.GILDROOT_PLAYWRIGHT) tries.push(process.env.GILDROOT_PLAYWRIGHT);
  if (existsSync(GLOBAL_PLAYWRIGHT)) tries.push(GLOBAL_PLAYWRIGHT);
  tries.push('playwright');
  const errors = [];
  for (const spec of tries) {
    try {
      const url = spec.startsWith('/') ? pathToFileURL(spec).href : spec;
      const mod = await import(url);
      const chromium = mod.chromium || mod.default?.chromium;
      if (chromium) return { chromium, source: spec };
      errors.push(`${spec}: no chromium export`);
    } catch (e) {
      errors.push(`${spec}: ${String(e.message || e).split('\n')[0]}`);
    }
  }
  return { error: `Playwright is not installed (${errors.join('; ')}). Run: cd web && npm ci && npx playwright install chromium` };
}

/** Launch headless Chromium, or return an error string. */
export async function launchChromium(chromium) {
  try {
    return { browser: await chromium.launch({ headless: true }) };
  } catch (e) {
    return { error: `Chromium would not start: ${String(e.message || e).split('\n')[0]}. Run: npx playwright install --with-deps chromium` };
  }
}

/** Is python3 with PyMuPDF available? Resolves to { ok, version } or { ok: false, error }. */
export function checkPython() {
  return new Promise(res => {
    execFile('python3', ['-c', 'import sys\ntry:\n import pymupdf as m\nexcept ImportError:\n import fitz as m\nprint(m.VersionBind)'], { timeout: 30000 }, (err, stdout, stderr) => {
      if (err) res({ ok: false, error: `python3 with PyMuPDF is required for the PDF checks (${(stderr || err.message).trim().split('\n').pop()}). Run: pip install pymupdf pillow` });
      else res({ ok: true, version: stdout.trim() });
    });
  });
}
