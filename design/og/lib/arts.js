// Gildroot render workshop: the static marketing images in web/src/assets/img/.
// Every chart here is computed from a real GEDCOM file:
//   web/src/samples/victoria.ged      Queen Victoria's ancestors (Wikidata, CC0)
//   web/src/samples/almeida-novak.ged the fictional sample family (labelled as such wherever shown)
// Nothing is drawn by hand and no person is invented.
import { parseGedcom, ahnentafel, subtree, lifeSpan, formatDate } from './gedcom.js';
import { FONTS, fan, pedigree, laurel, compassRose, tw, esc, r2, arcOnly, RAD } from './charts.js';

// ---------------- style tokens (mirror the product's six styles) ----------------
export const MIDNIGHT = {
  wedgeA: '#101936', wedgeB: '#171B31', emptyFill: 'rgba(201,164,92,0.035)', stroke: '#C9A45C', strokeOpacity: .55, sw: .8,
  name: '#E8CB8A', date: '#A9B3D6', medFill: '#0A0F22', medStroke: '#D8B76C', medSw: 1.6, medInner: 6,
  medName: '#EDD196', medDate: '#A9B3D6', nameFont: FONTS.cg600, dateFont: FONTS.eb400, edge: '#C9A45C', edgeGap: 7,
};
const IVORY = {
  wedgeA: '#F3EDE2', wedgeB: '#EDE4D2', emptyFill: 'none', stroke: '#6B4E2E', strokeOpacity: .75, sw: .8,
  name: '#3A2A1A', date: '#8A6A48', medFill: '#F3EDE2', medStroke: '#6B4E2E', medSw: 1.4, medInner: 5,
  medName: '#3A2A1A', medDate: '#8A6A48', nameFont: FONTS.cg600, dateFont: FONTS.eb400, edge: '#6B4E2E', edgeGap: 7,
};
const BOTANICAL = {
  wedgeA: '#F4F1E6', wedgeB: '#EFEBDD', emptyFill: 'none', stroke: '#8E875C', strokeOpacity: .8, sw: .9,
  name: '#3C4629', date: '#9A6D35', medFill: '#FBF8F1', medStroke: '#6F7A45', medSw: 1.6, medInner: 6,
  medName: '#3C4629', medDate: '#9A6D35', nameFont: FONTS.cg600, dateFont: FONTS.eb400i, edge: '#8E875C', edgeGap: 8,
};
const LETTERPRESS = {
  box: '#F4EEDC', boxStroke: '#1B1A17', emptyStroke: 'rgba(27,26,23,.25)', connector: '#C8402A', connSw: 1.4, sw: 1,
  name: '#1B1A17', date: '#C8402A', nameFont: FONTS.eb600, dateFont: FONTS.eb400,
};
const NORDIC = {
  wedgeA: '#EEF1F4', wedgeB: '#E6EAEE', emptyFill: '#F7F8F9', stroke: '#FFFFFF', strokeOpacity: 1, sw: 2,
  name: '#2A2F35', date: '#6B7885', medFill: '#2A2F35', medStroke: '#2A2F35', medSw: 1,
  medName: '#FFFFFF', medDate: '#C3CCD5', nameFont: FONTS.in400, dateFont: FONTS.in400,
};
const CARTO = {
  wedgeA: '#F1F4F2', wedgeB: '#EAEFEC', emptyFill: 'none', stroke: '#3F5663', strokeOpacity: .7, sw: .8,
  name: '#1F3440', date: '#3F5663', medFill: '#F4F1E8', medStroke: '#3F5663', medSw: 1.4, medInner: 5,
  medName: '#1F3440', medDate: '#3F5663', nameFont: FONTS.cg600, dateFont: FONTS.eb400, edge: '#3F5663', edgeGap: 7,
};
// Atlas palette (7 hues + other), validated for colour-blind separation by the Atlas direction.
const ATLAS = { Germany: '#D9B46A', 'United Kingdom': '#C9806E', France: '#7FAE92', Denmark: '#8E9ECB', Sweden: '#B892B8', Netherlands: '#E3A15A', Poland: '#6AA5B3', Austria: '#A6A36B' };
const ATLAS_OTHER = '#D3CFC4';

const RINGS6 = [null,
  { max: 25, min: 15, twoLine: true, dateRatio: .66, font: FONTS.cg600 },
  { max: 21, min: 12.5, twoLine: true, dateRatio: .7, font: FONTS.cg600 },
  { max: 16.5, min: 10, twoLine: true, dateRatio: .74, font: FONTS.cg600 },
  { max: 13.5, min: 8.5, twoLine: true, dateRatio: .78, font: FONTS.eb400 },
  { max: 11, min: 6.5, twoLine: false, dateRatio: .82, font: FONTS.eb400 },
];
const RINGS7 = [null,
  { max: 28, min: 19, twoLine: true, dateRatio: .64, font: FONTS.cg600 },
  { max: 23, min: 15, twoLine: true, dateRatio: .68, font: FONTS.cg600 },
  { max: 18, min: 11, twoLine: true, dateRatio: .74, font: FONTS.cg600 },
  { max: 14.5, min: 9, twoLine: true, dateRatio: .78, font: FONTS.eb400 },
  { max: 12.5, min: 7.5, twoLine: true, dateRatio: .8, font: FONTS.eb400 },
  { max: 10.5, min: 6.2, twoLine: false, dateRatio: .82, font: FONTS.eb400 },
];
const withFont = (rings, font) => rings.map(r => r && { ...r, font });

// ---------------- helpers ----------------
function medLines(p, st, size = 36, dateSize = 16, maxW = 110) {
  const lines = [];
  const name = p.name;
  const words = name.split(' ');
  if (words.length > 1 && tw(name, FONTS.cg600, size) > maxW * 1.6) {
    const surname = p.surname || words[words.length - 1];
    const given = p.surname ? p.given.split(' ')[0] : words.slice(0, -1).join(' ');
    lines.push({ t: given, font: FONTS.cg600, size: size * .9, fill: st.medName, lh: 1.02 });
    lines.push({ t: surname, font: FONTS.cg600, size: size * .9, fill: st.medName, lh: 1.08 });
  } else {
    lines.push({ t: name.split(',')[0], font: FONTS.cg600, size, fill: st.medName, lh: 1.06 });
  }
  const ls = lifeSpan(p).replace('–', ' – ');
  if (ls) lines.push({ t: ls, font: FONTS.eb400, size: dateSize, fill: st.medDate, lh: 1.35 });
  return lines;
}
const svgText = (x, y, str, font, size, fill, extra = '') =>
  `<text x="${r2(x)}" y="${r2(y)}" font-family="${font.family}, EB Garamond, serif" font-weight="${font.weight}"${font.style ? ` font-style="${font.style}"` : ''} font-size="${size}" fill="${fill}"${extra}>${esc(str)}</text>`;
function fitSize(str, font, size, maxW, track = 0) { while (size > 6 && tw(str, font, size, track) > maxW) size -= .5; return size; }
function doubleRule(x, y, w, h, color, gap = 7, sw = 1.4) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="${color}" stroke-width="${sw}"/><rect x="${x + gap}" y="${y + gap}" width="${w - 2 * gap}" height="${h - 2 * gap}" fill="none" stroke="${color}" stroke-width="${sw * .5}"/>`;
}
function diamondRule(cx, y, half, color) {
  return `<path d="M${cx - half} ${y}H${cx - 12}M${cx + 12} ${y}H${cx + half}" stroke="${color}" stroke-width="1"/><path d="M${cx} ${y - 5}L${cx + 5} ${y}L${cx} ${y + 5}L${cx - 5} ${y}Z" fill="${color}"/>`;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.max(0, Math.min(255, v + amt)));
  return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
}
const NUM = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

// ---------------- hero: Midnight Gilt, 270°, 7 generations ----------------
// Geometry is exported so the homepage can hit-test the static image (and, later, the live canvas).
export const HERO = {
  viewBox: [-600, -572, 1200, 1112],
  radii: [0, 82, 152, 216, 278, 348, 426, 508],
  span: 270,
  gens: 7,
};

export function heroArt(model, rootId = '@I1@') {
  const { gens, radii } = HERO;
  const ahn = ahnentafel(model, rootId, gens);
  const root = ahn[1];
  const st = MIDNIGHT;
  const { defs, body } = fan({
    ahn, gens, span: HERO.span, center: 0, radii, rings: RINGS7, style: st, prefix: 'h',
    medallion: { lines: medLines(root, st, 42, 18, 136) },
  });
  const [vx, vy, vw, vh] = HERO.viewBox;
  // Pedigree collapse: people who fill more than one Ahnentafel slot.
  const seen = new Map();
  for (let n = 1; n < ahn.length; n++) if (ahn[n]) seen.set(ahn[n].id, (seen.get(ahn[n].id) || 0) + 1);
  const people = seen.size;
  const slots = ahn.filter(Boolean).length;
  const repeated = [...seen.values()].filter(v => v > 1).length;
  const title = 'THE ANCESTORS OF QUEEN VICTORIA';
  const tSize = fitSize(title, FONTS.cg600, 34, 760, .16);
  const sub = `${NUM[gens]} generations · ${people} people · 1819`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">
    <rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="#0B1024"/>
    <defs>${defs}</defs>${body}
    ${svgText(0, 432, title, FONTS.cg600, tSize, '#E6C98A', ` text-anchor="middle" letter-spacing="${r2(tSize * .16)}"`)}
    ${diamondRule(0, 458, 150, 'rgba(201,164,92,.75)')}
    ${svgText(0, 496, sub, FONTS.eb400i, 22, '#A9B3D6', ' text-anchor="middle"')}
  </svg>`;
  // Register data: [name, born, died] per Ahnentafel slot, in the brief's date style.
  const ev = e => [formatDate(e.date), e.place].filter(Boolean).join(', ');
  const data = [];
  for (let n = 0; n < ahn.length; n++) {
    const p = ahn[n];
    data.push(p ? [p.name, ev(p.birth), ev(p.death), seen.get(p.id) > 1 ? seen.get(p.id) : 0] : null);
  }
  const counts = [...seen.entries()].filter(([, v]) => v > 1).map(([id, v]) => [model.people.get(id).name, v]).sort((a, b) => b[1] - a[1]);
  return { svg, data, stats: { gens, slots, people, repeated, counts } };
}

// ---------------- gallery prints ----------------
export function artIvory(ahn) {
  const st = IVORY;
  const { defs, body } = fan({ ahn, gens: 6, span: 270, center: 0, radii: [0, 64, 122, 180, 250, 330, 410], rings: RINGS6, style: st, prefix: 'iv',
    medallion: { lines: medLines(ahn[1], st, 34, 15) } });
  return { w: 900, h: 1200, svg: `<rect width="900" height="1200" fill="#F3EDE2"/>${doubleRule(34, 34, 832, 1132, '#6B4E2E', 8, 1.6)}
    <defs>${defs}</defs><g transform="translate(450 488)">${body}</g>
    <g text-anchor="middle">
      ${diamondRule(450, 900, 190, '#6B4E2E')}
      ${svgText(450, 958, 'The Ancestors of', FONTS.eb400i, 28, '#6B4E2E', ' text-anchor="middle"')}
      ${svgText(450, 1022, 'QUEEN VICTORIA', FONTS.cg600, 54, '#3A2A1A', ' text-anchor="middle" letter-spacing="6"')}
      ${svgText(450, 1068, 'Six generations · 1819', FONTS.eb400i, 24, '#8A6A48', ' text-anchor="middle"')}
    </g>` };
}

export function artMidnightBowtie(ahn) {
  const st = MIDNIGHT;
  const radii = [0, 92, 164, 236, 322, 424];
  const rings = [null, { ...RINGS6[1], max: 28 }, { ...RINGS6[2], max: 23 }, { ...RINGS6[3], max: 18 }, { ...RINGS6[4], max: 15 }];
  const side = (k, c, pre) => fan({ ahn: subtree(ahn, k, 5), gens: 5, span: 156, center: c, radii, rings, style: { ...st, edge: null }, prefix: pre, medallion: { lines: [] } });
  const L = side(2, -90, 'mgl'), R = side(3, 90, 'mgr');
  const strip = s => s.replace(/<g class="ring med"[\s\S]*$/, '');
  const med = `<circle r="92" fill="#0A0F22" stroke="#D8B76C" stroke-width="2"/><circle r="84" fill="none" stroke="#D8B76C" stroke-width=".8" stroke-opacity=".7"/>
    ${svgText(0, -24, 'Edward', FONTS.cg600, 32, '#EDD196', ' text-anchor="middle"')}
    ${svgText(0, 6, '&', FONTS.cg500i, 26, '#C9A45C', ' text-anchor="middle"')}
    ${svgText(0, 38, 'Victoria', FONTS.cg600, 32, '#EDD196', ' text-anchor="middle"')}
    ${svgText(0, 64, 'm. 1818', FONTS.eb400, 17, '#A9B3D6', ' text-anchor="middle"')}`;
  const flank = (x, a, b, c) => `<g text-anchor="middle">${svgText(x, 430, a, FONTS.cg600, 24, '#E3C27E', ' text-anchor="middle" letter-spacing="4"')}${diamondRule(x, 456, 70, 'rgba(201,164,92,.7)')}${svgText(x, 494, b, FONTS.cg600, 30, '#EDD196', ' text-anchor="middle"')}${svgText(x, 528, c, FONTS.eb400i, 21, '#A9B3D6', ' text-anchor="middle"')}</g>`;
  return { w: 1500, h: 1000, svg: `<rect width="1500" height="1000" fill="#0B1024"/>${doubleRule(30, 30, 1440, 940, '#C9A45C', 8, 1.4)}
    <defs>${L.defs}${R.defs}</defs><g transform="translate(750 462)">${strip(L.body)}${strip(R.body)}${med}</g>
    ${flank(190, 'HIS FAMILY', 'Edward', 'Duke of Kent, 1767–1820')}
    ${flank(1310, 'HER FAMILY', 'Victoria', 'of Saxe-Coburg, 1786–1861')}
    ${svgText(750, 930, 'TWO FAMILIES · MARRIED 1818', FONTS.cg600, 28, '#E3C27E', ' text-anchor="middle" letter-spacing="6"')}` };
}

export function artBotanical(ahn) {
  const st = BOTANICAL;
  const tint = { p: ['#DCE1C3', '#E3E7CF', '#E9ECDB', '#EFF1E6', '#F3F4EC'], m: ['#EFD5CC', '#F2DDD5', '#F5E5DF', '#F8ECE8', '#FAF2EF'] };
  const fillFor = (n, g, i) => { const pat = i < 2 ** g / 2; const a = (pat ? tint.p : tint.m)[g - 1]; return i % 2 ? a : shade(a, -4); };
  const rings = [null, { ...RINGS6[1], max: 30 }, { ...RINGS6[2], max: 25 }, { ...RINGS6[3], max: 20, min: 11 }, { ...RINGS6[4], max: 16, min: 9 }];
  const { defs, body } = fan({ ahn, gens: 5, span: 180, center: 0, radii: [0, 108, 200, 292, 414, 560], rings, style: st, prefix: 'bo', fillFor,
    medallion: { lines: medLines(ahn[1], st, 38, 17) } });
  return { w: 1400, h: 1100, svg: `<rect width="1400" height="1100" fill="#FBF8F1"/>${doubleRule(34, 34, 1332, 1032, '#8E875C', 8, 1.4)}
    <defs>${defs}</defs><g transform="translate(700 700)">${body}</g>
    ${laurel(700, 846, 620, '#6F7A45', 1.6)}
    ${svgText(700, 960, 'The Ancestors of Queen Victoria', FONTS.cg500i, 46, '#3C4629', ' text-anchor="middle"')}
    ${svgText(700, 1004, 'Five generations, father’s line in olive, mother’s in rose', FONTS.eb400i, 23, '#9A6D35', ' text-anchor="middle"')}` };
}

export function artLetterpress(ahn) {
  const st = LETTERPRESS;
  const rings = [
    { max: 26, min: 14, twoLine: true, dateRatio: .7, font: FONTS.cg600 },
    { max: 21, min: 12, twoLine: true, dateRatio: .72, font: FONTS.eb600 },
    { max: 17, min: 10, twoLine: true, dateRatio: .75, font: FONTS.eb600 },
    { max: 14, min: 8, twoLine: false, dateRatio: .8, font: FONTS.eb400 },
    { max: 11.5, min: 6.5, twoLine: false, dateRatio: .8, font: FONTS.eb400 },
  ];
  return { w: 1100, h: 850, svg: `<rect width="1100" height="850" fill="#F4EEDC"/>
    ${svgText(550, 92, 'THE ANCESTORS OF QUEEN VICTORIA', FONTS.cg600, 42, '#1B1A17', ' text-anchor="middle" letter-spacing="5"')}
    <path d="M150 116H950M150 122H950" stroke="#C8402A" stroke-width="1.6"/>
    ${svgText(550, 152, 'Five generations · 1819', FONTS.eb400i, 22, '#C8402A', ' text-anchor="middle"')}
    ${pedigree({ ahn, gens: 5, x0: 56, y0: 180, w: 988, h: 630, style: st, rings, maxBox: 150 })}` };
}

export function artNordic(ahn) {
  const st = NORDIC;
  const fillFor = (n, g, i) => { const pat = i < 2 ** g / 2; return pat ? (i % 2 ? '#DDE5EC' : '#D5DEE7') : (i % 2 ? '#EEF1F4' : '#E7EBEF'); };
  const rings = withFont([null, { ...RINGS6[1], max: 19, min: 11 }, { ...RINGS6[2], max: 15, min: 9 }, { ...RINGS6[3], max: 12, min: 8 }, { ...RINGS6[4], max: 10, min: 6.5 }, { ...RINGS6[5], max: 8.5, min: 5.5 }], FONTS.in400);
  const med = medLines(ahn[1], st, 22, 11).map(l => ({ ...l, font: l.font === FONTS.cg600 ? FONTS.in600 : FONTS.in400 }));
  const { defs, body } = fan({ ahn, gens: 6, span: 360, center: 0, radii: [0, 58, 104, 150, 210, 278, 346], rings, style: st, prefix: 'no', fillFor, curved: 2,
    medallion: { lines: med } });
  return { w: 800, h: 1000, svg: `<rect width="800" height="1000" fill="#FFFFFF"/>
    <defs>${defs}</defs><g transform="translate(400 412)">${body}</g>
    ${svgText(64, 874, 'Victoria', FONTS.in600, 44, '#2A2F35', ' letter-spacing="-.5"')}
    ${svgText(64, 912, 'Ancestors in six generations', FONTS.in400, 20, '#6B7885')}
    ${svgText(736, 912, '1819', FONTS.in400, 20, '#6B7885', ' text-anchor="end"')}
    <path d="M64 840H736" stroke="#2A2F35" stroke-width="2"/>` };
}

function countryOf(p) {
  const pl = p.birth.place || '';
  if (!pl.includes(',')) return null;
  return pl.split(',').pop().trim();
}
export function artCarto(ahn) {
  const st = CARTO;
  const counts = new Map();
  for (let n = 1; n < 64; n++) { const p = ahn[n]; if (!p) continue; const c = countryOf(p); if (c) counts.set(c, (counts.get(c) || 0) + 1); }
  const fillFor = (n, g, i, p) => { const c = countryOf(p); return c ? (ATLAS[c] || ATLAS_OTHER) : '#F1F4F2'; };
  const { defs, body } = fan({ ahn, gens: 6, span: 270, center: 0, radii: [0, 64, 122, 180, 250, 330, 410], rings: RINGS6, style: st, prefix: 'ca', fillFor,
    medallion: { lines: medLines(ahn[1], st, 34, 15) } });
  const grat = [];
  for (let k = -4; k <= 4; k++) grat.push(`<ellipse cx="450" cy="600" rx="${Math.abs(k) * 110 + 1}" ry="760" fill="none"/>`);
  for (let k = 0; k < 9; k++) { const y = 80 + k * 130; grat.push(`<path d="M0 ${y}Q450 ${y - 40} 900 ${y}" fill="none"/>`); }
  const total = [...counts.values()].reduce((a, b) => a + b, 0) || 1;
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const legend = sorted.slice(0, 6).map(([c, v], i) => {
    const x = 120 + (i % 3) * 230, y = 1058 + Math.floor(i / 3) * 40;
    return `<rect x="${x}" y="${y - 17}" width="22" height="22" fill="${ATLAS[c] || ATLAS_OTHER}" stroke="#3F5663" stroke-width=".8"/>${svgText(x + 34, y, `${c} ${Math.round((v / total) * 100)}%`, FONTS.eb400, 22, '#1F3440')}`;
  }).join('');
  return { w: 900, h: 1200, svg: `<rect width="900" height="1200" fill="#E3EBEE"/><g stroke="#C4D4DB" stroke-width="1">${grat.join('')}</g>
    ${doubleRule(34, 34, 832, 1132, '#3F5663', 8, 1.4)}
    ${compassRose(782, 134, 48, '#3F5663', '#E3EBEE')}
    <defs>${defs}</defs><g transform="translate(450 488)">${body}</g>
    ${svgText(450, 930, 'WHERE QUEEN VICTORIA’S ANCESTORS WERE BORN', FONTS.cg600, 30, '#1F3440', ' text-anchor="middle" letter-spacing="2"')}
    ${svgText(450, 972, `Born in ${counts.size} countries across six generations`, FONTS.eb400i, 23, '#3F5663', ' text-anchor="middle"')}
    <path d="M110 1010H790" stroke="#3F5663" stroke-width=".8"/>
    ${legend}` };
}

// Gift card front: the brief's fictional sample family (Almeida–Novak), four generations, Ivory.
export function artCard(model) {
  const rootId = [...model.people.keys()][0];
  const ahn = ahnentafel(model, rootId, 4);
  const st = IVORY;
  const rings = [null, { ...RINGS6[1], max: 20, min: 11 }, { ...RINGS6[2], max: 15, min: 9 }, { max: 12, min: 7, twoLine: true, dateRatio: .8, font: FONTS.eb400 }];
  const { defs, body } = fan({ ahn, gens: 4, span: 180, center: 0, radii: [0, 58, 114, 166, 226], rings, style: { ...st, edge: '#6B4E2E', edgeGap: 6 }, prefix: 'gc', curved: 2,
    medallion: { lines: medLines(ahn[1], st, 22, 12, 72) } });
  const name = ahn[1].name;
  const nSize = fitSize(name, FONTS.cg600, 32, 400);
  return { w: 500, h: 700, svg: `<rect width="500" height="700" fill="#F4EEE2"/>${doubleRule(22, 22, 456, 656, '#6B4E2E', 6, 1.2)}
    ${svgText(250, 112, 'The Ancestors of', FONTS.eb400i, 22, '#8A6A48', ' text-anchor="middle"')}
    ${svgText(250, 152, name, FONTS.cg600, nSize, '#3A2A1A', ' text-anchor="middle"')}
    ${diamondRule(250, 184, 80, '#6B4E2E')}
    <defs>${defs}</defs><g transform="translate(250 470)">${body}</g>
    ${laurel(250, 552, 250, '#6B4E2E', 1)}
    ${svgText(250, 620, 'For Mom · Christmas 2026', FONTS.eb400i, 21, '#8A6A48', ' text-anchor="middle"')}` };
}

export { parseGedcom, ahnentafel };
