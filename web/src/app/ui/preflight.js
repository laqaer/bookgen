// Glyph preflight (company/BRIEF.md §4.3 "Text system", voice rule 9): before any
// export, list the names on the chart that the chart fonts cannot print (Chinese,
// Japanese, Korean, Hebrew, Arabic in v1) and let the visitor type a romanized form.

import { html, useState } from '../../vendor/preact-htm.module.js';
import { ancestors } from '../engine/tree.js';
import { plural } from './format.js';

const SCRIPTS = [
  [/[一-鿿㐀-䶿豈-﫿]/u, 'Chinese'],
  [/[぀-ヿ]/u, 'Japanese'],
  [/[가-힯ᄀ-ᇿ]/u, 'Korean'],
  [/[֐-׿]/u, 'Hebrew'],
  [/[؀-ۿݐ-ݿ]/u, 'Arabic'],
];

/** Name of the script of the missing characters ("Chinese"), or "some". */
export function scriptName(chars) {
  const s = chars.join('');
  for (const [re, name] of SCRIPTS) if (re.test(s)) return name;
  return 'some';
}

/**
 * People on the chart whose names the fonts cannot print, and who have no romanized form.
 * @param {object} tree tree with overrides and romanized names applied
 * @param {{ chart: string, rootId: string, coupleIds?: string[], generations: number }} o
 * @param {(font: string, str: string) => { ok: boolean, missing: string[] }} hasGlyphs
 * @param {string[]} fontKeys the fonts names are set in
 * @returns {{ id: string, name: string, missing: string[], script: string }[]}
 */
export function unprintableNames(tree, o, hasGlyphs, fontKeys = ['ebg-400']) {
  const ids = new Set();
  const add = (root, gens) => { for (const id of ancestors(tree, root, gens).values()) ids.add(id); };
  try {
    if (o.chart === 'bowtie' && o.coupleIds && o.coupleIds.length === 2) {
      for (const id of o.coupleIds) add(id, o.generations + 1);
    } else if (o.rootId) {
      add(o.rootId, o.generations);
    }
  } catch { return []; }
  const out = [];
  for (const id of ids) {
    const p = tree.people[id];
    if (!p || p.unknown || !p.name) continue;
    const missing = new Set();
    for (const f of fontKeys) {
      let r;
      try { r = hasGlyphs(f, p.name); } catch { continue; }
      if (!r.ok) r.missing.forEach(c => missing.add(c));
    }
    if (!missing.size) continue;
    if (p.romanized) {
      let fine = true;
      for (const f of fontKeys) { try { if (!hasGlyphs(f, p.romanized).ok) fine = false; } catch { /* ignore */ } }
      if (fine) continue;
    }
    out.push({ id, name: p.name, missing: [...missing], script: scriptName([...missing]) });
  }
  return out;
}

/**
 * @param {{ items: object[], romanized: Record<string,string>, onRomanize: (id: string, text: string) => void }} props
 */
export function Preflight({ items, romanized, onRomanize }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState({});
  if (!items.length) return null;
  const scripts = [...new Set(items.map(i => i.script))].filter(s => s !== 'some');
  return html`
    <div class="notice notice--warn preflight" role="status">
      <p class="notice__title">${plural(items.length, 'name')} can’t be printed yet.</p>
      <p>The chart fonts don’t have ${scripts.length ? scripts.join(' or ') : 'these'} letters. Type a romanized form for each and the chart will use it.</p>
      <button type="button" class="btn--quiet" aria-expanded=${open ? 'true' : 'false'} onClick=${() => setOpen(!open)}>
        ${open ? 'Hide the list' : `Type romanized names (${items.length})`}
      </button>
      ${open && html`
        <ul class="preflight__list" role="list">
          ${items.map(it => html`
            <li class="preflight__item">
              <label class="label" for=${`rom-${it.id}`}><span lang="und">${it.name}</span></label>
              <div class="preflight__row">
                <input id=${`rom-${it.id}`} class="input" autocomplete="off" spellcheck="false" placeholder="Romanized name"
                  value=${drafts[it.id] ?? romanized[it.id] ?? ''} onInput=${e => setDrafts({ ...drafts, [it.id]: e.currentTarget.value })}
                  onKeyDown=${e => { if (e.key === 'Enter') { e.preventDefault(); onRomanize(it.id, (drafts[it.id] || '').trim()); } }} />
                <button type="button" class="btn btn--secondary btn--small" onClick=${() => onRomanize(it.id, (drafts[it.id] || '').trim())}>Use</button>
              </div>
            </li>`)}
        </ul>`}
    </div>`;
}
