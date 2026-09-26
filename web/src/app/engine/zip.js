// .zip and .gdz (GEDZIP, GEDCOM 7) input: find the GEDCOM inside and return its bytes.
// Uses the vendored fflate. Pure JS, no DOM.

import { unzipSync, gunzipSync } from '../../vendor/fflate.module.js';

/** True for a ZIP local-file / empty-archive / spanned signature ("PK\x03\x04", "PK\x05\x06", "PK\x07\x08"). */
export function isZip(u8) {
  return !!u8 && u8.length >= 4 && u8[0] === 0x50 && u8[1] === 0x4B && (u8[2] === 3 || u8[2] === 5 || u8[2] === 7);
}

/** True for gzip data. */
export function isGzip(u8) {
  return !!u8 && u8.length >= 2 && u8[0] === 0x1F && u8[1] === 0x8B;
}

function skip(name) {
  const base = name.split('/').pop();
  return /(^|\/)__MACOSX\//.test(name) || base.startsWith('._') || name.endsWith('/');
}

/**
 * List the files in a zip without inflating them.
 * @param {Uint8Array} u8
 * @returns {{ name: string, size: number, originalSize: number }[]}
 */
export function listArchive(u8) {
  const entries = [];
  unzipSync(u8, { filter: f => { entries.push({ name: f.name, size: f.size, originalSize: f.originalSize }); return false; } });
  return entries;
}

/**
 * Extract the GEDCOM from a .zip or .gdz archive (gzip is also accepted).
 * GEDZIP puts the tree in "gedcom.ged" at the archive root; otherwise the largest .ged wins.
 * Bytes that are not an archive are returned unchanged.
 * @param {Uint8Array|ArrayBuffer} input
 * @returns {Uint8Array}
 * @throws {Error} when the archive holds no .ged file or cannot be read
 */
export function extractGedcom(input) {
  const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (isGzip(u8)) {
    try { return gunzipSync(u8); } catch { throw new Error('This compressed file could not be opened.'); }
  }
  if (!isZip(u8)) return u8;
  let entries;
  try { entries = listArchive(u8); } catch { throw new Error('This .zip file could not be opened. It may be damaged.'); }
  const geds = entries.filter(e => !skip(e.name) && /\.ged(com)?$/i.test(e.name));
  if (!geds.length) throw new Error('There is no .ged file inside this archive.');
  const pick = geds.find(e => e.name.toLowerCase() === 'gedcom.ged') || geds.slice().sort((a, b) => b.originalSize - a.originalSize)[0];
  let files;
  try { files = unzipSync(u8, { filter: f => f.name === pick.name }); } catch { throw new Error('This .zip file could not be opened. It may be damaged.'); }
  const out = files[pick.name];
  if (!out) throw new Error('There is no .ged file inside this archive.');
  return out;
}
