// Read a family tree file on this computer: a module Web Worker runs engine/worker.js,
// with a main-thread fallback when workers are unavailable. Nothing is uploaded.

import { handleParse } from '../engine/worker.js';

const WORKER_URL = new URL('../engine/worker.js', import.meta.url);
let seq = 0;

const EXT_HELP = {
  ftm: 'a Family Tree Maker file. In Family Tree Maker, choose File, then Export, then GEDCOM, and choose that file here',
  ftmb: 'a Family Tree Maker file. In Family Tree Maker, choose File, then Export, then GEDCOM, and choose that file here',
  rmtree: 'a RootsMagic file. In RootsMagic, choose File, then Export, then GEDCOM, and choose that file here',
  rmgc: 'a RootsMagic file. In RootsMagic, choose File, then Export, then GEDCOM, and choose that file here',
  gramps: 'a Gramps file. In Gramps, choose Family Trees, then Export, then GEDCOM, and choose that file here',
  paf: 'a PAF file. In PAF, choose File, then Export, then GEDCOM, and choose that file here',
  pdf: 'a PDF. Gildroot needs the family tree file itself, which ends in .ged',
  csv: 'a spreadsheet. Gildroot needs a GEDCOM file, which ends in .ged',
  xlsx: 'a spreadsheet. Gildroot needs a GEDCOM file, which ends in .ged',
  jpg: 'a picture. Gildroot needs a GEDCOM file, which ends in .ged',
  jpeg: 'a picture. Gildroot needs a GEDCOM file, which ends in .ged',
  png: 'a picture. Gildroot needs a GEDCOM file, which ends in .ged',
};

/**
 * A plain-word explanation for a file we cannot read, or null when the name looks fine.
 * @param {string} name
 */
export function fileTypeProblem(name) {
  const n = String(name || '');
  if (!n.includes('.')) return null;
  const ext = n.toLowerCase().split('.').pop();
  if (['ged', 'gedcom', 'zip', 'gdz', 'txt'].includes(ext)) return null;
  const help = EXT_HELP[ext];
  return help ? `${name} is ${help}.` : `${name} is not a GEDCOM file. Gildroot reads .ged files, or a .zip or .gdz that holds one.`;
}

/**
 * Quick count of people in GEDCOM bytes (for the "Reading 4,212 people" line).
 * Returns null when the bytes are compressed or the count is not obvious.
 * @param {Uint8Array} u8
 */
export function quickCount(u8) {
  if (!u8 || u8.length < 8) return null;
  if (u8[0] === 0x50 && u8[1] === 0x4B) return null; // zip
  if (u8[0] === 0x1F && u8[1] === 0x8B) return null; // gzip
  let text;
  try {
    if ((u8[0] === 0xFF && u8[1] === 0xFE) || (u8[0] === 0xFE && u8[1] === 0xFF)) {
      text = new TextDecoder(u8[0] === 0xFF ? 'utf-16le' : 'utf-16be').decode(u8);
    } else {
      text = new TextDecoder('latin1').decode(u8);
    }
  } catch {
    return null;
  }
  const m = text.match(/^\s*0\s+@[^@\r\n]+@\s+INDI\b/gm);
  return m ? m.length : 0;
}

function parseOnMainThread(buffer, name) {
  return new Promise((resolve, reject) => {
    // yield first so the "Reading…" line paints
    setTimeout(() => {
      try { resolve(handleParse({ buffer, name }).tree); } catch (e) { reject(e); }
    }, 30);
  });
}

/**
 * Parse file bytes into a Tree.
 * @param {ArrayBuffer} buffer (a copy is transferred to the worker; the caller keeps its bytes)
 * @param {string} name
 * @returns {Promise<object>} Tree
 */
export function parseTree(buffer, name) {
  if (typeof Worker === 'undefined') return parseOnMainThread(buffer, name);
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(WORKER_URL, { type: 'module', name: 'gildroot-parse' });
    } catch {
      parseOnMainThread(buffer, name).then(resolve, reject);
      return;
    }
    const id = ++seq;
    let settled = false;
    const finish = fn => v => { if (settled) return; settled = true; worker.terminate(); fn(v); };
    const ok = finish(resolve), fail = finish(reject);
    worker.onmessage = e => {
      const d = e.data || {};
      if (d.id !== id) return;
      if (d.type === 'tree') ok(d.tree);
      else fail(new Error(d.message || 'This file could not be read.'));
    };
    worker.onerror = ev => {
      ev.preventDefault?.();
      // module workers can fail to start (old Safari): fall back to the main thread
      if (!settled) { settled = true; worker.terminate(); parseOnMainThread(buffer, name).then(resolve, reject); }
    };
    const copy = buffer.slice(0);
    worker.postMessage({ type: 'parse', id, buffer: copy, name }, [copy]);
  });
}

/** Friendly wording for parser errors: what happened and what to do. */
export function explainParseError(err, name) {
  const msg = String((err && err.message) || err || '');
  if (/does not look like a family tree/i.test(msg)) {
    return `${name || 'This file'} does not look like a family tree (GEDCOM) file. Export your tree as GEDCOM from your family tree website or program, then choose that file.`;
  }
  if (/no \.ged file inside/i.test(msg)) return `There is no .ged file inside ${name || 'this archive'}. Choose the .ged file itself, or a .zip that holds one.`;
  if (/could not find any people/i.test(msg)) return `We could not find any people in ${name || 'this file'}. It may be an empty export. Try exporting the tree again.`;
  if (/empty/i.test(msg)) return `${name || 'This file'} is empty. Try exporting the tree again.`;
  if (/could not be opened|damaged/i.test(msg)) return `${name || 'This file'} could not be opened. It may be damaged. Try downloading or exporting it again.`;
  return `${name || 'This file'} could not be read (${msg || 'unknown problem'}). Try exporting it again, or email support@gildroot.com and describe what happened. Please don’t attach the file.`;
}
