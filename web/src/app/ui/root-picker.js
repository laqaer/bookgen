// Person picker: the chosen person (name + years) with a type-ahead search over the
// whole file (engine/tree.js searchPeople). An ARIA combobox: arrow keys move through
// the list, Enter picks, Escape closes.

import { html, useState, useRef, useMemo, useEffect } from '../../vendor/preact-htm.module.js';
import { searchPeople } from '../engine/tree.js';
import { formatYearRange } from '../engine/dates.js';

let uid = 0;

function yearsOf(p) {
  return p ? formatYearRange(p.birth, p.death) : '';
}

/**
 * @param {{ tree: object, value: string|null, onChange: (id: string) => void, label: string,
 *   hint?: string, suggestions?: { id: string, note: string }[], changeLabel?: string }} props
 */
export function PersonPicker({ tree, value, onChange, label, hint, suggestions = [], changeLabel = 'Choose someone else' }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const id = useMemo(() => `pp-${++uid}`, []);
  const person = value ? tree.people[value] : null;

  const results = useMemo(() => {
    if (!open) return [];
    if (!q.trim()) {
      return suggestions.map(s => ({ ...tree.people[s.id], years: yearsOf(tree.people[s.id]), note: s.note })).filter(p => p && p.id);
    }
    return searchPeople(tree, q, 8);
  }, [open, q, tree, suggestions]);

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);
  useEffect(() => { setActive(0); }, [q]);

  const pick = p => {
    if (!p) return;
    onChange(p.id);
    setOpen(false);
    setQ('');
  };
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(results.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); pick(results[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); setQ(''); }
  };

  return html`
    <div class="picker">
      ${person && html`
        <p class="picker__current">
          <span class="picker__name">${person.name || 'Name not recorded'}</span>
          ${yearsOf(person) && html`<span class="picker__years nums">${yearsOf(person)}</span>`}
        </p>`}
      ${!open && html`
        <button type="button" class="btn--quiet picker__change" aria-expanded="false" onClick=${() => setOpen(true)}>
          ${person ? changeLabel : label}
        </button>`}
      ${open && html`
        <div class="picker__search">
          <label class="label" for=${`${id}-q`}>${label}</label>
          ${hint && html`<p class="hint" id=${`${id}-hint`}>${hint}</p>`}
          <input id=${`${id}-q`} ref=${inputRef} class="input" type="search" autocomplete="off" spellcheck="false"
            role="combobox" aria-expanded=${results.length > 0 ? 'true' : 'false'} aria-controls=${`${id}-list`}
            aria-autocomplete="list" aria-describedby=${hint ? `${id}-hint` : undefined}
            aria-activedescendant=${results.length ? `${id}-o${active}` : undefined}
            placeholder="Type a name or a year" value=${q}
            onInput=${e => setQ(e.currentTarget.value)} onKeyDown=${onKey} />
          <ul class="picker__list" id=${`${id}-list`} role="listbox" aria-label="Matching people">
            ${results.map((p, i) => html`
              <li id=${`${id}-o${i}`} role="option" aria-selected=${i === active ? 'true' : 'false'}
                class=${`picker__option${i === active ? ' is-active' : ''}`}
                onMouseDown=${e => e.preventDefault()} onClick=${() => pick(p)} onMouseMove=${() => setActive(i)}>
                <span class="picker__option-name">${p.name || 'Name not recorded'}</span>
                <span class="picker__option-meta nums">${[p.years, p.note || (p.birth && p.birth.place) || ''].filter(Boolean).join(' · ')}</span>
              </li>`)}
          </ul>
          ${q.trim() && !results.length && html`<p class="hint" role="status">Nobody in this file matches “${q.trim()}”. Try a surname, or a birth year.</p>`}
          <button type="button" class="btn--quiet" onClick=${() => { setOpen(false); setQ(''); }}>Cancel</button>
        </div>`}
    </div>`;
}
