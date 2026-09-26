// Render-workshop copy of the Gilt Night mockup engine (design/directions/gilt-night/js/charts.js).
// Used only to draw the static marketing images in web/src/assets/img/. The product's real
// engine lives in web/src/app/charts/. Changes: Cormorant SC -> Cormorant Garamond, Inter -> the
// house sans (Source Sans 3, registered as sans-400/sans-600).
// Mockup chart engine: fan, bowtie ("Two families") and pedigree as SVG strings.
// It follows the brief's craft rules (4.3, 4.7): names along the arc in rings 1-3,
// radial beyond, depths solved from text, the abbreviation ladder, no hyphenation,
// faint wedges for unknown ancestors. Text is measured with the real fonts.
import { lifeSpan } from './gedcom.js';

const r2 = n => Math.round(n * 100) / 100;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const P = (r, a) => [r2(r * Math.sin(a)), r2(-r * Math.cos(a))]; // a: radians clockwise from 12 o'clock
const RAD = Math.PI / 180;

export const FONTS = {
  cg600: { family: 'Cormorant Garamond', weight: 600 },
  cg500: { family: 'Cormorant Garamond', weight: 500 },
  cg500i: { family: 'Cormorant Garamond', weight: 500, style: 'italic' },
  eb400: { family: 'EB Garamond', weight: 400 },
  eb400i: { family: 'EB Garamond', weight: 400, style: 'italic' },
  eb600: { family: 'EB Garamond', weight: 600 },
  csc600: { family: 'Cormorant Garamond', weight: 600 },
  csc500: { family: 'Cormorant Garamond', weight: 500 },
  in400: { family: 'Gildroot Sans', weight: 400 },
  in600: { family: 'Gildroot Sans', weight: 600 },
};

export async function loadChartFonts() {
  await Promise.all(Object.values(FONTS).map(f =>
    document.fonts.load(`${f.style || 'normal'} ${f.weight} 20px "${f.family}"`, 'Aa1ßéΩЖ')));
}

const ctx = document.createElement('canvas').getContext('2d');
export function tw(str, font, size, track = 0) {
  ctx.font = `${font.style || 'normal'} ${font.weight} ${size}px "${font.family}"`;
  return ctx.measureText(str).width + track * size * Math.max(0, str.length - 1);
}
const fa = (font, size, fill, extra = '') =>
  `font-family="${font.family}, EB Garamond, serif" font-weight="${font.weight}"${font.style ? ` font-style="${font.style}"` : ''} font-size="${r2(size)}" fill="${fill}"${extra}`;

// ---------- names ----------
const TITLE = /^(Grand Duke|Grand Duchess|Prince|Princess|Duke|Duchess|Count|Countess|Margrave|Margravine|Landgrave|Landgravine|Elector|Electress|Queen|King|Lady|Lord|Baron|Baroness|Archduke|Archduchess|Burgrave|Herzog|Graf|Gräfin|Fürst|Fürstin)\s+/i;
export function nameLadder(p) {
  const out = [];
  const add = s => { s = (s || '').replace(/\s+/g, ' ').replace(/[,\s]+$/, '').trim(); if (s && !out.includes(s)) out.push(s); };
  const name = p.name;
  add(name);
  if (p.surname && p.given) {
    // BRIEF ladder: Johann Georg Friedrich Weber → Johann Georg F. Weber → Johann G. Weber → J. G. Weber → Weber
    const g = p.given.split(' ');
    for (let i = g.length - 1; i >= 1; i--) { g[i] = g[i][0] + '.'; add([...g, p.surname].join(' ')); }
    g[0] = g[0][0] + '.'; add([...g, p.surname].join(' '));
    add(p.surname);
    return out;
  }
  const beforeComma = name.split(',')[0];
  add(beforeComma);
  add(beforeComma.replace(TITLE, ''));
  const of = beforeComma.match(/^(.*?)\s(of|von|zu|de|van|af|of the)\s/);
  if (of) { add(of[1]); add(of[1].replace(TITLE, '')); }
  add(out[out.length - 1].split(' ')[0]);
  return out;
}

function splitTwo(str, font, size) {
  const words = str.split(' ');
  if (words.length < 2) return null;
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
    const m = Math.max(tw(a, font, size), tw(b, font, size));
    if (!best || m < best.m) best = { lines: [a, b], m };
  }
  return best;
}

// ---------- label fitting ----------
// Returns {lines:[{t,font,size,fill,cls}], ...} or null.
function fitBlock(p, ring, st, fitsLine, fitsHeight) {
  const dates = ring.dates === false ? '' : lifeSpan(p);
  const nf = ring.font || st.nameFont;
  const df = st.dateFont;
  const cands = nameLadder(p);
  const step = Math.max(0.25, ring.max / 40);
  // Pass 1 keeps the dates (they matter to genealogists); pass 2 lets them go.
  for (const keepDates of dates ? [true, false] : [false]) {
    for (const cand of cands) {
      for (const two of [false, true]) {
        if (two && (!ring.twoLine || !cand.includes(' '))) continue;
        for (let s = ring.max; s >= ring.min - 1e-6; s -= step) {
          const ds = Math.max(ring.dateMin || 0, s * (ring.dateRatio || 0.72));
          const nameLines = two ? splitTwo(cand, nf, s).lines : [cand];
          const lines = nameLines.map(t => ({ t, font: nf, size: s, fill: st.name, cls: 'nm' }));
          if (keepDates) lines.push({ t: dates, font: df, size: ds, fill: st.date, cls: 'dt' });
          if (fitsHeight(lines) && lines.every(fitsLine)) return { lines };
        }
      }
    }
  }
  return null;
}
const blockH = lines => lines.reduce((h, l, i) => h + l.size * (i === 0 ? 0.95 : 1.12), 0);

// ---------- fan ----------
// opts: ahn, gens, span(deg), center(deg), radii[r0..rG], curved (rings shown on arc),
//       rings[]: per ring {max,min,twoLine,dateRatio}, style, fillFor(n,g,i,p), prefix, medallion
export function fan(opts) {
  const { ahn, gens, radii, style: st, prefix = 'f' } = opts;
  const span = opts.span * RAD, center = (opts.center || 0) * RAD;
  const start = center - span / 2;
  const curved = opts.curved ?? 3;
  const defs = [];
  const out = [];
  for (let g = 1; g < gens; g++) {
    const n0 = 2 ** g, count = n0;
    const w = span / count;
    const ra = radii[g], rb = radii[g + 1];
    const ring = opts.rings[g];
    const wedges = [], labels = [];
    for (let i = 0; i < count; i++) {
      const n = n0 + i;
      const p = ahn[n];
      const a1 = start + i * w, a2 = a1 + w;
      const fill = p ? (opts.fillFor ? opts.fillFor(n, g, i, p) : (i % 2 ? st.wedgeB : st.wedgeA)) : st.emptyFill;
      const d = sectorPath(ra, rb, a1, a2);
      wedges.push(`<path class="w${p ? '' : ' empty'}" data-n="${n}" d="${d}" fill="${fill}"/>`);
      if (!p) continue;
      const mid = (a1 + a2) / 2;
      if (g <= curved) labels.push(arcLabel(p, n, ra, rb, a1, a2, mid, ring, st, prefix, defs));
      else labels.push(radialLabel(p, n, ra, rb, a1, a2, mid, ring, st));
    }
    out.push(`<g class="ring" style="--g:${g}"><g class="wedges" stroke="${st.stroke}" stroke-width="${st.sw}" stroke-opacity="${st.strokeOpacity ?? 1}">${wedges.join('')}</g><g class="labels" pointer-events="none">${labels.join('')}</g></g>`);
  }
  // outer hairline double rule (engraved edge)
  if (st.edge) {
    const R = radii[gens];
    out.push(`<g class="ring edge" style="--g:${gens}" fill="none" stroke="${st.edge}" pointer-events="none"><path d="${arcOnly(R + st.edgeGap, start, start + span)}" stroke-width="${st.sw * 1.6}"/><path d="${arcOnly(R + st.edgeGap * 2.2, start, start + span)}" stroke-width="${st.sw * 0.8}"/></g>`);
  }
  out.push(medallion(opts, st));
  return { defs: defs.join(''), body: out.join('') };
}

function sectorPath(ra, rb, a1, a2) {
  const large = a2 - a1 > Math.PI ? 1 : 0;
  const [x2, y2] = P(rb, a1), [x3, y3] = P(rb, a2);
  if (a2 - a1 >= 2 * Math.PI - 1e-6) { // full ring
    const [xa, ya] = P(rb, 0), [xb, yb] = P(rb, Math.PI), [xc, yc] = P(ra, 0), [xd, yd] = P(ra, Math.PI);
    return `M${xa},${ya}A${rb},${rb} 0 1 1 ${xb},${yb}A${rb},${rb} 0 1 1 ${xa},${ya}ZM${xc},${yc}A${ra},${ra} 0 1 0 ${xd},${yd}A${ra},${ra} 0 1 0 ${xc},${yc}Z`;
  }
  const [x1, y1] = P(ra, a1), [x4, y4] = P(ra, a2);
  return `M${x1},${y1}L${x2},${y2}A${rb},${rb} 0 ${large} 1 ${x3},${y3}L${x4},${y4}A${ra},${ra} 0 ${large} 0 ${x1},${y1}Z`;
}
function arcOnly(r, a1, a2, reverse = false) {
  const large = a2 - a1 > Math.PI ? 1 : 0;
  const [x1, y1] = P(r, a1), [x2, y2] = P(r, a2);
  return reverse ? `M${x2},${y2}A${r},${r} 0 ${large} 0 ${x1},${y1}` : `M${x1},${y1}A${r},${r} 0 ${large} 1 ${x2},${y2}`;
}

function norm180(a) { let d = a / RAD; while (d > 180) d -= 360; while (d < -180) d += 360; return d; }

function arcLabel(p, n, ra, rb, a1, a2, mid, ring, st, prefix, defs) {
  const reverse = Math.abs(norm180(mid)) > 112; // keep text upright in the lower half
  const depth = rb - ra, rm = (ra + rb) / 2;
  const pad = Math.min(depth * 0.1, 8);
  const angle = a2 - a1;
  // Baseline radius for each line; glyphs grow outward (normal) or inward (reversed).
  const place = lines => {
    const H = blockH(lines);
    let acc = 0;
    return lines.map((l, i) => {
      acc += l.size * (i === 0 ? 0.95 : 1.12);
      const fromTop = acc - l.size * 0.22; // block top to this baseline
      return reverse ? rm - H / 2 + fromTop : rm + H / 2 - fromTop;
    });
  };
  const fitsHeight = lines => blockH(lines) <= depth - 2 * pad;
  let current;
  const fitsLine = l => {
    const idx = current.indexOf(l);
    const rbase = place(current)[idx];
    return tw(l.t, l.font, l.size) <= angle * rbase * 0.9 - 6;
  };
  const res = fitBlock(p, ring, st, l => fitsLine(l), lines => { current = lines; return fitsHeight(lines); });
  if (!res) return '';
  const rs = place(res.lines);
  return res.lines.map((l, i) => {
    const id = `${prefix}-a${n}-${i}`;
    const inset = 0.02;
    defs.push(`<path id="${id}" d="${arcOnly(rs[i], a1 + inset, a2 - inset, reverse)}"/>`);
    return `<text ${fa(l.font, l.size, l.fill)} class="${l.cls}"><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(l.t)}</textPath></text>`;
  }).join('');
}

function radialLabel(p, n, ra, rb, a1, a2, mid, ring, st) {
  const pad = Math.max(3, (rb - ra) * 0.06);
  const L = rb - ra - 2 * pad;
  const rm = (ra + rb) / 2;
  const T = (a2 - a1) * (rm - L / 2) * 0.94;
  const res = fitBlock(p, ring, st, l => tw(l.t, l.font, l.size) <= L, lines => blockH(lines) <= T);
  if (!res) return '';
  const deg = mid / RAD;
  const right = Math.sin(mid) >= 0;
  const rot = right ? deg - 90 : deg + 90;
  const [x, y] = P(rm, mid);
  const H = blockH(res.lines);
  let acc = -H / 2;
  const t = res.lines.map((l, i) => {
    acc += l.size * (i === 0 ? 0.95 : 1.12);
    return `<text ${fa(l.font, l.size, l.fill)} class="${l.cls}" x="0" y="${r2(acc - l.size * 0.22)}" text-anchor="middle">${esc(l.t)}</text>`;
  }).join('');
  return `<g transform="translate(${x} ${y}) rotate(${r2(rot)})">${t}</g>`;
}

function medallion(opts, st) {
  const r = opts.radii[1];
  const m = opts.medallion;
  const parts = [`<g class="ring med" style="--g:0">`];
  parts.push(`<circle class="w" data-n="1" r="${r}" fill="${st.medFill}" stroke="${st.medStroke}" stroke-width="${st.medSw || st.sw * 1.6}"/>`);
  if (st.medInner) parts.push(`<circle r="${r - st.medInner}" fill="none" stroke="${st.medStroke}" stroke-width="${st.sw * 0.7}" stroke-opacity=".7" pointer-events="none"/>`);
  const lines = m.lines;
  // fit every line to the medallion width at its height
  const H = lines.reduce((h, l) => h + l.size * (l.lh || 1.1), 0);
  let y = -H / 2;
  for (const l of lines) {
    let s = l.size;
    const maxW = 2 * Math.sqrt(Math.max(0, r * r - (y + s * 0.5) ** 2)) * 0.82;
    while (s > 6 && tw(l.t, l.font, s, l.track || 0) > maxW) s -= 0.5;
    y += l.size * (l.lh || 1.1);
    parts.push(`<text ${fa(l.font, s, l.fill, l.track ? ` letter-spacing="${r2(l.track * s)}"` : '')} text-anchor="middle" x="0" y="${r2(y - l.size * 0.28)}" pointer-events="none">${esc(l.t)}</text>`);
  }
  parts.push('</g>');
  return parts.join('');
}

// ---------- pedigree ----------
export function pedigree(opts) {
  const { ahn, gens, x0, y0, w, h, style: st } = opts;
  const colGap = w * 0.035;
  const colW = (w - colGap * (gens - 1)) / gens;
  const out = [], lines = [];
  const box = (g, i) => {
    const rows = 2 ** g;
    const rowH = h / rows;
    const bh = Math.min(rowH * 0.78, opts.maxBox || 120);
    const cy = y0 + rowH * (i + 0.5);
    return { x: x0 + g * (colW + colGap), y: cy - bh / 2, w: colW, h: bh, cy };
  };
  for (let g = 0; g < gens; g++) {
    for (let i = 0; i < 2 ** g; i++) {
      const n = 2 ** g + i, p = ahn[n];
      const b = box(g, i);
      if (g < gens - 1) {
        const f = box(g + 1, 2 * i), m = box(g + 1, 2 * i + 1);
        const xm = b.x + b.w + colGap / 2;
        lines.push(`M${r2(b.x + b.w)},${r2(b.cy)}H${r2(xm)}M${r2(xm)},${r2(f.cy)}V${r2(m.cy)}M${r2(xm)},${r2(f.cy)}H${r2(f.x)}M${r2(xm)},${r2(m.cy)}H${r2(m.x)}`);
      }
      out.push(`<rect class="w${p ? '' : ' empty'}" data-n="${n}" x="${r2(b.x)}" y="${r2(b.y)}" width="${r2(b.w)}" height="${r2(b.h)}" fill="${p ? st.box : 'none'}" stroke="${p ? st.boxStroke : st.emptyStroke}" stroke-width="${st.sw}"/>`);
      if (g === 0) out.push(`<rect x="${r2(b.x + 4)}" y="${r2(b.y + 4)}" width="${r2(b.w - 8)}" height="${r2(b.h - 8)}" fill="none" stroke="${st.boxStroke}" stroke-width="${st.sw * 0.6}"/>`);
      if (!p) continue;
      const ring = opts.rings[g];
      const padX = b.w * 0.07;
      const res = fitBlock(p, ring, st, l => tw(l.t, l.font, l.size) <= b.w - 2 * padX, ls => blockH(ls) <= b.h * 0.84);
      if (!res) continue;
      const H = blockH(res.lines);
      let acc = b.cy - H / 2;
      res.lines.forEach((l, k) => {
        acc += l.size * (k === 0 ? 0.95 : 1.12);
        out.push(`<text ${fa(l.font, l.size, l.fill)} x="${r2(b.x + padX)}" y="${r2(acc - l.size * 0.18)}">${esc(l.t)}</text>`);
      });
    }
  }
  return `<path d="${lines.join('')}" fill="none" stroke="${st.connector}" stroke-width="${st.connSw || st.sw}"/>` + out.join('');
}

// ---------- ornaments ----------
export function laurel(cx, cy, span, color, sw = 1) {
  // Two engraved branches meeting under the medallion.
  const parts = [];
  for (const side of [-1, 1]) {
    const pts = [];
    const steps = 13;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const x = cx + side * (span * 0.06 + span * 0.5 * t);
      const y = cy - Math.sin(t * Math.PI * 0.62) * span * 0.16 + t * span * 0.02;
      pts.push([x, y]);
    }
    parts.push(`<path d="M${pts.map(p => p.map(r2).join(',')).join('L')}" fill="none" stroke="${color}" stroke-width="${sw}"/>`);
    for (let k = 1; k < pts.length; k++) {
      const [x, y] = pts[k], [px, py] = pts[k - 1];
      const ang = Math.atan2(y - py, x - px) / RAD;
      const size = span * 0.05 * (1 - k / (pts.length + 4));
      for (const up of [-1, 1]) {
        parts.push(`<ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(size)}" ry="${r2(size * 0.36)}" transform="rotate(${r2(ang + up * 38 * side)} ${r2(x)} ${r2(y)}) translate(${r2(size * 0.9 * side)} 0)" fill="${color}" fill-opacity="${up > 0 ? 0.85 : 0.6}"/>`);
      }
    }
  }
  return parts.join('');
}

export function compassRose(cx, cy, r, ink, fill) {
  const pts = [];
  for (let k = 0; k < 8; k++) {
    const a = k * 45 * RAD, long = k % 2 === 0 ? r : r * 0.55, side = r * 0.13;
    const [tx, ty] = P(long, a), [lx, ly] = P(side, a - Math.PI / 2), [rx, ry] = P(side, a + Math.PI / 2);
    pts.push(`<path d="M0,0L${lx},${ly}L${tx},${ty}Z" fill="${ink}"/><path d="M0,0L${rx},${ry}L${tx},${ty}Z" fill="${fill}" stroke="${ink}" stroke-width=".8"/>`);
  }
  return `<g transform="translate(${cx} ${cy})"><circle r="${r * 0.72}" fill="none" stroke="${ink}" stroke-width=".7"/><circle r="${r * 0.78}" fill="none" stroke="${ink}" stroke-width=".4"/>${pts.join('')}<text y="${-r - 6}" text-anchor="middle" font-family="Cormorant Garamond" font-weight="600" font-size="${r * 0.34}" fill="${ink}">N</text></g>`;
}

export { sectorPath, arcOnly, esc, P, RAD, r2 };
