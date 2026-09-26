// Node unit tests for the chart foundation (no browser needed).
//   node --test web/test/charts/unit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePath, sectorPath, circlePath, pathBounds, fmt } from '../../src/app/charts/path.js';
import { fonts, loadFonts, measure, metrics, hasGlyphs, fallbackFont, fontFaceName, layoutRun, nodePdfKit } from '../../src/app/charts/fonts-node.mjs';
import {
  setTextBackend, fitText, fitBlock, balancedSplit, arcGlyphs, radialRotation, radialText, smallCapsText,
  glyphOffsets, graphemes, baselineOffset,
} from '../../src/app/charts/text.js';
import { PAPER, SIZE_LIMITS, pageSize, margins, marginPt, resolveOrientation, clampGenerations, sizeFromDimensions, BLEED_PT } from '../../src/app/charts/sizes.js';
import { planTiles, rowLabel } from '../../src/app/charts/tiles.js';
import { planRaster, setJpegDpi } from '../../src/app/charts/raster.js';
import { slugify, exportFilename } from '../../src/app/charts/export.js';
import { sceneToPdf } from '../../src/app/charts/render-pdf.js';

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ''} expected ${b} ± ${eps}, got ${a}`);

await loadFonts();
setTextBackend(fonts);

// ---------------------------------------------------------------- path.js
test('path: arcs become cubics that stay on the circle', () => {
  const cmds = parsePath('M100 50 A50 50 0 0 1 150 100 A50 50 0 1 1 100 50 Z');
  assert.deepEqual(cmds.map(c => c[0]).join(''), 'MCCCCCCCCZ');
  let [px, py] = [100, 50], worst = 0;
  for (const c of cmds) {
    if (c[0] !== 'C') continue;
    for (let t = 0; t <= 1; t += 0.05) {
      const m = 1 - t;
      const x = m * m * m * px + 3 * m * m * t * c[1] + 3 * m * t * t * c[3] + t * t * t * c[5];
      const y = m * m * m * py + 3 * m * m * t * c[2] + 3 * m * t * t * c[4] + t * t * t * c[6];
      worst = Math.max(worst, Math.abs(Math.hypot(x - 100, y - 100) - 50));
    }
    [px, py] = [c[5], c[6]];
  }
  assert.ok(worst < 0.001, `radial error ${worst}`);
});

test('path: SVG corner cases PDFKit gets wrong', () => {
  // zero radius -> straight line (PDFKit drops the segment)
  assert.deepEqual(parsePath('M0 0 A0 0 0 0 1 30 30'), [['M', 0, 0], ['L', 30, 30]]);
  // zero-length arc -> omitted, no NaN
  assert.deepEqual(parsePath('M10 10 A5 5 0 0 1 10 10 L20 20'), [['M', 10, 10], ['L', 20, 20]]);
  // quadratic raised exactly to a cubic (PDFKit emits a wrong 'v')
  const [, q] = parsePath('M0 100 Q50 0 100 100');
  assert.deepEqual(q.map(v => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)), ['C', 33.333, 33.333, 66.667, 33.333, 100, 100]);
  // relative commands, implicit lineto, exponents, compact arc flags, T reflection
  const r = parsePath('m10,10l5-5h1v1 1e1 2.5e0t4 0a5 5 0 0010 10z');
  assert.equal(r[0][0], 'M');
  assert.ok(r.every(c => c.slice(1).every(Number.isFinite)));
  assert.throws(() => parsePath('L0 0'), /must start with M/);
  assert.throws(() => parsePath('M0 0 L1'), /expected number/);
});

test('path: sector helpers', () => {
  const ring = parsePath(sectorPath(0, 0, 50, 100, 0, 360));
  const b = pathBounds(ring);
  near(b.x0, -100, 1e-6); near(b.y1, 100, 1e-6);
  const pie = sectorPath(10, 10, 0, 20, -30, 30);
  assert.match(pie, /L10 10 Z$/);
  assert.equal(fmt(-0.00001), '0');
  assert.equal(fmt(1.23456), '1.235');
  assert.ok(parsePath(circlePath(5, 5, 5)).length > 4);
});

// ---------------------------------------------------------------- fonts
test('fonts: registry, aliases, metrics', () => {
  assert.equal(fontFaceName('ebg-400'), 'gr-ebg-400');
  assert.equal(fontFaceName('sans-400'), 'gr-ebg-400'); // temporary alias until the sans lands
  const m = metrics('ebg-400');
  assert.equal(m.unitsPerEm, 1000);
  assert.ok(m.capHeight > 600 && m.xHeight > 350 && m.descender < 0);
  near(measure('ebg-400', 24, 'Dvořák'), 2 * measure('ebg-400', 12, 'Dvořák'), 1e-9, 'width is linear in size');
  assert.equal(measure('ebg-400', 12, ''), 0);
});

test('fonts: ligatures off, kerning on, old-style figures baked in', () => {
  const fi = layoutRun('ebg-400', 100, 'fi');
  assert.equal(fi.length, 2, 'fi stays two glyphs');
  assert.ok(measure('ebg-400', 100, 'fi') > measure('ebg-400', 100, 'f') + measure('ebg-400', 100, 'i'), 'f–i kern applied');
  const osf = layoutRun('ebg-400', 100, '1819');
  assert.equal(osf.length, 4);
  assert.deepEqual(osf.map(g => g.codePoints[0]), [0x31, 0x38, 0x31, 0x39], 'figures still map back to their digits (PDF ToUnicode)');
  near(measure('ebg-400', 100, '1'), 28.9, 0.05, 'one.osf is proportional');
  near(measure('ebg-400', 100, '0'), 50.7, 0.05, 'zero.osf');
  // Cormorant's default figures are already old-style: untouched
  near(measure('cg-500', 100, '1'), 33.2, 0.05);
});

test('fonts: glyph coverage and title fallback', () => {
  assert.deepEqual(hasGlyphs('ebg-400', 'Dvořák Ødegård Nguyễn Κωνσταντίνος Екатерина'), { ok: true, missing: [] });
  const cjk = hasGlyphs('ebg-400', 'Wang 王秀英');
  assert.equal(cjk.ok, false);
  assert.deepEqual(cjk.missing, ['王', '秀', '英']);
  assert.equal(fallbackFont('cg-500', 'Κωνσταντίνος'), 'ebg-400');
  assert.equal(fallbackFont('cg-500', 'Victoria'), 'cg-500');
});

// ---------------------------------------------------------------- text.js
test('text: fitText walks the ladder, respects 6 pt / 5.5 pt and slack', () => {
  const ladder = ['Johann Georg Friedrich Weber', 'Johann G. Weber', 'J. G. Weber', 'Weber'];
  const wide = fitText(ladder, 400, 'ebg-400', 14);
  assert.equal(wide.str, ladder[0]);
  assert.equal(wide.size, 14);
  const w1 = measure('ebg-400', 1, ladder[0]);
  const narrow = fitText(ladder, w1 * 7, 'ebg-400', 14); // full name fits at 7 × 0.96 = 6.72 -> 6.5
  assert.equal(narrow.index, 0);
  assert.equal(narrow.size, 6.5);
  assert.ok(narrow.width <= w1 * 7 * 0.96 + 1e-9);
  const abbr = fitText(ladder, w1 * 5, 'ebg-400', 14);
  assert.ok(abbr.index > 0 && abbr.size >= 6 && abbr.abbreviated);
  const floor = fitText(['Weber'], measure('ebg-400', 5.6, 'Weber') / 0.96, 'ebg-400', 14);
  assert.equal(floor.size, 5.5);
  assert.equal(floor.belowMin, true);
  assert.equal(fitText(['Weber'], 5, 'ebg-400', 14), null);
});

test('text: balanced two-line split, never hyphenated', () => {
  const s = balancedSplit('Charlotte of Mecklenburg-Strelitz', 'ebg-400', 10);
  assert.deepEqual(s.lines, ['Charlotte of', 'Mecklenburg-Strelitz']);
  assert.deepEqual(balancedSplit('Victoria', 'ebg-400', 10).lines, ['Victoria']);
  const b = fitBlock(['Charlotte of Mecklenburg-Strelitz'], 60, 40, 'ebg-400', 14);
  assert.equal(b.lines.length, 2);
  assert.ok(b.size >= 6);
});

test('text: prefix-width offsets carry kerning', () => {
  const { xs, ws, width, chars } = glyphOffsets('AVAWAY', 'ebg-400', 20);
  assert.equal(chars.length, 6);
  near(xs[0], 0, 1e-9);
  near(xs[5] + ws[5], width, 1e-9);
  const naive = chars.slice(0, 5).reduce((s, c) => s + measure('ebg-400', 20, c), 0);
  assert.ok(Math.abs(xs[5] - naive) > 0.5, 'kerning moves later glyphs');
  assert.deepEqual(graphemes('Nguye\u0302\u0303n'), ['N', 'g', 'u', 'y', 'e\u0302\u0303', 'n']); // decomposed e + circumflex + tilde stays one grapheme
});

test('text: arc glyphs sit on the circle, read left to right, flip on the bottom', () => {
  const cx = 300, cy = 300, r = 120;
  const g = arcGlyphs('Dvořák Ødegård', 'ebg-400', 14, cx, cy, r, 0);
  assert.equal(g.flipped, false);
  for (const q of g) {
    const w = measure('ebg-400', 14, q.ch);
    const a = q.rot * Math.PI / 180;
    near(Math.hypot(q.x + Math.cos(a) * w / 2 - cx, q.y + Math.sin(a) * w / 2 - cy), r, 0.01, 'glyph centre on radius');
  }
  assert.ok(g[0].x < g[g.length - 1].x, 'top text runs left to right');
  const edge = (q, side) => q.rot + side * (measure('ebg-400', 14, q.ch) / 2 / r) * 180 / Math.PI;
  near(edge(g[0], -1) + edge(g[g.length - 1], 1), 0, 0.05, 'centred on 12 o\'clock');
  const b = arcGlyphs('Nguyễn Thị Hoa', 'ebg-400', 14, cx, cy, r, 180);
  assert.equal(b.flipped, true);
  assert.ok(b[0].x < b[b.length - 1].x, 'bottom text still reads left to right');
  assert.ok(b.every(q => Math.abs(q.rot) < 90), 'bottom glyphs upright');
  const mid = arcGlyphs('Ab', 'ebg-400', 20, cx, cy, r, 0, { valign: 'middle' });
  near(mid.baselineRadius, r - baselineOffset(metrics('ebg-400'), 20, 'middle'), 1e-9);
});

test('text: radial text is never upside down', () => {
  for (let a = -180; a <= 180; a += 7.5) {
    const { rot } = radialRotation(a);
    assert.ok(Math.cos(rot * Math.PI / 180) > -1e-9, `angle ${a} -> rot ${rot}`);
  }
  const items = radialText(['Wolff Griffith', '1730–1795'], ['ebg-400', 'ebg-400i'], [9, 7], 0, 0, 200, 60, { color: '#000000' });
  assert.equal(items.length, 2);
  assert.ok(items.every(i => i.t === 'text' && i.baseline === 'middle' && i.anchor === 'middle'));
  const sc = smallCapsText('The Ancestors', 'cg-500', 30, 100, 100, { tracking: 2 });
  assert.deepEqual(sc.map(i => i.str), ['T', 'HE ', 'A', 'NCESTORS']);
  assert.ok(sc[1].size < sc[0].size);
});

// ---------------------------------------------------------------- sizes.js
test('sizes: paper, limits, margins, orientation', () => {
  assert.deepEqual(pageSize('24x36'), { wPt: 1728, hPt: 2592 });
  assert.deepEqual(pageSize('letter', 'landscape'), { wPt: 792, hPt: 612 });
  near(PAPER.a4.w, 595.276, 0.001); near(PAPER.a1.h, 2383.937, 0.001);
  assert.deepEqual(SIZE_LIMITS['11x14'], { fan: 6, bowtie: 5, pedigree: 5 });
  assert.equal(SIZE_LIMITS.a1.fan, 8);
  assert.ok(marginPt(1728, 2592) >= 0.06 * 1728);
  assert.equal(margins(612, 792).w, 612 - 2 * marginPt(612, 792));
  assert.equal(resolveOrientation('fan', 'auto', 180), 'landscape');
  assert.equal(resolveOrientation('fan', 'auto', 270), 'portrait');
  assert.equal(resolveOrientation('pedigree', 'portrait'), 'landscape');
  assert.equal(clampGenerations('letter', 'fan', 9), 6);
  assert.deepEqual(sizeFromDimensions(2592, 1728), { size: '24x36', orientation: 'landscape' });
  assert.equal(BLEED_PT, 9);
});

// ---------------------------------------------------------------- tiles / raster / export
test('tiles: grid covers the poster with 0.25 in overlaps', () => {
  const p = planTiles(1728, 2592, { sheet: 'letter' });
  assert.equal(p.tiles.length, 15);
  assert.equal(p.orientation, 'landscape');
  assert.equal(p.overlap, 18);
  const right = p.tiles[0].x + p.tiles[0].w, nextLeft = p.tiles[1].x;
  near(right - nextLeft, 18, 1e-9, 'horizontal overlap');
  for (let y = 0; y <= 2592; y += 97) for (let x = 0; x <= 1728; x += 89) {
    assert.ok(p.tiles.some(t => x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h), `point ${x},${y} covered`);
  }
  assert.equal(p.tiles[7].label, 'Row C · Column 2');
  assert.equal(rowLabel(26), 'AA');
});

test('raster: dpi rules and the iOS 16.7 MP cap', () => {
  assert.equal(planRaster({ wPt: 1296, hPt: 1728 }, { maxMegapixels: Infinity }).dpi, 200);
  const ios = planRaster({ wPt: 1728, hPt: 2592 }, { maxMegapixels: 16.7 });
  assert.equal(ios.dpi, 139);
  assert.ok(ios.capped && ios.width * ios.height <= 16.7e6);
  const jfif = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]);
  const out = setJpegDpi(jfif, 200);
  assert.deepEqual([...out.subarray(13, 18)], [1, 0, 200, 0, 200]);
});

test('export: filenames', () => {
  assert.equal(slugify('Dvořák Ødegård Þórður Nguyễn Łukasiewicz'), 'dvorak-odegard-thordur-nguyen-lukasiewicz');
  const scene = { wPt: 1728, hPt: 2592, meta: { title: 'The Ancestors of Margaret Kowalski' } };
  assert.equal(exportFilename(scene, 'pdf'), 'gildroot-ancestors-of-margaret-kowalski-24x36.pdf');
  assert.equal(exportFilename(scene, 'tiles', { sheet: 'a4' }), 'gildroot-ancestors-of-margaret-kowalski-24x36-tiled-a4.pdf');
  assert.equal(exportFilename(scene, 'jpeg', { dpi: 150 }), 'gildroot-ancestors-of-margaret-kowalski-24x36-150dpi.jpg');
  assert.equal(exportFilename({ wPt: 100, hPt: 100, meta: {} }, 'share'), 'gildroot-family-tree-share.png');
});

test('render-pdf: Node render of a small scene', async () => {
  const scene = {
    wPt: 300, hPt: 200, bg: '#ffffff', hits: [], meta: { title: 'Test' },
    items: [
      { t: 'path', d: 'M10 10 H290 V190 H10 Z', stroke: '#000000', sw: 0.5 },
      { t: 'text', x: 150, y: 100, str: 'Dvořák 1819', font: 'ebg-400', size: 12, color: '#000000', anchor: 'middle', baseline: 'middle' },
      { t: 'group', clip: 'M0 0 H150 V200 H0 Z', opacity: 0.5, items: [{ t: 'glyphs', font: 'ebg-600', size: 10, color: '#333333', g: [{ ch: 'A', x: 20, y: 40, rot: 10 }, { ch: 'b', x: 28, y: 41, rot: 12 }] }] },
    ],
  };
  const pdf = await sceneToPdf(scene, { fonts, PDFDocument: nodePdfKit() });
  assert.equal(String.fromCharCode(...pdf.subarray(0, 5)), '%PDF-');
  const s = Buffer.from(pdf).toString('latin1');
  assert.match(s, /\/TrimBox \[0 0 300 200\]/);
  assert.match(s, /\/FontFile2/);
  assert.equal(sceneToPdf.lastStats.glyphs, 2);
  await assert.rejects(sceneToPdf({ ...scene, items: [{ t: 'bogus' }] }, { fonts, PDFDocument: nodePdfKit() }), /unknown scene item/);
});
