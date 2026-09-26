// A synthetic Scene that exercises every Scene IR item type, used by the chart
// smoke test in the browser (harness.html) and in Node (scene-smoke.mjs).
// Names are test strings chosen for their scripts and diacritics (they are not
// presented as anyone's ancestors).
//
//   import { buildSyntheticScene, SYNTHETIC_NAMES } from './synthetic-scene.js';
//   setTextBackend(fonts); const scene = buildSyntheticScene({ grainSrc });

import {
  arcText, fitText, fitArc, radialText, fitBlock, smallCapsText, arcLength, polar,
} from '../../src/app/charts/text.js';
import { sectorPath, circlePath, arcPath, rectPath, fmt } from '../../src/app/charts/path.js';
import { pageSize, margins } from '../../src/app/charts/sizes.js';

export const INK = '#3a2a14';
export const SEPIA = '#6b4f2a';
export const GOLD = '#a8832f';
export const BG = '#f7f1e3';

/** Ring 1 (arc text), ring 2 (arc text), ring 3 (radial text). */
export const PEOPLE = [
  // ring 1: two parents
  { id: 'I2', name: 'Dvořák Ødegård', dates: '1791–1854' },
  { id: 'I3', name: 'Nguyễn Thị Hoa', dates: '1793–1861' },
  // ring 2: four grandparents
  { id: 'I4', name: 'Κωνσταντίνος Παπαδόπουλος', dates: '1760–1822' },
  { id: 'I5', name: 'Seán Ó Briain', dates: '1764–1830' },
  { id: 'I6', name: 'Zdeňka Wąsowska', dates: '1766–1841' },
  { id: 'I7', name: 'Þórður Guðmundsson', dates: '1731/32–1790' },
  // ring 3: eight great-grandparents
  { id: 'I8', name: 'Екатерина Иванова', dates: '1735–1799' },
  { id: 'I9', name: 'Przemysł Łukasiewicz', dates: 'c. 1740–1801' },
  { id: 'I10', name: 'Anneliese Müller', dates: '1738–1790' },
  { id: 'I11', name: 'Charlotte of Mecklenburg-Strelitz', dates: '1744–1818' },
  { id: 'I12', name: 'Jóhanna Brønnum', dates: '1741–1808' },
  { id: 'I13', name: 'François Lefèvre', dates: 'b. 1736' },
  { id: 'I14', name: 'Wolff Griffith', dates: '1730–1795' },
  { id: 'I15', name: 'Ælfgifu Ashdown', dates: '1745–1812' },
];

export const ROOT = { id: 'I1', name: 'Victoria Weber', dates: '1819–1901' };

/** Every name the PDF must contain as extractable text. */
export const SYNTHETIC_NAMES = [ROOT.name, ...PEOPLE.map(p => p.name)];

/**
 * Build the scene. Requires text.js to have a font backend (setTextBackend).
 * @param {{ grainSrc?: string }} [opts] grainSrc: URL of a paper texture (image item)
 */
export function buildSyntheticScene(opts = {}) {
  const { wPt, hPt } = pageSize('11x14', 'portrait');
  const m = margins(wPt, hPt);
  const items = [];
  const hits = [];
  const cx = wPt / 2, cy = m.top + 330;
  const R = [0, 70, 150, 230, 340];
  const A0 = -135, SWEEP = 270;

  // paper grain under everything
  if (opts.grainSrc) items.push({ t: 'image', x: 0, y: 0, w: wPt, h: hPt, src: opts.grainSrc, opacity: 0.35 });

  // engraved double rule around the live area
  items.push({ t: 'path', d: rectPath(m.x, m.y, m.w, m.h), stroke: SEPIA, sw: 0.5 });
  items.push({ t: 'path', d: rectPath(m.x + 4, m.y + 4, m.w - 8, m.h - 8), stroke: SEPIA, sw: 0.35 });

  // clipped, translucent ornament group: a graticule clipped to a circle behind the fan
  const grat = [];
  for (let x = cx - 360; x <= cx + 360; x += 24) grat.push(`M${fmt(x)} ${fmt(cy - 360)} V${fmt(cy + 360)}`);
  for (let y = cy - 360; y <= cy + 360; y += 24) grat.push(`M${fmt(cx - 360)} ${fmt(y)} H${fmt(cx + 360)}`);
  items.push({
    t: 'group', clip: circlePath(cx, cy, R[4] + 14), opacity: 0.5,
    items: [
      { t: 'path', d: grat.join(' '), stroke: '#9fb3c8', sw: 0.35 },
      { t: 'path', d: circlePath(cx, cy, R[4] + 10), stroke: GOLD, sw: 0.5 },
      // text inside the clip, partly cut off on purpose
      { t: 'text', x: cx + R[4] + 6, y: cy + 40, str: 'clipped', font: 'ebg-400i', size: 14, color: SEPIA, anchor: 'start', rot: 90, opacity: 0.8 },
    ],
  });

  // rings
  let idx = 0;
  for (let ring = 1; ring <= 3; ring++) {
    const n = 2 ** ring;
    const r0 = R[ring], r1 = R[ring + 1];
    for (let k = 0; k < n; k++) {
      const p = PEOPLE[idx++];
      const a0 = A0 + (SWEEP * k) / n, a1 = A0 + (SWEEP * (k + 1)) / n;
      const mid = (a0 + a1) / 2;
      items.push({ t: 'path', d: sectorPath(cx, cy, r0, r1, a0, a1), fill: k % 2 ? '#efe4cc' : '#e9dcbf', stroke: SEPIA, sw: 0.5, join: 'round' });
      hits.push({ personId: p.id, ahnen: n + k, side: k < n / 2 ? 'a' : 'b', shape: 'sector', cx, cy, r0, r1, a0, a1 });
      if (ring <= 2) {
        // names along the arc, dates on an inner arc
        const rName = r0 + (r1 - r0) * 0.6, rDate = r0 + (r1 - r0) * 0.28;
        const span = (a1 - a0) * 0.9;
        const fit = fitArc([p.name, p.name.split(' ').slice(-1)[0]], ring === 1 ? 'ebg-600' : 'ebg-400', rName, span, ring === 1 ? 22 : 16);
        items.push(arcText(fit.str, ring === 1 ? 'ebg-600' : 'ebg-400', fit.size, INK, cx, cy, rName, mid, { valign: 'middle' }));
        items.push(arcText(p.dates, 'ebg-400i', ring === 1 ? 11 : 9, SEPIA, cx, cy, rDate, mid, { valign: 'middle', tracking: 0.3 }));
      } else {
        // radial: name (balanced over two lines when needed) + dates
        const thick = arcLength(a1 - a0, (r0 + r1) / 2) * 0.8;
        const block = fitBlock([p.name], r1 - r0 - 16, thick * 0.62, 'ebg-400', 12);
        const lines = [...block.lines, p.dates];
        const sizes = [...block.lines.map(() => block.size), Math.max(6, block.size * 0.8)];
        const fontsFor = [...block.lines.map(() => 'ebg-400'), 'ebg-400i'];
        items.push(...radialText(lines, fontsFor, sizes, cx, cy, (r0 + r1) / 2, mid, { color: lines.map((_, i) => (i === lines.length - 1 ? SEPIA : INK)) }));
      }
    }
  }

  // centre medallion
  items.push({ t: 'path', d: circlePath(cx, cy, R[1]), fill: '#fbf7ee', stroke: GOLD, sw: 1.2 });
  items.push({ t: 'path', d: circlePath(cx, cy, R[1] - 4), stroke: GOLD, sw: 0.4, opacity: 0.7 });
  const rootFit = fitText([ROOT.name, 'Victoria'], R[1] * 1.7, 'ebg-600', 20);
  items.push({ t: 'text', x: cx, y: cy - 4, str: rootFit.str, font: 'ebg-600', size: rootFit.size, color: INK, anchor: 'middle', baseline: 'alphabetic' });
  items.push({ t: 'text', x: cx, y: cy + 16, str: ROOT.dates, font: 'ebg-400', size: 12, color: SEPIA, anchor: 'middle', baseline: 'middle' });
  hits.push({ personId: ROOT.id, ahnen: 1, shape: 'sector', cx, cy, r0: 0, r1: R[1], a0: 0, a1: 360 });

  // ornament: quadratic + relative arc commands, round caps
  const [ox, oy] = polar(cx, cy, R[4] + 26, 180);
  items.push({ t: 'path', d: `M${fmt(ox - 60)} ${fmt(oy)} q30 -14 60 0 t60 0 M${fmt(ox - 4)} ${fmt(oy - 8)} a4 4 0 1 1 8 0 a4 4 0 1 1 -8 0 Z`, stroke: GOLD, sw: 0.8, cap: 'round', join: 'round', fill: 'none' });
  items.push({ t: 'path', d: arcPath(cx, cy, R[4] + 8, A0, A0 + SWEEP), stroke: GOLD, sw: 0.5 });

  // title block: tracked small caps title, tracked caps subtitle, italic dedication
  const ty = hPt - m.bottom - 150;
  items.push(...smallCapsText('The Ancestors of Victoria Weber', 'cg-500', 30, cx, ty, { tracking: 2.4, anchor: 'middle', color: INK }));
  items.push({ t: 'text', x: cx, y: ty + 30, str: 'FOUR GENERATIONS · 1731–1901', font: 'cg-500', size: 11, color: SEPIA, anchor: 'middle', tracking: 2.2 });
  items.push({ t: 'text', x: cx, y: ty + 54, str: 'For Oma, Christmas 2026', font: 'cg-500i', size: 13, color: SEPIA, anchor: 'middle', opacity: 0.9 });
  items.push({ t: 'path', d: `M${fmt(cx - 120)} ${fmt(ty + 12)} H${fmt(cx + 120)} M${fmt(cx - 120)} ${fmt(ty + 15)} H${fmt(cx + 120)}`, stroke: GOLD, sw: 0.35 });
  hits.push({ personId: ROOT.id, shape: 'rect', x: cx - 250, y: ty - 30, w: 500, h: 90 });
  // colophon, bottom right, rotated -90 to exercise rotation + anchor end
  items.push({ t: 'text', x: wPt - m.right - 8, y: hPt - m.bottom - 12, str: 'Made with Gildroot · gildroot.com', font: 'ebg-400', size: 7, color: SEPIA, anchor: 'end', rot: -90 });

  return {
    wPt, hPt, bg: BG, items, hits,
    meta: {
      chart: 'fan', style: 'ivory', colorMode: 'tones', generations: 4,
      fonts: ['ebg-400', 'ebg-400i', 'ebg-600', 'cg-500', 'cg-500i'],
      counts: { slots: 15, placed: 15, abbreviated: 0, missing: 0 },
      warnings: [], title: 'The Ancestors of Victoria Weber', subtitle: 'Four generations · 1731–1901',
    },
  };
}

const FIRST = ['Johann', 'Maria', 'Jóhanna', 'Przemysł', 'Þórður', 'Bartholomew', 'Wilhelmina', 'Seán', 'Zdeňka', 'François', 'Anneliese', 'Wojciech', 'Margarethe', 'Ekaterina', 'Κωνσταντίνος', 'Nguyễn Thị'];
const LAST = ['Weber', 'Wąsowska', 'Dvořák', 'Guðmundsson', 'Fitzwilliam-Montgomery', 'Ó Briain', 'Müller', 'Łukasiewicz', 'Brønnum', 'Schwarzenberg', 'Kowalczyk', 'Παπαδόπουλος', 'Hoa'];

/**
 * A full-size performance scene: 24×36 in, 270° fan, `gens` generations
 * (8 → 255 people), arc names on rings 1–3 and two-line radial names beyond.
 * Deterministic. Requires a text backend.
 */
export function buildBenchScene(gens = 8) {
  const { wPt, hPt } = pageSize('24x36', 'portrait');
  const cx = wPt / 2, cy = 1150, R0 = 90, ring = (800 - R0) / (gens - 1);
  const items = [], hits = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = a => a[Math.floor(rnd() * a.length)];
  items.push({ t: 'path', d: circlePath(cx, cy, R0), fill: '#fbf7ee', stroke: GOLD, sw: 1 });
  items.push({ t: 'text', x: cx, y: cy, str: 'Johann Weber', font: 'ebg-600', size: 26, color: INK, anchor: 'middle', baseline: 'middle' });
  let people = 1;
  for (let g = 1; g < gens; g++) {
    const n = 2 ** g, r0 = R0 + (g - 1) * ring, r1 = r0 + ring;
    for (let k = 0; k < n; k++) {
      const a0 = -135 + (270 * k) / n, a1 = -135 + (270 * (k + 1)) / n, mid = (a0 + a1) / 2;
      const name = `${pick(FIRST)} ${pick(LAST)}`;
      const dates = `${1900 - g * 28 + Math.floor(rnd() * 10)}–${1960 - g * 28 + Math.floor(rnd() * 20)}`;
      const id = `P${n + k}`;
      people++;
      items.push({ t: 'path', d: sectorPath(cx, cy, r0, r1, a0, a1), fill: k % 2 ? '#efe4cc' : '#e9dcbf', stroke: SEPIA, sw: 0.4 });
      hits.push({ personId: id, ahnen: n + k, shape: 'sector', cx, cy, r0, r1, a0, a1 });
      if (g <= 3) {
        const rName = r0 + ring * 0.6;
        const fit = fitArc([name, name.split(' ').slice(-1)[0]], 'ebg-600', rName, (a1 - a0) * 0.9, 22) || { str: name.split(' ').slice(-1)[0], size: 6 };
        items.push(arcText(fit.str, 'ebg-600', fit.size, INK, cx, cy, rName, mid, { valign: 'middle' }));
        items.push(arcText(dates, 'ebg-400i', 12, SEPIA, cx, cy, r0 + ring * 0.3, mid, { valign: 'middle' }));
      } else {
        const thick = arcLength(a1 - a0, (r0 + r1) / 2) * 0.85;
        const block = fitBlock([name, name.split(' ').slice(-1)[0]], ring - 12, thick * 0.62, 'ebg-400', 16, 6, 5.5) || { lines: [name.split(' ').slice(-1)[0]], size: 5.5 };
        const lines = [...block.lines, dates];
        items.push(...radialText(lines, [...block.lines.map(() => 'ebg-400'), 'ebg-400i'], [...block.lines.map(() => block.size), Math.max(5.5, block.size * 0.8)], cx, cy, (r0 + r1) / 2, mid, { color: INK }));
      }
    }
  }
  items.push(...smallCapsText('The Ancestors of Johann Weber', 'cg-500', 64, cx, 2200, { tracking: 6, anchor: 'middle', color: INK }));
  return { wPt, hPt, bg: BG, items, hits, meta: { chart: 'fan', style: 'ivory', colorMode: 'tones', generations: gens, fonts: [], counts: { slots: 2 ** gens - 1, placed: people, abbreviated: 0, missing: 0 }, warnings: [], title: 'The Ancestors of Johann Weber', subtitle: '' } };
}
