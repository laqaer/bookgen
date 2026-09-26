#!/usr/bin/env node
// Synthetic large GEDCOM generator (fictional people, deterministic).
//   node web/test/fixtures/gen-large.mjs [count=50000] [out.ged]
// Without an output path it prints the size only. Tests import generateLargeGedcom() and parse
// the string in memory, so the multi-megabyte file is never committed.

const GIVEN_M = ['John', 'William', 'James', 'Johann', 'Pierre', 'José', 'Jan', 'Lars', 'Seán', 'Giovanni', 'Mikhail', 'Nikolaos', 'Tomás', 'Karl', 'Józef', 'Henrik', 'Luis', 'Patrick', 'Georg', 'Antonín'];
const GIVEN_F = ['Mary', 'Anna', 'Elizabeth', 'Maria', 'Marie', 'Ingrid', 'Bridget', 'Rosa', 'Sofia', 'Eleni', 'Katarzyna', 'Johanna', 'Margaret', 'Kateřina', 'Brita', 'Ana', 'Zofia', 'Helga', 'Aoife', 'Lucía'];
const SURNAMES = ['Smith', 'Müller', 'García', 'Novák', 'Kowalski', 'Ødegård', 'Byrne', 'Rossi', 'Papadopoulos', 'Nguyen', 'Andersson', 'Dubois', 'Schmidt', 'Almeida', 'Walsh', 'Horváth', 'Jansen', 'Petrov', 'Murphy', 'Weber'];
const PLACES = ['Boston, Suffolk, Massachusetts, USA', 'Cork, County Cork, Ireland', 'Tábor, Bohemia, Austrian Empire', 'Ålesund, Møre og Romsdal, Norway',
  'Kraków, Galicia, Austria-Hungary', 'Lyon, Rhône, France', 'Toledo, Lucas, Ohio, USA', 'Tripoli, Arcadia, Greece', 'Ponta Delgada, Azores, Portugal',
  'Stuttgart, Württemberg, Germany', 'Chicago, Cook, Illinois, USA', 'Vilna, Russian Empire', 'Hải Phòng, Tonkin, French Indochina', 'Göteborg, Sweden', 'Unknownville'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * Build a synthetic GEDCOM with `count` people arranged as a many-generation pedigree forest.
 * @param {number} [count]
 * @param {number} [seed]
 * @returns {string}
 */
export function generateLargeGedcom(count = 50000, seed = 42) {
  const r = rng(seed);
  const pick = a => a[Math.floor(r() * a.length)];
  const out = ['0 HEAD', '1 SOUR GILDROOT_SYNTH', '2 NAME Gildroot synthetic generator', '1 GEDC', '2 VERS 5.5.1', '2 FORM LINEAGE-LINKED', '1 CHAR UTF-8',
    '1 NOTE Synthetic fictional people for performance tests.'];
  // Person i has parents 2i+1 (father) and 2i+2 (mother) when they exist: a binary pedigree
  // with some gaps, plus a family record per couple. Birth years go back ~28 per generation.
  const fams = [];
  const famOfChild = new Map();
  for (let i = 0; 2 * i + 2 < count; i++) {
    if (r() < 0.08) continue; // gaps
    const fid = fams.length + 1;
    fams.push({ id: fid, h: 2 * i + 1, w: 2 * i + 2, c: i });
    famOfChild.set(i, fid);
  }
  const famsOf = new Map();
  for (const f of fams) { famsOf.set(f.h, f.id); famsOf.set(f.w, f.id); }
  for (let i = 0; i < count; i++) {
    const gen = Math.floor(Math.log2(i + 1));
    const male = i === 0 ? r() < 0.5 : i % 2 === 1;
    const year = 1990 - gen * 28 - Math.floor(r() * 8);
    const sur = pick(SURNAMES);
    out.push(`0 @I${i + 1}@ INDI`);
    out.push(`1 NAME ${pick(male ? GIVEN_M : GIVEN_F)} ${r() < 0.4 ? pick(male ? GIVEN_M : GIVEN_F) + ' ' : ''}/${sur}/`);
    out.push(`2 GIVN ${pick(male ? GIVEN_M : GIVEN_F)}`);
    out.push(`2 SURN ${sur}`);
    out.push(`1 SEX ${male ? 'M' : 'F'}`);
    out.push('1 BIRT');
    const q = r();
    out.push(`2 DATE ${q < 0.15 ? 'ABT ' + year : q < 0.2 ? 'BEF ' + year : `${1 + Math.floor(r() * 28)} ${pick(MONTHS)} ${year}`}`);
    out.push(`2 PLAC ${pick(PLACES)}`);
    if (year < 1940 || r() < 0.2) {
      out.push('1 DEAT');
      out.push(`2 DATE ${year + 40 + Math.floor(r() * 45)}`);
    }
    out.push(`1 _UID ${(i * 2654435761 >>> 0).toString(16).padStart(8, '0')}`);
    out.push('1 NOTE Synthetic person used for performance tests. This note is long enough to need');
    out.push('2 CONC  a continuation line, like real exports.');
    if (famOfChild.has(i)) out.push(`1 FAMC @F${famOfChild.get(i)}@`);
    if (famsOf.has(i)) out.push(`1 FAMS @F${famsOf.get(i)}@`);
  }
  for (const f of fams) {
    out.push(`0 @F${f.id}@ FAM`, `1 HUSB @I${f.h + 1}@`, `1 WIFE @I${f.w + 1}@`, `1 CHIL @I${f.c + 1}@`, '1 MARR', `2 DATE ABT ${1990 - Math.floor(Math.log2(f.c + 1)) * 28 - 30}`);
  }
  out.push('0 TRLR', '');
  return out.join('\n');
}

const isMain = typeof process !== 'undefined' && process.argv && process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href;
if (isMain) {
  const n = Number(process.argv[2]) || 50000;
  const text = generateLargeGedcom(n);
  if (process.argv[3]) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.argv[3], text);
  }
  console.log(`${n} people, ${(Buffer.byteLength(text) / 1e6).toFixed(1)} MB${process.argv[3] ? ' -> ' + process.argv[3] : ''}`);
}
