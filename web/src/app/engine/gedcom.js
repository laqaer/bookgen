// GEDCOM parser: 5.5, 5.5.1 and 7.0 into the plain-JSON Tree model (see docs/ARCHITECTURE.md).
// Tolerant by design: CONC/CONT, level jumps, vendor _TAGS, blank and junk lines, CRLF/LF/CR,
// @VOID@ pointers, one-sided links. It records warnings and never throws on bad data.
// Pure JS, no DOM.

import { decodeBytes } from './decode.js';
import { parseDate } from './dates.js';
import { resolveCountry, cleanPlace } from './places.js';
import { isLiving } from './living.js';
import { fixCaps } from './names.js';

/**
 * @typedef {import('./dates.js').GDate} GDate
 * @typedef {{ date: GDate|null, place: string, country: string|null, region?: string|null, tag?: string }} GEvent
 * @typedef {{ id: string, given: string, surname: string, name: string, suffix: string,
 *   sex: 'M'|'F'|'U', birth: GEvent|null, death: GEvent|null, living: boolean,
 *   famc: {fam: string, pedi: 'birth'|'adopted'|'foster'|'step'|'unknown'}[], fams: string[], romanized?: string }} Person
 * @typedef {{ id: string, partners: string[], children: string[], marriage: GEvent|null, roles?: ('HUSB'|'WIFE')[] }} Family
 * @typedef {{ people: Record<string, Person>, families: Record<string, Family>,
 *   meta: { source: string, version: string, charset: string, count: number, homeId: string|null, warnings: string[], fileName?: string } }} Tree
 */

const POINTER_RE = /^@([^@#\s][^@]*)@$/;
const PLACEHOLDER_RE = /^(?:[?_.\-\s*]*|unknown|unk|unkn|nn|n\s?n|nomen nescio|n\/a|none|not known|\[unknown\]|\(unknown\)|onbekend|unbekannt|inconnu|desconocido|sconosciuto|ukjent|okand|tuntematon|nieznany|neznamy)$/i;
const LIVING_WORD_RE = /^(?:living|private|privat|lebend|vivant|levende|elossa)$/i;
const LATIN_RE = /^[\p{Script=Latin}\p{M}\s.,'’"()\/-]+$/u;

/** Map -> plain object (JSON-friendly). "__proto__" is defined as an own data property. */
function toRecord(map) {
  const out = {};
  for (const [k, v] of map) {
    if (k === '__proto__') Object.defineProperty(out, k, { value: v, enumerable: true, writable: true, configurable: true });
    else out[k] = v;
  }
  return out;
}

/** Strip @...@ from an xref or pointer. */
export function cleanId(x) {
  if (!x) return '';
  const s = String(x).trim();
  const m = s.match(/^@(.+)@$/);
  return m ? m[1] : s;
}

function pointerOf(value) {
  if (!value) return null;
  const m = POINTER_RE.exec(value.trim());
  if (!m) return null;
  if (m[1].toUpperCase() === 'VOID') return null;
  return m[1];
}

class Node {
  constructor(tag, value, xref) {
    this.tag = tag;
    this.value = value;
    this.xref = xref;
    this.children = null;
  }
  child(tag) {
    if (!this.children) return null;
    for (const c of this.children) if (c.tag === tag) return c;
    return null;
  }
  all(tag) {
    return this.children ? this.children.filter(c => c.tag === tag) : [];
  }
  text(tag) {
    const c = this.child(tag);
    return c && c.value ? c.value.trim() : '';
  }
}

function unescapeAt(v) {
  return v && v.indexOf('@@') >= 0 ? v.replace(/@@/g, '@') : v;
}

class Warnings {
  constructor() { this.counts = new Map(); this.samples = new Map(); this.list = []; }
  add(kind, sample) {
    this.counts.set(kind, (this.counts.get(kind) || 0) + 1);
    if (sample !== undefined) {
      const arr = this.samples.get(kind) || [];
      if (arr.length < 3) arr.push(sample);
      this.samples.set(kind, arr);
    }
  }
  note(msg) { this.list.push(msg); }
  finish() {
    const out = [...this.list];
    const T = {
      junk: n => `${n} line(s) could not be read and were skipped`,
      orphanLine: n => `${n} line(s) appeared before the first record and were skipped`,
      duplicate: n => `${n} record id(s) appear more than once; the first was kept`,
      danglingFam: n => `${n} link(s) point to a family that is not in the file`,
      danglingIndi: n => `${n} link(s) point to a person who is not in the file`,
      noXref: n => `${n} record(s) had no id and were given one`,
    };
    for (const [kind, n] of this.counts) {
      const s = this.samples.get(kind);
      out.push(T[kind] ? T[kind](n) + (s && s.length ? ` (e.g. ${s.join(', ')})` : '') : `${kind}: ${n}`);
    }
    return out;
  }
}

const NAME_TYPE_PREFERRED = new Set(['', 'BIRTH', 'MAIDEN', 'BIRTH NAME', 'GIVEN']);

function isPlaceholder(s) {
  return PLACEHOLDER_RE.test(s.trim());
}

function joinName(given, surname, suffix, surnameFirst) {
  let core;
  if (surnameFirst && given && surname) {
    const cjk = /[\u3040-\u30FF\u3400-\u9FFF\uAC00-\uD7AF]/;
    core = cjk.test(surname) && cjk.test(given) ? surname + given : `${surname} ${given}`;
  } else core = [given, surname].filter(Boolean).join(' ');
  return [core, suffix].filter(Boolean).join(' ');
}

/** Parse a GEDCOM NAME value: "Given /Surname/ Suffix" or "/Surname/ Given". */
export function parseNameValue(value) {
  const v = String(value || '').replace(/\s+/g, ' ').trim();
  const m = v.match(/^(.*?)\/([^/]*)(?:\/(.*))?$/);
  if (!m) return { given: v, surname: '', suffix: '', surnameFirst: false, hadSlashes: false };
  const before = m[1].trim(), surname = m[2].trim(), after = (m[3] || '').replace(/\//g, ' ').trim();
  if (before || !after) return { given: before, surname, suffix: after, surnameFirst: false, hadSlashes: true };
  if (/^(jr|sr|jnr|snr|ii|iii|iv|v|vi|esq)\.?$/i.test(after)) return { given: '', surname, suffix: after, surnameFirst: false, hadSlashes: true };
  return { given: after, surname, suffix: '', surnameFirst: true, hadSlashes: true };
}

function readName(node) {
  const raw = unescapeAt(node.value || '');
  let { given, surname, suffix, surnameFirst, hadSlashes } = parseNameValue(raw);
  const givn = node.text('GIVN'), surn = node.text('SURN'), spfx = node.text('SPFX'), nsfx = node.text('NSFX');
  if (!raw.trim()) {
    given = givn; surname = [spfx, surn].filter(Boolean).join(' '); suffix = nsfx;
  } else if (!hadSlashes && surn) {
    const full = raw.replace(/\s+/g, ' ').trim();
    if (full.endsWith(' ' + surn) || full === surn) {
      given = full.slice(0, full.length - surn.length).trim();
      surname = surn;
    } else if (full.startsWith(surn + ' ')) {
      surname = surn; given = full.slice(surn.length).trim(); surnameFirst = true;
    }
  }
  if (!given && givn && !isPlaceholder(givn)) given = givn;
  if (!surname && surn && !isPlaceholder(surn) && hadSlashes) surname = [spfx, surn].filter(Boolean).join(' ');
  if (!suffix && nsfx) suffix = nsfx;
  let livingHint = false;
  if (LIVING_WORD_RE.test(given)) { livingHint = true; given = ''; }
  if (isPlaceholder(given)) given = '';
  if (isPlaceholder(surname)) surname = '';
  given = fixCaps(given);
  surname = fixCaps(surname);
  const name = joinName(given, surname, suffix, surnameFirst);
  // Romanised / transliterated form (5.5.1 ROMN, 7.0 TRAN with a Latin script tag).
  let romanized = '';
  for (const c of node.children || []) {
    if (c.tag === 'ROMN' || c.tag === '_ROMN' || c.tag === 'TRAN') {
      // A TRAN is only useful here when it is in Latin script (a romanisation).
      if (c.tag === 'TRAN' && !LATIN_RE.test(c.value || '')) continue;
      const r = parseNameValue(c.value || '');
      const rn = joinName(fixCaps(r.given), fixCaps(r.surname), r.suffix, r.surnameFirst);
      if (rn && rn !== name) { romanized = rn; break; }
    }
  }
  return { given, surname, suffix, name, romanized, livingHint, type: node.text('TYPE').toUpperCase() };
}

function mapPedi(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return null;
  if (/^(birth|natural|biological|bio|blood|birth parent|biologic)/.test(s)) return 'birth';
  if (/^adop/.test(s)) return 'adopted';
  if (/^(foster|guardian)/.test(s)) return 'foster';
  if (/^step/.test(s)) return 'step';
  return 'unknown';
}

function combineRel(frel, mrel) {
  const a = mapPedi(frel), b = mapPedi(mrel);
  if (!a && !b) return null;
  if (a === b || !b) return a;
  if (!a) return b;
  for (const k of ['adopted', 'foster', 'step', 'unknown']) if (a === k || b === k) return k;
  return 'birth';
}

/**
 * Parse GEDCOM text or bytes into a Tree.
 * @param {string|ArrayBuffer|Uint8Array} input
 * @param {{ nowYear?: number, fileName?: string }} [opts]
 * @returns {Tree}
 */
export function parseGedcom(input, opts = {}) {
  const nowYear = opts.nowYear || new Date().getFullYear();
  const W = new Warnings();
  let text, charset;
  if (typeof input === 'string') {
    text = input.charCodeAt(0) === 0xFEFF ? input.slice(1) : input;
    // eslint-disable-next-line no-control-regex
    if (/[^\u0000-\u007F]/.test(text)) text = text.normalize('NFC');
    charset = null;
  } else if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
    const u8 = input instanceof Uint8Array ? input : input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    const d = decodeBytes(u8);
    text = d.text;
    charset = d.charset;
    for (const w of d.warnings) W.note(w);
  } else {
    text = '';
    W.note('Nothing to read: the input was empty.');
  }

  const people = new Map();
  const families = new Map();
  const ctx = {
    head: null, submitters: new Map(), homeHints: [], anciHints: [], livingHints: new Set(),
    famRel: new Map(), // `${fam}|${child}` -> pedi from _FREL/_MREL
    adop: [], // [personId, famId, pedi]
    auto: 0,
  };

  let rec = null;
  const stack = new Array(128);
  let cur = 0; // level of the most recent node; stack entries above it are stale
  let sawHead = false;
  let skip = -1; // inside a subtree we do not need: lines deeper than this level are ignored
  let keepAll = false, recKind = 0; // recKind: 1 = INDI, 2 = FAM
  // CR-only and CRLF files become LF; lines are then scanned in place with indexOf.
  if (text.indexOf('\r') >= 0) text = text.replace(/\r\n?/g, '\n');
  const n = text.length;
  let pos = 0;
  while (pos < n) {
    let e = text.indexOf('\n', pos);
    if (e < 0) e = n;
    const ls = pos;
    pos = e + 1;
    if (e === ls) continue;
    // Hand-rolled parse of "LEVEL [@XREF@] TAG [VALUE]" directly on the text (no per-line
    // strings, no regex): much less garbage on 50,000-person files.
    let i = ls, c = text.charCodeAt(i);
    while ((c === 32 || c === 9) && i < e) c = text.charCodeAt(++i);
    let level = 0;
    const ds = i;
    while (c >= 48 && c <= 57 && i < e) { level = level * 10 + (c - 48); c = text.charCodeAt(++i); }
    let bad = i === ds || i - ds > 3 || i >= e || !(c === 32 || c === 9);
    if (skip >= 0) {
      if (bad || level > skip) continue; // part of a skipped subtree (notes, sources, media...)
      skip = -1;
    }
    let xref = null, tag = '', value = '';
    if (!bad) {
      while ((c === 32 || c === 9) && i < e) c = text.charCodeAt(++i);
      if (c === 64) { // '@'
        const at = text.indexOf('@', i + 1);
        const sp = at > 0 && at < e ? text.charCodeAt(at + 1) : 0;
        if (at > i + 1 && at < e && (sp === 32 || sp === 9)) {
          xref = text.slice(i, at + 1);
          i = at + 1; c = text.charCodeAt(i);
          while ((c === 32 || c === 9) && i < e) c = text.charCodeAt(++i);
        } else bad = true;
      }
      if (!bad) {
        const ts = i;
        let lower = false;
        while (i < e && c !== 32 && c !== 9) { if (c >= 97 && c <= 122) lower = true; c = text.charCodeAt(++i); }
        if (i === ts) bad = true;
        else {
          tag = text.slice(ts, i);
          if (lower) tag = tag.toUpperCase();
          value = i < e ? text.slice(i + 1, e) : '';
        }
      }
    }
    if (bad) {
      const line = text.slice(ls, e);
      if (line.trim()) {
        // A raw line break inside a note: keep the text as a continuation of a text value.
        const top = rec ? stack[cur] : null;
        if (top && (top.tag === 'NOTE' || top.tag === 'TEXT' || top.tag === 'SNOTE')) top.value = (top.value || '') + '\n' + line;
        else W.add('junk', JSON.stringify(line.slice(0, 24)));
      }
      continue;
    }
    if (level === 0) {
      if (rec) finishRecord(rec, people, families, ctx, W);
      rec = new Node(tag, value, xref);
      if (tag === 'HEAD') sawHead = true;
      stack[0] = rec;
      cur = 0;
      keepAll = tag === 'HEAD' || tag === 'SUBM';
      recKind = tag === 'INDI' ? 1 : tag === 'FAM' ? 2 : 0;
      if (!keepAll && !recKind) skip = 0; // SOUR, NOTE, OBJE, REPO... records are not needed
      continue;
    }
    if (!rec) { W.add('orphanLine'); continue; }
    if (!keepAll && tag !== 'CONC' && tag !== 'CONT') {
      const wanted = level === 1 ? (recKind === 1 ? INDI_TAGS.has(tag) || HOME_TAGS.has(tag) : FAM_TAGS.has(tag)) : SUB_TAGS.has(tag);
      if (!wanted) { skip = level; continue; }
    }
    if (level > 120) level = 120;
    let parent = null;
    for (let l = Math.min(level - 1, cur); l >= 0; l--) if (stack[l]) { parent = stack[l]; break; }
    if (!parent) parent = rec;
    if (tag === 'CONC' || tag === 'CONT') {
      parent.value = (parent.value || '') + (tag === 'CONT' ? '\n' : '') + value;
      continue;
    }
    const node = new Node(tag, value, xref);
    (parent.children || (parent.children = [])).push(node);
    for (let l = cur + 1; l < level; l++) stack[l] = null; // level jump: no nodes in between
    stack[level] = node;
    cur = level;
  }
  if (rec) finishRecord(rec, people, families, ctx, W);

  // ---- Reconcile links in both directions ----------------------------------------------
  // People and families live in Maps while parsing: fast on 50,000 records, and ids such as
  // "constructor" or "__proto__" are harmless.
  for (const [fid, fam] of families) {
    const keep = [], roles = [];
    fam.partners.forEach((pid, i) => {
      const p = people.get(pid);
      if (!p) { W.add('danglingIndi', `@${pid}@`); return; }
      if (keep.includes(pid)) return;
      keep.push(pid); roles.push(fam.roles[i]);
      if (!p.fams.includes(fid)) p.fams.push(fid);
    });
    fam.partners = keep; fam.roles = roles;
    const kids = [];
    for (const cid of fam.children) {
      const c = people.get(cid);
      if (!c) { W.add('danglingIndi', `@${cid}@`); continue; }
      if (kids.includes(cid)) continue;
      kids.push(cid);
      const rel = ctx.famRel.get(fid + '|' + cid);
      const link = c.famc.find(l => l.fam === fid);
      if (!link) c.famc.push({ fam: fid, pedi: rel || 'birth' });
      else if (rel && link.pedi === 'birth' && !link._explicit) link.pedi = rel;
    }
    fam.children = kids;
  }
  for (const [pid, fid, pedi] of ctx.adop) {
    const p = people.get(pid);
    if (!p || !families.has(fid)) continue;
    const link = p.famc.find(l => l.fam === fid);
    if (link) link.pedi = pedi;
    else { p.famc.push({ fam: fid, pedi }); families.get(fid).children.push(pid); }
  }
  for (const [pid, p] of people) {
    const famc = [];
    for (const l of p.famc) {
      const fam = families.get(l.fam);
      if (!fam) { W.add('danglingFam', `@${l.fam}@`); continue; }
      if (famc.some(x => x.fam === l.fam)) continue; // same family linked twice
      if (!fam.children.includes(pid)) fam.children.push(pid);
      famc.push({ fam: l.fam, pedi: l.pedi });
    }
    p.famc = famc;
    const fams = [];
    for (const fid of p.fams) {
      if (fams.includes(fid)) continue;
      const fam = families.get(fid);
      if (!fam) { W.add('danglingFam', `@${fid}@`); continue; }
      if (!fam.partners.includes(pid)) {
        // One-sided FAMS: add as a partner in the slot that matches their sex.
        if (p.sex === 'F') { fam.partners.push(pid); fam.roles.push('WIFE'); }
        else { fam.partners.unshift(pid); fam.roles.unshift('HUSB'); }
      }
      fams.push(fid);
    }
    p.fams = fams;
  }
  for (const fam of families.values()) {
    // Contract: HUSB then WIFE.
    if (fam.roles.length > 1) {
      const order = fam.partners.map((p, i) => [p, fam.roles[i], i]).sort((a, b) => (a[1] === b[1] ? a[2] - b[2] : a[1] === 'HUSB' ? -1 : 1));
      fam.partners = order.map(o => o[0]);
      fam.roles = order.map(o => o[1]);
    }
  }

  const tree = {
    people: toRecord(people),
    families: toRecord(families),
    meta: {
      source: '',
      version: '',
      charset: charset || 'UTF-8',
      count: people.size,
      homeId: null,
      warnings: [],
    },
  };

  // ---- Header -------------------------------------------------------------------------
  const head = ctx.head;
  if (head) {
    const sour = head.child('SOUR');
    tree.meta.source = sour ? (sour.text('NAME') || (sour.value || '').trim()) : '';
    const gedc = head.child('GEDC');
    tree.meta.version = gedc ? gedc.text('VERS') : '';
  }
  if (!sawHead && people.size === 0) W.note('This does not look like a GEDCOM file: no HEAD record and no people were found.');
  else if (!sawHead) W.note('The file has no HEAD record; read it anyway.');

  // ---- Countries and living -----------------------------------------------------------
  const countries = new Map();
  const withCountry = ev => {
    if (!ev || !ev.place) return;
    let r = countries.get(ev.place);
    if (!r) { r = resolveCountry(ev.place); countries.set(ev.place, r); }
    ev.country = r.country;
    ev.region = r.region;
  };
  for (const p of people.values()) { withCountry(p.birth); withCountry(p.death); }
  for (const fam of families.values()) withCountry(fam.marriage);
  for (const [pid, p] of people) {
    p.living = ctx.livingHints.has(pid) && !p.death ? true : isLiving(p, nowYear, tree);
  }
  const count = people.size;

  // ---- Home person hints --------------------------------------------------------------
  let homeId = null;
  for (const h of ctx.homeHints) if (people.has(h)) { homeId = h; break; }
  if (!homeId) {
    for (const [, sub] of ctx.submitters) {
      for (const ptr of sub.pointers) if (people.has(ptr)) { homeId = ptr; break; }
      if (homeId) break;
    }
  }
  if (!homeId && ctx.anciHints.length) homeId = ctx.anciHints.find(id => people.has(id)) || null;
  if (!homeId && head) {
    // Submitter whose name matches exactly one person (MyHeritage/FTM exports).
    const subId = cleanId(head.text('SUBM'));
    const subs = subId && ctx.submitters.has(subId) ? [ctx.submitters.get(subId)] : [...ctx.submitters.values()];
    const norm = s => s.normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    for (const sub of subs) {
      if (!sub.name) continue;
      const key = norm(sub.name.replace(/\//g, ' '));
      if (!key) continue;
      const hits = [];
      for (const [pid, p] of people) if (norm(p.name) === key) hits.push(pid);
      if (hits.length) {
        hits.sort((a, b) => (people.get(b).birth?.date?.year || 0) - (people.get(a).birth?.date?.year || 0));
        homeId = hits[0];
        break;
      }
    }
  }
  tree.meta.homeId = homeId;
  if (opts.fileName) tree.meta.fileName = opts.fileName;
  if (count === 0 && sawHead) W.note('No people were found in this file.');
  tree.meta.warnings = W.finish();
  return tree;
}

// ---- Record handlers ------------------------------------------------------------------

function finishRecord(rec, people, families, ctx, W) {
  switch (rec.tag) {
    case 'HEAD': ctx.head = rec; readHead(rec, ctx); break;
    case 'INDI': readIndi(rec, people, ctx, W); break;
    case 'FAM': readFam(rec, families, ctx, W); break;
    case 'SUBM': {
      const id = cleanId(rec.xref) || 'SUBM';
      const pointers = [];
      for (const c of rec.children || []) { const p = pointerOf(c.value); if (p) pointers.push(p); }
      ctx.submitters.set(id, { name: rec.text('NAME'), pointers });
      break;
    }
    default: break;
  }
}

// Tags read from INDI and FAM records; everything else (sources, notes, media) is skipped
// while scanning, which keeps big exports fast.
const INDI_TAGS = new Set(['NAME', 'SEX', 'BIRT', 'CHR', 'BAPM', '_BAPT', 'DEAT', 'BURI', 'CREM', 'FAMC', 'FAMS', 'ADOP', 'ANCI']);
const FAM_TAGS = new Set(['HUSB', 'WIFE', 'CHIL', 'MARR']);
const SUB_TAGS = new Set(['DATE', 'PLAC', 'GIVN', 'SURN', 'SPFX', 'NSFX', 'NPFX', 'TYPE', 'ROMN', '_ROMN', 'TRAN', 'LANG', 'PEDI',
  '_FREL', '_MREL', '_FATHER_REL', '_MOTHER_REL', 'FAMC', 'ADOP']);

const HOME_TAGS = new Set(['_HOME', '_ROOT', '_HME', '_HOMEPERSON', '_ROOTPERSON', '_HOME_PERSON', '_ROOT_PERSON', '_PRIM_PERSON', '_START', '_STARTPERSON']);

function readHead(head, ctx) {
  for (const c of head.children || []) {
    if (HOME_TAGS.has(c.tag)) { const p = pointerOf(c.value); if (p) ctx.homeHints.push(p); }
  }
  const sour = head.child('SOUR');
  if (sour) for (const c of sour.children || []) if (HOME_TAGS.has(c.tag)) { const p = pointerOf(c.value); if (p) ctx.homeHints.push(p); }
}

function readEvent(node) {
  const date = node.text('DATE');
  const place = cleanPlace(unescapeAt(node.text('PLAC')));
  return { date: date ? parseDate(date) : null, place, country: null, region: null, tag: node.tag };
}

/** Pick the best event among candidates: [priority, node] pairs (0 = BIRT/DEAT, 1 = CHR/BURI...). */
function pickEvent(cands) {
  if (!cands.length) return null;
  const scored = cands.map(([prio, node], i) => {
    const ev = readEvent(node);
    const hasDate = !!(ev.date && ev.date.year !== undefined);
    return { ev, prio, score: (hasDate ? 0 : 20) + prio * 10 + (ev.place ? 0 : 3), i };
  });
  // A dated christening beats an undated birth; an empty birth still beats nothing.
  scored.sort((a, b) => a.score - b.score || a.i - b.i);
  const best = scored[0].ev;
  if (!best.place) {
    const withPlace = scored.filter(x => x.ev.place).sort((a, b) => a.prio - b.prio || a.i - b.i)[0];
    if (withPlace) best.place = withPlace.ev.place;
  }
  return best;
}

function readIndi(rec, people, ctx, W) {
  let id = cleanId(rec.xref);
  if (!id) { id = `IAUTO${++ctx.auto}`; W.add('noXref'); }
  if (people.has(id)) { W.add('duplicate', `@${id}@`); return; }
  const p = { id, given: '', surname: '', name: '', suffix: '', sex: 'U', birth: null, death: null, living: false, famc: [], fams: [] };
  const names = [];
  const births = [], deaths = [];
  for (const c of rec.children || []) {
    switch (c.tag) {
      case 'NAME': names.push(c); break;
      case 'SEX': {
        const v = (c.value || '').trim().toUpperCase();
        p.sex = v[0] === 'M' ? 'M' : v[0] === 'F' ? 'F' : 'U';
        break;
      }
      case 'BIRT': births.push([0, c]); break;
      case 'CHR': case 'BAPM': case '_BAPT': births.push([1, c]); break;
      case 'DEAT': deaths.push([0, c]); break;
      case 'BURI': case 'CREM': deaths.push([1, c]); break;
      case 'FAMC': {
        const fid = pointerOf(c.value);
        if (!fid) break;
        const pediNode = c.child('PEDI');
        const explicit = pediNode ? mapPedi(pediNode.value) : null;
        const rel = combineRel(c.text('_FREL'), c.text('_MREL'));
        const link = { fam: fid, pedi: explicit || rel || 'birth' };
        if (explicit || rel) link._explicit = true;
        p.famc.push(link);
        break;
      }
      case 'FAMS': { const fid = pointerOf(c.value); if (fid) p.fams.push(fid); break; }
      case 'ADOP': {
        const f = c.child('FAMC');
        const fid = f && pointerOf(f.value);
        if (fid) ctx.adop.push([id, fid, 'adopted']);
        break;
      }
      // ANCI: the submitter is interested in this person's ancestors, a good root hint.
      case 'ANCI': if (pointerOf(c.value)) ctx.anciHints.push(id); break;
      default:
        if (HOME_TAGS.has(c.tag) && /^(y|yes|true|1)$/i.test((c.value || '').trim())) ctx.homeHints.push(id);
    }
  }
  if (names.length) {
    const chosen = names.find(nm => NAME_TYPE_PREFERRED.has(nm.text('TYPE').toUpperCase())) || names[0];
    const nm = readName(chosen);
    p.given = nm.given; p.surname = nm.surname; p.suffix = nm.suffix; p.name = nm.name;
    if (nm.romanized) p.romanized = nm.romanized;
    if (nm.livingHint) ctx.livingHints.add(id);
  }
  p.birth = pickEvent(births);
  p.death = pickEvent(deaths);
  people.set(id, p);
}

function readFam(rec, families, ctx, W) {
  let id = cleanId(rec.xref);
  if (!id) { id = `FAUTO${++ctx.auto}`; W.add('noXref'); }
  if (families.has(id)) { W.add('duplicate', `@${id}@`); return; }
  const husb = [], wife = [], children = [];
  const marr = [];
  for (const c of rec.children || []) {
    switch (c.tag) {
      case 'HUSB': { const p = pointerOf(c.value); if (p) husb.push(p); break; }
      case 'WIFE': { const p = pointerOf(c.value); if (p) wife.push(p); break; }
      case 'CHIL': {
        const p = pointerOf(c.value);
        if (!p) break;
        children.push(p);
        const rel = combineRel(c.text('_FREL') || c.text('_FATHER_REL'), c.text('_MREL') || c.text('_MOTHER_REL')) || mapPedi(c.text('PEDI'));
        if (rel) ctx.famRel.set(id + '|' + p, rel);
        break;
      }
      case 'MARR': marr.push([0, c]); break;
      default: break;
    }
  }
  const marriage = pickEvent(marr);
  families.set(id, {
    id,
    partners: [...husb, ...wife],
    children,
    marriage: marriage || null,
    roles: [...husb.map(() => 'HUSB'), ...wife.map(() => 'WIFE')],
  });
}
