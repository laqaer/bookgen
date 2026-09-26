// Chart styles: six token sets × three colour modes (company/BRIEF.md §4.3, §4.7).
//
//   import { getStyle, wedgeFill } from './styles.js';
//   const st = getStyle('ivory', 'tones');   // resolved tokens for one style + mode
//   wedgeFill(st, { ring: 3, index: 5, quarter: 2 })  // '#rrggbb' or null
//
// Rules the tokens follow:
//   * light, print-safe grounds are the default (Ivory is the free style);
//   * gold is used only for rules and ornaments, or as text on a dark ground (Midnight);
//   * hairlines 0.35–0.5 pt; nothing thinner than 0.35 pt;
//   * every text colour meets WCAG AA (4.5:1) on every fill it can sit on
//     (checked by web/test/charts/layout.test.mjs).
// Fonts use the registry keys from fonts.js. 'sans-*' are aliases until the
// design panel commits the sans TTFs; nothing here changes when they land.

/** Style keys in UI order. */
export const STYLE_KEYS = Object.freeze(['ivory', 'midnight', 'botanical', 'letterpress', 'nordic', 'cartographer']);
/** Colour modes: style tones, family line, Atlas (birthplace). */
export const COLOR_MODES = Object.freeze(['tones', 'lines', 'atlas']);

// ---------------------------------------------------------------------------
// Colour helpers (sRGB hex)

const clamp01 = v => Math.max(0, Math.min(1, v));
const s2lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lin2s = c => { c = clamp01(c); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };

/** '#rrggbb' -> [r, g, b] in 0..1 (sRGB). */
export function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`bad colour "${hex}"`);
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
}

/** [r, g, b] in 0..1 -> '#rrggbb'. */
export function rgbToHex(rgb) {
  return '#' + rgb.map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
}

/**
 * Mix two colours in linear light (t = 0 -> a, t = 1 -> b). Used for tints so a
 * 20% tint of a colour on a ground looks like ink laid thinly on that paper.
 */
export function mix(a, b, t) {
  const A = hexToRgb(a).map(s2lin), B = hexToRgb(b).map(s2lin);
  return rgbToHex(A.map((v, i) => lin2s(v * (1 - t) + B[i] * t)));
}

/** WCAG relative luminance. */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(s2lin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio (1..21). */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Atlas palettes: 7 hues + "other". Tuned with the Machado (2009) CVD model in
// OKLab (see atlas.js cvdReport): every pair stays apart for protan and deutan
// readers at the documented floor, the three most frequent slots (and "other")
// at the target, and ink text passes AA on every fill. Colour is never the only
// channel: the legend names each colour and the wedges carry the birthplace.

/** Light grounds: antique map tints (slate, ochre, madder, sage, lavender, teal, rust). */
export const ATLAS_LIGHT = Object.freeze(['#7da6dc', '#bba24e', '#cf8f9c', '#9ec3a3', '#c6b3ee', '#7fd3d6', '#e8a878']);
export const ATLAS_LIGHT_OTHER = '#d9d2c4';
/** Dark ground (Midnight): deep jewel tones under gold text. */
export const ATLAS_DARK = Object.freeze(['#25528a', '#5a4418', '#5b1d2a', '#2c5a34', '#4b3777', '#0f5159', '#7a4216']);
export const ATLAS_DARK_OTHER = '#262b3e';

// ---------------------------------------------------------------------------
// Style token sets

const BASE_FONTS = Object.freeze({
  title: 'cg-500', titleSmall: 'cg-500', subtitle: 'ebg-400i', dedication: 'ebg-400i',
  root: 'ebg-600', nameInner: 'ebg-600', nameOuter: 'ebg-400', dates: 'ebg-400', place: 'ebg-400i',
  legend: 'ebg-400', legendHead: 'cg-600', marker: 'ebg-600', colophon: 'ebg-400i', label: 'cg-600',
});

/**
 * Raw style definitions. Resolve with getStyle(key, mode); don't read these directly.
 * Fields:
 *   ground           page colour
 *   ink / inkSoft / inkPlace / inkFaint   names / dates / places / colophon & quiet text
 *   accent / accent2 ornaments, cartouche rules, collapse markers (gold only here, as rules)
 *   line             wedge line work { color, width, opacity }
 *   faint            empty wedges { color, width, opacity, fill }
 *   gutter           >0: wedges are separated by ground-coloured gaps of this width (Nordic)
 *   fonts            font keys per role
 *   title            { case: 'smallcaps'|'caps'|'italic', tracking (em), weight font }
 *   medallion        { fill, stroke, ring: 'double'|'beaded'|'solid'|'single', name, dates, place }
 *   frame            page frame: 'double'|'thickthin'|'neatline'|'gilt'|'none'
 *   rule             cartouche rules: 'double'|'thickthin'|'single'
 *   fleuron          centre ornament on rules: 'diamond'|'medallion'|'dot'|'star'|'none'
 *   ornaments        { corners (keepsake frame), laurel, compass, graticule }
 *   tones / lines / atlas   fills per colour mode
 */
export const STYLES = Object.freeze({
  ivory: {
    label: 'Ivory',
    note: 'Bone paper, sepia ink and an engraved double rule. Print-safe.',
    dark: false,
    ground: '#f3ede2',
    ink: '#3a2a1a', inkSoft: '#6e5337', inkPlace: '#735a3f', inkFaint: '#8a7155',
    accent: '#6b4e2e', accent2: '#8c6a3f',
    line: { color: '#6b4e2e', width: 0.45, opacity: 0.62 },
    faint: { color: '#6b4e2e', width: 0.35, opacity: 0.26, fill: null },
    gutter: 0,
    fonts: { ...BASE_FONTS },
    title: { case: 'smallcaps', tracking: 0.16 },
    medallion: { fill: '#f8f3ea', stroke: '#6b4e2e', ring: 'double', name: '#3a2a1a', dates: '#6e5337', place: '#735a3f' },
    frame: 'double', rule: 'double', fleuron: 'diamond',
    ornaments: { corners: true, laurel: false, compass: false, graticule: false },
    tones: { pattern: 'rings', a: '#efe6d6', b: '#f3ede2' },
    lines: { pat: ['#dfe3e1', '#e6e8e3'], mat: ['#eedcd0', '#f1e4da'] },
    atlas: { mixToGround: 0.18 },
  },
  midnight: {
    label: 'Midnight Gilt',
    note: 'Midnight ground with gold hairlines and names.',
    paperNote: 'Best on photo or matte poster paper. Dark grounds use a lot of ink.',
    dark: true,
    ground: '#0b1024',
    ink: '#e8cb8a', inkSoft: '#a9b3d6', inkPlace: '#9aa4c8', inkFaint: '#8a93b6',
    accent: '#c9a45c', accent2: '#e0c078',
    line: { color: '#c9a45c', width: 0.45, opacity: 0.5 },
    faint: { color: '#c9a45c', width: 0.35, opacity: 0.2, fill: null },
    gutter: 0,
    fonts: { ...BASE_FONTS, root: 'cg-600', nameInner: 'cg-600' },
    title: { case: 'caps', tracking: 0.2 },
    medallion: { fill: '#080c1c', stroke: '#d8b76c', ring: 'beaded', name: '#eed299', dates: '#a9b3d6', place: '#9aa4c8' },
    frame: 'gilt', rule: 'double', fleuron: 'star',
    ornaments: { corners: true, laurel: false, compass: false, graticule: false },
    tones: { pattern: 'checker', a: '#111a38', b: '#0e1530' },
    lines: { pat: ['#132449', '#172a52'], mat: ['#2a1834', '#2f1c3a'] },
    atlas: { mixToGround: 0.0 },
  },
  botanical: {
    label: 'Botanical',
    note: 'Warm white with olive, ochre and rose tints over an engraved laurel.',
    dark: false,
    ground: '#fbf8f1',
    ink: '#2f3a1d', inkSoft: '#6d5227', inkPlace: '#5f5a3e', inkFaint: '#7b7556',
    accent: '#6f7a45', accent2: '#9a6d35',
    line: { color: '#7d7a4e', width: 0.45, opacity: 0.6 },
    faint: { color: '#7d7a4e', width: 0.35, opacity: 0.25, fill: null },
    gutter: 0,
    fonts: { ...BASE_FONTS, title: 'cg-500i', titleSmall: 'cg-500' },
    title: { case: 'italic', tracking: 0.01 },
    medallion: { fill: '#fdfbf6', stroke: '#6f7a45', ring: 'double', name: '#2f3a1d', dates: '#6d5227', place: '#5f5a3e' },
    frame: 'none', rule: 'single', fleuron: 'medallion',
    ornaments: { corners: false, laurel: true, compass: false, graticule: false },
    tones: { pattern: 'cycle', cycle: ['#edf0e0', '#f6ecda', '#f6e5e0'] },
    lines: { pat: ['#e3e9d2', '#ebefde'], mat: ['#f3dcd6', '#f6e6e1'] },
    atlas: { mixToGround: 0.16 },
  },
  letterpress: {
    label: 'Letterpress',
    note: 'Cream stock, two inks (black and vermilion), bold small-caps title.',
    dark: false,
    ground: '#f4eedc',
    ink: '#1b1a17', inkSoft: '#b23a24', inkPlace: '#3d3a33', inkFaint: '#5e594d',
    accent: '#c8402a', accent2: '#1b1a17',
    line: { color: '#1b1a17', width: 0.5, opacity: 0.78 },
    faint: { color: '#1b1a17', width: 0.35, opacity: 0.22, fill: null },
    gutter: 0,
    fonts: { ...BASE_FONTS, title: 'ebg-600', titleSmall: 'ebg-600', legendHead: 'ebg-600', label: 'ebg-600' },
    title: { case: 'smallcaps', tracking: 0.12 },
    medallion: { fill: '#f7f2e3', stroke: '#1b1a17', ring: 'single', name: '#1b1a17', dates: '#b23a24', place: '#3d3a33' },
    frame: 'thickthin', rule: 'thickthin', fleuron: 'dot',
    ornaments: { corners: false, laurel: false, compass: false, graticule: false },
    tones: { pattern: 'none' },
    lines: { pat: ['#e2dccb', '#e8e2d1'], mat: ['#f1d7c6', '#f3e0d1'] },
    atlas: { mixToGround: 0.2 },
  },
  nordic: {
    label: 'Nordic',
    note: 'White, charcoal and pale blue-grey, set in a sans.',
    dark: false,
    ground: '#ffffff',
    ink: '#2a2f35', inkSoft: '#56616c', inkPlace: '#56616c', inkFaint: '#6b7580',
    accent: '#2a2f35', accent2: '#8796a4',
    line: { color: '#ffffff', width: 1.1, opacity: 1 },
    faint: { color: '#ffffff', width: 1.1, opacity: 1, fill: '#f4f6f8' },
    gutter: 1.1,
    fonts: {
      ...BASE_FONTS, title: 'sans-600', titleSmall: 'sans-400', subtitle: 'sans-400', dedication: 'sans-400',
      root: 'sans-600', nameInner: 'sans-600', nameOuter: 'sans-400', dates: 'sans-400', place: 'sans-400',
      legend: 'sans-400', legendHead: 'sans-600', marker: 'sans-600', colophon: 'sans-400', label: 'sans-600',
    },
    title: { case: 'caps', tracking: 0.18 },
    medallion: { fill: '#2a2f35', stroke: '#2a2f35', ring: 'solid', name: '#ffffff', dates: '#d3dae1', place: '#d3dae1' },
    frame: 'none', rule: 'single', fleuron: 'none',
    ornaments: { corners: false, laurel: false, compass: false, graticule: false },
    tones: { pattern: 'gradient', inner: '#d3dde6', outer: '#edf1f4' },
    lines: { pat: ['#d2dde7', '#dde5ec'], mat: ['#e9e0d6', '#efe8e0'] },
    atlas: { mixToGround: 0.1 },
  },
  cartographer: {
    label: 'Cartographer',
    note: 'Pale map-blue ground, a faint graticule and a compass rose.',
    dark: false,
    ground: '#e3ebee',
    ink: '#1c3140', inkSoft: '#3a5261', inkPlace: '#3a5261', inkFaint: '#4d6473',
    accent: '#3f5663', accent2: '#8a6a3a',
    line: { color: '#3f5663', width: 0.45, opacity: 0.62 },
    faint: { color: '#3f5663', width: 0.35, opacity: 0.24, fill: null },
    gutter: 0,
    fonts: { ...BASE_FONTS, title: 'cg-600' },
    title: { case: 'caps', tracking: 0.22 },
    medallion: { fill: '#f6f3ea', stroke: '#3f5663', ring: 'double', name: '#1c3140', dates: '#3a5261', place: '#3a5261' },
    frame: 'neatline', rule: 'double', fleuron: 'star',
    ornaments: { corners: false, laurel: false, compass: true, graticule: true },
    tones: { pattern: 'checker', a: '#f4f1e8', b: '#eeeadf' },
    lines: { pat: ['#e2ecdc', '#e9f0e3'], mat: ['#f2e5d1', '#f5ebdc'] },
    atlas: { mixToGround: 0.12 },
  },
});

const cache = new Map();

/**
 * Resolved tokens for a style and colour mode.
 * Adds: key, mode, atlasPalette (7), atlasOther, and per-mode text colours
 * (Atlas darkens dates and places so they stay AA on the stronger fills).
 * @param {string} [key='ivory']
 * @param {'tones'|'lines'|'atlas'} [mode='tones']
 * @returns {object}
 */
export function getStyle(key = 'ivory', mode = 'tones') {
  if (!STYLES[key]) throw new Error(`unknown style "${key}" (one of ${STYLE_KEYS.join(', ')})`);
  if (!COLOR_MODES.includes(mode)) throw new Error(`unknown colour mode "${mode}" (one of ${COLOR_MODES.join(', ')})`);
  const ck = key + '/' + mode;
  if (cache.has(ck)) return cache.get(ck);
  const s = STYLES[key];
  const base = s.dark ? ATLAS_DARK : ATLAS_LIGHT;
  const t = s.atlas.mixToGround || 0;
  const atlasPalette = base.map(c => (t ? mix(c, s.ground, t) : c));
  const atlasOther = s.dark ? ATLAS_DARK_OTHER : mix(ATLAS_LIGHT_OTHER, s.ground, t * 0.5);
  const out = {
    ...s,
    key,
    mode,
    atlasPalette,
    atlasOther,
    // In Atlas the fills are stronger: quiet text colours move to the main ink.
    inkSoft: mode === 'atlas' && !s.dark ? mix(s.inkSoft, s.ink, 0.55) : s.inkSoft,
    inkPlace: mode === 'atlas' && !s.dark ? mix(s.inkPlace, s.ink, 0.55) : s.inkPlace,
  };
  if (mode === 'atlas' && s.dark) { out.inkSoft = '#c3cbe6'; out.inkPlace = '#b8c0de'; out.ink = '#f0d69c'; }
  Object.freeze(out);
  cache.set(ck, out);
  return out;
}

/**
 * Fill for one wedge.
 * @param {object} st resolved style (getStyle)
 * @param {{ ring: number, rings: number, index: number, quarter: number, side: 'a'|'b',
 *           atlasColor?: string|null, empty?: boolean }} w
 *   ring 1 = parents; index = position in the ring (0 = leftmost); quarter 0–3 = grandparent line
 *   (0 paternal-paternal … 3 maternal-maternal; -1 on ring 1); side 'a' paternal, 'b' maternal.
 * @returns {string|null} '#rrggbb' or null for no fill (ground shows through)
 */
export function wedgeFill(st, w) {
  if (w.empty) return st.faint.fill || null;
  if (st.mode === 'atlas') {
    if (w.atlasColor === undefined) return null;
    return w.atlasColor || null;
  }
  if (st.mode === 'lines') {
    const set = w.side === 'b' ? st.lines.mat : st.lines.pat;
    const shade = w.quarter < 0 ? set[0] : set[w.quarter % 2];
    const fade = Math.max(0, (w.ring - 2) * 0.05);
    return fade ? mix(shade, st.ground, Math.min(0.35, fade)) : shade;
  }
  const tn = st.tones;
  switch (tn.pattern) {
    case 'rings': return w.ring % 2 ? tn.a : tn.b;
    case 'checker': return (w.ring + w.index) % 2 ? tn.a : tn.b;
    case 'cycle': return tn.cycle[(w.ring - 1) % tn.cycle.length];
    case 'gradient': {
      const n = Math.max(1, (w.rings || 7) - 1);
      return mix(tn.inner, tn.outer, Math.min(1, (w.ring - 1) / n));
    }
    default: return null;
  }
}

/** Every fill a style can put under text in a mode (for contrast checks). */
export function possibleFills(st, rings = 8) {
  const out = new Set([st.ground]);
  if (st.medallion.fill) out.add(st.medallion.fill);
  for (let ring = 1; ring < rings; ring++) {
    for (const index of [0, 1]) {
      for (const quarter of [-1, 0, 1, 2, 3]) {
        for (const side of ['a', 'b']) {
          const f = wedgeFill(st, { ring, rings, index, quarter, side, atlasColor: null });
          if (f) out.add(f);
        }
      }
    }
  }
  if (st.mode === 'atlas') { st.atlasPalette.forEach(c => out.add(c)); out.add(st.atlasOther); }
  if (st.faint.fill) out.add(st.faint.fill);
  return [...out];
}
