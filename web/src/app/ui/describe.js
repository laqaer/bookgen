// The "register" line for a person on the chart: Ahnentafel number, name, dates,
// birthplace and how they are related to the person in the center. Pure functions.

import { relationshipLabel } from '../engine/tree.js';
import { firstName, possessive } from './format.js';

/** Generations above the root for an Ahnentafel number (1 -> 0, 2..3 -> 1). */
export function stepsUp(n) {
  return Math.floor(Math.log2(n));
}

/** The line from n back to the root: [n, n/2, ..., 1]. */
export function lineOf(n) {
  const out = [n];
  while (n > 1) { n = Math.floor(n / 2); out.push(n); }
  return out;
}

/** Ahnentafel number of the parent (2 or 3) whose side n is on; 0 for the root. */
export function sideOf(n) {
  let x = n;
  while (x > 3) x = Math.floor(x / 2);
  return x >= 2 ? x : 0;
}

function eventText(label, ev) {
  if (!ev) return '';
  const d = ev.date && ev.date.display ? ev.date.display : '';
  const p = ev.place || '';
  if (!d && !p) return '';
  return `${label} ${[d, p].filter(Boolean).join(', ')}`;
}

/**
 * Keys that identify the highlighted line for a hit, matched against scene.hits by lineKey().
 * @returns {Set<string>}
 */
export function lineKeys(hit, scene) {
  const keys = new Set();
  if (!hit) return keys;
  if (hit.side) {
    for (const k of lineOf(hit.ahnen || 1)) keys.add(k === 1 ? `c:${hit.side}` : `${hit.side}:${k}`);
  } else if (hit.ahnen) {
    for (const k of lineOf(hit.ahnen)) keys.add(`${k}`);
  } else {
    // a bowtie partner in the medallion
    const idx = centerIndex(hit, scene);
    keys.add(`c:${idx === 0 ? 'a' : 'b'}`);
  }
  return keys;
}

function centerIndex(hit, scene) {
  const centers = (scene.hits || []).filter(h => !h.ahnen && !h.side);
  return Math.max(0, centers.indexOf(hit));
}

/** Key of a hit in the same space as lineKeys(). */
export function lineKey(hit, scene) {
  if (hit.side) return `${hit.side}:${hit.ahnen}`;
  if (hit.ahnen) return `${hit.ahnen}`;
  return `c:${centerIndex(hit, scene) === 0 ? 'a' : 'b'}`;
}

/**
 * Describe a hit for the register.
 * @param {object} hit
 * @param {{ tree: object, scene: object, privacy: string, coupleIds?: string[] }} ctx
 * @returns {{ id: string, no: string, name: string, facts: string, relation: string, line: string, appears: string, living: boolean }}
 */
export function describeHit(hit, ctx) {
  const { tree, scene } = ctx;
  const p = tree.people[hit.personId];
  if (!p) return null;
  const hits = scene.hits || [];
  const out = { id: p.id, no: '', name: p.unknown ? 'Unknown' : (p.name || 'Name not recorded'), facts: '', relation: '', line: '', appears: '', living: !!p.living };

  const facts = [eventText('Born', p.birth), eventText('Died', p.death)].filter(Boolean);
  out.facts = facts.length ? facts.join(' · ') : 'No dates or places recorded.';
  if (p.living) {
    out.facts = ctx.privacy === 'show-all'
      ? `${out.facts} Living: dates are printed because “Show everything” is on.`
      : ctx.privacy === 'living-only'
        ? 'Living. The chart shows only the word “Living”.'
        : `${facts.length ? out.facts + ' ' : ''}Living. Dates are hidden on the chart.`.trim();
  }

  const center = id => tree.people[id];
  if (hit.side) {
    const partnerHit = hits.find(h => !h.ahnen && !h.side && centerIndex(h, scene) === (hit.side === 'a' ? 0 : 1));
    const partner = partnerHit ? center(partnerHit.personId) : null;
    const pn = firstName(partner);
    const up = stepsUp(hit.ahnen);
    const label = relationshipLabel(up, 0, p.sex);
    out.no = `No. ${hit.ahnen} on ${possessive(pn)} side`;
    out.relation = `${possessive(pn)} ${label}${up >= 2 ? sideText(hit, hits, tree, pn) : ''}.`;
    out.line = lineOf(hit.ahnen).join(' → ');
  } else if (hit.ahnen) {
    out.no = `No. ${hit.ahnen}`;
    if (hit.ahnen === 1) {
      out.relation = 'The person in the center of this chart.';
    } else {
      const rootHit = hits.find(h => h.ahnen === 1);
      const rn = firstName(rootHit ? center(rootHit.personId) : null);
      const up = stepsUp(hit.ahnen);
      out.relation = `${possessive(rn)} ${relationshipLabel(up, 0, p.sex)}${up >= 2 ? sideText(hit, hits, tree, rn) : ''}.`;
      out.line = lineOf(hit.ahnen).join(' → ');
    }
  } else {
    out.no = 'In the center';
    out.relation = 'One of the couple in the center.';
  }

  const places = hits.filter(h => h.personId === hit.personId && (h.ahnen || h.side));
  const nums = [...new Set(places.map(h => (h.side ? `${h.ahnen} (${h.side === 'a' ? 'left' : 'right'})` : String(h.ahnen))))];
  if (nums.length > 1) out.appears = `Appears ${nums.length} times on this chart: No. ${nums.join(', No. ')}. Two of the lines above meet in this person.`;
  return out;
}

/** ", on Thomas’s side" — named after the parent, so it reads right for every family. */
function sideText(hit, hits, tree, rootFirst) {
  const s = sideOf(hit.ahnen);
  const ph = hits.find(h => h.ahnen === s && (h.side || null) === (hit.side || null));
  const parent = ph ? tree.people[ph.personId] : null;
  const pn = firstName(parent);
  if (pn) return `, on ${possessive(pn)} side`;
  return s === 2 ? `, on ${possessive(rootFirst)} first parent’s side` : `, on ${possessive(rootFirst)} second parent’s side`;
}

/** Center of a hit in scene points (for keyboard navigation and scrolling into view). */
export function hitCenter(h) {
  if (h.shape === 'rect') return { x: h.x + h.w / 2, y: h.y + h.h / 2 };
  if (h.r0 === 0 && h.a1 - h.a0 >= 360) return { x: h.cx, y: h.cy };
  const a = ((h.a0 + h.a1) / 2) * Math.PI / 180;
  const r = h.r0 === 0 ? h.r1 * 0.5 : (h.r0 + h.r1) / 2;
  return { x: h.cx + r * Math.sin(a), y: h.cy - r * Math.cos(a) };
}

/**
 * Spatial keyboard navigation: the nearest hit in an arrow's direction.
 * @param {object[]} hits
 * @param {object} from current hit
 * @param {'up'|'down'|'left'|'right'} dir
 */
export function nextHit(hits, from, dir) {
  const c = hitCenter(from);
  const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best = null, bestScore = Infinity;
  for (const h of hits) {
    if (h === from) continue;
    const p = hitCenter(h);
    const dx = p.x - c.x, dy = p.y - c.y;
    const along = dx * v[0] + dy * v[1];
    if (along <= 0.5) continue;
    const across = Math.abs(dx * v[1] - dy * v[0]);
    if (across > along * 3.1) continue; // within about 72° of the arrow
    const score = along + across * 2.5;
    if (score < bestScore) { bestScore = score; best = h; }
  }
  return best || logicalNext(hits, from, dir);
}

/** Family-order fallback: up/right go out to a parent, down/left come back toward the center. */
function logicalNext(hits, from, dir) {
  const side = from.side || null;
  const at = n => hits.find(h => h.ahnen === n && (h.side || null) === side);
  const n = from.ahnen || 1;
  if (dir === 'up' || dir === 'right') return at(2 * n) || at(2 * n + 1) || null;
  if (n <= 1) return null;
  const child = n >> 1;
  if (child === 1 && side) {
    const centers = hits.filter(h => !h.ahnen && !h.side);
    return centers[side === 'a' ? 0 : 1] || null;
  }
  return at(child) || null;
}
