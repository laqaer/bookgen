// Builds ../index.html from ./index.src.html by inlining the chart and map SVGs.
// Run: cd design/directions/atlas/build && npm i && node wikidata.mjs && node build.mjs
// (wikidata.mjs caches birthplace coordinates in cache/birthplaces.json; the Natural Earth
//  land/country TopoJSON comes from the world-atlas@2 package on jsDelivr, also in cache/.)
import fs from 'node:fs';
import * as d3 from 'd3-geo';
import * as topo from 'topojson-client';
import { fan, loadVictoria, countryRanks, ATLAS, OTHER, tint, mix, measure, FONTS } from './charts.mjs';

const C = { sea: '#E4ECEC', paper: '#F6F8F5', paperHi: '#FAFBF8', ink: '#14232E', ink2: '#43535E', grat: '#9DB5BD', red: '#A23122', gold: '#B8913A', midnight: '#0B1024' };
const GENS = 7, MAXN = 2 ** GENS - 1;
const vic = loadVictoria(8);
const { ranked, colour } = countryRanks(vic, MAXN);
const fillAtlas = (n, p) => p.country ? tint(colour[p.country].deep, colour[p.country] === ATLAS[0] ? 0.28 : 0.36) : 'url(#hatch)';
const f2 = v => +v.toFixed(1);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// ---------- stats for the copy ----------
const uniq = new Map();
for (const [n, p] of Object.entries(vic)) if (+n > 1 && +n <= MAXN) uniq.set(p.id, p);
const people = [...uniq.values()];
const placed = people.filter(p => p.country);
const byCountry = {}; for (const p of placed) byCountry[p.country] = (byCountry[p.country] || 0) + 1;
const slots = Object.keys(vic).filter(n => +n > 1 && +n <= MAXN).length;
const stats = { ancestors: people.length, slots, placed: placed.length, unplaced: people.length - placed.length, byCountry };
console.log('stats', JSON.stringify(stats));
console.log('slot ranking', ranked.map(([c, v]) => `${c}:${v}`).join(' '));

// ---------- compass rose ----------
function compass(cx, cy, r, { ink = C.ink, gold = C.gold, paper = C.paperHi, label = true } = {}) {
  let s = `<g class="compass" transform="translate(${cx} ${cy})">`;
  s += `<circle r="${r}" fill="none" stroke="${ink}" stroke-width=".8"/><circle r="${r * 0.9}" fill="none" stroke="${ink}" stroke-width=".4"/>`;
  for (let i = 0; i < 64; i++) { const a = i * 360 / 64, l = i % 8 === 0 ? 0.1 : i % 2 === 0 ? 0.06 : 0.035; s += `<line x1="0" y1="${-r}" x2="0" y2="${f2(-r * (1 - l))}" stroke="${ink}" stroke-width=".5" transform="rotate(${a})"/>`; }
  const pt = (a, len, w, fillL, fillR) => `<g transform="rotate(${a})"><path d="M0 ${-len}L${w} 0L0 0Z" fill="${fillR}"/><path d="M0 ${-len}L${-w} 0L0 0Z" fill="${fillL}"/><path d="M0 ${-len}L${w} 0L0 ${w * 0.001}L${-w} 0Z" fill="none" stroke="${ink}" stroke-width=".5"/></g>`;
  for (const a of [45, 135, 225, 315]) s += pt(a, r * 0.52, r * 0.1, paper, ink);
  for (const a of [0, 90, 180, 270]) s += pt(a, r * 0.84, r * 0.14, a === 0 ? gold : paper, a === 0 ? mix(gold, ink, 0.35) : ink);
  s += `<circle r="${r * 0.06}" fill="${paper}" stroke="${ink}" stroke-width=".6"/>`;
  if (label) s += `<text y="${f2(-r - 6)}" text-anchor="middle" font-size="${f2(r * 0.26)}" font-family="Cormorant Garamond" font-weight="600" fill="${ink}">N</text>`;
  return s + '</g>';
}

function heroDesc() {
  const hueName = { gilt: 'gilt', lake: 'blue', madder: 'red', verdigris: 'green-blue', sienna: 'orange', heather: 'violet', moss: 'green' };
  const [first, ...rest] = ranked.slice(0, ATLAS.length);
  const few = rest.slice(0, 2).map(([c]) => `${hueName[colour[c].key]} for ${c === 'United Kingdom' ? 'the United Kingdom' : c === 'Netherlands' ? 'the Netherlands' : c}`).join(', ');
  const others = rest.slice(2).map(([c]) => c).join(', ');
  return `Most wedges are ${hueName[colour[first[0]].key]} for ${first[0]}; a few are ${few}, and other colors mark ${others}. Hatched wedges have no clear birthplace in the file.`;
}

// ---------- hero: fan centred on Victoria's birthplace, over a faint map ----------
function heroFan() {
  const W = 760, H = 686, cx = 380, cy = 366, R = 340;
  const radii = [54, 102, 143, 182, 228, 276, R];
  const sizes = [
    { name: 16, date: 11, min: 11 }, { name: 12.5, date: 9, min: 9 }, { name: 10.5, date: 7.8, min: 7.5 },
    { name: 7.8, date: 6.2, min: 6 }, { name: 6.4, date: 5.2, min: 5 }, { name: 5.4, date: 4.4, min: 4.2 }];
  const f = fan({ people: vic, gens: GENS, cx, cy, radii, fill: fillAtlas, line: C.paperHi, lineW: 0.9, sizes, id: 'hero', rootFill: C.paperHi, rootStroke: C.ink, rootFont: 27, rootDateFont: 11.5, bloom: true, ringClass: 'ring', info: true });
  // faint map: Europe in a conic projection, London at the fan's centre
  const london = vic[1].lonlat;
  const proj = d3.geoConicConformal().parallels([45, 57]).rotate([-8, 0]).scale(2300).translate([0, 0]);
  const [lx, ly] = proj(london); proj.translate([cx - lx, cy - ly]).clipExtent([[0, 0], [W, H]]);
  const path = d3.geoPath(proj).digits(1);
  const land = topo.feature(JSON.parse(fs.readFileSync('cache/land-50m.json')), 'land');
  const grat = d3.geoGraticule().step([2, 2]).extent([[-30, 30], [40, 72]])();
  const gratMajor = d3.geoGraticule().step([10, 10]).extent([[-30, 30], [40, 72]])();
  // inside the fan's open gap: a ladder of generation names (left) and Ahnentafel numbers (right), one row per ring
  const P = (r, a) => [cx + r * Math.sin(a * Math.PI / 180), cy - r * Math.cos(a * Math.PI / 180)];
  const genNames = ['Parents', 'Grandparents', 'Great-grandparents', '2nd great-grandparents', '3rd great-grandparents', '4th great-grandparents'];
  let edge = '';
  for (let k = 1; k < GENS; k++) {
    const rm = (radii[k - 1] + radii[k]) / 2;
    const [xl, yl0] = P(rm, -135), [xr] = P(rm, 135); const yl = yl0 + 2;
    const lo = 2 ** k, hi = 2 ** (k + 1) - 1;
    const tl = genNames[k - 1], tr = `${lo}–${hi}`;
    const wl = measure(tl, 11.5, FONTS.fira) + tl.length * 0.46, wr = measure(tr, 11.5, FONTS.fira) + tr.length * 0.46;
    const x0 = xl + 8 + wl + 6, x1 = xr - 8 - wr - 6;
    if (x1 - x0 > 12) edge += `<line x1="${f2(x0)}" y1="${f2(yl)}" x2="${f2(x1)}" y2="${f2(yl)}" class="leader"/>`;
    edge += `<text x="${f2(xl + 8)}" y="${f2(yl + 4)}" class="edge">${tl}</text>`;
    edge += `<text x="${f2(xr - 8)}" y="${f2(yl + 4)}" text-anchor="end" class="edge num">${tr}</text>`;
  }
  const [, yb] = P(radii[GENS - 1], 135);
  const edgeHead = `<text x="${f2(cx)}" y="${f2(yb + 2)}" text-anchor="middle" class="edge head">Generation · Ahnentafel numbers</text>`;
  const title = `<text x="${cx}" y="${f2(yb + 34)}" text-anchor="middle" class="ctitle">THE ANCESTORS OF QUEEN VICTORIA</text>` +
    `<text x="${cx}" y="${f2(yb + 56)}" text-anchor="middle" class="csub">Seven generations · colored by birthplace</text>`;
  const svg = `<svg class="hero-fan" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="hero-fan-t hero-fan-d" xmlns="http://www.w3.org/2000/svg">
<title id="hero-fan-t">Fan chart: the ancestors of Queen Victoria, seven generations, colored by birthplace</title>
<desc id="hero-fan-d">A 270-degree fan. Victoria sits at the center; her parents, grandparents and earlier generations fan out in rings. ${heroDesc()}</desc>
<defs>
<pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="${C.paperHi}"/><line x1="0" y1="0" x2="0" y2="5" stroke="${C.grat}" stroke-width="1.1"/></pattern>
<radialGradient id="mapfade" cx="50%" cy="56%" r="56%"><stop offset="62%" stop-color="#fff" stop-opacity="1"/><stop offset="100%" stop-color="#fff" stop-opacity="0"/></radialGradient>
<mask id="mapmask"><rect width="${W}" height="${H}" fill="url(#mapfade)"/></mask>
</defs>${f.defs}
<g mask="url(#mapmask)" class="heromap"><path d="${path(land)}" fill="${C.paperHi}" fill-opacity=".75" stroke="${C.grat}" stroke-width=".8"/><path d="${path(grat)}" fill="none" stroke="${C.grat}" stroke-width=".45" stroke-opacity=".6"/><path d="${path(gratMajor)}" fill="none" stroke="${C.grat}" stroke-width=".8"/></g>
<g class="fan">${f.body}</g>
<text x="${cx}" y="${cy - 22}" text-anchor="middle" class="ahn">No. 1</text>
<g class="edges">${edgeHead}${edge}</g>${title}
${compass(W - 46, 60, 34)}
</svg>`;
  return svg;
}

// ---------- the atlas map: birthplaces and parent-to-child arcs ----------
function atlasMap() {
  const W = 1200;
  const bbox = { type: 'Polygon', coordinates: [[[-15, 45.2], [-15, 59.4], [20.5, 59.4], [20.5, 45.2], [-15, 45.2]]] };
  const proj = d3.geoConicConformal().parallels([45, 57]).rotate([-3, 0]).fitWidth(W, bbox);
  const bnds = d3.geoPath(proj).bounds(bbox);
  const H = Math.round(Math.min(bnds[1][1] - bnds[0][1], 760));
  const [tx, ty] = proj.translate(); proj.translate([tx - bnds[0][0], ty - bnds[0][1] - Math.max(0, (bnds[1][1] - bnds[0][1] - H) / 2)]);
  proj.clipExtent([[0, 0], [W, H]]);
  const path = d3.geoPath(proj).digits(1);
  const world = JSON.parse(fs.readFileSync('cache/countries-50m.json'));
  const land = topo.feature(JSON.parse(fs.readFileSync('cache/land-50m.json')), 'land');
  const borders = topo.mesh(world, world.objects.countries, (a, b) => a !== b);
  const grat = d3.geoGraticule().step([2, 2]).extent([[-20, 35], [40, 72]])();
  // ancestors with coordinates, gens <= 8, aggregated per place
  const pts = new Map();
  const arcs = [];
  for (const [nS, p] of Object.entries(vic)) {
    const n = +nS; if (!p.lonlat) continue;
    const key = p.lonlat.join(',');
    const e = pts.get(key) || { lonlat: p.lonlat, town: p.town, country: p.country, n: 0, people: [] };
    e.n++; e.people.push(p.name); pts.set(key, e);
    const child = vic[Math.floor(n / 2)];
    if (n > 1 && child?.lonlat) {
      const [x0, y0] = proj(p.lonlat), [x1, y1] = proj(child.lonlat);
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
      if (len < 3) continue;
      const bend = Math.min(0.28 * len, 90);
      const mx = (x0 + x1) / 2 - dy / len * bend, my = (y0 + y1) / 2 + dx / len * bend;
      const gen = Math.floor(Math.log2(n)) + 1;
      arcs.push({ d: `M${f2(x0)} ${f2(y0)}Q${f2(mx)} ${f2(my)} ${f2(x1)} ${f2(y1)}`, colour: colour[p.country] || OTHER, gen, len });
    }
  }
  const arcSvg = arcs.sort((a, b) => b.gen - a.gen).map(a => `<path d="${a.d}" stroke="${a.colour.deep}" style="--len:${Math.ceil(a.len * 1.3)};--g:${a.gen}" class="arc"/>`).join('');
  const dots = [...pts.values()].sort((a, b) => b.n - a.n).map(e => { const [x, y] = proj(e.lonlat); const c = colour[e.country] || OTHER; return `<circle cx="${f2(x)}" cy="${f2(y)}" r="${f2(2.6 + Math.sqrt(e.n) * 1.5)}" fill="${c.deep}" stroke="${C.paperHi}" stroke-width="1.4"><title>${esc(e.town)}, ${esc(e.country)}: ${e.n} ${e.n === 1 ? 'birth' : 'births'}</title></circle>`; }).join('');
  const lab = (lonlat, text, dx = 8, dy = 4, anchor = 'start', cls = 'place') => { const [x, y] = proj(lonlat); return `<text x="${f2(x + dx)}" y="${f2(y + dy)}" text-anchor="${anchor}" class="${cls}">${text}</text>`; };
  const L = vic[1].lonlat;
  const labels = [
    lab(L, 'London', -10, 4, 'end'), lab([10.9644, 50.2612], 'Coburg', 10, 14), lab([9.7386, 52.3744], 'Hanover', -9, -6, 'end'),
    lab([4.31, 52.08], 'The Hague', -9, 4, 'end'), lab([16.3725, 48.2083], 'Vienna', 9, 4), lab([16.5989, 58.4414], 'Stegeborg', -9, 4, 'end'),
    lab([-0.4586, 46.3237], 'Niort', 9, 4), lab([10.7011, 50.9489], 'Gotha', -8, -7, 'end'), lab([9.7476, 55.0577], 'Nordborg', 9, 4),
    lab([15.1372, 51.6419], 'Żary', 9, 4), lab([16.5833, 47.6833], 'Sopron', 9, 12),
    lab([-1.6, 52.6], 'BRITAIN', 0, 0, 'middle', 'region'), lab([11.6, 48.05], 'GERMANY', 0, 0, 'middle', 'region'), lab([2.4, 47.2], 'FRANCE', 0, 0, 'middle', 'region'), lab([-8.0, 53.0], 'IRELAND', 0, 0, 'middle', 'region'), lab([-3.4589, 56.0719], 'Dunfermline', 9, 4),
    lab([4.2, 55.2], 'North Sea', 0, 0, 'middle', 'water'), lab([-3.2, 49.9], 'English Channel', 0, 0, 'middle', 'water'), lab([-11.2, 53.2], 'Atlantic Ocean', 0, 0, 'middle', 'water'), lab([17.2, 55.6], 'Baltic Sea', 0, 0, 'middle', 'water'),
  ].join('');
  // lat/long ticks on the neat line
  let ticks = '';
  for (let lon = -12; lon <= 20; lon += 4) { const lat0 = proj.invert([W / 2, H - 4])[1]; const p = proj([lon, lat0]); if (p && p[0] > 30 && p[0] < W - 30) ticks += `<text x="${f2(p[0])}" y="${H - 8}" text-anchor="middle" class="tick">${Math.abs(lon)}°${lon < 0 ? 'W' : 'E'}</text>`; }
  for (let lat = 46; lat <= 58; lat += 2) { const lon0 = proj.invert([8, H / 2])[0]; const p = proj([lon0, lat]); if (p && p[1] > 24 && p[1] < H - 24) ticks += `<text x="12" y="${f2(p[1] + 4)}" class="tick">${lat}°N</text>`; }
  const [sx, sy] = [W - 250, H - 48];
  const kmPerPx = (() => { const a = proj.invert([W / 2, H / 2]), b = proj.invert([W / 2 + 100, H / 2]); return d3.geoDistance(a, b) * 6371 / 100; })();
  const barKm = 200, barPx = barKm / kmPerPx;
  let scale = `<g class="scalebar" transform="translate(${sx} ${sy})">`;
  for (let i = 0; i < 4; i++) scale += `<rect x="${f2(i * barPx / 4)}" y="0" width="${f2(barPx / 4)}" height="5" fill="${i % 2 ? C.paperHi : C.ink}" stroke="${C.ink}" stroke-width=".6"/>`;
  scale += `<text x="0" y="18" class="tick">0</text><text x="${f2(barPx)}" y="18" text-anchor="middle" class="tick">${barKm} km</text></g>`;
  return `<svg class="atlas-map" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="map-t map-d" xmlns="http://www.w3.org/2000/svg">
<title id="map-t">Map: where Queen Victoria's ancestors were born</title>
<desc id="map-d">Dots mark ${pts.size} birthplaces of her ancestors over eight generations, most of them in what is now central Germany. Curved lines join each parent's birthplace to their child's, converging on London, where Victoria was born in 1819.</desc>
<rect width="${W}" height="${H}" fill="${C.sea}"/>
<path d="${path(grat)}" fill="none" stroke="${C.grat}" stroke-width=".5" stroke-opacity=".8"/>
<path d="${path(land)}" fill="${C.paperHi}" stroke="${mix(C.grat, C.ink, 0.25)}" stroke-width=".8"/>
<path d="${path(borders)}" fill="none" stroke="${C.ink2}" stroke-width=".7" stroke-dasharray="5 2 1 2" stroke-opacity=".55"/>
<g fill="none" stroke-width="1.3" stroke-linecap="round" class="arcs">${arcSvg}</g>
<g class="dots">${dots}</g>
${compass(W - 64, 70, 38)}
<g class="labels">${labels}</g>
${mapLegend(64, H - 30)}
<g>${ticks}</g>${scale}
<rect x="3" y="3" width="${W - 6}" height="${H - 6}" fill="none" stroke="${C.ink}" stroke-width="1"/>
</svg>`;
}

function mapLegend(x, yBottom) {
  const rows = [];
  ranked.forEach(([c, v], i) => { if (i < ATLAS.length) rows.push([c, v, colour[c].deep]); });
  const other = ranked.slice(ATLAS.length);
  if (other.length) rows.push([`Other (${other.length} countries)`, other.reduce((t, [, v]) => t + v, 0), OTHER.deep]);
  const lh = 24, w = 262, h = 58 + rows.length * lh + 14;
  const y = yBottom - h;
  let g = `<g class="mlegend" transform="translate(${x} ${f2(y)})"><rect width="${w}" height="${h}" fill="${C.paperHi}" stroke="${C.ink}"/><rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="none" stroke="${C.ink}" stroke-width=".6"/>`;
  g += `<text x="18" y="32" class="mlh">WHERE THEY WERE BORN</text><text x="18" y="50" class="mls">Today's borders · counts from the chart</text>`;
  rows.forEach(([c, v, col], i) => { const yy = 70 + i * lh; g += `<circle cx="26" cy="${yy}" r="6.5" fill="${col}" stroke="${C.paperHi}" stroke-width="1.4"/><text x="42" y="${yy + 5}" class="mlc">${esc(c)}</text><text x="${w - 18}" y="${yy + 5}" text-anchor="end" class="mlv">${v}</text>`; });
  return g + '</g>';
}

// ---------- the six chart styles, as small fans ----------
function styleFan(style) {
  const W = 300, H = 262, cx = 150, cy = 136, R = 122;
  const radii = [21, 42, 61, 80, 101, R];
  const sizes = [{ name: 7.5, date: 0, min: 5.5 }, { name: 5.4, date: 0, min: 4.2 }, { name: 4.4, date: 0, min: 3.6 }, { name: 3.4, date: 0, min: 2.8 }, { name: 2.8, date: 0, min: 2.2 }];
  const s = STYLES[style];
  const f = fan({ people: vic, gens: 6, cx, cy, radii, fill: s.fill, line: s.line, lineW: s.lineW ?? 0.6, ink: s.ink, ink2: s.ink, sizes, id: 'st-' + style, rootFill: s.root ?? s.ground, rootStroke: s.rootStroke ?? s.line, rootName: 'Victoria', rootDates: '', rootFont: 9, font: s.font || 'EB Garamond', emptyFill: s.empty || 'none' });
  let extra = '';
  if (style === 'cartographer') {
    extra += `<g stroke="${s.grat}" stroke-width=".5" fill="none">${[...Array(8)].map((_, i) => `<line x1="${i * 42 + 6}" y1="0" x2="${i * 42 + 6}" y2="${H}"/>`).join('')}${[...Array(7)].map((_, i) => `<line x1="0" y1="${i * 42 + 8}" x2="${W}" y2="${i * 42 + 8}"/>`).join('')}</g>`;
  }
  let over = '';
  if (style === 'cartographer') over += compass(W - 30, 32, 17, { label: false });
  if (style === 'botanical') over += laurel(cx, cy + 50, s.leaf);
  if (style === 'ivory') over += `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" fill="none" stroke="${s.line}" stroke-width=".8"/><rect x="10" y="10" width="${W - 20}" height="${H - 20}" fill="none" stroke="${s.line}" stroke-width=".4"/>`;
  if (style === 'midnight') over += `<circle cx="${cx}" cy="${cy}" r="${radii[0]}" fill="none" stroke="${s.gold}" stroke-width="1"/>`;
  const titleY = cy + 0.707 * R + 26;
  const ttl = s.title(cx, titleY);
  return `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false"><rect width="${W}" height="${H}" fill="${s.ground}"/>${extra}${f.defs}${f.body}${over}${ttl}</svg>`;
}
function laurel(cx, cy, col) {
  // two engraved sprigs that fit inside the fan's open gap
  let s = `<g fill="${col}" stroke="none">`;
  for (const side of [-1, 1]) {
    s += `<path d="M${cx + side * 3} ${cy + 6}Q${cx + side * 22} ${cy + 6} ${cx + side * 40} ${cy - 3}" fill="none" stroke="${col}" stroke-width=".7"/>`;
    for (let i = 0; i < 6; i++) { const t = (i + 1) / 7; const x = cx + side * (3 + 37 * t), y = cy + 6 - 9 * t * t; s += `<ellipse cx="${f2(x)}" cy="${f2(y - 2.4)}" rx="3.3" ry="1.3" transform="rotate(${f2(side * (-28 - 16 * t))} ${f2(x)} ${f2(y - 2.4)})"/><ellipse cx="${f2(x)}" cy="${f2(y + 2.4)}" rx="3.3" ry="1.3" transform="rotate(${f2(side * (22 - 8 * t))} ${f2(x)} ${f2(y + 2.4)})"/>`; }
  }
  return s + `<circle cx="${cx}" cy="${cy + 6}" r="1.6"/></g>`;
}
const alt = (a, b) => (n) => (Math.floor(Math.log2(n)) % 2 ? a : b);
const STYLES = {
  ivory: { ground: '#F3EDE2', line: '#8C6E4C', ink: '#4A3526', fill: () => 'none', title: (x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Cormorant Garamond" font-weight="600" font-size="9" letter-spacing="2.2" fill="#4A3526">THE ANCESTORS OF VICTORIA</text>` },
  midnight: { ground: '#0B1024', line: '#8F7536', lineW: 0.45, gold: '#C9A24A', ink: '#E3C77A', root: '#0B1024', rootStroke: '#C9A24A', fill: (n) => (n % 2 ? '#131B38' : '#161A2C'), title: (x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Cormorant Garamond" font-weight="600" font-size="9" letter-spacing="2.4" fill="#C9A24A">THE ANCESTORS OF VICTORIA</text>` },
  botanical: { ground: '#FBF8F1', line: '#FBF8F1', lineW: 0.9, leaf: '#6F7A45', ink: '#3C3A2A', fill: (n) => ['#DDE0BE', '#F0DDB0', '#EFD2CB'][n % 3], title: (x, y) => `<text x="${x}" y="${y + 2}" text-anchor="middle" font-family="Cormorant Garamond" font-style="italic" font-weight="500" font-size="11" fill="#3C3A2A">The Ancestors of Victoria</text>` },
  letterpress: { ground: '#F4EEDF', line: '#1A1A1A', lineW: 0.5, ink: '#1A1A1A', root: '#D2472E', rootStroke: '#1A1A1A', fill: (n) => (n === 2 || n === 3 ? '#F4EEDF' : 'none'), title: (x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="EB Garamond" font-weight="600" font-size="10" letter-spacing="1.6" fill="#D2472E">THE ANCESTORS OF VICTORIA</text>` },
  nordic: { ground: '#FFFFFF', line: '#FFFFFF', lineW: 1, ink: '#2B2F33', font: 'Fira Sans', fill: (n) => ['#D9E1E7', '#E8EDF0', '#C9D4DC'][Math.floor(Math.log2(n)) % 3], title: (x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Fira Sans" font-weight="500" font-size="8" letter-spacing="1.4" fill="#2B2F33">ANCESTORS OF VICTORIA</text>` },
  cartographer: { ground: '#E3ECEF', grat: '#B7CBD1', line: '#FAFBF8', lineW: 0.7, ink: '#14232E', fill: fillAtlas, empty: '#EEF2F2', title: (x, y) => `<text x="${x}" y="${y}" text-anchor="middle" font-family="Cormorant Garamond" font-weight="600" font-size="9" letter-spacing="2.2" fill="#14232E">THE ANCESTORS OF VICTORIA</text>` },
};

// ---------- legend ----------
function legendRows() {
  const total = ranked.reduce((s, [, v]) => s + v, 0);
  const rows = []; let other = 0, otherNames = [];
  ranked.forEach(([c, v], i) => { if (i < ATLAS.length) rows.push({ c, v, col: colour[c] }); else { other += v; otherNames.push(c); } });
  const unplaced = slots - total;
  const pct = v => Math.round(v / slots * 100);
  let html = rows.map(r => `<li style="--sw:${r.col.deep};--tint:${tint(r.col.deep, r.col === ATLAS[0] ? 0.28 : 0.36)}"><span class="sw" aria-hidden="true"></span><span class="lc">${r.c}</span><span class="lv">${r.v}</span></li>`).join('');
  if (other) html += `<li style="--sw:${OTHER.deep};--tint:${tint(OTHER.deep, 0.36)}"><span class="sw" aria-hidden="true"></span><span class="lc">Other (${otherNames.join(', ')})</span><span class="lv">${other}</span></li>`;
  html += `<li class="unplaced"><span class="sw hatch" aria-hidden="true"></span><span class="lc">Birthplace missing or unclear</span><span class="lv">${unplaced}</span></li>`;
  return { html, total, unplaced, slots, germanyPct: pct(byCountry.Germany ? ranked[0][1] : 0) };
}
function legendBar() {
  let x = 0; const segs = [];
  ranked.forEach(([c, v], i) => { const col = i < ATLAS.length ? colour[c] : OTHER; segs.push(`<span style="flex:${v};background:${col.deep}" title="${c}: ${v}"></span>`); });
  segs.push(`<span class="hatch" style="flex:${slots - ranked.reduce((s, [, v]) => s + v, 0)}" title="Birthplace missing or unclear: ${slots - ranked.reduce((s, [, v]) => s + v, 0)}"></span>`);
  return `<div class="lbar" aria-hidden="true">${segs.join('')}</div>`;
}

// ---------- logo ----------
export function logoMark(size = 36, { ink = 'currentColor', gilt = 'var(--mark-gilt, #9C7A22)', paper = 'var(--mark-paper, #F6F8F5)' } = {}) {
  // A quarter fan (three rings: 1, 2 and 4 wedges) set in the north-east quadrant of a graticule cross.
  const px = 11, py = 29;
  const P = (r, a) => [f2(px + r * Math.sin(a * Math.PI / 180)), f2(py - r * Math.cos(a * Math.PI / 180))];
  const wedge = (r0, r1, a0, a1) => { const [x0, y0] = P(r1, a0), [x1, y1] = P(r1, a1), [x2, y2] = P(r0, a1), [x3, y3] = P(r0, a0); return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`; };
  const rings = [[5.2, 11, 1], [12.4, 18.2, 2], [19.6, 25.6, 4]];
  let fanPaths = '';
  for (const [r0, r1, n] of rings) for (let i = 0; i < n; i++) fanPaths += wedge(r0, r1, i * 90 / n + (i ? 1.4 : 0), (i + 1) * 90 / n - (i < n - 1 ? 1.4 : 0));
  return `<svg class="mark" width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
<path d="${fanPaths}" fill="${gilt}"/>
<path d="M${px} 1.5V38.5M1.5 ${py}H38.5" stroke="${ink}" stroke-width="1.4"/>
<path d="M${px} 0.5L${px + 2.2} 5.5H${px - 2.2}Z" fill="${ink}"/>
<circle cx="${px}" cy="${py}" r="3.1" fill="${paper}" stroke="${ink}" stroke-width="1.4"/>
</svg>`;
}

// ---------- assemble ----------
const lg = legendRows();
let html = fs.readFileSync('index.src.html', 'utf8');
const repl = {
  HERO_FAN: heroFan(), ATLAS_MAP: atlasMap(), LEGEND: lg.html, LEGEND_BAR: legendBar(), LOGO: logoMark(38), LOGO_SM: logoMark(30),
  STYLE_IVORY: styleFan('ivory'), STYLE_MIDNIGHT: styleFan('midnight'), STYLE_BOTANICAL: styleFan('botanical'), STYLE_LETTERPRESS: styleFan('letterpress'), STYLE_NORDIC: styleFan('nordic'), STYLE_CARTOGRAPHER: styleFan('cartographer'),
  N_ANCESTORS: stats.ancestors, N_PLACED: stats.placed, N_GERMANY: byCountry.Germany, N_UK: byCountry['United Kingdom'] || 0, N_SLOTS: slots, N_UNPLACED_SLOTS: lg.unplaced, N_COUNTRIES: Object.keys(byCountry).length,
};
html = html.replace(/<!--@(\w+)-->|@@(\w+)@@/g, (m, a, b) => { const k = a || b; if (!(k in repl)) throw new Error('missing ' + k); return repl[k]; });
fs.writeFileSync('../index.html', html);
fs.writeFileSync('../favicon.svg', logoMark(40, { ink: '#14232E', gilt: '#9C7A22', paper: '#F6F8F5' }).replace('class="mark" width="40" height="40" ', 'xmlns="http://www.w3.org/2000/svg" ').replace(/ aria-hidden="true" focusable="false"/, ''));
console.log('wrote index.html', (html.length / 1024).toFixed(0) + ' KB');
