// Tiled home print: a poster Scene split across Letter or A4 sheets.
//
// Page 1 is an assembly map (the chart outline with the sheet grid, labels and
// instructions). Every following page holds one tile: the Scene clipped to the
// printable area, crop marks at the tile corners, ticks where the 0.25 in overlap
// with the neighbouring sheet begins, and a label such as "Row B · Column 3".
// Tiles are drawn with the same SceneWriter as the full PDF, culled to the items
// that touch the tile so the file stays close to one copy of the chart.

import { SceneWriter, sceneFontKeys, loadSceneImages, collectPdf } from './render-pdf.js';
import { fonts as defaultFonts, ensurePdfKit } from './fonts.js';
import { PAPER, TILE_OVERLAP_PT, sizeFromDimensions, ptToIn } from './sizes.js';
import { rectPath, fmt } from './path.js';

const IN = 72;
const LABEL_FONT = 'ebg-400';
const LABEL_BOLD = 'ebg-600';
const INK = '#222222';
const GUIDE = '#8a8a8a';

/** Row label: A…Z, then AA, AB… */
export function rowLabel(i) {
  let s = '';
  i += 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

/**
 * Work out the sheet grid.
 * @param {number} wPt poster width
 * @param {number} hPt poster height
 * @param {{ sheet?: 'letter'|'a4', overlapIn?: number, marginIn?: number }} [opts]
 * @returns {{ sheetW:number, sheetH:number, orientation:'portrait'|'landscape', margin:number, areaW:number, areaH:number,
 *            overlap:number, cols:number, rows:number, originX:number, originY:number, tiles: {row:number,col:number,x:number,y:number,w:number,h:number,label:string,code:string}[] }}
 */
export function planTiles(wPt, hPt, opts = {}) {
  const paper = PAPER[opts.sheet || 'letter'];
  if (!paper) throw new Error(`tiles: unknown sheet "${opts.sheet}"`);
  const overlap = (opts.overlapIn ?? TILE_OVERLAP_PT / IN) * IN;
  const margin = (opts.marginIn ?? 0.5) * IN;
  const plans = ['portrait', 'landscape'].map(orientation => {
    const sheetW = orientation === 'portrait' ? paper.w : paper.h;
    const sheetH = orientation === 'portrait' ? paper.h : paper.w;
    const areaW = sheetW - 2 * margin, areaH = sheetH - 2 * margin;
    const stepX = areaW - overlap, stepY = areaH - overlap;
    const cols = wPt <= areaW ? 1 : Math.ceil((wPt - areaW) / stepX - 1e-9) + 1;
    const rows = hPt <= areaH ? 1 : Math.ceil((hPt - areaH) / stepY - 1e-9) + 1;
    return { orientation, sheetW, sheetH, areaW, areaH, stepX, stepY, cols, rows };
  });
  plans.sort((a, b) => a.cols * a.rows - b.cols * b.rows || (a.orientation === 'portrait' ? -1 : 1));
  const p = plans[0];
  // centre the grid on the poster so the spare paper is shared by both edges
  const coveredW = (p.cols - 1) * p.stepX + p.areaW, coveredH = (p.rows - 1) * p.stepY + p.areaH;
  const originX = -(coveredW - wPt) / 2, originY = -(coveredH - hPt) / 2;
  const tiles = [];
  for (let r = 0; r < p.rows; r++) {
    for (let c = 0; c < p.cols; c++) {
      tiles.push({
        row: r, col: c,
        x: originX + c * p.stepX, y: originY + r * p.stepY, w: p.areaW, h: p.areaH,
        label: `Row ${rowLabel(r)} · Column ${c + 1}`, code: `${rowLabel(r)}${c + 1}`,
      });
    }
  }
  return { ...p, margin, overlap, originX, originY, tiles };
}

function t(x, y, str, size, opts = {}) {
  return { t: 'text', x, y, str, font: opts.font || LABEL_FONT, size, color: opts.color || INK, anchor: opts.anchor || 'start', ...(opts.baseline ? { baseline: opts.baseline } : {}) };
}

function posterName(scene) {
  const s = sizeFromDimensions(scene.wPt, scene.hPt);
  if (s) return PAPER[s.size].label;
  return `${ptToIn(scene.wPt).toFixed(1)} × ${ptToIn(scene.hPt).toFixed(1)} in`;
}

/**
 * Split a Scene into printable tiles.
 * @param {object} scene
 * @param {{ sheet?: 'letter'|'a4', overlapIn?: number, marginIn?: number, fonts?: object, PDFDocument?: any,
 *           loadImage?: (src: string) => Promise<Uint8Array>, compress?: boolean }} [opts]
 * @returns {Promise<Uint8Array>} multi-page PDF
 */
export async function sceneToTiles(scene, opts = {}) {
  const fonts = opts.fonts || defaultFonts;
  const PDFDocument = opts.PDFDocument || await ensurePdfKit();
  const sheet = opts.sheet || 'letter';
  const plan = planTiles(scene.wPt, scene.hPt, opts);
  await fonts.loadFonts([...new Set([...sceneFontKeys(scene), LABEL_FONT, LABEL_BOLD])]);
  const images = await loadSceneImages(scene, opts.loadImage);
  const meta = scene.meta || {};
  const doc = new PDFDocument({
    size: [plan.sheetW, plan.sheetH], margin: 0, autoFirstPage: false, font: null, compress: opts.compress ?? true,
    pdfVersion: '1.7', displayTitle: true, lang: 'en',
    info: { Title: `${meta.title || 'Family tree chart'} (tiled print)`, Creator: 'Gildroot (gildroot.com)' },
  });
  const done = collectPdf(doc);
  const w = new SceneWriter(doc, { fonts, images });
  const sheetName = PAPER[sheet].label;
  const n = plan.tiles.length;

  // ---- page 1: assembly map
  doc.addPage({ size: [plan.sheetW, plan.sheetH], margin: 0 });
  w.beginPage();
  const M = plan.margin;
  const head = [
    t(M, M + 14, 'Assembly map', 18, { font: LABEL_BOLD }),
    t(M, M + 34, `${meta.title || 'Your chart'}: a ${posterName(scene)} poster on ${n} ${sheetName} sheets (${plan.orientation}), ${plan.rows} ${plan.rows === 1 ? 'row' : 'rows'} × ${plan.cols} ${plan.cols === 1 ? 'column' : 'columns'}.`, 10),
    t(M, M + 50, 'Print every page at 100% ("Actual size"). Do not choose "Fit to page".', 10),
    t(M, M + 64, 'Cut each sheet along its crop marks. Neighboring sheets share 1/4 in of the picture: the small ticks show', 10),
    t(M, M + 78, 'where that overlap starts. Lay each sheet over its neighbor so the picture lines up, then tape from behind.', 10),
    t(M, M + 92, 'Work row by row, starting with Row A · Column 1 at the top left.', 10),
  ];
  w.items(head);
  const boxX = M, boxY = M + 110, boxW = plan.sheetW - 2 * M, boxH = plan.sheetH - boxY - M - 14;
  const gridW = plan.cols * plan.stepX + plan.overlap, gridH = plan.rows * plan.stepY + plan.overlap;
  const minX = Math.min(0, plan.originX), minY = Math.min(0, plan.originY);
  const spanW = Math.max(scene.wPt, plan.originX + gridW) - minX, spanH = Math.max(scene.hPt, plan.originY + gridH) - minY;
  const k = Math.min(boxW / spanW, boxH / spanH);
  const ox = boxX + (boxW - spanW * k) / 2 - minX * k, oy = boxY + (boxH - spanH * k) / 2 - minY * k;
  // chart outline (shapes only: text would be far below printable size here)
  w.push();
  doc.transform(k, 0, 0, k, ox, oy);
  w.push();
  doc.rect(0, 0, scene.wPt, scene.hPt).clip();
  w.background(scene, 0);
  w.items(scene.items, 1, { skipText: true });
  w.pop();
  w.pop();
  // grid
  const grid = [];
  for (const tile of plan.tiles) {
    const x = ox + tile.x * k, y = oy + tile.y * k, tw = tile.w * k, th = tile.h * k;
    grid.push({ t: 'path', d: rectPath(x, y, tw, th), stroke: '#b3261e', sw: 0.75 });
    grid.push({ t: 'path', d: rectPath(x + tw / 2 - 11, y + th / 2 - 8, 22, 16, 3), fill: '#ffffff', stroke: '#b3261e', sw: 0.5, opacity: 0.92 });
    grid.push(t(x + tw / 2, y + th / 2, tile.code, 9, { anchor: 'middle', baseline: 'middle', color: '#b3261e', font: LABEL_BOLD }));
  }
  grid.push({ t: 'path', d: rectPath(ox, oy, scene.wPt * k, scene.hPt * k), stroke: INK, sw: 0.5 });
  w.items(grid);
  w.items([t(M, plan.sheetH - M + 14, `Page 1 of ${n + 1} · Made with Gildroot · gildroot.com`, 8, { color: GUIDE })]);

  // ---- tile pages
  plan.tiles.forEach((tile, idx) => {
    doc.addPage({ size: [plan.sheetW, plan.sheetH], margin: 0 });
    w.beginPage();
    const ax = M, ay = M;
    w.push();
    doc.rect(ax, ay, tile.w, tile.h).clip();
    doc.translate(ax - tile.x, ay - tile.y);
    // background only where the poster is
    w.push();
    doc.rect(0, 0, scene.wPt, scene.hPt).clip();
    w.background(scene, 0);
    w.items(scene.items, 1, { cull: { x0: tile.x, y0: tile.y, x1: tile.x + tile.w, y1: tile.y + tile.h } });
    w.pop();
    w.pop();
    // crop marks at the printable-area corners
    const marks = [];
    const gap = 3, len = Math.min(18, M - 10);
    for (const [cx, sx] of [[ax, -1], [ax + tile.w, 1]]) {
      for (const [cy, sy] of [[ay, -1], [ay + tile.h, 1]]) {
        marks.push(`M${fmt(cx + sx * gap)} ${fmt(cy)} L${fmt(cx + sx * (gap + len))} ${fmt(cy)}`);
        marks.push(`M${fmt(cx)} ${fmt(cy + sy * gap)} L${fmt(cx)} ${fmt(cy + sy * (gap + len))}`);
      }
    }
    // overlap ticks: where the neighbour's picture begins
    const ticks = [];
    const tl = 7;
    const seg = (x1, y1, x2, y2) => `M${fmt(x1)} ${fmt(y1)} L${fmt(x2)} ${fmt(y2)}`;
    const vTicks = x => ticks.push(seg(x, ay - gap, x, ay - gap - tl), seg(x, ay + tile.h + gap, x, ay + tile.h + gap + tl));
    const hTicks = y => ticks.push(seg(ax - gap, y, ax - gap - tl, y), seg(ax + tile.w + gap, y, ax + tile.w + gap + tl, y));
    if (tile.col > 0) vTicks(ax + plan.overlap);
    if (tile.col < plan.cols - 1) vTicks(ax + tile.w - plan.overlap);
    if (tile.row > 0) hTicks(ay + plan.overlap);
    if (tile.row < plan.rows - 1) hTicks(ay + tile.h - plan.overlap);
    const deco = [
      { t: 'path', d: marks.join(' '), stroke: '#000000', sw: 0.3 },
      ...(ticks.length ? [{ t: 'path', d: ticks.join(' '), stroke: GUIDE, sw: 0.5 }] : []),
      t(ax + tile.w / 2, plan.sheetH - M / 2 + 3, tile.label, 10, { anchor: 'middle', font: LABEL_BOLD }),
      t(ax, plan.sheetH - M / 2 + 3, `Sheet ${idx + 1} of ${n}`, 8, { color: GUIDE }),
      t(ax + tile.w, plan.sheetH - M / 2 + 3, `${posterName(scene)} · print at 100%`, 8, { color: GUIDE, anchor: 'end' }),
      t(ax + tile.w / 2, M / 2 + 3, tile.code, 8, { anchor: 'middle', color: GUIDE }),
    ];
    w.items(deco);
  });

  doc.end();
  const bytes = await done;
  sceneToTiles.lastPlan = plan;
  return bytes;
}
