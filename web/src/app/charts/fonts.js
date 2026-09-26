// Font registry: one set of font bytes for canvas, PDF and measurement.
//
// Each TTF is fetched once, "baked" (old-style figures mapped into the cmap,
// standard ligatures switched off; see font-patch.js), and the SAME patched bytes
// are registered with `new FontFace()` for the canvas preview and with PDFKit for
// PDF export and for all text measurement (PDFKit's bundled fontkit). Because the
// typographic choices live in the bytes, HarfBuzz (canvas) and fontkit (PDF) shape
// names identically without any feature switches.
//
// Public API (frozen contract, docs/ARCHITECTURE.md):
//   await loadFonts(keys)                      idempotent
//   measure(fontKey, sizePt, str) -> widthPt   kerning on, ligatures off
//   metrics(fontKey) -> { ascender, descender, capHeight, xHeight, unitsPerEm, lineGap } (font units)
//   hasGlyphs(fontKey, str) -> { ok, missing }
//   fontFaceName(fontKey) -> CSS family used on canvas, e.g. "gr-ebg-400"
// Extras used by the renderers: fontBytes, resolveFontKey, fallbackFont, ensurePdfKit.
//
// Node tests use fonts-node.mjs, which builds the same registry over npm pdfkit@0.20.2.

import { patchFont } from './font-patch.js';

/**
 * The registry table. Adding a font is one line.
 *   file      static TTF in web/src/assets/fonts/
 *   figures   'oldstyle' | 'lining' | 'default'  (baked into the cmap)
 *   fallback  key to use when this font lacks a glyph (Cormorant has no Greek)
 *   alias     use another key's font entirely
 */
export const FONT_TABLE = Object.freeze({
  'ebg-400': { file: 'EBGaramond-400.ttf', figures: 'oldstyle' },
  'ebg-400i': { file: 'EBGaramond-400i.ttf', figures: 'oldstyle' },
  'ebg-600': { file: 'EBGaramond-600.ttf', figures: 'oldstyle' },
  'cg-500': { file: 'CormorantGaramond-500.ttf', figures: 'default', fallback: 'ebg-400' },
  'cg-500i': { file: 'CormorantGaramond-500i.ttf', figures: 'default', fallback: 'ebg-400i' },
  'cg-600': { file: 'CormorantGaramond-600.ttf', figures: 'default', fallback: 'ebg-600' },
  // TEMPORARY until the design panel commits the sans TTFs (must cover Latin Ext +
  // Greek + Cyrillic). Replace each alias with { file: '<Sans>-400.ttf', figures: 'default' }.
  'sans-400': { alias: 'ebg-400' },
  'sans-600': { alias: 'ebg-600' },
});

/** Every key a chart may use. */
export const FONT_KEYS = Object.freeze(Object.keys(FONT_TABLE));

/**
 * Features passed to fontkit for measurement and PDF text. Ligatures are also
 * renamed away in the bytes (so canvas matches); passing an object additionally
 * makes PDFKit lay the whole string out in one run, so kerning across spaces
 * matches HarfBuzz on canvas.
 */
export const TEXT_FEATURES = Object.freeze({ liga: false });

/**
 * A fresh copy of TEXT_FEATURES for each fontkit call: fontkit writes the
 * features it applied back into the object it is given.
 */
export function textFeatures() {
  return { liga: false };
}

const LIGATURE_RENAME = Object.freeze({ liga: 'ligz' });
const FIGURE_RULES = {
  oldstyle: { feature: 'onum', suffixes: ['.osf', '.onum', '.oldstyle'] },
  lining: { feature: 'lnum', suffixes: ['.lf', '.lnum', '.lining'] },
};
const DIGIT_NAMES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const IGNORABLE = /[\s\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0]/u;

/** Resolve aliases ('sans-400' -> 'ebg-400' while the sans is pending). */
export function resolveFontKey(key) {
  let k = key;
  for (let hop = 0; hop < 4; hop++) {
    const e = FONT_TABLE[k];
    if (!e) throw new Error(`unknown font key "${key}"`);
    if (!e.alias) return k;
    k = e.alias;
  }
  throw new Error(`font alias loop at "${key}"`);
}

/** CSS family name for canvas text. */
export function fontFaceName(key) {
  return 'gr-' + resolveFontKey(key);
}

/**
 * Work out the cmap overrides that bake a figure style into a font.
 * @param {any} fk fontkit font (original bytes)
 * @param {'oldstyle'|'lining'|'default'|undefined} figures
 * @returns {Map<number, number>}
 */
export function figureOverrides(fk, figures) {
  const out = new Map();
  const rule = FIGURE_RULES[figures];
  if (!rule) return out;
  const hasFeature = (fk.availableFeatures || []).includes(rule.feature);
  let byName = null;
  const glyphIdByName = name => {
    if (!byName) {
      byName = new Map();
      for (let gid = 0; gid < fk.numGlyphs; gid++) {
        const n = fk.getGlyph(gid).name;
        if (n && !byName.has(n)) byName.set(n, gid);
      }
    }
    return byName.get(name);
  };
  for (let d = 0; d < 10; d++) {
    const cp = 0x30 + d;
    const base = fk.glyphForCodePoint(cp);
    if (!base || base.id === 0) continue;
    let target = null;
    if (hasFeature) {
      const run = fk.layout(String.fromCharCode(cp), [rule.feature]);
      if (run.glyphs.length === 1 && run.glyphs[0].id !== base.id) target = run.glyphs[0].id;
    }
    if (target == null) {
      const baseName = base.name || DIGIT_NAMES[d];
      for (const suffix of rule.suffixes) {
        const gid = glyphIdByName(baseName + suffix) ?? glyphIdByName(DIGIT_NAMES[d] + suffix);
        if (gid != null) { target = gid; break; }
      }
    }
    if (target != null && target !== base.id) out.set(cp, target);
  }
  return out;
}

/**
 * Create a registry. The browser instance below and fonts-node.mjs share this.
 * @param {{ readFont: (file: string) => Promise<Uint8Array>,
 *           getPDFDocument: () => Promise<any>,
 *           registerFace?: (family: string, bytes: Uint8Array) => Promise<void> }} io
 */
export function createFontRegistry(io) {
  const loaded = new Map(); // resolved key -> state
  const pending = new Map(); // resolved key -> Promise<state>
  let measureDoc = null;

  async function getMeasureDoc() {
    if (!measureDoc) {
      const PDFDocument = await io.getPDFDocument();
      measureDoc = new PDFDocument({ autoFirstPage: false, compress: false, font: null });
    }
    return measureDoc;
  }

  async function loadOne(rk) {
    const entry = FONT_TABLE[rk];
    const orig = await io.readFont(entry.file);
    const doc = await getMeasureDoc();
    const origName = `__orig__${rk}`;
    doc.registerFont(origName, orig);
    const origFont = doc.font(origName)._font;
    const fkOrig = origFont.font;
    const cmapOverrides = figureOverrides(fkOrig, entry.figures);
    const bytes = patchFont(orig, {
      cmapOverrides,
      renameGsub: entry.ligatures === true ? {} : LIGATURE_RENAME,
    });
    // drop the original from the measuring document
    for (const [k, v] of Object.entries(doc._fontFamilies || {})) if (v === origFont) delete doc._fontFamilies[k];
    delete doc._registeredFonts[origName];
    doc.registerFont(rk, bytes);
    const pdfFont = doc.font(rk)._font;
    const fk = pdfFont.font;
    if (io.registerFace) await io.registerFace(fontFaceName(rk), bytes);
    const state = {
      key: rk,
      bytes,
      pdfFont,
      fk,
      figuresBaked: cmapOverrides.size,
      widths: new Map(),
      metrics: Object.freeze({
        ascender: fk.ascent,
        descender: fk.descent,
        capHeight: fk.capHeight,
        xHeight: fk.xHeight,
        unitsPerEm: fk.unitsPerEm,
        lineGap: fk.lineGap || 0,
      }),
    };
    loaded.set(rk, state);
    return state;
  }

  /**
   * Load fonts (idempotent; concurrent calls share work).
   * @param {string[]} [keys] default: every key in FONT_TABLE
   */
  async function loadFonts(keys = FONT_KEYS) {
    const resolved = [...new Set(keys.map(resolveFontKey))];
    await Promise.all(resolved.map(rk => {
      if (loaded.has(rk)) return loaded.get(rk);
      if (!pending.has(rk)) {
        const p = loadOne(rk).finally(() => pending.delete(rk));
        pending.set(rk, p);
      }
      return pending.get(rk);
    }));
  }

  function state(key) {
    const rk = resolveFontKey(key);
    const s = loaded.get(rk);
    if (!s) throw new Error(`font "${key}" is not loaded; await loadFonts(["${key}"]) first`);
    return s;
  }

  /**
   * Advance width of a string in points (kerning on, ligatures off, no tracking).
   * @param {string} key @param {number} sizePt @param {string} str
   */
  function measure(key, sizePt, str) {
    if (!str) return 0;
    const s = state(key);
    let units = s.widths.get(str);
    if (units === undefined) {
      units = s.pdfFont.widthOfString(str, 1000, textFeatures());
      if (s.widths.size > 50000) s.widths.clear();
      s.widths.set(str, units);
    }
    return (units * sizePt) / 1000;
  }

  /** Font metrics in font units (divide by unitsPerEm for em). */
  function metrics(key) {
    return state(key).metrics;
  }

  /**
   * Which characters of str the font cannot draw.
   * @returns {{ ok: boolean, missing: string[] }}
   */
  function hasGlyphs(key, str) {
    const { fk } = state(key);
    const missing = [];
    for (const ch of String(str ?? '')) {
      if (IGNORABLE.test(ch)) continue;
      const cp = ch.codePointAt(0);
      if (!fk.hasGlyphForCodePoint(cp) && !missing.includes(ch)) missing.push(ch);
    }
    return { ok: missing.length === 0, missing };
  }

  /** Key to actually use for str: the key itself, or its fallback when glyphs are missing. */
  function fallbackFont(key, str) {
    if (hasGlyphs(key, str).ok) return key;
    const fb = FONT_TABLE[resolveFontKey(key)].fallback;
    if (fb && loaded.has(resolveFontKey(fb)) && hasGlyphs(fb, str).ok) return fb;
    return key;
  }

  /** Patched TTF bytes (what canvas and PDF both use). */
  function fontBytes(key) {
    return state(key).bytes;
  }

  /** True when loadFonts has completed for key. */
  function isLoaded(key) {
    return loaded.has(resolveFontKey(key));
  }

  /**
   * Shaped glyph run from fontkit (points): [{ gid, codePoints, x, y, xAdvance }].
   * Used by the PDF renderer for exact glyph placement.
   */
  function layoutRun(key, sizePt, str) {
    const { pdfFont } = state(key);
    const run = pdfFont.layout(str, textFeatures());
    const k = sizePt / 1000;
    let x = 0;
    return run.glyphs.map((g, i) => {
      const p = run.positions[i];
      const out = { gid: g.id, codePoints: g.codePoints, x: x + p.xOffset * k, y: p.yOffset * k, xAdvance: p.xAdvance * k };
      x += p.xAdvance * k;
      return out;
    });
  }

  return { loadFonts, measure, metrics, hasGlyphs, fallbackFont, fontFaceName, fontBytes, isLoaded, layoutRun, resolveFontKey };
}

// ---------------------------------------------------------------------------
// Browser instance

let fontBase = null;
let pdfkitUrl = null;
let pdfkitPromise = null;

/** Override where fonts / PDFKit are loaded from (defaults resolve from this module). */
export function setAssetUrls({ fonts, pdfkit } = {}) {
  if (fonts) fontBase = fonts.endsWith('/') ? fonts : fonts + '/';
  if (pdfkit) pdfkitUrl = pdfkit;
}

/**
 * Load the vendored PDFKit build (global PDFDocument) once. Lazy: only called
 * when the studio needs measurement or export.
 * @returns {Promise<any>} the PDFDocument constructor
 */
export function ensurePdfKit() {
  if (globalThis.PDFDocument) return Promise.resolve(globalThis.PDFDocument);
  if (!pdfkitPromise) {
    pdfkitPromise = new Promise((resolve, reject) => {
      if (typeof document === 'undefined') {
        reject(new Error('PDFKit is not loaded and there is no document to load it into'));
        return;
      }
      const s = document.createElement('script');
      s.src = pdfkitUrl || new URL('../../vendor/pdfkit.standalone.js', import.meta.url).href;
      s.async = true;
      s.onload = () => globalThis.PDFDocument ? resolve(globalThis.PDFDocument) : reject(new Error('PDFKit loaded but PDFDocument is missing'));
      s.onerror = () => { pdfkitPromise = null; reject(new Error(`could not load ${s.src}`)); };
      document.head.appendChild(s);
    });
  }
  return pdfkitPromise;
}

const browserRegistry = createFontRegistry({
  async readFont(file) {
    const url = fontBase ? fontBase + file : new URL(`../../assets/fonts/${file}`, import.meta.url).href;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font ${file}: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  },
  getPDFDocument: ensurePdfKit,
  async registerFace(family, bytes) {
    if (typeof FontFace === 'undefined') return;
    const face = new FontFace(family, bytes, { style: 'normal', weight: '400', display: 'block' });
    await face.load();
    const set = typeof document !== 'undefined' ? document.fonts : globalThis.fonts;
    if (set) set.add(face);
  },
});

export const loadFonts = browserRegistry.loadFonts;
export const measure = browserRegistry.measure;
export const metrics = browserRegistry.metrics;
export const hasGlyphs = browserRegistry.hasGlyphs;
export const fallbackFont = browserRegistry.fallbackFont;
export const fontBytes = browserRegistry.fontBytes;
export const isLoaded = browserRegistry.isLoaded;
export const layoutRun = browserRegistry.layoutRun;
/** The browser registry as one object (handy for injection into layout/text/renderers). */
export const fonts = browserRegistry;
