// Load-time font patching ("baking") shared by the browser and Node registries.
//
// Canvas 2D cannot switch OpenType features (no font-feature-settings, no way to
// turn ligatures off), while PDFKit/fontkit can. To make screen and paper match
// exactly, we bake the typographic choices into the font bytes once, then give
// the SAME patched bytes to FontFace (canvas) and to PDFKit (PDF + measurement):
//
//   * cmap overrides: e.g. digits -> old-style figure glyphs (EB Garamond ships
//     zero.osf … nine.osf without an onum feature). Both shapers then pick the
//     same glyphs with no feature switch at all.
//   * feature renames: e.g. 'liga' -> 'ligz', which disables standard ligatures
//     in HarfBuzz (canvas) and fontkit (PDF) alike. Rename keeps the table size,
//     so it is patched in place.
//
// The result is a valid sfnt: rebuilt cmap (format 4 + format 12 when needed),
// fresh table checksums and head.checkSumAdjustment. Chrome's OTS sanitizer and
// fontkit both accept it (verified by web/test/charts/scene-smoke.mjs).

const u16 = (dv, o) => dv.getUint16(o);
const u32 = (dv, o) => dv.getUint32(o);
const tagAt = (dv, o) => String.fromCharCode(dv.getUint8(o), dv.getUint8(o + 1), dv.getUint8(o + 2), dv.getUint8(o + 3));

/**
 * Read the sfnt table directory.
 * @param {Uint8Array} bytes
 */
export function readTables(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sfntVersion = u32(dv, 0);
  const numTables = u16(dv, 4);
  const tables = new Map();
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = tagAt(dv, rec);
    const offset = u32(dv, rec + 8), length = u32(dv, rec + 12);
    tables.set(tag, bytes.subarray(offset, offset + length));
  }
  return { sfntVersion, tables };
}

/**
 * Parse the best Unicode cmap subtable into a Map<codePoint, glyphId>.
 * Supports formats 4 and 12 (all our static TTFs use these).
 * @param {Uint8Array} cmap
 */
export function readCmap(cmap) {
  const dv = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength);
  const n = u16(dv, 2);
  let best = null, bestScore = -1;
  const keep = []; // subtables we copy verbatim (format 14 variation sequences)
  for (let i = 0; i < n; i++) {
    const pid = u16(dv, 4 + i * 8), eid = u16(dv, 6 + i * 8), off = u32(dv, 8 + i * 8);
    const format = u16(dv, off);
    if (format === 14) { keep.push({ pid, eid, off }); continue; }
    let score = -1;
    if (format === 12 && ((pid === 3 && eid === 10) || (pid === 0 && (eid === 4 || eid === 6)))) score = 3;
    else if (format === 4 && ((pid === 3 && eid === 1) || pid === 0)) score = 2;
    if (score > bestScore) { best = { off, format }; bestScore = score; }
  }
  if (!best) throw new Error('font has no Unicode cmap (format 4 or 12)');
  const map = new Map();
  const o = best.off;
  if (best.format === 4) {
    const segX2 = u16(dv, o + 6);
    const endO = o + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      const end = u16(dv, endO + s * 2), start = u16(dv, startO + s * 2);
      const delta = dv.getInt16(deltaO + s * 2), range = u16(dv, rangeO + s * 2);
      for (let c = start; c <= end && c !== 0xffff; c++) {
        let g;
        if (range === 0) g = (c + delta) & 0xffff;
        else {
          const gi = rangeO + s * 2 + range + (c - start) * 2;
          g = u16(dv, gi);
          if (g !== 0) g = (g + delta) & 0xffff;
        }
        if (g !== 0) map.set(c, g);
      }
    }
  } else {
    const groups = u32(dv, o + 12);
    for (let k = 0; k < groups; k++) {
      const go = o + 16 + k * 12;
      const start = u32(dv, go), end = u32(dv, go + 4), g0 = u32(dv, go + 8);
      for (let c = start; c <= end; c++) map.set(c, g0 + (c - start));
    }
  }
  const variation = keep.map(k => ({ pid: k.pid, eid: k.eid, bytes: cmap.subarray(k.off, k.off + u32(dv, k.off + 2)) }));
  return { map, variation };
}

function buildFormat4(entries) {
  // entries: sorted [cp, gid] with cp <= 0xFFFE.
  // Preferred: one segment per run of consecutive code points with a constant
  // glyph delta (no glyphIdArray). If that needs too many segments, fall back to
  // one segment per consecutive run with an explicit glyph array.
  let segs = [];
  for (const [cp, g] of entries) {
    const last = segs[segs.length - 1];
    if (last && cp === last.end + 1 && g - cp === last.delta) last.end = cp;
    else segs.push({ start: cp, end: cp, delta: g - cp, glyphs: null });
  }
  if (16 + (segs.length + 1) * 8 > 0xffff) {
    segs = [];
    for (const [cp, g] of entries) {
      const last = segs[segs.length - 1];
      if (last && cp === last.end + 1) { last.end = cp; last.glyphs.push(g); }
      else segs.push({ start: cp, end: cp, delta: 0, glyphs: [g] });
    }
  }
  segs.push({ start: 0xffff, end: 0xffff, delta: 1, glyphs: null });
  const segCount = segs.length;
  const glyphArrayLen = segs.reduce((s, g) => s + (g.glyphs ? g.glyphs.length : 0), 0);
  const length = 16 + segCount * 8 + glyphArrayLen * 2;
  if (length > 0xffff) throw new Error('cmap format 4 subtable too large');
  const buf = new Uint8Array(length);
  const dv = new DataView(buf.buffer);
  let searchRange = 1, entrySelector = 0;
  while (searchRange * 2 <= segCount) { searchRange *= 2; entrySelector++; }
  searchRange *= 2;
  dv.setUint16(0, 4); dv.setUint16(2, length); dv.setUint16(4, 0);
  dv.setUint16(6, segCount * 2); dv.setUint16(8, searchRange); dv.setUint16(10, entrySelector);
  dv.setUint16(12, segCount * 2 - searchRange);
  const endO = 14, startO = endO + segCount * 2 + 2, deltaO = startO + segCount * 2, rangeO = deltaO + segCount * 2;
  let glyphO = rangeO + segCount * 2;
  segs.forEach((s, idx) => {
    dv.setUint16(endO + idx * 2, s.end);
    dv.setUint16(startO + idx * 2, s.start);
    dv.setUint16(deltaO + idx * 2, s.delta & 0xffff);
    if (s.glyphs) {
      dv.setUint16(rangeO + idx * 2, glyphO - (rangeO + idx * 2));
      for (const g of s.glyphs) { dv.setUint16(glyphO, g); glyphO += 2; }
    } else dv.setUint16(rangeO + idx * 2, 0);
  });
  return buf;
}

function buildFormat12(entries) {
  const groups = [];
  for (const [cp, g] of entries) {
    const last = groups[groups.length - 1];
    if (last && cp === last[1] + 1 && g === last[2] + (cp - last[0])) last[1] = cp;
    else groups.push([cp, cp, g]);
  }
  const length = 16 + groups.length * 12;
  const buf = new Uint8Array(length);
  const dv = new DataView(buf.buffer);
  dv.setUint16(0, 12); dv.setUint16(2, 0); dv.setUint32(4, length); dv.setUint32(8, 0);
  dv.setUint32(12, groups.length);
  groups.forEach(([s, e, g], k) => { dv.setUint32(16 + k * 12, s); dv.setUint32(20 + k * 12, e); dv.setUint32(24 + k * 12, g); });
  return buf;
}

/**
 * Build a complete cmap table from a code point map.
 * @param {Map<number, number>} map
 * @param {{pid:number,eid:number,bytes:Uint8Array}[]} variation
 */
export function buildCmap(map, variation = []) {
  const entries = [...map.entries()].filter(([, g]) => g > 0).sort((a, b) => a[0] - b[0]);
  const bmp = entries.filter(([c]) => c <= 0xfffe);
  const f4 = buildFormat4(bmp);
  const needs12 = entries.some(([c]) => c > 0xffff);
  const f12 = needs12 ? buildFormat12(entries) : null;
  const records = []; // {pid, eid, data}
  records.push({ pid: 0, eid: 3, data: f4 });
  if (f12) records.push({ pid: 0, eid: 4, data: f12 });
  for (const v of variation) records.push({ pid: v.pid, eid: v.eid, data: v.bytes });
  records.push({ pid: 3, eid: 1, data: f4 });
  if (f12) records.push({ pid: 3, eid: 10, data: f12 });
  records.sort((a, b) => a.pid - b.pid || a.eid - b.eid);
  const unique = [...new Set(records.map(r => r.data))];
  const headerLen = 4 + records.length * 8;
  const offsets = new Map();
  let off = headerLen;
  for (const u of unique) { offsets.set(u, off); off += u.length; off += (4 - (off % 4)) % 4; }
  const out = new Uint8Array(off);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 0); dv.setUint16(2, records.length);
  records.forEach((r, i) => { dv.setUint16(4 + i * 8, r.pid); dv.setUint16(6 + i * 8, r.eid); dv.setUint32(8 + i * 8, offsets.get(r.data)); });
  for (const u of unique) out.set(u, offsets.get(u));
  return out;
}

/**
 * Rename feature tags in a GSUB/GPOS table (in place on a copy). Returns count.
 * @param {Uint8Array} table
 * @param {Record<string,string>} renames e.g. { liga: 'ligz' }
 */
export function renameFeatures(table, renames) {
  const dv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  const featureListOffset = u16(dv, 6);
  const count = u16(dv, featureListOffset);
  let changed = 0;
  for (let i = 0; i < count; i++) {
    const rec = featureListOffset + 2 + i * 6;
    const tag = tagAt(dv, rec);
    const to = renames[tag];
    if (to) {
      if (to.length !== 4) throw new Error(`feature rename target must be 4 chars: ${to}`);
      for (let k = 0; k < 4; k++) dv.setUint8(rec + k, to.charCodeAt(k));
      changed++;
    }
  }
  return changed;
}

function checksum(bytes) {
  const padded = bytes.length % 4 ? (() => { const p = new Uint8Array(bytes.length + (4 - (bytes.length % 4))); p.set(bytes); return p; })() : bytes;
  const dv = new DataView(padded.buffer, padded.byteOffset, padded.byteLength);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + dv.getUint32(i)) >>> 0;
  return sum;
}

/**
 * Reassemble an sfnt from tables (sorted directory, 4-byte alignment, checksums).
 * @param {number} sfntVersion
 * @param {Map<string, Uint8Array>} tables
 */
export function writeSfnt(sfntVersion, tables) {
  const tags = [...tables.keys()].filter(t => t !== 'DSIG').sort();
  const numTables = tags.length;
  let searchRange = 1, entrySelector = 0;
  while (searchRange * 2 <= numTables) { searchRange *= 2; entrySelector++; }
  searchRange *= 16;
  const dirLen = 12 + numTables * 16;
  let total = dirLen;
  const placed = tags.map(tag => {
    const data = tables.get(tag);
    const rec = { tag, data, offset: total };
    total += data.length + ((4 - (data.length % 4)) % 4);
    return rec;
  });
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, sfntVersion); dv.setUint16(4, numTables); dv.setUint16(6, searchRange);
  dv.setUint16(8, entrySelector); dv.setUint16(10, numTables * 16 - searchRange);
  let headOffset = -1;
  placed.forEach((r, i) => {
    let data = r.data;
    if (r.tag === 'head') {
      data = data.slice();
      new DataView(data.buffer).setUint32(8, 0); // checkSumAdjustment zeroed for checksumming
      headOffset = r.offset;
    }
    out.set(data, r.offset);
    const rec = 12 + i * 16;
    for (let k = 0; k < 4; k++) dv.setUint8(rec + k, r.tag.charCodeAt(k));
    dv.setUint32(rec + 4, checksum(data));
    dv.setUint32(rec + 8, r.offset);
    dv.setUint32(rec + 12, r.data.length);
  });
  if (headOffset >= 0) dv.setUint32(headOffset + 8, (0xb1b0afba - checksum(out)) >>> 0);
  return out;
}

/**
 * Apply cmap overrides and feature renames; returns new font bytes.
 * @param {Uint8Array} bytes original TTF
 * @param {{ cmapOverrides?: Map<number, number>, renameGsub?: Record<string,string> }} patch
 */
export function patchFont(bytes, { cmapOverrides = new Map(), renameGsub = {} } = {}) {
  const { sfntVersion, tables } = readTables(bytes);
  const next = new Map();
  for (const [tag, data] of tables) next.set(tag, data);
  if (cmapOverrides.size) {
    const { map, variation } = readCmap(tables.get('cmap'));
    for (const [cp, gid] of cmapOverrides) map.set(cp, gid);
    next.set('cmap', buildCmap(map, variation));
  }
  if (Object.keys(renameGsub).length && tables.has('GSUB')) {
    const gsub = tables.get('GSUB').slice();
    renameFeatures(gsub, renameGsub);
    next.set('GSUB', gsub);
  }
  return writeSfnt(sfntVersion, next);
}
