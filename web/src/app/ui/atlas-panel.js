// Atlas panel (color = "Where they were born"): how many birthplaces were placed in a
// country, and the ones that were not, most frequent first, each with a country picker.
// Assignments are stored as project placeOverrides; the file is never changed.

import { html } from '../../vendor/preact-htm.module.js';
import { COUNTRY_NAMES } from '../engine/places.js';
import { num, plural } from './format.js';

const SORTED = [...new Set(COUNTRY_NAMES)].sort((a, b) => a.localeCompare(b, 'en'));

function pct(p) {
  const v = Math.round(p * 100);
  return p > 0 && v === 0 ? '<1%' : `${v}%`;
}

/**
 * @param {{ atlas: object|null, legend: object[]|undefined, placeOverrides: object,
 *   onAssign: (place: string, country: string|null) => void, usStates: boolean, onUsStates: (v: boolean) => void }} props
 */
export function AtlasPanel({ atlas, legend = [], placeOverrides = {}, onAssign, usStates, onUsStates }) {
  if (!atlas) return html`<p class="hint">Birthplaces are counted when the chart is drawn.</p>`;
  const { coverage, unresolved = [], summary } = atlas;
  const assigned = Object.entries(placeOverrides || {});
  const total = legend.reduce((s, e) => s + e.count, 0) || 1;

  return html`
    <div class="atlas">
      <p class="atlas__coverage nums" role="status">
        ${coverage.total
          ? html`Resolved <strong>${num(coverage.resolved)}</strong> of <strong>${num(coverage.total)}</strong> birthplaces on this chart.`
          : 'Nobody on this chart has a birthplace recorded yet.'}
      </p>
      ${legend.length > 0 && html`
        <div class="atlas__bar" aria-hidden="true">
          ${legend.map(e => html`<span style=${{ flexGrow: e.count, background: e.color }}></span>`)}
        </div>
        <ul class="atlas__legend" role="list">
          ${legend.map(e => html`
            <li><span class="atlas__swatch" style=${{ background: e.color }}></span><span>${e.label}</span><b class="nums">${pct(e.count / total)}</b></li>`)}
        </ul>`}
      ${summary && html`<p class="hint">${summary}.</p>`}
      <label class="check atlas__us">
        <input type="checkbox" checked=${usStates} onChange=${e => onUsStates(e.currentTarget.checked)} />
        <span>Show US states separately</span>
      </label>
      ${unresolved.length > 0 && html`
        <div class="atlas__todo">
          <p class="atlas__lead">We couldn’t place ${plural(unresolved.length, 'birthplace')}. Tell us which country each is in and we’ll color them.</p>
          <ul class="atlas__places" role="list">
            ${unresolved.slice(0, 40).map((u, i) => html`
              <li class="atlas__place">
                <label class="atlas__place-name" for=${`atlas-${i}`}>
                  <span>${u.place}</span>
                  <small class="nums">${plural(u.count, 'person', 'people')}${u.ambiguous ? ' · a historical place' : ''}</small>
                </label>
                <select id=${`atlas-${i}`} class="select" onChange=${e => e.currentTarget.value && onAssign(u.place, e.currentTarget.value)}>
                  <option value="">Choose a country</option>
                  ${u.candidates && u.candidates.length > 0 && html`
                    <optgroup label="Most likely">${u.candidates.map(c => html`<option value=${c}>${c}</option>`)}</optgroup>`}
                  <optgroup label="All countries">${SORTED.map(c => html`<option value=${c}>${c}</option>`)}</optgroup>
                </select>
              </li>`)}
          </ul>
          ${unresolved.length > 40 && html`<p class="hint">${plural(unresolved.length - 40, 'more place')} after these. They appear here as you assign the ones above.</p>`}
        </div>`}
      ${assigned.length > 0 && html`
        <div class="atlas__done">
          <p class="atlas__lead">You placed ${plural(assigned.length, 'birthplace')}:</p>
          <ul class="atlas__assigned" role="list">
            ${assigned.map(([place, country]) => html`
              <li><span>${place} <span class="muted">→ ${country}</span></span>
                <button type="button" class="btn--quiet" onClick=${() => onAssign(place, null)} aria-label=${`Undo: ${place} in ${country}`}>Undo</button></li>`)}
          </ul>
        </div>`}
    </div>`;
}
