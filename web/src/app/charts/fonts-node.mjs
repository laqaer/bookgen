// Node twin of fonts.js for tests and tooling (never loaded by the browser).
// Same registry, same patched bytes, same metrics: backed by the npm package
// pdfkit@0.20.2 (devDependency in web/package.json; run `npm install` in web/).
//
//   import { loadFonts, measure, metrics, hasGlyphs, fontFaceName } from '../../src/app/charts/fonts-node.mjs';
//   await loadFonts();
//   measure('ebg-400', 12, 'Dvořák');

import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createFontRegistry } from './fonts.js';

export { FONT_TABLE, FONT_KEYS, TEXT_FEATURES, textFeatures, resolveFontKey, fontFaceName, figureOverrides } from './fonts.js';

const require = createRequire(import.meta.url);
const FONT_DIR = fileURLToPath(new URL('../../assets/fonts/', import.meta.url));

/** The npm PDFKit constructor (same version as web/src/vendor/pdfkit.standalone.js). */
export function nodePdfKit() {
  return require('pdfkit');
}

const registry = createFontRegistry({
  async readFont(file) {
    return new Uint8Array(await readFile(FONT_DIR + file));
  },
  async getPDFDocument() {
    return nodePdfKit();
  },
});

export const loadFonts = registry.loadFonts;
export const measure = registry.measure;
export const metrics = registry.metrics;
export const hasGlyphs = registry.hasGlyphs;
export const fallbackFont = registry.fallbackFont;
export const fontBytes = registry.fontBytes;
export const isLoaded = registry.isLoaded;
export const layoutRun = registry.layoutRun;
export const fonts = registry;
