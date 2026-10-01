// Amazon KDP print geometry, printing cost and royalty for Gildroot Press.
//
// This module implements books/KDP_SPEC.md exactly. Every number below carries
// the source tag used in that spec ([S1] … [S20]); all sources were checked on
// 2026-09-30. If KDP changes a number, change the spec first, then this file,
// then the tests in web/test/books/kdp.test.mjs.
//
// Units are inches and US dollars unless a name says otherwise. Cover
// coordinates use a top-left origin, like CSS and PDF-from-HTML.
//
//   import { kdpGeometry } from './kdp.mjs';
//   const g = kdpGeometry({ trim: '8.5x11', pages: 120, paper: 'white', bleed: true, binding: 'paperback' });
//   g.interiorPageIn   // { w: 8.625, h: 11.25 }
//   g.coverIn          // { w: 17.52024, h: 11.25 }
//   g.royaltyAt(14.99) // 5.95

export const KDP_SPEC_CHECKED = '2026-09-30';

const MM = 1 / 25.4;
const round2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;
const ceil2 = (x) => Math.ceil(x * 100 - 1e-7) / 100;

/** Rules the preflight tooling enforces (books/KDP_SPEC.md §5, §7, §8). */
export const KDP_RULES = Object.freeze({
  bleedIn: 0.125,                  // [S1] trimmed from top, bottom and outside edge
  minFontPt: 7,                    // [S2] interior, [S5] cover
  minLineWidthPt: 0.75,            // [S2] "0.75 point or 0.01 in"
  minGrayFill: 0.10,               // [S2] recommended minimum grayscale fill on B&W
  minImagePpi: 300,                // [S2]
  recommendedMaxImagePpi: 600,     // [S2]
  lowResolutionPpi: 200,           // [S14] "Any image containing less than 200 DPI"
  maxFileMB: 650,                  // [S2]
  recommendedMaxCoverMB: 40,       // [S5]
  maxBlankRunStartOrMiddle: 4,     // [S15] consecutive blank pages
  maxBlankRunEnd: 10,              // [S15]
  spineTextClearanceIn: 0.0625,    // [S2][S5] each side of the spine
  coverTextInsetIn: 0.125,         // [S5] paperback: text at least 0.125 in inside trim
  coverBorderMinIn: 0.25,          // [S5] a border, if used, must be at least 0.25 in inside trim
  barcodeIn: Object.freeze({ w: 2, h: 1.2 }),       // [S12] suggested and auto-placed size
  barcodeMinIn: Object.freeze({ w: 1.4, h: 0.8 }),  // [S12]
  barcodeClearanceIn: 0.25,        // [S12] from spine and trim
  maxTitleSubtitleChars: 200,      // [S16] "200 characters or less"
  maxDescriptionChars: 4000,       // [S17] counts HTML tags
  keywordSlots: 7,                 // [S18]
  keywordSlotChars: 50,            // UI limit, secondary sources only (spec §13)
  categories: 3,                   // [S19]
  newTitlesPerFormatPerWeek: 2,    // [S2][S20]
  proofCopiesPerOrder: 5,          // [S21]
  authorCopiesPerOrder: 999,       // [S21]
});

// ---------------------------------------------------------------------------
// Trim sizes and page-count limits (kdp.amazon.com). [S1][S2][S3]
// Columns: [white, cream, groundwood, standard color, premium color]; null = not offered.

const PB_A = [[24, 828], [24, 776], [24, 812], [72, 600], [24, 828]];
const PB_B = [[24, 800], [24, 750], [24, 784], [72, 600], [24, 800]];
const PB_C = [[24, 590], [24, 550], [24, 578], [72, 600], [24, 590]];
const PB_A4 = [[24, 780], [24, 730], [24, 764], null, [24, 590]];
const HC = [[75, 550], [75, 550], null, null, [75, 550]];

const PAPERBACK_TRIMS = {
  '5x8': PB_A, '5.06x7.81': PB_A, '5.25x8': PB_A, '5.5x8.5': PB_A, '6x9': PB_A,
  '6.14x9.21': PB_A, '6.69x9.61': PB_A, '7x10': PB_A, '7.44x9.69': PB_A, '7.5x9.25': PB_A, '8x10': PB_A,
  '8.25x6': PB_B, '8.25x8.25': PB_B,
  '8.5x8.5': PB_C, '8.5x11': PB_C,
  '8.27x11.69': PB_A4,
};
const HARDCOVER_TRIMS = { '5.5x8.5': HC, '6x9': HC, '6.14x9.21': HC, '7x10': HC, '8.25x11': HC };

/** Custom paperback trims must fall inside these bounds (inches). [S3] */
export const CUSTOM_PAPERBACK_TRIM = Object.freeze({ minW: 4, maxW: 8.5, minH: 6, maxH: 11.69 });

export const TRIMS = Object.freeze({
  paperback: Object.freeze(Object.keys(PAPERBACK_TRIMS)),
  hardcover: Object.freeze(Object.keys(HARDCOVER_TRIMS)),
});

// ---------------------------------------------------------------------------
// Paper and ink. [S2][S3][S5]

const STOCKS = {
  // col: column in the page-count tables; perPage: spine inches per page; ink: implied ink.
  white: { col: 0, perPage: 0.002252, ink: 'black' },
  cream: { col: 1, perPage: 0.0025, ink: 'black' },
  groundwood: { col: 2, perPage: 0.00235, ink: 'black' },
  'standard-color': { col: 3, perPage: 0.002252, ink: 'standard-color' },
  'premium-color': { col: 4, perPage: 0.002347, ink: 'premium-color' },
};

// Hardcover case geometry, from KDP's cover calculator on 2026-09-30 (spec §7.2). [S6][S7]
export const HARDCOVER_CASE = Object.freeze({
  boardExtraWIn: 5 * MM,   // front/back board = trim width + 5 mm
  boardExtraHIn: 6 * MM,   // board height = trim height + 6 mm
  wrapIn: 15 * MM,         // 0.591 in on every outside edge
  hingeIn: 10 * MM,        // 0.394 in on each board next to the spine
  spineExtraIn: 4.8 * MM,  // spine = pages x per-page factor + 4.8 mm
  marginIn: 0.125,         // keep text this far inside the board edges
  barcodeFromHingeIn: 0.25,          // [S6][S7]
  barcodeFromBoardBottomIn: 0.375,   // [S6] calculator "Barcode Margin"
  barcodeFromCoverBottomIn: 0.76,    // [S7] "from the bottom of the cover"; we apply it from the
                                     // board edge, the stricter reading (spec §8)
});

// ---------------------------------------------------------------------------
// US printing cost, Amazon.com. [S8][S9]
// Each entry: fixedOnlyMaxPages (inclusive) and fixed-only cost, then fixed + per-page above it,
// as [regular, large].

const US_COST = {
  paperback: {
    black: { upTo: 110, flat: [2.30, 2.84], fixed: [1.00, 1.00], perPage: [0.012, 0.017] },
    groundwood: { upTo: 112, flat: [2.23, 2.75], fixed: [1.00, 1.00], perPage: [0.0114, 0.0162] },
    'premium-color': { upTo: 40, flat: [3.60, 4.20], fixed: [1.00, 1.00], perPage: [0.065, 0.08] },
    'standard-color': { upTo: 0, flat: [null, null], fixed: [1.00, 1.00], perPage: [0.0255, 0.0402] },
  },
  hardcover: {
    black: { upTo: 108, flat: [6.80, 7.49], fixed: [5.65, 5.65], perPage: [0.012, 0.017] },
    'premium-color': { upTo: 0, flat: [null, null], fixed: [5.65, 5.65], perPage: [0.065, 0.080] },
  },
};

// Amazon.com royalty rates. [S10][S11]
export const US_ROYALTY = Object.freeze({
  lowRate: 0.50, lowRateMaxPrice: 9.98,
  highRate: 0.60, highRateMinPrice: 9.99,
  expandedRate: 0.40,          // paperback only [S10][S13]
  maxListPrice: 250,           // [S8][S9]
});

export class KdpSpecError extends Error {
  constructor(message) { super(message); this.name = 'KdpSpecError'; }
}

// ---------------------------------------------------------------------------

function parseTrim(trim) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*$/i.exec(String(trim));
  if (!m) throw new KdpSpecError(`Trim "${trim}" is not in the form "WxH" (inches), e.g. "8.5x11".`);
  const w = Number(m[1]); const h = Number(m[2]);
  return { key: `${w}x${h}`, w, h };
}

/** A trim is "large" if it is more than 6.12 in wide or more than 9 in tall. [S1][S8] */
export function isLargeTrim(wIn, hIn) {
  return wIn > 6.12 || hIn > 9;
}

/** KDP counts pages from the file and rounds up to an even number. [S2][S15] */
export function billedPageCount(pages) {
  if (!Number.isInteger(pages) || pages < 1) throw new KdpSpecError(`Page count must be a positive integer, got ${pages}.`);
  return pages % 2 ? pages + 1 : pages;
}

/** Minimum inside (gutter) margin for a page count. [S1][S2] */
export function insideMarginIn(billedPages) {
  if (billedPages <= 150) return 0.375;
  if (billedPages <= 300) return 0.5;
  if (billedPages <= 500) return 0.625;
  if (billedPages <= 700) return 0.75;
  if (billedPages <= 828) return 0.875;
  throw new KdpSpecError(`No KDP margin bracket for ${billedPages} pages (maximum 828).`);
}

/**
 * US (Amazon.com) printing cost for one copy, rounded to the cent.
 * Implements "fixed cost + (page count x per page cost)". Pass the billed page count.
 */
export function usPrintCost({ binding, ink, paper, large, pages }) {
  const table = US_COST[binding];
  if (!table) throw new KdpSpecError(`Unknown binding "${binding}".`);
  const key = ink === 'black' ? (paper === 'groundwood' ? 'groundwood' : 'black') : ink;
  const row = table[key];
  if (!row) throw new KdpSpecError(`No US printing cost for ${binding} with ${ink} ink on ${paper} paper.`);
  const i = large ? 1 : 0;
  if (pages <= row.upTo) return row.flat[i];
  return round2(row.fixed[i] + pages * row.perPage[i]);
}

/** Royalty rate on Amazon.com for a list price. [S10][S11] */
export function usRoyaltyRate(priceUsd) {
  return priceUsd >= US_ROYALTY.highRateMinPrice ? US_ROYALTY.highRate : US_ROYALTY.lowRate;
}

/** (royalty rate x list price) - printing cost, rounded to the cent. [S10][S11] */
export function usRoyalty(priceUsd, printCostUsd, { channel = 'amazon' } = {}) {
  const rate = channel === 'expanded' ? US_ROYALTY.expandedRate : usRoyaltyRate(priceUsd);
  return round2(rate * priceUsd - printCostUsd);
}

/**
 * Lowest Amazon.com list price KDP accepts: printing cost / royalty rate, where the rate
 * is the one that applies at the resulting price. [S8][S9] Rounded up to the cent so the
 * royalty is never negative.
 */
export function usMinListPrice(printCostUsd, { channel = 'amazon' } = {}) {
  if (channel === 'expanded') return ceil2(printCostUsd / US_ROYALTY.expandedRate);
  const at50 = ceil2(printCostUsd / US_ROYALTY.lowRate);
  if (at50 <= US_ROYALTY.lowRateMaxPrice) return at50;
  return Math.max(US_ROYALTY.highRateMinPrice, ceil2(printCostUsd / US_ROYALTY.highRate));
}

const box = (x, y, w, h) => ({ x, y, w, h });
// Shrink (or, with negative insets, grow) a box. A side that would go negative collapses to
// a zero-width line at the panel's center, as KDP's calculator reports a 0 in safe area on a
// 24-page spine.
const inset = (b, l, t, r, bt) => {
  const w = b.w - l - r; const h = b.h - t - bt;
  return box(w >= 0 ? b.x + l : b.x + b.w / 2, h >= 0 ? b.y + t : b.y + b.h / 2, Math.max(0, w), Math.max(0, h));
};

/**
 * Everything a Gildroot Press book needs to lay out its interior and cover for KDP.
 *
 * @param {object} o
 * @param {string} o.trim     "WxH" in inches, e.g. "8.5x11" (paperback) or "8.25x11" (hardcover)
 * @param {number} o.pages    interior PDF page count (KDP bills the next even number)
 * @param {'white'|'cream'|'groundwood'|'standard-color'|'premium-color'} [o.paper='white']
 * @param {boolean} [o.bleed=true]
 * @param {'paperback'|'hardcover'} [o.binding='paperback']
 * @param {boolean} [o.customTrim=false] allow a paperback trim that is not on KDP's list
 */
export function kdpGeometry({ trim, pages, paper = 'white', bleed = true, binding = 'paperback', customTrim = false } = {}) {
  if (binding !== 'paperback' && binding !== 'hardcover') {
    throw new KdpSpecError(`Binding must be "paperback" or "hardcover", got "${binding}".`);
  }
  const stock = STOCKS[paper];
  if (!stock) throw new KdpSpecError(`Paper must be one of ${Object.keys(STOCKS).join(', ')}; got "${paper}".`);
  const t = parseTrim(trim);
  const warnings = [];

  // Trim and page-count limits.
  const table = binding === 'paperback' ? PAPERBACK_TRIMS : HARDCOVER_TRIMS;
  let limits = table[t.key];
  if (!limits) {
    if (binding === 'hardcover') {
      throw new KdpSpecError(`Hardcover trim ${t.key} is not offered. Hardcover trims: ${TRIMS.hardcover.join(', ')}.`);
    }
    const c = CUSTOM_PAPERBACK_TRIM;
    if (!customTrim) {
      throw new KdpSpecError(`Paperback trim ${t.key} is not a standard KDP trim. Pass customTrim: true to use a custom trim (${c.minW}-${c.maxW} x ${c.minH}-${c.maxH} in).`);
    }
    if (t.w < c.minW || t.w > c.maxW || t.h < c.minH || t.h > c.maxH) {
      throw new KdpSpecError(`Custom paperback trim ${t.key} is outside ${c.minW}-${c.maxW} x ${c.minH}-${c.maxH} in.`);
    }
    limits = PB_C; // most restrictive published row; KDP publishes no limits for custom trims
    warnings.push('Custom trim: KDP publishes no page-count limits for custom trims; the 8.5x11 limits were applied. No custom trim is marked eligible in KDP\'s Expanded Distribution chart.');
  }
  const range = limits[stock.col];
  if (!range) {
    const what = stock.ink === 'black' ? `${paper} paper` : `${stock.ink} ink`;
    throw new KdpSpecError(`${binding} ${t.key} is not offered with ${what}.`);
  }
  const billed = billedPageCount(pages);
  if (billed < range[0] || billed > range[1]) {
    throw new KdpSpecError(`${binding} ${t.key} on ${paper} takes ${range[0]}-${range[1]} pages; this book has ${pages} (billed as ${billed}).`);
  }
  const large = isLargeTrim(t.w, t.h);

  // Interior. [S1][S2]
  const B = KDP_RULES.bleedIn;
  const interiorPageIn = bleed ? { w: t.w + B, h: t.h + 2 * B } : { w: t.w, h: t.h };
  const edge = bleed ? 0.375 : 0.25;
  const marginsIn = { inside: insideMarginIn(billed), outside: edge, top: edge, bottom: edge };
  // Where the trim sits on a given PDF page (1-based). Odd pages are right-hand pages [S2], so
  // their outside (bleed) edge is on the right; even pages bleed on the left.
  const trimBoxIn = (pageNumber) => {
    if (!bleed) return box(0, 0, t.w, t.h);
    return box(pageNumber % 2 === 1 ? 0 : B, B, t.w, t.h);
  };

  // Spine and cover. [S2][S5][S6][S7]
  let spineIn; let cover;
  if (binding === 'paperback') {
    spineIn = billed * stock.perPage;
    const W = 2 * B + 2 * t.w + spineIn; const H = t.h + 2 * B;
    const back = box(B, B, t.w, t.h);
    const spine = box(B + t.w, B, spineIn, t.h);
    const front = box(B + t.w + spineIn, B, t.w, t.h);
    const s = KDP_RULES.coverTextInsetIn; const sp = KDP_RULES.spineTextClearanceIn;
    const bc = KDP_RULES.barcodeIn; const bcc = KDP_RULES.barcodeClearanceIn;
    const barcode = box(back.x + back.w - bcc - bc.w, back.y + back.h - bcc - bc.h, bc.w, bc.h);
    cover = {
      widthIn: W, heightIn: H, bleedIn: B, wrapIn: 0, hingeIn: 0,
      panels: { back, spine, front },
      safe: { back: inset(back, s, s, s, s), spine: inset(spine, sp, s, sp, s), front: inset(front, s, s, s, s) },
      barcode, barcodeKeepOut: inset(barcode, -0.125, -0.125, -0.125, -0.125),
    };
  } else {
    const k = HARDCOVER_CASE;
    spineIn = billed * stock.perPage + k.spineExtraIn;
    const bw = t.w + k.boardExtraWIn; const bh = t.h + k.boardExtraHIn;
    const W = 2 * k.wrapIn + 2 * bw + spineIn; const H = bh + 2 * k.wrapIn;
    const back = box(k.wrapIn, k.wrapIn, bw, bh);
    const spine = box(k.wrapIn + bw, k.wrapIn, spineIn, bh);
    const front = box(k.wrapIn + bw + spineIn, k.wrapIn, bw, bh);
    const m = k.marginIn; const sp = KDP_RULES.spineTextClearanceIn;
    const bc = KDP_RULES.barcodeIn;
    // Our own barcode (if ever supplied) sits where both readings of KDP's rule are met.
    const fromBottom = Math.max(k.barcodeFromBoardBottomIn, k.barcodeFromCoverBottomIn);
    const barcode = box(back.x + back.w - k.hingeIn - k.barcodeFromHingeIn - bc.w, back.y + back.h - fromBottom - bc.h, bc.w, bc.h);
    // The keep-out covers KDP's own placement anywhere from 0.375 in to 0.76 in above the board
    // bottom, plus 0.125 in all round.
    const koTop = barcode.y - 0.125;
    const koBottom = back.y + back.h - k.barcodeFromBoardBottomIn + 0.125;
    const barcodeKeepOut = box(barcode.x - 0.125, koTop, bc.w + 0.25, koBottom - koTop);
    cover = {
      widthIn: W, heightIn: H, bleedIn: 0, wrapIn: k.wrapIn, hingeIn: k.hingeIn,
      boardIn: { w: bw, h: bh },
      panels: { back, spine, front },
      safe: { back: inset(back, m, m, k.hingeIn, m), spine: inset(spine, sp, m, sp, m), front: inset(front, k.hingeIn, m, m, m) },
      hinges: { back: box(back.x + back.w - k.hingeIn, 0, k.hingeIn, H), front: box(front.x, 0, k.hingeIn, H) },
      barcode, barcodeKeepOut,
    };
  }

  // Spine text: paperback needs at least 79 pages ("more than 79" elsewhere); with even
  // page counts both mean 80 or more. KDP publishes no minimum for hardcover. [S2][S5][S15]
  const spineTextAllowed = binding === 'hardcover' ? true : billed >= 80;

  // Money (Amazon.com). [S8][S9][S10][S11]
  const printCostUsd = usPrintCost({ binding, ink: stock.ink, paper, large, pages: billed });
  const minListPriceUsd = usMinListPrice(printCostUsd);
  const expandedAllowed = binding === 'paperback';
  const royaltyAt = (priceUsd, { channel = 'amazon' } = {}) => {
    if (typeof priceUsd !== 'number' || !Number.isFinite(priceUsd)) throw new KdpSpecError(`Price must be a number, got ${priceUsd}.`);
    if (channel === 'expanded' && !expandedAllowed) throw new KdpSpecError('Hardcovers are not eligible for Expanded Distribution.');
    const min = usMinListPrice(printCostUsd, { channel });
    if (priceUsd < min) throw new KdpSpecError(`$${priceUsd.toFixed(2)} is below the minimum list price of $${min.toFixed(2)}.`);
    if (priceUsd > US_ROYALTY.maxListPrice) throw new KdpSpecError(`$${priceUsd.toFixed(2)} is above the $${US_ROYALTY.maxListPrice} maximum list price.`);
    return usRoyalty(priceUsd, printCostUsd, { channel });
  };

  return {
    binding, paper, ink: stock.ink, bleed,
    trimIn: { w: t.w, h: t.h }, largeTrim: large,
    pages, billedPages: billed, pageRange: { min: range[0], max: range[1] },
    interiorPageIn, marginsIn, trimBoxIn,
    spineIn, spineTextAllowed,
    coverIn: { w: cover.widthIn, h: cover.heightIn }, cover,
    printCostUsd, minListPriceUsd, maxListPriceUsd: US_ROYALTY.maxListPrice,
    royaltyRateAt: usRoyaltyRate, royaltyAt,
    expandedDistribution: expandedAllowed ? { minListPriceUsd: usMinListPrice(printCostUsd, { channel: 'expanded' }) } : null,
    warnings,
  };
}
