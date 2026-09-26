// UI-facing export wrappers: run a renderer, name the file, trigger the download.
//
//   const { filename } = await exportPdf(scene, { size: '24x36', bleed: true });
//   -> "gildroot-ancestors-of-margaret-kowalski-24x36.pdf" downloaded
//
// Every wrapper returns { blob, filename, ... } and downloads unless
// { download: false } is passed (tests, share sheets, previews).

import { sceneToPdf } from './render-pdf.js';
import { sceneToTiles } from './tiles.js';
import { sceneToJpeg, shareImage } from './raster.js';
import { PAPER, BLEED_PT, sizeFromDimensions } from './sizes.js';

const FOLD = { ø: 'o', Ø: 'O', æ: 'ae', Æ: 'AE', œ: 'oe', Œ: 'OE', ß: 'ss', ł: 'l', Ł: 'L', đ: 'd', Đ: 'D', ð: 'd', Ð: 'D', þ: 'th', Þ: 'Th', ı: 'i', ħ: 'h', ŋ: 'ng' };

/**
 * ASCII slug for filenames: "Dvořák Ødegård" -> "dvorak-odegard".
 * Non-Latin names keep their letters (browsers accept Unicode filenames).
 * @param {string} str
 * @param {number} [max=60]
 */
export function slugify(str, max = 60) {
  let s = String(str ?? '').replace(/[øØæÆœŒßłŁđĐðÐþÞıħŋ]/g, c => FOLD[c]);
  s = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  s = s.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
  if (s.length > max) {
    const cut = s.slice(0, max);
    s = cut.includes('-') ? cut.slice(0, cut.lastIndexOf('-')) : cut;
  }
  return s;
}

/** Size slug ("24x36", "a4") from options or from the scene's page size. */
export function sizeSlug(scene, size) {
  if (size && PAPER[size]) return PAPER[size].slug;
  const found = sizeFromDimensions(scene.wPt, scene.hPt);
  if (found) return PAPER[found.size].slug;
  return `${Math.round(scene.wPt / 72 * 10) / 10}x${Math.round(scene.hPt / 72 * 10) / 10}in`.replace(/\./g, '_');
}

/**
 * Good filenames: "gildroot-ancestors-of-margaret-kowalski-24x36.pdf".
 * @param {object} scene
 * @param {'pdf'|'tiles'|'jpeg'|'share'} kind
 * @param {{ size?: string, sheet?: string, dpi?: number }} [opts]
 */
export function exportFilename(scene, kind, opts = {}) {
  const title = ((scene.meta && scene.meta.title) || '').replace(/^\s*the\s+/i, '');
  const base = 'gildroot-' + (slugify(title) || 'family-tree');
  const size = sizeSlug(scene, opts.size);
  switch (kind) {
    case 'pdf': return `${base}-${size}.pdf`;
    case 'tiles': return `${base}-${size}-tiled-${opts.sheet || 'letter'}.pdf`;
    case 'jpeg': return `${base}-${size}${opts.dpi ? `-${opts.dpi}dpi` : ''}.jpg`;
    case 'share': return `${base}-share.png`;
    default: throw new Error(`unknown export kind "${kind}"`);
  }
}

/**
 * Save a Blob through a temporary <a download> link.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  // Safari needs the URL alive for a moment after the click
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 30000);
}

/**
 * Vector PDF at trim size; with bleed, 0.125 in bleed and crop marks.
 * @param {object} scene
 * @param {{ size?: string, bleed?: boolean, cropMarks?: boolean, download?: boolean }} [opts]
 * @returns {Promise<{ blob: Blob, filename: string, bytes: Uint8Array }>}
 */
export async function exportPdf(scene, opts = {}) {
  const bleed = !!opts.bleed;
  const bytes = await sceneToPdf(scene, { bleedPt: bleed ? BLEED_PT : 0, cropMarks: opts.cropMarks ?? bleed });
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const filename = exportFilename(scene, 'pdf', opts);
  if (opts.download !== false) downloadBlob(blob, filename);
  return { blob, filename, bytes };
}

/**
 * Tiled home print on Letter or A4 sheets.
 * @param {object} scene
 * @param {{ size?: string, sheet?: 'letter'|'a4', overlapIn?: number, download?: boolean }} [opts]
 * @returns {Promise<{ blob: Blob, filename: string, bytes: Uint8Array, pages: number }>}
 */
export async function exportTiles(scene, opts = {}) {
  const sheet = opts.sheet || 'letter';
  const bytes = await sceneToTiles(scene, { sheet, overlapIn: opts.overlapIn ?? 0.25 });
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const filename = exportFilename(scene, 'tiles', { ...opts, sheet });
  if (opts.download !== false) downloadBlob(blob, filename);
  return { blob, filename, bytes, pages: (sceneToTiles.lastPlan?.tiles.length ?? 0) + 1 };
}

/**
 * JPEG for photo counters (see raster.js for dpi rules and the iOS cap).
 * @param {object} scene
 * @param {{ size?: string, dpi?: number, maxMegapixels?: number, download?: boolean }} [opts]
 */
export async function exportJpeg(scene, opts = {}) {
  const r = await sceneToJpeg(scene, opts);
  const filename = exportFilename(scene, 'jpeg', { ...opts, dpi: r.dpi });
  if (opts.download !== false) downloadBlob(r.blob, filename);
  return { ...r, filename };
}

/**
 * 1080×1350 share PNG.
 * @param {object} scene
 * @param {{ mark?: boolean, download?: boolean }} [opts]
 */
export async function exportShareImage(scene, opts = {}) {
  const blob = await shareImage(scene, { mark: opts.mark !== false });
  const filename = exportFilename(scene, 'share', opts);
  if (opts.download !== false) downloadBlob(blob, filename);
  return { blob, filename };
}
