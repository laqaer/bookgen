// Unit tests for tools/books/kdp.mjs against the numbers in books/KDP_SPEC.md.
// Run: node --test web/test/books/
//
// The "calculator" fixtures were read from KDP's cover calculator
// (https://kdp.amazon.com/en_US/cover-calculator) on 2026-09-30. It prints inches to
// three decimals, so geometry is compared to within 0.0006 in.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  kdpGeometry, KdpSpecError, KDP_RULES, TRIMS, isLargeTrim, billedPageCount, insideMarginIn,
  usPrintCost, usRoyalty, usMinListPrice, usRoyaltyRate,
} from '../../../tools/books/kdp.mjs';

const near = (actual, expected, tol = 0.0006, msg = '') =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg} expected ${expected} ± ${tol}, got ${actual}`);

// ---------------------------------------------------------------------------
// Trim sizes and interior page size

test('interior page size with bleed matches KDP\'s published table for every US trim', () => {
  // [S1] "Examples of page size with and without bleed (kdp.amazon.com)". KDP lists
  // 5.5x8.5 as 5.626 wide; the formula (trim width + 0.125) gives 5.625, which we use.
  const table = {
    '5x8': [5.125, 8.25], '5.06x7.81': [5.185, 8.06], '5.25x8': [5.375, 8.25], '5.5x8.5': [5.625, 8.75],
    '6x9': [6.125, 9.25], '6.14x9.21': [6.265, 9.46], '6.69x9.61': [6.815, 9.86], '7x10': [7.125, 10.25],
    '7.44x9.69': [7.565, 9.94], '7.5x9.25': [7.625, 9.5], '8x10': [8.125, 10.25], '8.5x11': [8.625, 11.25],
    '8.25x6': [8.375, 6.25], '8.25x8.25': [8.375, 8.5], '8.27x11.69': [8.395, 11.94], '8.5x8.5': [8.625, 8.75],
  };
  for (const [trim, [w, h]] of Object.entries(table)) {
    const g = kdpGeometry({ trim, pages: 100, bleed: true });
    near(g.interiorPageIn.w, w, 1e-9, `${trim} width`);
    near(g.interiorPageIn.h, h, 1e-9, `${trim} height`);
  }
  const hc = kdpGeometry({ trim: '8.25x11', pages: 100, bleed: true, binding: 'hardcover' });
  assert.deepEqual(hc.interiorPageIn, { w: 8.375, h: 11.25 });
});

test('trim box sits on the spine side of the page, with bleed on the outside edge', () => {
  const g = kdpGeometry({ trim: '8.5x11', pages: 120, bleed: true });
  assert.deepEqual(g.trimBoxIn(1), { x: 0, y: 0.125, w: 8.5, h: 11 });     // right-hand page
  assert.deepEqual(g.trimBoxIn(2), { x: 0.125, y: 0.125, w: 8.5, h: 11 }); // left-hand page
  const n = kdpGeometry({ trim: '8.5x11', pages: 120, bleed: false });
  assert.deepEqual(n.trimBoxIn(2), { x: 0, y: 0, w: 8.5, h: 11 });
});

test('interior page size without bleed is the trim size', () => {
  for (const trim of ['6x9', '7x10', '8x10', '8.5x11']) {
    const g = kdpGeometry({ trim, pages: 120, bleed: false });
    assert.deepEqual(g.interiorPageIn, g.trimIn);
  }
});

test('hardcover and paperback trim lists match KDP', () => {
  assert.deepEqual([...TRIMS.hardcover], ['5.5x8.5', '6x9', '6.14x9.21', '7x10', '8.25x11']);
  assert.equal(TRIMS.paperback.length, 16);
  assert.ok(TRIMS.paperback.includes('8.5x11'));
  assert.ok(!TRIMS.paperback.includes('8.25x11'));
  assert.ok(!TRIMS.hardcover.includes('8.5x11'));
});

test('large trim is more than 6.12 in wide or more than 9 in tall', () => {
  assert.equal(isLargeTrim(6, 9), false);
  assert.equal(isLargeTrim(5.5, 8.5), false);
  assert.equal(isLargeTrim(6.14, 9.21), true);
  assert.equal(isLargeTrim(8.25, 6), true);
  assert.equal(isLargeTrim(7, 10), true);
  assert.equal(kdpGeometry({ trim: '8.5x11', pages: 100 }).largeTrim, true);
});

// ---------------------------------------------------------------------------
// Page counts and margins

test('page counts round up to an even number', () => {
  assert.equal(billedPageCount(24), 24);
  assert.equal(billedPageCount(79), 80);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 75, binding: 'hardcover' }).billedPages, 76);
});

test('inside margin follows the page-count brackets', () => {
  const cases = [[24, 0.375], [150, 0.375], [152, 0.5], [300, 0.5], [302, 0.625], [500, 0.625], [502, 0.75], [700, 0.75], [702, 0.875], [828, 0.875]];
  for (const [pages, inside] of cases) assert.equal(insideMarginIn(pages), inside, `${pages} pages`);
  // 151 pages is billed as 152, which falls in the 151-300 bracket.
  assert.equal(kdpGeometry({ trim: '6x9', pages: 151 }).marginsIn.inside, 0.5);
  assert.throws(() => insideMarginIn(830), KdpSpecError);
});

test('outside, top and bottom margins are 0.25 in without bleed and 0.375 in with bleed', () => {
  assert.deepEqual(kdpGeometry({ trim: '8.5x11', pages: 120, bleed: false }).marginsIn, { inside: 0.375, outside: 0.25, top: 0.25, bottom: 0.25 });
  assert.deepEqual(kdpGeometry({ trim: '8.5x11', pages: 200, bleed: true }).marginsIn, { inside: 0.5, outside: 0.375, top: 0.375, bottom: 0.375 });
});

test('page-count limits are enforced per trim, paper and binding', () => {
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 22 }), KdpSpecError);
  assert.ok(kdpGeometry({ trim: '6x9', pages: 24 }));
  assert.ok(kdpGeometry({ trim: '6x9', pages: 828 }));
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 830 }), KdpSpecError);
  assert.ok(kdpGeometry({ trim: '8.5x11', pages: 590 }));
  assert.throws(() => kdpGeometry({ trim: '8.5x11', pages: 592 }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: '8.5x11', pages: 552, paper: 'cream' }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: '8.5x11', pages: 70, paper: 'standard-color' }), KdpSpecError);
  assert.ok(kdpGeometry({ trim: '8.5x11', pages: 72, paper: 'standard-color' }));
  assert.throws(() => kdpGeometry({ trim: '8.27x11.69', pages: 100, paper: 'standard-color' }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 72, binding: 'hardcover' }), KdpSpecError);
  assert.ok(kdpGeometry({ trim: '6x9', pages: 550, binding: 'hardcover' }));
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 552, binding: 'hardcover' }), KdpSpecError);
});

test('hardcover rejects paperback-only trims, groundwood and standard color', () => {
  assert.throws(() => kdpGeometry({ trim: '8.5x11', pages: 120, binding: 'hardcover' }), /Hardcover trim 8.5x11 is not offered/);
  assert.throws(() => kdpGeometry({ trim: '8x10', pages: 120, binding: 'hardcover' }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 120, binding: 'hardcover', paper: 'groundwood' }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 120, binding: 'hardcover', paper: 'standard-color' }), KdpSpecError);
  assert.ok(kdpGeometry({ trim: '6x9', pages: 120, binding: 'hardcover', paper: 'premium-color' }));
});

test('custom paperback trims need an explicit opt-in and stay within 4-8.5 x 6-11.69 in', () => {
  assert.throws(() => kdpGeometry({ trim: '8.25x11', pages: 120 }), /not a standard KDP trim/);
  const g = kdpGeometry({ trim: '8.25x11', pages: 120, customTrim: true });
  assert.equal(g.warnings.length, 1);
  assert.deepEqual(g.pageRange, { min: 24, max: 590 });
  assert.throws(() => kdpGeometry({ trim: '9x12', pages: 120, customTrim: true }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: 'letter', pages: 120 }), KdpSpecError);
});

test('bad options fail loudly', () => {
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 120, binding: 'spiral' }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 120, paper: 'ivory' }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 0 }), KdpSpecError);
  assert.throws(() => kdpGeometry({ trim: '6x9', pages: 12.5 }), KdpSpecError);
});

// ---------------------------------------------------------------------------
// Spine and cover, checked against KDP's cover calculator

test('paperback spine and full cover match the KDP cover calculator', () => {
  // [trim, paper, pages, spine, cover w, cover h]
  const calc = [
    ['6x9', 'white', 200, 0.45, 12.7, 9.25],
    ['6x9', 'white', 120, 0.27, 12.52, 9.25],
    ['8.5x11', 'white', 200, 0.45, 17.7, 11.25],
    ['6x9', 'white', 24, 0.054, 12.304, 9.25],
    ['6x9', 'white', 78, 0.176, 12.426, 9.25],
    ['6x9', 'white', 80, 0.18, 12.43, 9.25],
    ['7x10', 'white', 200, 0.45, 14.7, 10.25],
    ['8x10', 'white', 200, 0.45, 16.7, 10.25],
    ['8.5x11', 'white', 120, 0.27, 17.52, 11.25],
    ['8.5x11', 'cream', 120, 0.3, 17.55, 11.25],
    ['8.5x11', 'groundwood', 120, 0.282, 17.532, 11.25],
    ['8.5x11', 'standard-color', 120, 0.27, 17.52, 11.25],
    ['8.5x11', 'premium-color', 120, 0.282, 17.532, 11.25],
  ];
  for (const [trim, paper, pages, spine, w, h] of calc) {
    const g = kdpGeometry({ trim, paper, pages });
    const tag = `${trim} ${paper} ${pages}p`;
    near(g.spineIn, spine, 0.0006, `${tag} spine`);
    near(g.coverIn.w, w, 0.0006, `${tag} cover width`);
    near(g.coverIn.h, h, 0.0006, `${tag} cover height`);
  }
});

test('paperback spine uses the published per-page factors', () => {
  near(kdpGeometry({ trim: '6x9', pages: 100, paper: 'white' }).spineIn, 0.2252, 1e-12);
  near(kdpGeometry({ trim: '6x9', pages: 100, paper: 'cream' }).spineIn, 0.25, 1e-12);
  near(kdpGeometry({ trim: '6x9', pages: 100, paper: 'groundwood' }).spineIn, 0.235, 1e-12);
  near(kdpGeometry({ trim: '6x9', pages: 100, paper: 'premium-color' }).spineIn, 0.2347, 1e-12);
  near(kdpGeometry({ trim: '6x9', pages: 100, paper: 'standard-color' }).spineIn, 0.2252, 1e-12);
});

test('hardcover spine and case match the KDP cover calculator across page counts', () => {
  // 6x9, white paper: [pages, spine, cover width]; cover height is 10.417 throughout.
  const white = [[76, 0.36, 13.935], [80, 0.369, 13.944], [100, 0.414, 13.989], [110, 0.437, 14.011],
    [120, 0.459, 14.034], [122, 0.464, 14.039], [150, 0.527, 14.102], [200, 0.639, 14.214], [250, 0.752, 14.327],
    [300, 0.865, 14.439], [350, 0.977, 14.552], [400, 1.09, 14.665], [450, 1.202, 14.777], [500, 1.315, 14.89], [550, 1.428, 15.002]];
  for (const [pages, spine, w] of white) {
    const g = kdpGeometry({ trim: '6x9', pages, binding: 'hardcover' });
    near(g.spineIn, spine, 0.0006, `${pages}p spine`);
    near(g.coverIn.w, w, 0.0006, `${pages}p width`);
    near(g.coverIn.h, 10.417, 0.0006, `${pages}p height`);
  }
  const cream = [[76, 0.379, 13.954], [200, 0.689, 14.264], [550, 1.564, 15.139]];
  for (const [pages, spine, w] of cream) {
    const g = kdpGeometry({ trim: '6x9', pages, paper: 'cream', binding: 'hardcover' });
    near(g.spineIn, spine, 0.0006, `cream ${pages}p spine`);
    near(g.coverIn.w, w, 0.0006, `cream ${pages}p width`);
  }
  for (const [trim, w] of [['8.25x11', 18.534], ['7x10', 16.034]]) {
    const g = kdpGeometry({ trim, pages: 120, binding: 'hardcover' });
    near(g.spineIn, 0.459, 0.0006, `${trim} 120p spine`);
    near(g.coverIn.w, w, 0.0006, `${trim} 120p width`);
  }
  const color = kdpGeometry({ trim: '8.25x11', pages: 200, paper: 'premium-color', binding: 'hardcover' });
  near(color.spineIn, 0.658, 0.0006, 'premium color spine');
  near(color.coverIn.w, 18.733, 0.0006, 'premium color width');
});

test('hardcover boards, wrap and hinge match the KDP cover calculator for every trim', () => {
  // [trim, cover w, cover h, board w, board h] at 200 pages, white paper.
  const calc = [
    ['5.5x8.5', 13.214, 9.917, 5.697, 8.736],
    ['6x9', 14.214, 10.417, 6.197, 9.236],
    ['6.14x9.21', 14.494, 10.627, 6.337, 9.446],
    ['7x10', 16.214, 11.417, 7.197, 10.236],
    ['8.25x11', 18.714, 12.417, 8.447, 11.236],
  ];
  for (const [trim, w, h, bw, bh] of calc) {
    const g = kdpGeometry({ trim, pages: 200, binding: 'hardcover' });
    near(g.coverIn.w, w, 0.0006, `${trim} width`);
    near(g.coverIn.h, h, 0.0006, `${trim} height`);
    near(g.cover.boardIn.w, bw, 0.0006, `${trim} board width`);
    near(g.cover.boardIn.h, bh, 0.0006, `${trim} board height`);
    near(g.cover.wrapIn, 0.591, 0.0006, 'wrap');
    near(g.cover.hingeIn, 0.394, 0.0006, 'hinge');
  }
});

test('cover panels tile the cover and the barcode sits inside the back panel', () => {
  for (const opts of [
    { trim: '6x9', pages: 120 }, { trim: '8.5x11', pages: 200 }, { trim: '8x10', pages: 24 },
    { trim: '6x9', pages: 120, binding: 'hardcover' }, { trim: '8.25x11', pages: 550, binding: 'hardcover' },
  ]) {
    const g = kdpGeometry(opts);
    const { back, spine, front } = g.cover.panels;
    const edge = g.cover.bleedIn + g.cover.wrapIn;
    near(back.x, edge, 1e-9);
    near(back.x + back.w, spine.x, 1e-9);
    near(spine.x + spine.w, front.x, 1e-9);
    near(front.x + front.w + edge, g.coverIn.w, 1e-9);
    near(back.y + back.h + edge, g.coverIn.h, 1e-9);
    const bc = g.cover.barcode;
    assert.deepEqual([bc.w, bc.h], [2, 1.2]);
    const ko = g.cover.barcodeKeepOut;
    assert.ok(ko.x >= back.x && ko.x + ko.w <= spine.x - g.cover.hingeIn, `${opts.trim} keep-out clear of spine and hinge`);
    assert.ok(ko.y + ko.h <= back.y + back.h, `${opts.trim} keep-out above the bottom edge`);
    for (const k of ['back', 'spine', 'front']) {
      const s = g.cover.safe[k]; const p = g.cover.panels[k];
      assert.ok(s.x >= p.x && s.y >= p.y && s.x + s.w <= p.x + p.w + 1e-9 && s.y + s.h <= p.y + p.h + 1e-9, `${k} safe area inside panel`);
    }
  }
  const pb = kdpGeometry({ trim: '6x9', pages: 120 });
  // Paperback barcode: 0.25 in from the spine fold and from the bottom trim line.
  near(pb.cover.panels.spine.x - (pb.cover.barcode.x + 2), 0.25, 1e-9);
  near(pb.cover.panels.back.y + 9 - (pb.cover.barcode.y + 1.2), 0.25, 1e-9);
  // Hardcover barcode: 0.25 in from the hinge and at least 0.76 in above the board bottom
  // (which is also at least 0.76 in above the bottom of the cover file).
  const hc = kdpGeometry({ trim: '6x9', pages: 120, binding: 'hardcover' });
  const hb = hc.cover.panels.back;
  near(hb.x + hb.w - hc.cover.hingeIn - (hc.cover.barcode.x + 2), 0.25, 1e-9);
  near(hb.y + hb.h - (hc.cover.barcode.y + 1.2), 0.76, 1e-9);
  // The keep-out also covers the calculator's position, 0.375 in above the board bottom.
  const ko = hc.cover.barcodeKeepOut;
  assert.ok(ko.y + ko.h >= hb.y + hb.h - 0.375 + 0.125 - 1e-9);
  assert.ok(ko.y <= hb.y + hb.h - 0.76 - 1.2 - 0.125 + 1e-9);
});

test('spine text needs 80 billed pages on a paperback; hardcover has no published minimum', () => {
  assert.equal(kdpGeometry({ trim: '6x9', pages: 78 }).spineTextAllowed, false);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 79 }).spineTextAllowed, true);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 80 }).spineTextAllowed, true);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 76, binding: 'hardcover' }).spineTextAllowed, true);
});

// ---------------------------------------------------------------------------
// Printing cost and royalty (Amazon.com)

test('US printing cost reproduces KDP\'s own worked examples', () => {
  // [S8] 300-page black-ink regular-trim paperback: 1.00 + 300 x 0.012 = 4.60
  assert.equal(usPrintCost({ binding: 'paperback', ink: 'black', paper: 'white', large: false, pages: 300 }), 4.60);
  // [S10] 333-page regular paperback costs 5.00 (4.996 rounded to the cent)
  assert.equal(usPrintCost({ binding: 'paperback', ink: 'black', paper: 'white', large: false, pages: 333 }), 5.00);
  // [S9] 300-page regular hardcover: 5.65 + 300 x 0.012 = 9.25
  assert.equal(usPrintCost({ binding: 'hardcover', ink: 'black', paper: 'white', large: false, pages: 300 }), 9.25);
  // [S10] ($15 x 0.60) - $5.00 = $4.00; Expanded Distribution (0.40 x $15) - $5.00 = $1.00
  assert.equal(usRoyalty(15, 5.00), 4.00);
  assert.equal(usRoyalty(15, 5.00, { channel: 'expanded' }), 1.00);
});

test('worked examples in the spec: 120 and 200 pages, black ink, white paper', () => {
  const rows = [
    // [binding, trim, pages, printCost, minListPrice]
    ['paperback', '6x9', 120, 2.44, 4.88],
    ['paperback', '6x9', 200, 3.40, 6.80],
    ['paperback', '8.5x11', 120, 3.04, 6.08],
    ['paperback', '8.5x11', 200, 4.40, 8.80],
    ['hardcover', '6x9', 120, 7.09, 11.82],
    ['hardcover', '6x9', 200, 8.05, 13.42],
    ['hardcover', '8.25x11', 120, 7.69, 12.82],
    ['hardcover', '8.25x11', 200, 9.05, 15.09],
  ];
  for (const [binding, trim, pages, cost, min] of rows) {
    const g = kdpGeometry({ trim, pages, binding });
    assert.equal(g.printCostUsd, cost, `${binding} ${trim} ${pages}p cost`);
    assert.equal(g.minListPriceUsd, min, `${binding} ${trim} ${pages}p minimum list price`);
  }
  const pb = kdpGeometry({ trim: '8.5x11', pages: 120 });
  assert.equal(pb.royaltyAt(14.99), 5.95);
  assert.equal(pb.royaltyAt(24.99), 11.95);
  assert.equal(pb.royaltyAt(9.98), 1.95);
  assert.equal(pb.royaltyAt(9.99), 2.95);
  assert.equal(pb.royaltyAt(24.99, { channel: 'expanded' }), 6.96);
  const hc = kdpGeometry({ trim: '8.25x11', pages: 200, binding: 'hardcover' });
  assert.equal(hc.royaltyAt(39.99), 14.94);
  assert.equal(hc.royaltyAt(29.99), 8.94);
});

test('fixed-cost bands end at 110 (paperback) and 108 (hardcover) pages', () => {
  assert.equal(kdpGeometry({ trim: '6x9', pages: 110 }).printCostUsd, 2.30);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 112 }).printCostUsd, 2.34);
  assert.equal(kdpGeometry({ trim: '8.5x11', pages: 110 }).printCostUsd, 2.84);
  assert.equal(kdpGeometry({ trim: '8.5x11', pages: 112 }).printCostUsd, 2.90);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 108, binding: 'hardcover' }).printCostUsd, 6.80);
  assert.equal(kdpGeometry({ trim: '7x10', pages: 108, binding: 'hardcover' }).printCostUsd, 7.49);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 110, binding: 'hardcover' }).printCostUsd, 6.97);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 112, paper: 'groundwood' }).printCostUsd, 2.23);
  assert.equal(kdpGeometry({ trim: '6x9', pages: 114, paper: 'groundwood' }).printCostUsd, 2.30);
  assert.equal(kdpGeometry({ trim: '8.5x11', pages: 40, paper: 'premium-color' }).printCostUsd, 4.20);
  assert.equal(kdpGeometry({ trim: '8.5x11', pages: 42, paper: 'premium-color' }).printCostUsd, 4.36);
  assert.equal(kdpGeometry({ trim: '8.5x11', pages: 100, paper: 'standard-color' }).printCostUsd, 5.02);
  assert.equal(kdpGeometry({ trim: '8.25x11', pages: 100, paper: 'premium-color', binding: 'hardcover' }).printCostUsd, 13.65);
});

test('royalty rate switches from 50% to 60% at $9.99', () => {
  assert.equal(usRoyaltyRate(9.98), 0.5);
  assert.equal(usRoyaltyRate(9.99), 0.6);
  assert.equal(usMinListPrice(4.99), 9.98);
  assert.equal(usMinListPrice(5.00), 9.99);
  assert.equal(usMinListPrice(9.05), 15.09);
  assert.equal(usMinListPrice(3.04, { channel: 'expanded' }), 7.60);
});

test('royaltyAt refuses prices KDP would not accept', () => {
  const g = kdpGeometry({ trim: '8.25x11', pages: 200, binding: 'hardcover' });
  assert.throws(() => g.royaltyAt(14.99), /below the minimum list price/);
  assert.throws(() => g.royaltyAt(250.01), /maximum list price/);
  assert.throws(() => g.royaltyAt(29.99, { channel: 'expanded' }), /Expanded Distribution/);
  assert.equal(g.expandedDistribution, null);
  assert.equal(g.royaltyAt(250), 140.95);
});

test('the rules table carries the spec\'s preflight numbers', () => {
  assert.equal(KDP_RULES.bleedIn, 0.125);
  assert.equal(KDP_RULES.minFontPt, 7);
  assert.equal(KDP_RULES.minLineWidthPt, 0.75);
  assert.equal(KDP_RULES.minImagePpi, 300);
  assert.equal(KDP_RULES.maxBlankRunStartOrMiddle, 4);
  assert.equal(KDP_RULES.maxBlankRunEnd, 10);
  assert.equal(KDP_RULES.categories, 3);
  assert.equal(KDP_RULES.keywordSlots, 7);
  assert.equal(KDP_RULES.newTitlesPerFormatPerWeek, 2);
  assert.ok(Object.isFrozen(KDP_RULES));
});
