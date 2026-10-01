// Edit how one person appears on the chart. Edits are project overrides
// (engine/tree.js applyOverrides): the family tree file itself is never changed.

import { html, useState, useEffect, useRef } from '../../vendor/preact-htm.module.js';
import { parseDate } from '../engine/dates.js';
import { firstName } from './format.js';

const dateText = ev => (ev && ev.date && ev.date.display) || '';

function checkDate(s) {
  const t = String(s || '').trim();
  if (!t) return null;
  const d = parseDate(t);
  return d && typeof d.year === 'number' ? null : 'We couldn’t read that date. Try 24 May 1819, May 1819, 1819 or about 1819.';
}

/**
 * @param {{ person: object, override: object|undefined, isRoot: boolean, chart: string,
 *   onSave: (override: object) => void (the person's complete override; {} means none), onReset: () => void, onClose: () => void,
 *   onMakeRoot: () => void, describe?: object }} props
 *   person: the person as read from the file (before any edits)
 */
export function EditPanel({ person, override = {}, isRoot, chart, onSave, onReset, onClose, onMakeRoot }) {
  const initial = () => ({
    name: override.name ?? person.name ?? '',
    born: override.birth !== undefined ? (override.birth && override.birth.date) || '' : dateText(person.birth),
    place: override.place ?? ((person.birth && person.birth.place) || ''),
    died: override.death !== undefined ? (override.death && override.death.date) || '' : dateText(person.death),
  });
  const [f, setF] = useState(initial);
  const [errors, setErrors] = useState({});
  const headRef = useRef(null);
  useEffect(() => { setF(initial()); setErrors({}); }, [person.id, JSON.stringify(override)]);
  useEffect(() => { if (headRef.current) headRef.current.focus(); }, [person.id]);

  const fn = firstName(person) || 'this person';
  const edited = override && Object.keys(override).length > 0;
  const set = k => e => setF({ ...f, [k]: e.currentTarget.value });

  const save = e => {
    e.preventDefault();
    const errs = { born: checkDate(f.born), died: checkDate(f.died) };
    if (!f.name.trim() && !override.unknown) errs.name = 'Type a name, or choose “Show as unknown” below.';
    setErrors(errs);
    if (errs.born || errs.died || errs.name) return;
    const patch = {};
    if (f.name.trim() !== (person.name || '')) patch.name = f.name.trim();
    if (f.born.trim() !== dateText(person.birth)) patch.birth = f.born.trim() ? { date: f.born.trim() } : { date: '' };
    if (f.died.trim() !== dateText(person.death)) patch.death = f.died.trim() ? { date: f.died.trim() } : { date: '' };
    if (f.place.trim() !== ((person.birth && person.birth.place) || '')) patch.place = f.place.trim();
    onSave({ ...(override.unknown ? { unknown: true } : {}), ...(override.hidden ? { hidden: true } : {}), ...patch });
  };

  const flag = (k, v) => () => {
    const next = { ...override };
    if (v) next[k] = true; else delete next[k];
    onSave(next);
  };

  return html`
    <section class="edit panel panel--offset" aria-labelledby="edit-title">
      <div class="panel__head">
        <span id="edit-title" tabindex="-1" ref=${headRef}>Edit how ${fn} appears</span>
        <button type="button" class="icon-btn" aria-label="Close the edit panel" onClick=${onClose}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg>
        </button>
      </div>
      <form class="panel__body" onSubmit=${save} novalidate>
        ${override.hidden && html`<p class="notice notice--warn"><span>${fn} and everyone above them are hidden from the chart.</span></p>`}
        ${override.unknown && html`<p class="notice notice--info"><span>${fn} shows as an empty slot. Their parents stay on the chart.</span></p>`}
        <div class=${`field${errors.name ? ' field--error' : ''}`}>
          <label class="label" for="edit-name">Name on the chart</label>
          <input id="edit-name" class="input" value=${f.name} onInput=${set('name')} autocomplete="off" spellcheck="false"
            aria-invalid=${errors.name ? 'true' : 'false'} aria-describedby=${errors.name ? 'edit-name-err' : undefined} />
          ${errors.name && html`<p class="error-message" id="edit-name-err">${errors.name}</p>`}
        </div>
        <div class="field-row">
          <div class=${`field${errors.born ? ' field--error' : ''}`}>
            <label class="label" for="edit-born">Born</label>
            <input id="edit-born" class="input" value=${f.born} onInput=${set('born')} autocomplete="off" placeholder="e.g. about 1843"
              aria-invalid=${errors.born ? 'true' : 'false'} aria-describedby=${errors.born ? 'edit-born-err' : 'edit-date-hint'} />
          </div>
          <div class=${`field${errors.died ? ' field--error' : ''}`}>
            <label class="label" for="edit-died">Died</label>
            <input id="edit-died" class="input" value=${f.died} onInput=${set('died')} autocomplete="off"
              aria-invalid=${errors.died ? 'true' : 'false'} aria-describedby=${errors.died ? 'edit-died-err' : 'edit-date-hint'} />
          </div>
        </div>
        <p class="hint" id="edit-date-hint">Dates like 24 May 1819, May 1819, 1819 or about 1819. Leave empty to show no date.</p>
        ${errors.born && html`<p class="error-message" id="edit-born-err">Born: ${errors.born}</p>`}
        ${errors.died && html`<p class="error-message" id="edit-died-err">Died: ${errors.died}</p>`}
        <div class="field">
          <label class="label" for="edit-place">Birthplace</label>
          <input id="edit-place" class="input" value=${f.place} onInput=${set('place')} autocomplete="off" />
        </div>
        <div class="edit__save">
          <button type="submit" class="btn btn--secondary btn--small">Show on the chart</button>
        </div>
        <ul class="edit__actions" role="list">
          ${!isRoot && html`<li><button type="button" class="btn--quiet" onClick=${onMakeRoot}>${chart === 'bowtie' ? `Make a fan chart centered on ${fn}` : `Put ${fn} in the center`}</button></li>`}
          <li><button type="button" class="btn--quiet" onClick=${flag('unknown', !override.unknown)}>${override.unknown ? `Show ${fn} again` : 'Show as unknown'}</button></li>
          ${!isRoot && html`<li><button type="button" class="btn--quiet" onClick=${flag('hidden', !override.hidden)}>${override.hidden ? `Show ${fn} again` : `Hide ${fn} and everyone above them`}</button></li>`}
          ${edited && html`<li><button type="button" class="btn--quiet" onClick=${onReset}>Undo every change to ${fn}</button></li>`}
        </ul>
      </form>
      <p class="panel__foot">Your family tree file is not changed. These edits are kept with this project, on this computer.</p>
    </section>`;
}
