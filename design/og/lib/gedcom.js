// Minimal GEDCOM reader for the homepage mockup.
// The product parses with read-gedcom in a worker (BRIEF 4.6); this is only
// enough to make the hero drop zone honest: your file, read here, nothing sent.

const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function parseDate(raw) {
  if (!raw) return null;
  const s = raw.toUpperCase().trim();
  let q = '';
  if (/^(ABT|ABOUT|CAL|EST|BET|FROM)\b/.test(s)) q = 'c.';
  else if (/^BEF\b/.test(s)) q = 'bef.';
  else if (/^AFT\b/.test(s)) q = 'aft.';
  const tokens = s.replace(/^(ABT|ABOUT|CAL|EST|BEF|AFT|BET|FROM|TO)\s+/, '').split(/\s+/);
  let d = null, m = null, y = null;
  for (const t of tokens) {
    if (t === 'AND' || t === 'TO') break;
    if (MONTHS[t]) m = MONTHS[t];
    else if (/^\d{3,4}(\/\d{1,4})?$/.test(t)) y = parseInt(t, 10);
    else if (/^\d{1,2}$/.test(t) && m === null) d = parseInt(t, 10);
  }
  if (!y) return null;
  return { d, m, y, q };
}

export function formatDate(dt) {
  if (!dt) return '';
  const core = [dt.d, dt.m ? MONTH_NAMES[dt.m] : null, dt.y].filter(Boolean).join(' ');
  return dt.q ? `${dt.q} ${core}` : core;
}

export function yearOf(dt) {
  if (!dt) return '';
  return dt.q ? `${dt.q} ${dt.y}` : String(dt.y);
}

function cleanName(val) {
  const m = val.match(/^(.*?)\/(.*?)\/(.*)$/);
  let given = val, surname = '';
  if (m) { given = (m[1] + ' ' + m[3]).trim(); surname = m[2].trim(); }
  const full = [given, surname].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return { full: full.normalize('NFC'), given: given.normalize('NFC'), surname: surname.normalize('NFC') };
}

export function parseGedcom(text) {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\r|\n/);
  const people = new Map();
  const fams = new Map();
  const order = [];
  let cur = null, kind = null, l1 = null;
  for (const raw of lines) {
    const m = raw.match(/^\s*(\d+)\s+(@[^@]+@\s+)?([A-Za-z0-9_]+)(?:\s(.*))?$/);
    if (!m) continue;
    const level = +m[1];
    const xref = m[2] ? m[2].trim() : null;
    const tag = m[3].toUpperCase();
    const val = (m[4] || '').trim();
    if (level === 0) {
      l1 = null;
      if (tag === 'INDI') {
        cur = { id: xref, name: '', given: '', surname: '', sex: '', birth: {}, death: {}, famc: null, fams: [] };
        people.set(xref, cur); order.push(xref); kind = 'I';
      } else if (tag === 'FAM') {
        cur = { id: xref, husb: null, wife: null, marr: {}, chil: [] };
        fams.set(xref, cur); kind = 'F';
      } else { cur = null; kind = null; }
      continue;
    }
    if (!cur) continue;
    if (level === 1) {
      l1 = tag;
      if (kind === 'I') {
        if (tag === 'NAME' && !cur.name) { const n = cleanName(val); cur.name = n.full; cur.given = n.given; cur.surname = n.surname; }
        else if (tag === 'SEX') cur.sex = val;
        else if (tag === 'FAMC' && !cur.famc) cur.famc = val;
        else if (tag === 'FAMS') cur.fams.push(val);
      } else {
        if (tag === 'HUSB') cur.husb = val;
        else if (tag === 'WIFE') cur.wife = val;
        else if (tag === 'CHIL') cur.chil.push(val);
      }
    } else if (level === 2 && (tag === 'DATE' || tag === 'PLAC')) {
      let ev = null;
      if (kind === 'I') {
        if (l1 === 'BIRT' || ((l1 === 'CHR' || l1 === 'BAPM') && !cur.birth.date)) ev = cur.birth;
        else if (l1 === 'DEAT' || (l1 === 'BURI' && !cur.death.date)) ev = cur.death;
      } else if (l1 === 'MARR') ev = cur.marr;
      if (ev) {
        if (tag === 'DATE') ev.date = parseDate(val);
        else ev.place = val.normalize('NFC');
      }
    }
  }
  for (const p of people.values()) {
    if (!p.name) p.name = 'Unknown';
    // BRIEF 4.3: living = no death event and born less than 100 years ago. Dates hidden.
    const by = p.birth.date && p.birth.date.y;
    p.living = !p.death.date && !p.death.place && (!by || by > new Date().getFullYear() - 100) && !!by;
  }
  return { people, fams, order };
}

// Ahnentafel array: index 1 is the root, 2n the father of n, 2n+1 the mother.
export function ahnentafel(model, rootId, gens) {
  const arr = new Array(2 ** gens).fill(null);
  arr[1] = model.people.get(rootId) || null;
  for (let n = 1; n < 2 ** (gens - 1); n++) {
    const p = arr[n];
    if (!p || !p.famc) continue;
    const f = model.fams.get(p.famc);
    if (!f) continue;
    arr[2 * n] = (f.husb && model.people.get(f.husb)) || null;
    arr[2 * n + 1] = (f.wife && model.people.get(f.wife)) || null;
  }
  return arr;
}

// Re-root an Ahnentafel array at ancestor k (used for the two sides of a bowtie).
export function subtree(ahn, k, gens) {
  const out = new Array(2 ** gens).fill(null);
  for (let g = 0; g < gens; g++) {
    for (let i = 0; i < 2 ** g; i++) {
      const src = k * 2 ** g + i;
      out[2 ** g + i] = src < ahn.length ? ahn[src] : null;
    }
  }
  return out;
}

// Pick a sensible center person for a dropped file: the one with the most
// known ancestors in six generations (usually the home person or a sibling).
export function pickRoot(model) {
  let best = null, bestScore = -1;
  const first = model.order[0];
  for (const id of model.order) {
    const ahn = ahnentafel(model, id, 6);
    let score = 0;
    for (let n = 2; n < ahn.length; n++) if (ahn[n]) score++;
    if (id === first) score += 0.5;
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

export function lifeSpan(p) {
  if (!p || p.living) return '';
  const b = yearOf(p.birth.date), d = yearOf(p.death.date);
  if (b && d) return `${b}–${d}`;
  if (b) return `b. ${b}`;
  if (d) return `d. ${d}`;
  return '';
}

export function relation(n, rootName) {
  if (n === 1) return 'The person at the center';
  const g = Math.floor(Math.log2(n));
  const male = n % 2 === 0;
  const side = g >= 2 ? ((n - 2 ** g) < 2 ** (g - 1) ? 'paternal ' : 'maternal ') : '';
  let base;
  if (g === 1) base = male ? 'father' : 'mother';
  else if (g === 2) base = male ? 'grandfather' : 'grandmother';
  else if (g === 3) base = male ? 'great-grandfather' : 'great-grandmother';
  else base = `${g - 2}× great-grandfather`.replace('father', male ? 'father' : 'mother');
  const who = rootName ? `${rootName}’s ` : '';
  return `${who}${side}${base}`;
}
