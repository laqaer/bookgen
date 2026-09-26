// Minimal GEDCOM reader for the design mockup (Victoria CC0 sample only).
import fs from 'node:fs';
export function readGed(path) {
  const lines = fs.readFileSync(path, 'utf8').split(/\r?\n/);
  const indi = {}, fam = {};
  let cur = null, ctx = null;
  for (const ln of lines) {
    const m = ln.match(/^(\d+)\s+(@[^@]+@\s+)?(\S+)\s?(.*)$/);
    if (!m) continue;
    const lvl = +m[1], id = m[2]?.trim(), tag = m[3], val = m[4];
    if (lvl === 0) {
      ctx = null;
      if (tag === 'INDI') cur = indi[id] = { id, famc: null, fams: [] };
      else if (tag === 'FAM') cur = fam[id] = { id, husb: null, wife: null, chil: [] };
      else cur = null;
      continue;
    }
    if (!cur) continue;
    if (lvl === 1) {
      ctx = tag;
      if (tag === 'NAME') cur.name = val.replace(/\//g, '').trim();
      if (tag === 'SEX') cur.sex = val;
      if (tag === 'FAMC') cur.famc = val;
      if (tag === 'FAMS') cur.fams.push(val);
      if (tag === 'HUSB') cur.husb = val;
      if (tag === 'WIFE') cur.wife = val;
      if (tag === 'CHIL') cur.chil.push(val);
      if (tag === 'NOTE' && /Wikidata (Q\d+)/.test(val)) cur.qid = val.match(/Q\d+/)[0];
    } else if (lvl === 2 && (ctx === 'BIRT' || ctx === 'DEAT')) {
      const k = ctx === 'BIRT' ? 'b' : 'd';
      if (tag === 'DATE') cur[k + 'date'] = val;
      if (tag === 'PLAC') cur[k + 'plac'] = val;
    }
  }
  return { indi, fam };
}
export function ahnentafel(g, rootId, gens) {
  const out = {};
  const walk = (id, n, gen) => {
    if (!id || gen > gens) return;
    out[n] = g.indi[id];
    const f = g.indi[id].famc && g.fam[g.indi[id].famc];
    if (!f) return;
    walk(f.husb, 2 * n, gen + 1);
    walk(f.wife, 2 * n + 1, gen + 1);
  };
  walk(rootId, 1, 1);
  return out;
}
export const year = d => { const m = (d || '').match(/(\d{3,4})(?!.*\d{3,4})/); return m ? m[1] : ''; };
