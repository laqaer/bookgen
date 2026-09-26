// Chart drawing for the Atlas homepage mockup.
// Everything here is computed from the Queen Victoria sample (web/src/samples/victoria.ged, Wikidata CC0).
// Nothing is invented: names, years and birthplaces come from the file; coordinates from Wikidata P19/P625.
import fs from 'node:fs';
import opentype from './node_modules/opentype.js/dist/opentype.module.js';
import { readGed, ahnentafel, year } from './ged.mjs';

const loadFont = f => { const b = fs.readFileSync(new URL('./cache/' + f, import.meta.url)); return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); };
export const FONTS = { garamond: loadFont('EBGaramond-400.ttf'), garamondSemi: loadFont('EBGaramond-600.ttf'), cormorant: loadFont('CormorantGaramond-600.ttf'), fira: loadFont('FiraSans-500.ttf') };
export const measure = (s, size, font = FONTS.garamond) => font.getAdvanceWidth(s, size);

// ---------- palette ----------
export const ATLAS = [ // fixed order; validated adjacent-pairs with the dataviz validator on #E6EDEE
  { key: 'gilt', name: 'Gilt', deep: '#9C7A22' },
  { key: 'lake', name: 'Lake', deep: '#2F6DAA' },
  { key: 'madder', name: 'Madder', deep: '#B5443A' },
  { key: 'verdigris', name: 'Verdigris', deep: '#00897B' },
  { key: 'sienna', name: 'Sienna', deep: '#C4691C' },
  { key: 'heather', name: 'Heather', deep: '#7050A8' },
  { key: 'moss', name: 'Moss', deep: '#5A8A33' },
];
export const OTHER = { key: 'other', name: 'Stone', deep: '#85837A' };
const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
export const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return rgb2hex(A.map((v, i) => v + (B[i] - v) * t)); };
export const tint = (deep, amt = 0.30, paper = '#FAFBF8') => mix(paper, deep, amt);

// ---------- data ----------
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export function loadVictoria(gens) {
  const g = readGed(new URL('../../../../web/src/samples/victoria.ged', import.meta.url).pathname);
  const bp = JSON.parse(fs.readFileSync(new URL('./cache/birthplaces.json', import.meta.url)));
  const a = ahnentafel(g, '@I1@', gens);
  for (const p of Object.values(a)) {
    const pl = p.bplac || '';
    const seg = pl.includes(',') ? pl.split(',').pop().trim() : null;
    const wd = bp[p.qid];
    // "Bavarian, Austria": Wikidata's place is a region claimed by two countries, so we leave it unplaced.
    p.country = seg && !(wd && wd.countries.length > 1) ? seg : null;
    p.town = pl ? pl.split(',')[0].trim() : null;
    p.lonlat = p.country && wd?.lonlat ? wd.lonlat : null;
    p.by = year(p.bdate); p.dy = year(p.ddate);
  }
  return a;
}
export function countryRanks(a, maxN) {
  const counts = {};
  for (const [n, p] of Object.entries(a)) if (+n >= 2 && +n <= maxN && p.country) counts[p.country] = (counts[p.country] || 0) + 1;
  const ranked = Object.entries(counts).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  const colour = {};
  ranked.forEach(([c], i) => colour[c] = i < ATLAS.length ? ATLAS[i] : OTHER);
  return { ranked, colour };
}

// ---------- fan ----------
const rad = d => d * Math.PI / 180;
const f2 = v => +v.toFixed(2);
export function fan(o) {
  const { people, gens, span = 270, cx, cy, radii, fill, line = '#FFFFFF', lineW = 0.8, ink = '#14232E', ink2 = '#43535E',
    textRings = gens - 1, radialFrom = 4, sizes, id = 'f', rootFill = '#FAFBF8', rootStroke = '#14232E', rootName = 'Victoria', rootDates = '1819–1901',
    rootFont = 30, rootDateFont = 12, emptyFill = 'none', emptyStroke = line, font = 'EB Garamond', bloom = false, ringClass = 'ring', info = false } = o;
  const P = (r, a) => [f2(cx + r * Math.sin(rad(a))), f2(cy - r * Math.cos(rad(a)))];
  let wedges = '', texts = '', defs = '';
  for (let k = 1; k < gens; k++) {
    const r0 = radii[k - 1], r1 = radii[k], n0 = 2 ** k, step = span / n0;
    let ringW = '', ringT = '';
    for (let i = 0; i < n0; i++) {
      const n = n0 + i, p = people[n];
      const a0 = -span / 2 + i * step, a1 = a0 + step, large = step > 180 ? 1 : 0;
      const [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0);
      const d = `M${x0} ${y0}A${r1} ${r1} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 ${large} 0 ${x3} ${y3}Z`;
      const fl = p ? fill(n, p) : emptyFill;
      const tip = p && info ? ` data-t="${esc([p.name, p.by ? 'b. ' + p.by : '', p.bplac || 'birthplace not in the file'].filter(Boolean).join(' · '))}"` : '';
      ringW += `<path d="${d}" fill="${fl}"${p ? ` data-n="${n}"` : ''}${tip}/>`;
      if (!p || k > textRings) continue;
      const sz = sizes[k - 1];
      const names = ladder(p.name);
      const dates = p.by ? (p.dy ? `${p.by}–${p.dy}` : `b. ${p.by}`) : '';
      const am = (a0 + a1) / 2;
      if (k < radialFrom) { // along the arc
        const flip = Math.abs(am) > 90;
        const avail = (r) => rad(step) * r * 0.86;
        const rn = r0 + (r1 - r0) * (flip ? 0.40 : 0.60), rd = r0 + (r1 - r0) * (flip ? 0.72 : 0.30);
        const nm = fit(names, sz.name, avail(rn), sz.min);
        const pid = `${id}-a${n}`, pid2 = `${id}-d${n}`;
        const arcPath = (r, pid) => { const [sx, sy] = P(r, flip ? a1 : a0), [ex, ey] = P(r, flip ? a0 : a1); defs += `<path id="${pid}" d="M${sx} ${sy}A${r} ${r} 0 ${large} ${flip ? 0 : 1} ${ex} ${ey}"/>`; };
        arcPath(rn, pid);
        ringT += `<text font-size="${nm.size}" fill="${ink}" dy="${f2(nm.size * 0.32)}"><textPath href="#${pid}" startOffset="50%" text-anchor="middle">${esc(nm.text)}</textPath></text>`;
        if (dates && sz.date) { arcPath(rd, pid2); ringT += `<text font-size="${sz.date}" fill="${ink2}" dy="${f2(sz.date * 0.32)}" class="d"><textPath href="#${pid2}" startOffset="50%" text-anchor="middle">${dates}</textPath></text>`; }
      } else { // radial
        const rm = (r0 + r1) / 2, [tx, ty] = P(rm, am);
        const rot = am >= 0 ? am - 90 : am + 90;
        const availLen = (r1 - r0) * 0.88, availW = rad(step) * rm;
        const nm = fit(names, sz.name, availLen, sz.min);
        const showDate = dates && sz.date && availW > (nm.size + sz.date) * 1.15;
        const off = showDate ? (nm.size + sz.date) * 0.5 : 0;
        ringT += `<g transform="translate(${tx} ${ty}) rotate(${f2(rot)})"><text text-anchor="middle" font-size="${nm.size}" fill="${ink}" y="${f2(-off + nm.size * 0.62 + (showDate ? 0 : -nm.size * 0.3))}">${esc(nm.text)}</text>${showDate ? `<text class="d" text-anchor="middle" font-size="${sz.date}" fill="${ink2}" y="${f2(off + sz.date * 0.2)}">${dates}</text>` : ''}</g>`;
      }
    }
    wedges += `<g class="${ringClass} r${k}" style="--k:${k}">${ringW}</g>`;
    texts += `<g class="${ringClass} r${k}" style="--k:${k}">${ringT}</g>`;
  }
  const r0 = radii[0];
  const root = `<g class="${ringClass} r0" style="--k:0"><circle cx="${cx}" cy="${cy}" r="${r0}" fill="${rootFill}" stroke="${rootStroke}" stroke-width="${lineW * 1.2}"/>` +
    (rootName ? `<text x="${cx}" y="${cy + rootFont * 0.18}" text-anchor="middle" font-size="${rootFont}" fill="${ink}" class="rootname">${esc(rootName)}</text><text x="${cx}" y="${cy + rootFont * 0.18 + rootDateFont * 1.6}" text-anchor="middle" font-size="${rootDateFont}" fill="${ink2}" class="d">${rootDates}</text>` : '') + '</g>';
  return { defs: `<defs>${defs}</defs>`, body: `<g stroke="${line}" stroke-width="${lineW}" stroke-linejoin="round" class="wedges">${wedges}</g><g font-family="${font}" stroke="none" pointer-events="none">${texts}</g>${root}` };
}
// the brief's abbreviation ladder, adapted to the titled names in this sample
export function ladder(full) {
  const out = [full];
  const noComma = full.split(',')[0].trim(); out.push(noComma);
  const beforeOf = noComma.split(/\s+(?:of|von|zu|de|van)\s+/i)[0]; out.push(beforeOf);
  const untitled = beforeOf.replace(/^(Prince|Princess|Duke|Duchess|Count|Countess|Landgrave|Margrave|Elector|King|Queen|Archduke|Countess Palatine)\s+/, ''); out.push(untitled);
  out.push(untitled.split(/\s+/)[0]);
  return [...new Set(out.filter(Boolean))];
}
function fit(cands, size, avail, min) {
  for (const c of cands) if (measure(c, size) <= avail) return { text: c, size };
  const last = cands[cands.length - 1];
  for (const c of cands) { const s = size * avail / measure(c, size); if (s >= min) return { text: c, size: f2(s) }; }
  return { text: last, size: f2(Math.max(min * 0.8, size * avail / measure(last, size))) };
}
