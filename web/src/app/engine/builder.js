// Quick Builder (up to 15 people: self, parents, grandparents, great-grandparents) and the
// "Ask the family" link codec. The partial tree travels in the URL fragment, compressed with
// lz-string, so it never reaches a server. Pure JS, no DOM.
//
// Slots are numbered like an Ahnentafel: 1 = the person the chart is for, 2 = father,
// 3 = mother, 4-7 grandparents, 8-15 great-grandparents (even = father's side slot, odd = mother).

import { parseDate } from './dates.js';
import { resolveCountry, cleanPlace } from './places.js';
import { isLiving } from './living.js';
import { splitName } from './names.js';

export const MAX_SLOTS = 15;

/**
 * @typedef {{ name?: string, sex?: 'M'|'F'|'U', birthYear?: number|string, birthAbout?: boolean,
 *   birthPlace?: string, deathYear?: number|string, deathAbout?: boolean, died?: boolean,
 *   living?: boolean, ahnen?: number }} Slot
 *   name: typed full name ("Anna Maria Kowalski" or "Anna /Kowalski/").
 *   birthYear/deathYear: 1920, "1920", "about 1920", "c. 1920". birthAbout marks it approximate.
 *   birthPlace: free text, or a picker value such as "Ohio" or "Ireland".
 *   died: true when the person has died but the year is unknown.
 * @typedef {(Slot|null)[]} SlotList  index i holds slot number i + 1 (length 15)
 */

const TEXT_FIELDS = ['name', 'birthPlace'];
const MAX_TEXT = 160;

function cleanText(s) {
  // eslint-disable-next-line no-control-regex
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT).normalize('NFC');
}

function cleanYear(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(Math.trunc(v)) : '';
  return cleanText(v).slice(0, 40);
}

/** Clean one slot; returns null when nothing meaningful is filled in. */
function cleanSlot(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {};
  for (const f of TEXT_FIELDS) { const v = cleanText(s[f]); if (v) out[f] = v; }
  const by = cleanYear(s.birthYear); if (by) out.birthYear = /^\d+$/.test(by) ? +by : by;
  const dy = cleanYear(s.deathYear); if (dy) out.deathYear = /^\d+$/.test(dy) ? +dy : dy;
  if (s.birthAbout) out.birthAbout = true;
  if (s.deathAbout) out.deathAbout = true;
  if (s.died) out.died = true;
  if (s.sex === 'M' || s.sex === 'F' || s.sex === 'U') out.sex = s.sex;
  if (typeof s.living === 'boolean') out.living = s.living;
  const meaningful = out.name || out.birthYear || out.birthPlace || out.deathYear || out.died;
  return meaningful ? out : null;
}

/**
 * Normalise slots to a 15-entry array (index i = slot i + 1). Accepts an array in that shape,
 * an object keyed by slot number ({ 1: {...}, 2: {...} }), or slots carrying an `ahnen` field.
 * @param {SlotList|Record<string, Slot>|null|undefined} slots
 * @returns {SlotList}
 */
export function normalizeSlots(slots) {
  const out = new Array(MAX_SLOTS).fill(null);
  if (!slots) return out;
  const put = (n, s) => {
    const k = Math.trunc(Number(n));
    if (k >= 1 && k <= MAX_SLOTS) { const c = cleanSlot(s); if (c) out[k - 1] = c; }
  };
  if (Array.isArray(slots)) {
    slots.forEach((s, i) => { if (s) put(s.ahnen ?? i + 1, s); });
  } else if (typeof slots === 'object') {
    for (const [k, s] of Object.entries(slots)) if (s) put(s.ahnen ?? k, s);
  }
  return out;
}

function yearDate(value, about) {
  if (value === undefined || value === null || value === '') return null;
  let s = String(value).trim();
  if (about && /^\d{3,4}$/.test(s)) s = `ABT ${s}`;
  const d = parseDate(s);
  return d.year === undefined && !d.display ? null : d;
}

/**
 * Build a Tree from Quick Builder slots. Missing people between filled slots become empty
 * placeholders so every line reaches the root. Ids are "Q1".."Q15"; families "QF<n>" hold
 * the parents of slot n.
 * @param {SlotList|Record<string, Slot>} slots
 * @param {{ nowYear?: number }} [opts]
 * @returns {import('./gedcom.js').Tree}
 */
export function treeFromSlots(slots, opts = {}) {
  const nowYear = opts.nowYear || new Date().getFullYear();
  const list = normalizeSlots(slots);
  const has = n => n <= MAX_SLOTS && !!list[n - 1];
  const needed = new Array(MAX_SLOTS * 2 + 2).fill(false);
  for (let n = MAX_SLOTS; n >= 1; n--) needed[n] = has(n) || (2 * n <= MAX_SLOTS && (needed[2 * n] || needed[2 * n + 1]));
  needed[1] = true;
  const people = {};
  const families = {};
  const explicitLiving = new Map();
  for (let n = 1; n <= MAX_SLOTS; n++) {
    if (!needed[n]) continue;
    const s = list[n - 1] || {};
    const id = `Q${n}`;
    const nm = splitName(s.name || '');
    const sex = s.sex || (n === 1 ? 'U' : n % 2 === 0 ? 'M' : 'F');
    const bDate = yearDate(s.birthYear, s.birthAbout);
    const bPlace = cleanPlace(s.birthPlace || '');
    let birth = null;
    if (bDate || bPlace) {
      const r = bPlace ? resolveCountry(bPlace) : { country: null, region: null };
      birth = { date: bDate, place: bPlace, country: r.country, region: r.region, tag: 'BIRT' };
    }
    const dDate = yearDate(s.deathYear, s.deathAbout);
    const death = dDate || s.died ? { date: dDate, place: '', country: null, region: null, tag: 'DEAT' } : null;
    const person = {
      id, given: nm.given, surname: nm.surname, suffix: nm.suffix,
      name: [nm.given, nm.surname, nm.suffix].filter(Boolean).join(' '),
      sex, birth, death, living: false, famc: [], fams: [], ahnen: n,
    };
    if (!list[n - 1]) person.placeholder = true;
    if (typeof s.living === 'boolean') explicitLiving.set(id, s.living);
    people[id] = person;
  }
  for (let n = 1; n <= 7; n++) {
    if (!people[`Q${n}`]) continue;
    const f = people[`Q${2 * n}`], m = people[`Q${2 * n + 1}`];
    if (!f && !m) continue;
    const fid = `QF${n}`;
    const partners = [], roles = [];
    if (f) { partners.push(f.id); roles.push('HUSB'); f.fams.push(fid); }
    if (m) { partners.push(m.id); roles.push('WIFE'); m.fams.push(fid); }
    families[fid] = { id: fid, partners, children: [`Q${n}`], marriage: null, roles };
    people[`Q${n}`].famc.push({ fam: fid, pedi: 'birth' });
  }
  const tree = {
    people,
    families,
    meta: { source: 'Gildroot Quick Builder', version: '1', charset: 'UTF-8', count: Object.keys(people).length, homeId: 'Q1', warnings: [] },
  };
  for (const id in people) {
    const p = people[id];
    p.living = explicitLiving.has(id) ? explicitLiving.get(id) : isLiving(p, nowYear, tree);
  }
  return tree;
}

// ---- Ask-the-family codec -------------------------------------------------------------------

let injectedCodec = null;

/**
 * Provide the lz-string codec explicitly (Node tests, workers). In the browser the global
 * `LZString` from /vendor/lz-string.min.js is used when present.
 * @param {{ compressToEncodedURIComponent: Function, decompressFromEncodedURIComponent: Function }|null} codec
 */
export function setAskCodec(codec) {
  injectedCodec = codec || null;
}

function lz() {
  if (injectedCodec) return injectedCodec;
  const g = typeof globalThis !== 'undefined' ? globalThis.LZString : undefined;
  return g && typeof g.compressToEncodedURIComponent === 'function' ? g : null;
}

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

const COMPACT = ['name', 'birthYear', 'birthAbout', 'birthPlace', 'deathYear', 'deathAbout', 'sex', 'died', 'living'];

function toCompact(list) {
  const rows = [];
  list.forEach((s, i) => {
    if (!s) return;
    const row = [i + 1, ...COMPACT.map(f => {
      const v = s[f];
      if (v === undefined || v === null || v === '') return 0;
      if (typeof v === 'boolean') return v ? 1 : 0;
      return v;
    })];
    while (row.length > 2 && row[row.length - 1] === 0) row.pop();
    rows.push(row);
  });
  return rows;
}

function fromCompact(rows) {
  const out = new Array(MAX_SLOTS).fill(null);
  if (!Array.isArray(rows)) return out;
  for (const row of rows) {
    if (!Array.isArray(row)) continue;
    const n = Math.trunc(Number(row[0]));
    if (!(n >= 1 && n <= MAX_SLOTS)) continue;
    const s = {};
    COMPACT.forEach((f, i) => {
      const v = row[i + 1];
      if (v === undefined || v === 0 || v === '' || v === null) return;
      if (f === 'birthAbout' || f === 'deathAbout' || f === 'died') s[f] = v === 1 || v === true;
      else if (f === 'living') s[f] = v === 1 || v === true;
      else if (f === 'sex') { if (v === 'M' || v === 'F' || v === 'U') s.sex = v; }
      else if (f === 'birthYear' || f === 'deathYear') s[f] = typeof v === 'number' ? v : String(v);
      else s[f] = String(v);
    });
    out[n - 1] = cleanSlot(s);
  }
  return out;
}

/**
 * Encode slots (and optional meta such as { for: 'Anna', from: 'Aunt Rose' }) into a URL-fragment
 * safe string: "z1." + lz-string when the codec is available, else "j1." + base64url JSON.
 * @param {SlotList|Record<string, Slot>} slots
 * @param {Record<string, string>} [meta]
 * @returns {string}
 */
export function encodeAsk(slots, meta) {
  const payload = { v: 1, s: toCompact(normalizeSlots(slots)) };
  if (meta && typeof meta === 'object') {
    const m = {};
    for (const [k, v] of Object.entries(meta)) if (typeof v === 'string' && v.trim()) m[k.slice(0, 20)] = cleanText(v);
    if (Object.keys(m).length) payload.m = m;
  }
  const json = JSON.stringify(payload);
  const codec = lz();
  if (codec) return 'z1.' + codec.compressToEncodedURIComponent(json);
  return 'j1.' + b64urlEncode(json);
}

/**
 * Decode an Ask link. Accepts the payload, "#ask=<payload>", or a whole URL.
 * @param {string} fragment
 * @returns {{ slots: SlotList, meta: Record<string, string> }|null} null when the link is unreadable
 */
export function decodeAskFull(fragment) {
  if (typeof fragment !== 'string') return null;
  let s = fragment.trim();
  try { s = decodeURIComponent(s); } catch { /* keep as is */ }
  const m = s.match(/([zj])1\.([A-Za-z0-9+\-$_]+)/);
  if (!m) return null;
  let json = null;
  try {
    if (m[1] === 'z') {
      const codec = lz();
      if (!codec) return null;
      json = codec.decompressFromEncodedURIComponent(m[2]);
    } else json = b64urlDecode(m[2]);
  } catch { return null; }
  if (!json) return null;
  let data;
  try { data = JSON.parse(json); } catch { return null; }
  if (!data || data.v !== 1 || !Array.isArray(data.s)) return null;
  const meta = {};
  if (data.m && typeof data.m === 'object') for (const [k, v] of Object.entries(data.m)) if (typeof v === 'string') meta[k] = cleanText(v);
  return { slots: fromCompact(data.s), meta };
}

/**
 * Decode an Ask link to its slots (see decodeAskFull for the meta as well).
 * @param {string} fragment
 * @returns {SlotList|null}
 */
export function decodeAsk(fragment) {
  const r = decodeAskFull(fragment);
  return r ? r.slots : null;
}

// ---- Merge ----------------------------------------------------------------------------------

function foldStr(v) {
  return String(v).normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function yearNum(v) {
  const m = String(v ?? '').match(/\d{3,4}/);
  return m ? +m[0] : null;
}

function isApprox(v, aboutFlag) {
  return !!aboutFlag || /abt|about|c\.|ca\.?|circa|~|est|cal/i.test(String(v ?? ''));
}

/**
 * Merge two slot sets (yours and a returned Ask link). Empty fields are filled from the other
 * side; an exact year beats an approximate one for the same year; real disagreements are
 * listed as conflicts and the first set's value is kept until the user chooses.
 * @param {SlotList|Record<string, Slot>} a
 * @param {SlotList|Record<string, Slot>} b
 * @returns {{ merged: SlotList, conflicts: { slot: number, field: string, a: any, b: any }[] }}
 */
export function mergeSlots(a, b) {
  const A = normalizeSlots(a), B = normalizeSlots(b);
  const merged = new Array(MAX_SLOTS).fill(null);
  const conflicts = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const sa = A[i], sb = B[i];
    if (!sa && !sb) continue;
    if (!sa || !sb) { merged[i] = { ...(sa || sb) }; continue; }
    const m = {};
    const empty = v => v === undefined || v === null || v === '';
    // Names and places: compare folded.
    for (const f of ['name', 'birthPlace']) {
      const va = sa[f], vb = sb[f];
      if (empty(va)) { if (!empty(vb)) m[f] = vb; continue; }
      if (empty(vb) || foldStr(va) === foldStr(vb)) { m[f] = va; continue; }
      m[f] = va;
      conflicts.push({ slot: i + 1, field: f, a: va, b: vb });
    }
    // Years with their "about" flags.
    for (const [f, af] of [['birthYear', 'birthAbout'], ['deathYear', 'deathAbout']]) {
      const va = sa[f], vb = sb[f];
      if (empty(va) && empty(vb)) continue;
      if (empty(va)) { m[f] = vb; if (sb[af]) m[af] = true; continue; }
      if (empty(vb)) { m[f] = va; if (sa[af]) m[af] = true; continue; }
      const ya = yearNum(va), yb = yearNum(vb);
      const apA = isApprox(va, sa[af]), apB = isApprox(vb, sb[af]);
      if (ya !== null && ya === yb) {
        if (apA && !apB) { m[f] = vb; } else { m[f] = va; if (apA) m[af] = true; }
        continue;
      }
      m[f] = va; if (sa[af]) m[af] = true;
      conflicts.push({ slot: i + 1, field: f, a: va, b: vb });
    }
    for (const f of ['sex', 'died', 'living']) {
      const va = sa[f], vb = sb[f];
      if (empty(va)) { if (!empty(vb)) m[f] = vb; continue; }
      if (empty(vb) || va === vb) { m[f] = va; continue; }
      m[f] = va;
      conflicts.push({ slot: i + 1, field: f, a: va, b: vb });
    }
    merged[i] = cleanSlot(m);
  }
  return { merged, conflicts };
}
