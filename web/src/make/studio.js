// The Gildroot studio (/make/): flow A of company/BRIEF.md §4.2.
//
// Import a file (or a sample) -> choose who is in the center -> the chart appears in
// Ivory at automatic depth -> change chart, style, color, size, generations, titles,
// privacy -> point at people, edit how they appear -> print it (free Letter PDF, or
// the paid exports behind ui/gate.js).
//
// Everything happens in this browser. The file is parsed in a Web Worker
// (engine/worker.js), the chart is laid out on the main thread (charts/layout.js,
// about 30 ms warm), and the project autosaves to IndexedDB (ui/store.js).
// Nothing leaves the browser except the license check and bucketed analytics.

import { html, render, useState, useEffect, useRef, useMemo, useCallback } from '../vendor/preact-htm.module.js';
import { loadFonts, fonts, FONT_KEYS } from '../app/charts/fonts.js';
import { layout, loadChartEngines, titleText } from '../app/charts/layout.js';
import { PAPER, SIZES, SIZE_LIMITS, MIN_GENERATIONS, FREE_MAX_GENERATIONS } from '../app/charts/sizes.js';
import { STYLES, STYLE_KEYS, COLOR_MODES } from '../app/charts/styles.js';
import { exportPdf, exportTiles, exportJpeg, exportShareImage, downloadBlob } from '../app/charts/export.js';
import { suggestRoot, autoGenerations, parentsOf, ancestors, applyOverrides } from '../app/engine/tree.js';
import { formatYearRange } from '../app/engine/dates.js';
import { Preview } from '../app/ui/preview.js';
import { OnTheWall } from '../app/ui/wall.js';
import { PersonPicker } from '../app/ui/root-picker.js';
import { EditPanel } from '../app/ui/edit-panel.js';
import { AtlasPanel } from '../app/ui/atlas-panel.js';
import { Preflight, unprintableNames } from '../app/ui/preflight.js';
import { ExportBar, ExportMore, Paywall } from '../app/ui/export-panel.js';
import { renderStyleThumbs } from '../app/ui/thumbs.js';
import { describeHit, lineKey } from '../app/ui/describe.js';
import { parseTree, quickCount, explainParseError, fileTypeProblem } from '../app/ui/parse-client.js';
import { saveProject, savedProjects, forgetProject } from '../app/ui/store.js';
import { requirePaid, paidReasons, licenseStatus, checkoutLink } from '../app/ui/gate.js';
import { track, configureAnalytics } from '../app/ui/analytics.js';
import {
  num, plural, word, sizeLabel, sizeLong, timeAgo, bucketPeople, firstName,
  CHART_LABEL, CHART_HINT, COLOR_LABEL, COLOR_HINT, SWEEP_LABEL, PRIVACY_LABEL,
} from '../app/ui/format.js';

// ---------------------------------------------------------------------------
// Config and one-time loading

const CONFIG = (() => {
  try { return JSON.parse(document.getElementById('studio-config').textContent); } catch { return {}; }
})();
const PRICE = (CONFIG.prices && CONFIG.prices.heirloom) || 29;
configureAnalytics(CONFIG.analytics && CONFIG.analytics.plausibleDomain);

const SAMPLES = Object.freeze({
  'almeida-novak': { file: '/samples/almeida-novak.ged', label: 'The Almeida–Novak family', note: 'A made-up sample family, so you can see how the charts look. None of these people are real.' },
  victoria: { file: '/samples/victoria.ged', label: 'Queen Victoria', note: 'Queen Victoria’s ancestors, from public Wikidata records (CC0).' },
});

let enginesPromise = null;
/** Fonts (and PDFKit, which measures them) and the three chart engines. */
function enginesReady() {
  if (!enginesPromise) {
    enginesPromise = Promise.all([loadFonts(FONT_KEYS), loadChartEngines()]).catch(e => { enginesPromise = null; throw e; });
  }
  return enginesPromise;
}
// start fetching the type straight away: the visitor is choosing a file meanwhile
const idleStart = window.requestIdleCallback || (fn => setTimeout(fn, 200));
idleStart(() => { enginesReady().catch(() => {}); });

const DEFAULTS = Object.freeze({
  chart: 'fan', rootId: null, coupleIds: null, style: 'ivory', colorMode: 'tones', size: 'letter',
  generations: null, sweep: null, title: '', subtitle: '', dedication: '', privacy: 'hide-dates',
  showPlaces: true, trimEmpty: false, usStates: false, bleed: false, marriageDate: '', marriagePlace: '',
});

const ICONS = {
  fan: html`<svg viewBox="0 0 84 72" aria-hidden="true"><path d="M42 68V8M42 68 14 20M42 68 28 12M42 68 56 12M42 68 70 20"/><path d="M18 24A28 28 0 0 1 66 24" stroke-dasharray="1 6"/></svg>`,
  bowtie: html`<svg viewBox="0 0 84 72" aria-hidden="true"><path d="M42 36 8 12M42 36 8 36M42 36 8 60M42 36 76 12M42 36 76 36M42 36 76 60"/><circle cx="42" cy="36" r="4" class="fill"/></svg>`,
  pedigree: html`<svg viewBox="0 0 84 72" aria-hidden="true"><rect x="4" y="28" width="24" height="16" rx="1"/><rect x="56" y="8" width="24" height="16" rx="1"/><rect x="56" y="48" width="24" height="16" rx="1"/><path d="M28 36H40V16H56M40 16V56H56"/></svg>`,
};

const cap = (size, chart) => SIZE_LIMITS[size][chart];
const yearsOf = p => (p ? formatYearRange(p.birth, p.death) : '');

/** The smallest size that fits more generations of this chart than `size` does. */
function biggerSizeFor(size, chart) {
  const now = cap(size, chart);
  return SIZES.find(s => cap(s, chart) > now) || null;
}

/** Default couple for "Two families": the root's two parents (task spec), else null (layout uses a partner). */
function defaultCouple(tree, rootId) {
  if (!tree || !rootId) return null;
  const { father, mother } = parentsOf(tree, rootId);
  return father && mother ? [father, mother] : null;
}

function partnersOf(tree, id) {
  const p = tree.people[id];
  const out = [];
  for (const fid of (p && p.fams) || []) {
    const fam = tree.families[fid];
    for (const x of (fam && fam.partners) || []) if (x !== id && tree.people[x] && !out.includes(x)) out.push(x);
  }
  return out;
}

function plainLayoutError(e) {
  const m = String((e && e.message) || e);
  if (/bowtie needs two people/.test(m)) return 'A two-family chart needs two people. Choose them under “The two families” on the left.';
  if (/no people/.test(m)) return 'This file has no people to put on a chart.';
  if (/not loaded/.test(m)) return 'The chart engines are still loading. This takes a few seconds on a slow connection.';
  return `The chart could not be drawn (${m}). Try another chart type or size. If it keeps happening, email support@gildroot.com and say which options you chose. Please don’t attach your file.`;
}

// ---------------------------------------------------------------------------
// Small controls

function Section({ id, title, children, peek, className = '' }) {
  return html`
    <section class=${`rail__section${peek ? ' rail__section--peek' : ''} ${className}`} aria-labelledby=${`${id}-h`}>
      <h2 class="rail__h" id=${`${id}-h`}>${title}</h2>
      ${children}
    </section>`;
}

function Segmented({ name, legend, value, options, onChange, icons }) {
  return html`
    <fieldset class="fieldset">
      <legend class="visually-hidden">${legend}</legend>
      <div class=${`seg${icons ? ' seg--icons' : ''}`} style=${{ '--n': options.length }}>
        ${options.map(o => html`
          <label class="seg__opt">
            <input type="radio" name=${name} value=${o.value} checked=${String(value) === String(o.value)} onChange=${() => onChange(o.value)} />
            <span class="seg__face">${o.icon || ''}<span class="seg__label">${o.label}</span></span>
          </label>`)}
      </div>
    </fieldset>`;
}

function RadioList({ name, legend, value, options, onChange }) {
  return html`
    <fieldset class="fieldset">
      <legend class="visually-hidden">${legend}</legend>
      <div class="radios">
        ${options.map(o => html`
          <label class="check radios__opt">
            <input type="radio" name=${name} value=${o.value} checked=${value === o.value} onChange=${() => onChange(o.value)} />
            <span><span class="radios__label">${o.label}</span>${o.hint && html`<span class="hint">${o.hint}</span>`}</span>
          </label>`)}
      </div>
    </fieldset>`;
}

function Stepper({ id, value, min, max, onChange, label }) {
  return html`
    <div class="stepper" role="group" aria-labelledby=${`${id}-label`}>
      <span id=${`${id}-label`} class="visually-hidden">${label}</span>
      <button type="button" class="stepper__btn" aria-label=${`Fewer generations (now ${value})`} disabled=${value <= min} onClick=${() => onChange(value - 1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" /></svg>
      </button>
      <output class="stepper__value nums" aria-live="polite">${value}</output>
      <button type="button" class="stepper__btn" aria-label=${`More generations (now ${value})`} disabled=${value >= max} onClick=${() => onChange(value + 1)}>
        <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M10 4v12" /></svg>
      </button>
    </div>`;
}

/** A text input that shows automatic text until the visitor types their own. */
function AutoText({ id, label, value, auto, onChange, hint, placeholder }) {
  const [draft, setDraft] = useState(null);
  const shown = draft ?? (value || auto || '');
  return html`
    <div class="field">
      <label class="label" for=${id}>${label}</label>
      <input id=${id} class="input" value=${shown} placeholder=${placeholder || auto || ''} autocomplete="off"
        onInput=${e => { const v = e.currentTarget.value; setDraft(v); onChange(v.trim() === (auto || '').trim() ? '' : v); }}
        onBlur=${() => setDraft(null)} aria-describedby=${hint ? `${id}-hint` : undefined} />
      ${hint && html`<p class="hint" id=${`${id}-hint`}>${hint}</p>`}
      ${value && auto && html`<button type="button" class="btn--quiet" onClick=${() => { setDraft(null); onChange(''); }}>Use the automatic ${label.toLowerCase()}</button>`}
    </div>`;
}

// ---------------------------------------------------------------------------
// The start screen

function Start({ onFile, onSample, status, busy, saved, onResume, onForget }) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);
  const pick = () => inputRef.current && inputRef.current.click();
  const drop = e => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) onFile(f);
  };
  const latest = saved[0];
  return html`
    <section class="studio-start">
      <div class="container studio-start__grid">
        <div class="studio-start__main">
          <p class="eyebrow">The studio</p>
          <h1 class="studio-start__title">Make your chart</h1>
          <p class="lead">Choose your family tree file. It is read on this computer, and nothing is uploaded.</p>

          ${saved.length > 0 && html`
            <div class="resume" aria-labelledby="resume-h">
              <h2 class="resume__h" id="resume-h">Resume where you left off</h2>
              <ul class="resume__list" role="list">
                ${saved.map(rec => html`
                  <li class="resume__item">
                    <div class="resume__text">
                      <span class="resume__title">${rec.title || 'Your chart'}</span>
                      <span class="resume__meta nums">${rec.source.kind === 'sample' ? 'Sample' : rec.source.name} · ${CHART_LABEL[rec.options.chart] || 'Fan'} · ${STYLES[rec.options.style] ? STYLES[rec.options.style].label : 'Ivory'} · saved ${timeAgo(rec.savedAt)}</span>
                    </div>
                    <div class="resume__actions">
                      <button type="button" class=${`btn ${rec === latest ? 'btn--secondary' : 'btn--secondary'} btn--small`} disabled=${busy} onClick=${() => onResume(rec)}>Resume</button>
                      <button type="button" class="btn--quiet" disabled=${busy} onClick=${() => onForget(rec)}>Remove from this computer</button>
                    </div>
                  </li>`)}
              </ul>
              <p class="hint">Saved in this browser only. Nothing was uploaded.</p>
            </div>`}

          <div id="dropzone" class=${`dropzone${drag ? ' is-dragging' : ''}${busy ? ' is-busy' : ''}`}
            onDragEnter=${e => { e.preventDefault(); setDrag(true); }} onDragOver=${e => { e.preventDefault(); setDrag(true); }}
            onDragLeave=${() => setDrag(false)} onDrop=${drop}>
            <div class="dropzone__head">
              <svg class="dropzone__icon" viewBox="0 0 40 48" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 14V6a2 2 0 0 1 2-2h10l4 5h14a2 2 0 0 1 2 2v6"/><path d="M4 14h32l-3 28H7Z"/><path d="M14 24v10M20 22v14M26 24v10"/>
              </svg>
              <div>
                <p class="dropzone__title">Drop your family tree file</p>
                <p class="dropzone__text">A .ged, .zip or .gdz file. Nothing is uploaded.</p>
              </div>
            </div>
            <div class="cluster">
              <button type="button" class="btn btn--primary btn--block-phone" disabled=${busy} onClick=${pick}>Choose a file</button>
              <input ref=${inputRef} id="file-input" type="file" class="visually-hidden" tabindex="-1" accept=".ged,.gedcom,.zip,.gdz,text/plain,application/zip"
                onChange=${e => { const f = e.currentTarget.files && e.currentTarget.files[0]; if (f) onFile(f); e.currentTarget.value = ''; }} />
            </div>
            <p class=${`dropzone__status${status && status.kind === 'error' ? ' is-error' : ''}`} role="status" aria-live="polite">
              ${status && status.kind === 'busy' && html`<span class="spinner" aria-hidden="true"></span>`}
              ${status ? status.text : ''}
            </p>
          </div>

          <p class="studio-start__links">
            <button type="button" class="link-arrow" disabled=${busy} onClick=${() => onSample('almeida-novak')}>Try a sample family</button>
            <button type="button" class="link-arrow" disabled=${busy} onClick=${() => onSample('victoria')}>See Queen Victoria’s ancestors</button>
          </p>
        </div>

        <aside class="studio-start__aside" aria-labelledby="where-h">
          <h2 class="studio-start__h" id="where-h">Where to find your file</h2>
          <table class="paths">
            <caption class="visually-hidden">Where to find the GEDCOM export in Ancestry, MyHeritage and FamilySearch</caption>
            <tbody>
              <tr><th scope="row">Ancestry</th><td><span class="menu-path"><span>Trees</span><span>your tree</span><span>Tree Settings</span><span>Export tree</span></span></td></tr>
              <tr><th scope="row">MyHeritage</th><td><span class="menu-path"><span>Family tree</span><span>tree menu (…)</span><span>Export GEDCOM</span></span></td></tr>
              <tr><th scope="row">FamilySearch</th><td>No direct export. A free program such as RootsMagic Essentials reads your tree and saves a GEDCOM.</td></tr>
            </tbody>
          </table>
          <p class="caption">Menu names change now and then. These were checked in September 2026.</p>
          <h2 class="studio-start__h">What happens to your file</h2>
          <p class="studio-start__p">This page reads it inside your browser. It is never uploaded, and nobody at Gildroot can see it. Your chart is saved in this browser, so it is here when you come back on this computer.</p>
        </aside>
      </div>
    </section>`;
}

// ---------------------------------------------------------------------------
// The studio

function App() {
  const [phase, setPhase] = useState('start');
  const [status, setStatus] = useState(null);
  const [busyStart, setBusyStart] = useState(false);
  const [saved, setSaved] = useState([]);
  const [tree, setTree] = useState(null);
  const [source, setSource] = useState(null);
  const [opts, setOptsState] = useState(DEFAULTS);
  const [overrides, setOverrides] = useState({});
  const [placeOverrides, setPlaceOverrides] = useState({});
  const [romanized, setRomanized] = useState({});
  const [scene, setScene] = useState(null);
  const [layoutError, setLayoutError] = useState(null);
  const [layoutMs, setLayoutMs] = useState(0);
  const [hovered, setHovered] = useState(null);
  const [sel, setSel] = useState(null);
  const [editing, setEditing] = useState(null);
  const [wall, setWall] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [tier, setTier] = useState('free');
  const [paywall, setPaywall] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [busy, setBusy] = useState(null);
  const [exportStatus, setExportStatus] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [announce, setAnnounce] = useState('');
  const controls = useRef(null);
  const thumbRefs = useRef({});
  const autoSubtitle = useRef('');
  const sessionId = useRef(0);
  const sceneRef = useRef(null);

  const setOpts = useCallback(patch => setOptsState(o => ({ ...o, ...(typeof patch === 'function' ? patch(o) : patch) })), []);

  // ---- license tier (re-checked when the visitor comes back from checkout or /unlock/)
  useEffect(() => {
    const check = () => licenseStatus().then(s => setTier(s.tier || 'free'));
    check();
    checkoutLink('heirloom', { src: 'studio' }, CONFIG.checkout || {}).then(setCheckout);
    window.addEventListener('focus', check);
    const vis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', vis); };
  }, []);

  // ---- the workspace fills the window under the site header; on phones the stage
  // stops where the bottom sheet's closed height begins
  useEffect(() => {
    const body = document.body;
    const top = () => {
      const h = document.querySelector('.site-header');
      body.style.setProperty('--studio-top', `${h ? Math.round(h.getBoundingClientRect().bottom + window.scrollY) : 113}px`);
    };
    top();
    window.addEventListener('resize', top);
    const rail = document.querySelector('.rail');
    let ro = null;
    if (rail && !sheetOpen) {
      ro = new ResizeObserver(() => { if (!rail.closest('.is-sheet-open')) body.style.setProperty('--sheet-peek', `${Math.round(rail.getBoundingClientRect().height)}px`); });
      ro.observe(rail);
    }
    return () => { window.removeEventListener('resize', top); if (ro) ro.disconnect(); };
  }, [phase, sheetOpen]);

  // ---- saved projects and deep links
  const refreshSaved = () => savedProjects().then(setSaved);
  useEffect(() => {
    refreshSaved();
    const fromHash = () => {
      const h = decodeURIComponent(location.hash.replace(/^#/, '')).toLowerCase();
      if (h === 'sample' || h === 'almeida-novak') openSample('almeida-novak');
      else if (h === 'victoria') openSample('victoria');
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, []);

  // ---- opening a tree
  async function startProject(t, src, rec) {
    await enginesReady();
    const my = ++sessionId.current;
    const o = { ...DEFAULTS, ...(rec ? rec.options : {}) };
    if (!o.rootId || !t.people[o.rootId]) o.rootId = suggestRoot(t);
    if (o.coupleIds && !(o.coupleIds.every(id => t.people[id]))) o.coupleIds = null;
    if (!STYLE_KEYS.includes(o.style)) o.style = 'ivory';
    if (!PAPER[o.size]) o.size = 'letter';
    if (my !== sessionId.current) return;
    setTree(t);
    setSource(src);
    setOptsState(o);
    setOverrides((rec && rec.overrides) || {});
    setPlaceOverrides((rec && rec.placeOverrides) || {});
    setRomanized((rec && rec.romanized) || {});
    setScene(null);
    sceneRef.current = null;
    setSel(null); setHovered(null); setEditing(null); setWall(false);
    setExportStatus(null);
    const count = Object.keys(t.people).length;
    const root = t.people[o.rootId];
    if (rec) setNotice({ kind: 'ok', text: `Welcome back. Your chart is as you left it ${timeAgo(rec.savedAt)}.` });
    else if (src.kind === 'sample') setNotice({ kind: 'info', text: SAMPLES[src.sample].note });
    else {
      const anc = Math.max(0, ancestors(t, o.rootId, 8).size - 1);
      setNotice({ kind: 'ok', text: `Read ${plural(count, 'person', 'people')} on this computer. Nothing was uploaded. The chart starts with ${root ? root.name : 'the suggested person'}, who has ${plural(anc, 'ancestor')} in this file. To start from someone else, use “In the center” on the left.` });
    }
    setPhase('studio');
    setStatus(null);
    setBusyStart(false);
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    track('Studio: tree opened', { source: src.kind === 'sample' ? src.sample : 'file', people: bucketPeople(count) });
  }

  async function openFile(file) {
    const problem = fileTypeProblem(file.name);
    if (problem) { setStatus({ kind: 'error', text: problem }); return; }
    if (file.size > 300 * 1024 * 1024) { setStatus({ kind: 'error', text: `${file.name} is ${Math.round(file.size / 1048576)} MB, too large to read in a browser tab. Export only the direct ancestors from your family tree program, then try again.` }); return; }
    setBusyStart(true);
    setStatus({ kind: 'busy', text: `Opening ${file.name} on this computer. Nothing is uploaded.` });
    try {
      const buf = await file.arrayBuffer();
      const n = quickCount(new Uint8Array(buf));
      setStatus({ kind: 'busy', text: n ? `Reading ${plural(n, 'person', 'people')} on this computer. Nothing is uploaded.` : `Reading ${file.name} on this computer. Nothing is uploaded.` });
      const t = await parseTree(buf, file.name);
      setStatus({ kind: 'busy', text: `Read ${plural(Object.keys(t.people).length, 'person', 'people')}. Setting the type for your chart…` });
      await startProject(t, { kind: 'file', name: file.name, bytes: buf }, null);
    } catch (e) {
      setBusyStart(false);
      setPhase('start');
      setStatus({ kind: 'error', text: /font|PDFKit|load/i.test(String(e && e.message)) && !/GEDCOM|people|archive/i.test(String(e && e.message))
        ? 'The chart fonts didn’t load. Check your internet connection and reload this page. Your file stays on this computer.'
        : explainParseError(e, file.name) });
    }
  }

  async function openSample(key, rec = null) {
    const s = SAMPLES[key];
    if (!s) return;
    setBusyStart(true);
    setStatus({ kind: 'busy', text: `Opening ${s.label}. Nothing is uploaded.` });
    try {
      const res = await fetch(s.file);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const t = await parseTree(buf, s.file.split('/').pop());
      await startProject(t, { kind: 'sample', name: s.file.split('/').pop(), sample: key }, rec);
    } catch (e) {
      setBusyStart(false);
      setPhase('start');
      setStatus({ kind: 'error', text: `The sample could not be opened (${e.message}). Check your internet connection and reload this page.` });
    }
  }

  async function resume(rec) {
    if (rec.source.kind === 'sample') return openSample(rec.source.sample, rec);
    setBusyStart(true);
    setStatus({ kind: 'busy', text: `Reading ${rec.source.name} again on this computer. Nothing is uploaded.` });
    try {
      const t = await parseTree(rec.source.bytes, rec.source.name);
      await startProject(t, rec.source, rec);
    } catch (e) {
      setBusyStart(false);
      setStatus({ kind: 'error', text: explainParseError(e, rec.source.name) });
    }
  }

  async function forget(rec) {
    await forgetProject(rec.slot);
    refreshSaved();
    setStatus({ kind: 'ok', text: `Removed ${rec.title || 'that project'} from this computer.` });
  }

  // ---- derived trees and options
  const viewTree = useMemo(() => {
    if (!tree) return null;
    const ids = Object.keys(romanized).filter(id => tree.people[id] && romanized[id]);
    if (!ids.length) return tree;
    const people = { ...tree.people };
    for (const id of ids) people[id] = { ...people[id], romanized: romanized[id] };
    return { ...tree, people };
  }, [tree, romanized]);
  const effTree = useMemo(() => (viewTree ? applyOverrides(viewTree, overrides) : null), [viewTree, overrides]);

  const chart = opts.chart;
  const maxGens = cap(opts.size, chart);
  const minGens = MIN_GENERATIONS[chart];
  const coupleIds = useMemo(() => (chart === 'bowtie' ? (opts.coupleIds || defaultCouple(effTree, opts.rootId)) : null), [chart, opts.coupleIds, effTree, opts.rootId]);
  const autoGens = useMemo(() => {
    if (!effTree || !opts.rootId) return minGens;
    if (chart === 'bowtie') return Math.min(maxGens, 4);
    return Math.max(minGens, autoGenerations(effTree, opts.rootId, maxGens));
  }, [effTree, opts.rootId, chart, maxGens, minGens]);
  const gens = opts.generations ? Math.max(minGens, Math.min(maxGens, opts.generations)) : autoGens;
  const colophon = tier === 'free';

  const layoutOpts = useMemo(() => {
    if (!viewTree) return null;
    return {
      tree: viewTree, chart, rootId: opts.rootId, coupleIds: coupleIds || undefined,
      sweep: chart === 'fan' && opts.sweep ? opts.sweep : undefined,
      generations: gens, size: opts.size, orientation: 'auto', style: opts.style, colorMode: opts.colorMode,
      privacy: opts.privacy, title: opts.title, subtitle: opts.subtitle, dedication: opts.dedication,
      showPlaces: opts.showPlaces, trimEmpty: opts.trimEmpty, bleed: false, colophon,
      placeOverrides, overrides, usStates: opts.usStates,
      marriage: opts.marriageDate || opts.marriagePlace ? { date: opts.marriageDate, place: opts.marriagePlace } : undefined,
    };
  }, [viewTree, chart, opts, coupleIds, gens, colophon, placeOverrides, overrides]);

  // ---- layout (debounced; about 30 ms warm)
  useEffect(() => {
    if (!layoutOpts) return;
    const t = setTimeout(() => {
      const t0 = performance.now();
      try {
        const sc = layout({ ...layoutOpts, measure: fonts.measure, metrics: fonts.metrics, hasGlyphs: fonts.hasGlyphs });
        const ms = Math.round((performance.now() - t0) * 10) / 10;
        setLayoutMs(ms);
        window.__studioLayoutMs = (window.__studioLayoutMs || []).concat(ms).slice(-50);
        if (!opts.subtitle) autoSubtitle.current = sc.meta.subtitle;
        // keep the pointed-at person across re-layouts
        const prev = sceneRef.current;
        sceneRef.current = sc;
        const remap = h => (h && prev ? sc.hits.find(x => x.personId === h.personId && lineKey(x, sc) === lineKey(h, prev)) || null : null);
        setScene(sc);
        setSel(s => (s ? (remap(s.hit) ? { ...s, hit: remap(s.hit) } : null) : s));
        setHovered(null);
        setLayoutError(null);
      } catch (e) {
        console.error(e);
        setLayoutError(plainLayoutError(e));
      }
    }, scene ? 90 : 0);
    return () => clearTimeout(t);
  }, [layoutOpts]);

  // ---- style thumbnails from the real chart
  const thumbKey = layoutOpts ? [source && source.name, chart, opts.rootId, coupleIds && coupleIds.join(), opts.colorMode, opts.sweep, opts.privacy, opts.showPlaces, opts.trimEmpty, Math.min(gens, 5), JSON.stringify(overrides), JSON.stringify(romanized), JSON.stringify(placeOverrides)].join('|') : '';
  useEffect(() => {
    if (!layoutOpts || phase !== 'studio') return;
    const t = setTimeout(() => { renderStyleThumbs({ ...layoutOpts, title: '', subtitle: '', dedication: '' }, s => thumbRefs.current[s]); }, 350);
    return () => clearTimeout(t);
  }, [thumbKey, phase]);

  // ---- autosave
  useEffect(() => {
    if (phase !== 'studio' || !source || !tree) return;
    const t = setTimeout(async () => {
      const ok = await saveProject({ source, options: opts, overrides, placeOverrides, romanized, title: scene ? scene.meta.title : '', people: Object.keys(tree.people).length });
      window.__studioSaved = ok ? Date.now() : -1;
    }, 700);
    return () => clearTimeout(t);
  }, [phase, source, opts, overrides, placeOverrides, romanized, scene && scene.meta.title]);

  // ---- people on the chart (preflight, privacy counts)
  const chartIds = useMemo(() => {
    if (!effTree || !opts.rootId) return [];
    const set = new Set();
    try {
      if (chart === 'bowtie' && coupleIds) for (const id of coupleIds) for (const x of ancestors(effTree, id, gens + 1).values()) set.add(x);
      else for (const x of ancestors(effTree, opts.rootId, gens).values()) set.add(x);
    } catch { /* ignore */ }
    return [...set];
  }, [effTree, opts.rootId, chart, coupleIds, gens]);
  const livingOnChart = useMemo(() => chartIds.filter(id => effTree.people[id] && effTree.people[id].living).length, [chartIds, effTree]);
  const unprintable = useMemo(() => {
    if (!effTree || !scene) return [];
    const st = STYLES[opts.style] || STYLES.ivory;
    const keys = [...new Set([st.fonts.nameOuter, st.fonts.nameInner, st.fonts.root])];
    return unprintableNames(effTree, { chart, rootId: opts.rootId, coupleIds, generations: gens }, fonts.hasGlyphs, keys);
  }, [effTree, scene, opts.style, chart, opts.rootId, coupleIds, gens]);

  // ---- pointing at people
  const focusHit = hovered || (sel && sel.hit) || null;
  const reg = useMemo(() => (focusHit && scene && effTree ? describeHit(focusHit, { tree: effTree, scene, privacy: opts.privacy }) : null), [focusHit, scene, effTree, opts.privacy]);

  const onSelect = useCallback((hit, how) => {
    if (!hit) { setSel(null); if (how !== 'keyboard') setEditing(null); return; }
    setSel({ hit, how });
    if (how === 'mouse') setEditing(hit.personId);
    else if (how === 'keyboard') setEditing(e => (e ? hit.personId : e));
  }, []);
  const onActivate = useCallback(hit => { setEditing(hit.personId); }, []);

  // ---- edits
  const saveOverride = (id, o) => {
    setOverrides(prev => {
      const next = { ...prev };
      const clean = Object.fromEntries(Object.entries(o || {}).filter(([, v]) => v !== undefined));
      if (!Object.keys(clean).length) delete next[id]; else next[id] = clean;
      return next;
    });
    const p = tree.people[id];
    setAnnounce(`Saved. The chart now shows your changes to ${p ? p.name || 'this person' : 'this person'}.`);
  };
  const makeRoot = id => {
    const p = tree.people[id];
    setOpts(o => ({ rootId: id, chart: o.chart === 'bowtie' ? 'fan' : o.chart, coupleIds: null, generations: null }));
    setEditing(null);
    setSel(null);
    setNotice({ kind: 'ok', text: `${p ? p.name : 'They'} ${p ? 'is' : 'are'} now in the center of the chart.` });
  };

  // ---- exports
  const freeSize = opts.size === 'a4' ? 'a4' : 'letter';
  const freeChart = chart === 'pedigree' ? 'pedigree' : 'fan';
  const freeGens = Math.max(MIN_GENERATIONS[freeChart], Math.min(FREE_MAX_GENERATIONS, chart === freeChart ? gens : autoGens, cap(freeSize, freeChart)));
  const freeLabel = `Download free ${sizeLabel(freeSize)} PDF (${freeGens} generations)`;
  const freeShort = `${sizeLabel(freeSize)} PDF (${freeGens} generations, Ivory)`;
  const freeHint = `The free PDF is a ${sizeLabel(freeSize)} ${CHART_LABEL[freeChart].toLowerCase()} chart of up to 5 generations in Ivory, with “Made with Gildroot” in small type at the bottom.`;
  const current = {
    kind: 'pdf', size: opts.size, generations: scene ? scene.meta.generations : gens, chart, style: opts.style, colorMode: opts.colorMode,
    sizeText: sizeLabel(opts.size), styleLabel: STYLES[opts.style] ? STYLES[opts.style].label : opts.style,
  };
  const reasons = paidReasons(current);
  const needsLicense = reasons.length > 0;
  const paid = tier !== 'free';

  const gateContext = () => {
    const rid = chart === 'bowtie' && coupleIds ? coupleIds[0] : opts.rootId;
    const r = effTree && effTree.people[rid];
    return {
      size: opts.size, chart, style: opts.style, colorMode: opts.colorMode, generations: current.generations,
      rootId: rid, rootName: r ? r.name : '', birthYear: r && r.birth && r.birth.date ? r.birth.date.year : null,
      coupleIds: coupleIds || null,
    };
  };

  async function run(label, fn) {
    setBusy(label);
    setExportStatus(null);
    await new Promise(r => setTimeout(r, 30));
    try {
      const msg = await fn();
      setExportStatus({ kind: 'ok', text: msg });
    } catch (e) {
      console.error(e);
      setExportStatus({ kind: 'error', text: `The export stopped (${e && e.message ? e.message : 'unknown problem'}). Try again. On a phone, a smaller size or fewer generations uses less memory.` });
    } finally {
      setBusy(null);
    }
  }

  async function freePdf() {
    await run('Making your free PDF…', async () => {
      const freeOpts = {
        ...layoutOpts,
        chart: freeChart,
        rootId: chart === 'bowtie' && coupleIds ? opts.rootId : opts.rootId,
        coupleIds: undefined,
        size: freeSize, style: 'ivory', colorMode: 'tones', generations: freeGens, colophon: true, bleed: false,
        sweep: chart === 'fan' && opts.sweep ? opts.sweep : undefined,
      };
      const sc = layout({ ...freeOpts, measure: fonts.measure, metrics: fonts.metrics, hasGlyphs: fonts.hasGlyphs });
      const r = await exportPdf(sc, { size: freeSize });
      window.__studioLastExport = { kind: 'free-pdf', filename: r.filename, bytes: r.bytes.length, names: sc.meta.names, page: [sc.wPt, sc.hPt] };
      track('Studio: export', { kind: 'free-pdf', chart: freeChart, gens: freeGens, size: freeSize, tier });
      return `Saved ${r.filename} to your downloads.`;
    });
  }

  async function gated(kind, fn) {
    const x = { ...current, kind, bleed: kind === 'pdf' && opts.bleed };
    if (paidReasons(x).length) {
      const g = await requirePaid(kind, gateContext());
      if (!g.ok) {
        setPaywall({ kind });
        track('Studio: paywall', { kind, chart, style: opts.style, size: opts.size, gens: current.generations });
        return;
      }
    }
    await fn();
  }

  const paidPdf = () => gated('pdf', () => run('Making your PDF…', async () => {
    const sc = scene.meta && colophon ? layout({ ...layoutOpts, colophon: false, measure: fonts.measure, metrics: fonts.metrics, hasGlyphs: fonts.hasGlyphs }) : scene;
    const r = await exportPdf(sc, { size: opts.size, bleed: opts.bleed });
    window.__studioLastExport = { kind: 'pdf', filename: r.filename, bytes: r.bytes.length, names: sc.meta.names, page: [sc.wPt, sc.hPt] };
    track('Studio: export', { kind: 'pdf', chart, style: opts.style, size: opts.size, gens: sc.meta.generations, tier });
    return `Saved ${r.filename} to your downloads.${opts.bleed ? ' It has 0.125 in bleed and crop marks.' : ''}`;
  }));

  const tiles = () => gated('tiles', () => run('Splitting your poster into pages…', async () => {
    const sheet = ['a4', 'a2', 'a1'].includes(opts.size) ? 'a4' : 'letter';
    const r = await exportTiles(scene, { size: opts.size, sheet });
    track('Studio: export', { kind: 'tiles', size: opts.size, tier });
    return `Saved ${r.filename}: ${plural(r.pages, 'page')}, starting with a map of how they fit together.`;
  }));

  const jpeg = () => gated('jpeg', () => run('Making your JPEG…', async () => {
    const r = await exportJpeg(scene, { size: opts.size });
    track('Studio: export', { kind: 'jpeg', size: opts.size, tier });
    return `Saved ${r.filename}: ${num(r.width)} × ${num(r.height)} pixels at ${r.dpi} dpi.${r.capped ? ` This device can make pictures up to 16.7 megapixels, so it is ${r.dpi} dpi instead of ${r.requestedDpi}. A computer makes the full ${r.requestedDpi} dpi.` : ''}`;
  }));

  const share = () => run('Making your picture…', async () => {
    const r = await exportShareImage(scene, { mark: true, download: false });
    const file = typeof File === 'function' ? new File([r.blob], r.filename, { type: 'image/png' }) : null;
    const touch = matchMedia('(pointer: coarse)').matches;
    if (touch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: scene.meta.title }); return 'Shared.'; } catch (e) { if (e && e.name === 'AbortError') return 'Sharing cancelled.'; }
    }
    downloadBlob(r.blob, r.filename);
    track('Studio: export', { kind: 'share', style: opts.style });
    return `Saved ${r.filename} (1080 × 1350 pixels) to your downloads.`;
  });

  // ---- QA hook for the privacy gate (web/test/qa/privacy.mjs): a full session
  useEffect(() => {
    window.__studio = {
      get scene() { return scene; }, get opts() { return opts; }, get tier() { return tier; }, layoutMs,
      unprintable: unprintable.length,
    };
  });
  useEffect(() => {
    window.__gildrootQaSession = async () => {
      await openSample('almeida-novak');
      const t0 = Date.now();
      while (!window.__studio.scene && Date.now() - t0 < 20000) await new Promise(r => setTimeout(r, 100));
      const sc = window.__studio.scene;
      if (!sc) return { ok: false, error: 'no chart' };
      const pdf = await exportPdf(sc, { size: 'letter', download: false });
      return { ok: true, hits: sc.hits.length, pdfBytes: pdf.bytes.length };
    };
  }, []);

  // =========================================================================
  if (phase === 'start') {
    return html`<${Start} onFile=${openFile} onSample=${k => openSample(k)} status=${status} busy=${busyStart}
      saved=${saved} onResume=${resume} onForget=${forget} />`;
  }

  const st = STYLES[opts.style];
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const people = Object.keys(tree.people).length;
  const root = effTree.people[opts.rootId];
  const bigger = biggerSizeFor(opts.size, chart);
  const autoTitle = titleText({ title: '', chart, coupleIds: coupleIds || [], tree: effTree, privacy: opts.privacy, rootId: opts.rootId });
  const chartLabel = scene ? `${CHART_LABEL[scene.meta.chart]} · ${plural(scene.meta.generations, 'generation')}${scene.meta.chart === 'bowtie' ? ' per side' : ''} · ${sizeLabel(opts.size)}` : '';
  const editPerson = editing && viewTree.people[editing];
  const rootSuggestions = [
    { id: suggestRoot(tree), note: 'Suggested' },
    ...(tree.meta && tree.meta.homeId && tree.meta.homeId !== suggestRoot(tree) ? [{ id: tree.meta.homeId, note: 'Home person in the file' }] : []),
  ].filter(s => s.id && tree.people[s.id]);
  const coupleSuggestions = (() => {
    const ids = [opts.rootId, ...partnersOf(effTree, opts.rootId)];
    const par = parentsOf(effTree, opts.rootId);
    if (par.father) ids.push(par.father);
    if (par.mother) ids.push(par.mother);
    return [...new Set(ids)].filter(Boolean).map(id => ({ id, note: id === opts.rootId ? 'In the center now' : par.father === id || par.mother === id ? `Parent of ${firstName(root)}` : `Partner of ${firstName(root)}` }));
  })();
  const edits = Object.entries(overrides);
  const describeEdit = o => [o.name !== undefined && 'name', o.birth !== undefined && 'birth date', o.death !== undefined && 'death date', o.place !== undefined && 'birthplace', o.unknown && 'shown as unknown', o.hidden && 'hidden with everyone above them'].filter(Boolean).join(', ');

  const preflight = html`<${Preflight} items=${unprintable} romanized=${romanized}
    onRomanize=${(id, text) => setRomanized(r => { const n = { ...r }; if (text) n[id] = text; else delete n[id]; return n; })} />`;
  const exportBar = html`<${ExportBar} free=${{ label: freeLabel, short: freeShort }} needsLicense=${needsLicense} reasons=${reasons}
    paid=${paid} price=${PRICE} sizeText=${sizeLabel(opts.size)} busy=${busy} status=${exportStatus}
    onFreePdf=${freePdf} onPdf=${paidPdf} onPoster=${paidPdf} preflight=${preflight} />`;

  return html`
    <div class=${`studio${sheetOpen ? ' is-sheet-open' : ''}`} data-chart=${chart}>
      <h1 class="visually-hidden">Studio: ${scene ? scene.meta.title : 'your chart'}</h1>
      <p class="visually-hidden" role="status" aria-live="polite">${announce}</p>

      <aside class="rail" aria-label="Chart options">
        <button type="button" class="rail__handle" aria-expanded=${sheetOpen ? 'true' : 'false'} aria-controls="rail-body" onClick=${() => setSheetOpen(!sheetOpen)}>
          <span class="rail__grip" aria-hidden="true"></span>
          <span>${sheetOpen ? 'Hide options' : 'All options'}</span>
        </button>
        <div class="rail__body" id="rail-body">
          <p class="rail__file nums">${source.kind === 'sample' ? SAMPLES[source.sample].label : source.name} · ${plural(people, 'person', 'people')}</p>

          ${chart !== 'bowtie' && html`
            <${Section} id="center" title="In the center">
              <${PersonPicker} tree=${effTree} value=${opts.rootId} label="Find a person" changeLabel="Choose someone else"
                hint="Type part of a name, or a year of birth." suggestions=${rootSuggestions}
                onChange=${id => { setOpts({ rootId: id, generations: null, coupleIds: null }); setSel(null); setEditing(null); }} />
            <//>`}
          ${chart === 'bowtie' && html`
            <${Section} id="couple" title="The two families">
              <p class="hint">Two people side by side, with their ancestors fanning out. Their names and wedding go in the center.</p>
              <div class="couple">
                <div>
                  <p class="couple__side">Left side</p>
                  <${PersonPicker} tree=${effTree} value=${coupleIds ? coupleIds[0] : null} label="Find the first person" changeLabel="Change" suggestions=${coupleSuggestions}
                    onChange=${id => setOpts({ coupleIds: [id, coupleIds ? coupleIds[1] : (partnersOf(effTree, id)[0] || null)].map(x => x || id) })} />
                </div>
                <div>
                  <p class="couple__side">Right side</p>
                  <${PersonPicker} tree=${effTree} value=${coupleIds ? coupleIds[1] : null} label="Find the second person" changeLabel="Change" suggestions=${coupleSuggestions}
                    onChange=${id => setOpts({ coupleIds: [coupleIds ? coupleIds[0] : opts.rootId, id] })} />
                </div>
              </div>
              <div class="field-row">
                <div class="field"><label class="label" for="m-date">Married</label>
                  <input id="m-date" class="input" value=${opts.marriageDate} placeholder="From your file" onInput=${e => setOpts({ marriageDate: e.currentTarget.value })} autocomplete="off" /></div>
                <div class="field"><label class="label" for="m-place">Where</label>
                  <input id="m-place" class="input" value=${opts.marriagePlace} placeholder="From your file" onInput=${e => setOpts({ marriagePlace: e.currentTarget.value })} autocomplete="off" /></div>
              </div>
              <p class="hint">Printed in the center. Leave empty to use the wedding in your file, if it has one.</p>
            <//>`}

          <${Section} id="chart" title="Chart">
            <${Segmented} name="chart" legend="Chart" value=${chart} icons=${true}
              options=${['fan', 'bowtie', 'pedigree'].map(c => ({ value: c, label: CHART_LABEL[c], icon: ICONS[c] }))}
              onChange=${c => setOpts({ chart: c, generations: null })} />
            <p class="hint">${CHART_HINT[chart]}</p>
          <//>

          <${Section} id="style" title="Style" peek=${true}>
            <fieldset class="fieldset">
              <legend class="visually-hidden">Style</legend>
              <div class="swatches">
                ${STYLE_KEYS.map(k => html`
                  <label class="swatch">
                    <input type="radio" name="style" value=${k} checked=${opts.style === k} onChange=${() => setOpts({ style: k })} />
                    <span class="swatch__paper" style=${{ background: STYLES[k].ground }}>
                      <canvas ref=${el => { thumbRefs.current[k] = el; }} aria-hidden="true"></canvas>
                    </span>
                    <span class="swatch__name">${STYLES[k].label}</span>
                  </label>`)}
              </div>
            </fieldset>
            <p class="hint">${st.note}${st.paperNote ? ` ${st.paperNote}` : ''}</p>
          <//>

          <${Section} id="color" title="Color">
            <${RadioList} name="color" legend="Color" value=${opts.colorMode} onChange=${v => setOpts({ colorMode: v })}
              options=${COLOR_MODES.map(m => ({ value: m, label: COLOR_LABEL[m], hint: COLOR_HINT[m] }))} />
            ${opts.colorMode === 'atlas' && html`
              <${AtlasPanel} atlas=${scene && scene.meta.atlas} legend=${scene && scene.meta.legend} placeOverrides=${placeOverrides}
                usStates=${opts.usStates} onUsStates=${v => setOpts({ usStates: v })}
                onAssign=${(place, country) => setPlaceOverrides(p => { const n = { ...p }; if (country) n[place] = country; else delete n[place]; return n; })} />`}
          <//>

          <${Section} id="size" title="Size">
            <label class="visually-hidden" for="size-select">Paper size</label>
            <select id="size-select" class="select" value=${opts.size} onChange=${e => setOpts({ size: e.currentTarget.value })}>
              <optgroup label="Home printer">
                ${['letter', 'a4'].map(s => html`<option value=${s} selected=${opts.size === s}>${sizeLong(s)}</option>`)}
              </optgroup>
              <optgroup label="Posters">
                ${SIZES.filter(s => s !== 'letter' && s !== 'a4').map(s => html`<option value=${s} selected=${opts.size === s}>${sizeLong(s)}</option>`)}
              </optgroup>
            </select>
            <p class="hint">Letter and A4 PDFs are free up to 5 generations, in Ivory. Every size is free to try on screen.</p>
          <//>

          <${Section} id="gens" title="Generations">
            <div class="gencount">
              <${Stepper} id="gens" label="Generations" value=${scene && chart === scene.meta.chart ? scene.meta.generations : gens} min=${minGens} max=${maxGens}
                onChange=${v => setOpts({ generations: v })} />
              <p class="gencount__text">
                ${opts.generations ? html`<span>You chose ${word(gens)}.</span> <button type="button" class="btn--quiet" onClick=${() => setOpts({ generations: null })}>Back to automatic (${autoGens})</button>`
                  : html`<span>Automatic: the deepest generation at least a quarter full.</span>`}
              </p>
            </div>
            <p class="hint">${sizeLabel(opts.size)} fits up to ${word(maxGens)} generations${chart === 'bowtie' ? ' on each side' : ''} of a ${chart === 'bowtie' ? 'two-family chart' : CHART_LABEL[chart].toLowerCase() + ' chart'}.${bigger ? ` For ${cap(bigger, chart)}, choose ${sizeLabel(bigger)} or larger.` : ''}${gens > FREE_MAX_GENERATIONS ? ' The free PDF has up to 5.' : ''}</p>
            ${chart === 'fan' && html`
              <div class="subsection">
                <p class="label" id="sweep-l">Shape</p>
                <${Segmented} name="sweep" legend="Fan shape" value=${scene && scene.meta.sweep ? scene.meta.sweep : (opts.sweep || 180)}
                  options=${[180, 270, 360].map(v => ({ value: v, label: SWEEP_LABEL[v] }))} onChange=${v => setOpts({ sweep: Number(v) })} />
                <p class="hint">${opts.sweep ? html`<button type="button" class="btn--quiet" onClick=${() => setOpts({ sweep: null })}>Back to automatic</button>` : 'Automatic: a half circle up to 5 generations, three-quarters above.'}</p>
              </div>`}
          <//>

          <${Section} id="words" title="Title and dedication">
            <${AutoText} id="t-title" label="Title" value=${opts.title} auto=${autoTitle} onChange=${v => setOpts({ title: v })} />
            <${AutoText} id="t-sub" label="Subtitle" value=${opts.subtitle} auto=${autoSubtitle.current} onChange=${v => setOpts({ subtitle: v })} />
            <div class="field">
              <label class="label" for="t-ded">Dedication</label>
              <input id="t-ded" class="input" value=${opts.dedication} placeholder="For Mom, Christmas 2026" autocomplete="off" onInput=${e => setOpts({ dedication: e.currentTarget.value })} aria-describedby="t-ded-hint" />
              <p class="hint" id="t-ded-hint">Optional. Printed under the title.</p>
            </div>
          <//>

          <${Section} id="privacy" title="Living people">
            <${RadioList} name="privacy" legend="Living people" value=${opts.privacy} onChange=${v => setOpts({ privacy: v })}
              options=${['hide-dates', 'living-only', 'show-all'].map(v => ({ value: v, label: PRIVACY_LABEL[v] }))} />
            <p class="hint">${livingOnChart ? `${plural(livingOnChart, 'person', 'people')} on this chart ${livingOnChart === 1 ? 'counts' : 'count'} as living` : 'Nobody on this chart counts as living'}: no death record, and born less than 100 years ago.</p>
          <//>

          <${Section} id="details" title="On the chart">
            <label class="check"><input type="checkbox" checked=${opts.showPlaces} onChange=${e => setOpts({ showPlaces: e.currentTarget.checked })} /><span>Show birthplaces</span></label>
            <label class="check"><input type="checkbox" checked=${opts.trimEmpty} onChange=${e => setOpts({ trimEmpty: e.currentTarget.checked })} /><span>Leave out empty branches<span class="hint">Otherwise missing ancestors show as faint, empty slots.</span></span></label>
          <//>

          ${edits.length > 0 && html`
            <${Section} id="edits" title="Your changes">
              <ul class="edits" role="list">
                ${edits.map(([id, o]) => html`
                  <li class="edits__item">
                    <button type="button" class="edits__who" onClick=${() => setEditing(id)}>${(tree.people[id] && tree.people[id].name) || 'Unknown'}</button>
                    <span class="hint">${describeEdit(o)}</span>
                    <button type="button" class="btn--quiet" onClick=${() => saveOverride(id, {})}>Undo</button>
                  </li>`)}
              </ul>
              <p class="hint">Your family tree file is not changed.</p>
            <//>`}

          <${Section} id="more" title="More ways to print">
            <${ExportMore} paid=${paid} busy=${busy} bleed=${opts.bleed} onBleed=${v => setOpts({ bleed: v })}
              tileSheet=${['a4', 'a2', 'a1'].includes(opts.size) ? 'A4' : 'Letter'} freeHint=${freeHint}
              onShare=${share} onTiles=${tiles} onJpeg=${jpeg} />
          <//>

          <${Section} id="project" title="This project">
            <p class="hint">Saved in this browser as you work. Nothing is uploaded.</p>
            <ul class="project-links" role="list">
              <li><button type="button" class="btn--quiet" onClick=${() => { setPhase('start'); refreshSaved(); setStatus(null); }}>Open another file</button></li>
            </ul>
          <//>
        </div>
        <div class="rail__export">${exportBar}</div>
      </aside>

      <section class="stage" aria-label="Preview">
        <div class="stage__bar">
          <p class="stage__label nums">${chartLabel}${st ? ` · ${st.label}` : ''}</p>
          <div class="stage__tools" role="toolbar" aria-label="Preview tools">
            <button type="button" class="vtool" aria-label="Zoom out" disabled=${wall} onClick=${() => controls.current && controls.current.zoomOut()}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12" /></svg></button>
            <button type="button" class="vtool vtool--text nums" aria-label=${`Fit the whole chart (now ${Math.round(zoom * 100)}%)`} disabled=${wall} onClick=${() => controls.current && controls.current.fit()}>
              ${Math.abs(zoom - 1) < 0.01 ? 'Fit' : `${Math.round(zoom * 100)}%`}</button>
            <button type="button" class="vtool" aria-label="Zoom in" disabled=${wall} onClick=${() => controls.current && controls.current.zoomIn()}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12M10 4v12" /></svg></button>
            <button type="button" class=${`vtool vtool--text vtool--toggle${wall ? ' is-on' : ''}`} aria-pressed=${wall ? 'true' : 'false'} onClick=${() => setWall(!wall)}>On the wall</button>
          </div>
        </div>

        ${notice && !wall && html`
          <div class=${`stage__notice notice notice--${notice.kind}`} role="status">
            <span>${notice.text}</span>
            <button type="button" class="icon-btn" aria-label="Dismiss this message" onClick=${() => setNotice(null)}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg></button>
          </div>`}

        <div class="stage__view">
          ${!scene && !layoutError && html`<p class="stage__loading" role="status"><span class="spinner" aria-hidden="true"></span> Setting the type…</p>`}
          ${layoutError && html`<div class="stage__error notice notice--error" role="alert"><p class="notice__title">The chart could not be drawn.</p><p>${layoutError}</p></div>`}
          ${scene && !wall && html`<${Preview} scene=${scene} hovered=${hovered} selected=${sel && sel.hit} selectedHow=${sel && sel.how}
            onHover=${setHovered} onSelect=${onSelect} onActivate=${onActivate} onZoom=${setZoom} controls=${controls}
            resetKey=${`${chart}|${opts.size}|${opts.rootId}`}
            label=${`${scene.meta.title}. ${scene.meta.subtitle}. Use the arrow keys to move between people, Enter to edit a person, plus and minus to zoom.`}
            describedBy="register" />`}
          ${scene && wall && html`<${OnTheWall} scene=${scene} label=${chartLabel} dark=${!!st.dark} />`}
        </div>

        ${editPerson && !wall && html`
          <div class="stage__edit">
            <${EditPanel} person=${editPerson} override=${overrides[editing]} chart=${chart}
              isRoot=${chart === 'bowtie' ? !!(coupleIds && coupleIds.includes(editing)) : editing === opts.rootId}
              onSave=${o => saveOverride(editing, o)} onReset=${() => saveOverride(editing, {})}
              onClose=${() => { setEditing(null); }} onMakeRoot=${() => makeRoot(editing)} />
          </div>`}

        <div class="stage__register" hidden=${wall}>
          <div class="register" id="register" aria-live="polite" aria-atomic="true">
            ${reg ? html`
              <p class="register__no nums">${reg.no}</p>
              <p class="register__name">${reg.name}</p>
              <p class="register__facts">${reg.facts}</p>
              <p class="register__rel">${reg.relation}${reg.line && html` <span class="rubric nums">${reg.line}</span>`}${reg.appears && html` ${reg.appears}`}</p>`
              : html`
              <p class="register__no">Who’s who</p>
              ${notice && html`<p class="register__rel register__notice">${notice.text}</p>`}
              <p class=${`register__rel${notice ? ' register__hint' : ''}`}>${coarse
                ? 'Tap anyone on the chart to see who they are. Pinch to zoom.'
                : 'Point at anyone on the chart to see who they are. Click to edit how they appear. With a keyboard, move into the chart and use the arrow keys.'}</p>`}
          </div>
          ${reg && !wall && editing !== reg.id && html`<button type="button" class="btn btn--secondary btn--small" onClick=${() => setEditing(reg.id)}>Edit ${firstName(effTree.people[reg.id]) || 'this person'}</button>`}
        </div>
      </section>

      <${Paywall} open=${!!paywall} onClose=${() => setPaywall(null)} price=${PRICE} checkout=${checkout} unprintable=${unprintable.length}
        freeLabel=${freeLabel} onFree=${() => { setPaywall(null); freePdf(); }} onCheckout=${() => track('Studio: checkout', { chart, style: opts.style, size: opts.size })} />
    </div>`;
}

render(html`<${App} />`, document.getElementById('studio'));
