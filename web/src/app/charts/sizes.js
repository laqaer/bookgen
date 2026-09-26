// Paper sizes, generation limits and margins (company/BRIEF.md §4.4, §4.7).
// All lengths in PDF points (1/72 in). Sizes are stored portrait (w <= h).

const IN = 72;
const MM = 72 / 25.4;

/** Trim sizes, portrait, in points. */
export const PAPER = Object.freeze({
  letter: Object.freeze({ w: 8.5 * IN, h: 11 * IN, label: 'Letter', slug: 'letter', unit: 'in' }),
  a4: Object.freeze({ w: 210 * MM, h: 297 * MM, label: 'A4', slug: 'a4', unit: 'mm' }),
  '11x14': Object.freeze({ w: 11 * IN, h: 14 * IN, label: '11 × 14 in', slug: '11x14', unit: 'in' }),
  '16x20': Object.freeze({ w: 16 * IN, h: 20 * IN, label: '16 × 20 in', slug: '16x20', unit: 'in' }),
  '18x24': Object.freeze({ w: 18 * IN, h: 24 * IN, label: '18 × 24 in', slug: '18x24', unit: 'in' }),
  a2: Object.freeze({ w: 420 * MM, h: 594 * MM, label: 'A2', slug: 'a2', unit: 'mm' }),
  '20x30': Object.freeze({ w: 20 * IN, h: 30 * IN, label: '20 × 30 in', slug: '20x30', unit: 'in' }),
  '24x36': Object.freeze({ w: 24 * IN, h: 36 * IN, label: '24 × 36 in', slug: '24x36', unit: 'in' }),
  a1: Object.freeze({ w: 594 * MM, h: 841 * MM, label: 'A1', slug: 'a1', unit: 'mm' }),
});

/** Size keys in UI order (smallest first). */
export const SIZES = Object.freeze(Object.keys(PAPER));

/** Maximum generations per size and chart (BRIEF §4.4; bowtie is per side). */
export const SIZE_LIMITS = Object.freeze({
  letter: Object.freeze({ fan: 6, bowtie: 4, pedigree: 5 }),
  a4: Object.freeze({ fan: 6, bowtie: 4, pedigree: 5 }),
  '11x14': Object.freeze({ fan: 6, bowtie: 5, pedigree: 5 }),
  '16x20': Object.freeze({ fan: 7, bowtie: 5, pedigree: 6 }),
  '18x24': Object.freeze({ fan: 7, bowtie: 5, pedigree: 6 }),
  a2: Object.freeze({ fan: 7, bowtie: 5, pedigree: 6 }),
  '20x30': Object.freeze({ fan: 8, bowtie: 6, pedigree: 6 }),
  '24x36': Object.freeze({ fan: 8, bowtie: 6, pedigree: 6 }),
  a1: Object.freeze({ fan: 8, bowtie: 6, pedigree: 6 }),
});

/** Minimum generations per chart (BRIEF §4.3: bowtie 3–6 per side, pedigree 4–6). */
export const MIN_GENERATIONS = Object.freeze({ fan: 2, bowtie: 3, pedigree: 4 });

/** Free PDFs: Letter/A4, up to 5 generations (BRIEF §4.5). */
export const FREE_SIZES = Object.freeze(['letter', 'a4']);
export const FREE_MAX_GENERATIONS = 5;

/** Margin: at least 6% of the short edge (BRIEF §4.7 rule 2). */
export const MARGIN_RATIO = 0.06;
/** Print bleed: 0.125 in. */
export const BLEED_PT = 0.125 * IN;
/** Tiled home print overlap: 0.25 in. */
export const TILE_OVERLAP_PT = 0.25 * IN;
/** Hairline range (BRIEF §4.7 rule 3) and the minimum printable stroke. */
export const HAIRLINE_PT = 0.35;
export const MIN_STROKE_PT = 0.35;

/**
 * Page size in points for a size key and orientation.
 * @param {string} size
 * @param {'portrait'|'landscape'} [orientation='portrait']
 * @returns {{ wPt: number, hPt: number }}
 */
export function pageSize(size, orientation = 'portrait') {
  const p = PAPER[size];
  if (!p) throw new Error(`unknown size "${size}"`);
  return orientation === 'landscape' ? { wPt: p.h, hPt: p.w } : { wPt: p.w, hPt: p.h };
}

/**
 * Resolve 'auto' orientation (BRIEF §4.4): 180° fans, bowties and pedigrees are
 * landscape; 270° and 360° fans are portrait unless asked otherwise.
 * @param {'fan'|'bowtie'|'pedigree'} chart
 * @param {'portrait'|'landscape'|'auto'} orientation
 * @param {number} [sweep]
 */
export function resolveOrientation(chart, orientation = 'auto', sweep = 270) {
  if (chart === 'bowtie' || chart === 'pedigree') return 'landscape';
  if (orientation === 'portrait' || orientation === 'landscape') {
    return chart === 'fan' && sweep === 180 ? 'landscape' : orientation;
  }
  return chart === 'fan' && sweep === 180 ? 'landscape' : 'portrait';
}

/**
 * Maximum generations for a size and chart.
 * @param {string} size @param {'fan'|'bowtie'|'pedigree'} chart
 */
export function maxGenerations(size, chart) {
  const lim = SIZE_LIMITS[size];
  if (!lim) throw new Error(`unknown size "${size}"`);
  if (!(chart in lim)) throw new Error(`unknown chart "${chart}"`);
  return lim[chart];
}

/** Clamp a requested generation count to the size limit and chart minimum. */
export function clampGenerations(size, chart, generations) {
  const hi = maxGenerations(size, chart);
  const lo = MIN_GENERATIONS[chart];
  const g = Math.round(Number(generations) || hi);
  return Math.max(lo, Math.min(hi, g));
}

/**
 * Uniform margin in points: 6% of the short edge.
 * @param {number} wPt @param {number} hPt
 */
export function marginPt(wPt, hPt) {
  return Math.ceil(MARGIN_RATIO * Math.min(wPt, hPt) * 100) / 100;
}

/**
 * Margins and the live area inside them.
 * @returns {{ top:number, right:number, bottom:number, left:number, x:number, y:number, w:number, h:number }}
 */
export function margins(wPt, hPt) {
  const m = marginPt(wPt, hPt);
  return { top: m, right: m, bottom: m, left: m, x: m, y: m, w: wPt - 2 * m, h: hPt - 2 * m };
}

/**
 * Find the size key for page dimensions (either orientation), within 1 pt.
 * @returns {{ size: string, orientation: 'portrait'|'landscape' }|null}
 */
export function sizeFromDimensions(wPt, hPt) {
  for (const [key, p] of Object.entries(PAPER)) {
    if (Math.abs(p.w - wPt) < 1 && Math.abs(p.h - hPt) < 1) return { size: key, orientation: 'portrait' };
    if (Math.abs(p.h - wPt) < 1 && Math.abs(p.w - hPt) < 1) return { size: key, orientation: 'landscape' };
  }
  return null;
}

/** True when the free tier may export this size/generation count as PDF. */
export function isFreeExport(size, generations) {
  return FREE_SIZES.includes(size) && generations <= FREE_MAX_GENERATIONS;
}

/** Inches from points, for labels. */
export const ptToIn = pt => pt / IN;
/** Points from inches. */
export const inToPt = inches => inches * IN;
/** Points from millimetres. */
export const mmToPt = mm => mm * MM;
