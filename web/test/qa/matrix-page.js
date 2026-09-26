// Browser side of the chart QA matrix (web/test/qa/matrix.mjs drives it with Playwright).
//
// Loads the real product modules exactly as the studio does (served from web/src, see
// serve.mjs), parses corpus files with the engine, runs charts/layout.js, validates the
// Scene IR, and renders the PDF (and optionally a canvas PNG for the raster diff).
// Everything is exposed on window.__qa; nothing here talks to the network except the
// local server.

import { loadFonts, fonts, FONT_KEYS, ensurePdfKit } from '/app/charts/fonts.js';
import { setTextBackend, FLOOR_TEXT_PT } from '/app/charts/text.js';
import { drawScene, preloadImages } from '/app/charts/render-canvas.js';
import { sceneToPdf } from '/app/charts/render-pdf.js';
import { sceneToTiles, planTiles } from '/app/charts/tiles.js';
import { sceneToJpeg, shareImage } from '/app/charts/raster.js';
import { parsePath } from '/app/charts/path.js';
import { BLEED_PT, MIN_STROKE_PT } from '/app/charts/sizes.js';
import { handleParse } from '/app/engine/worker.js';
import { suggestRoot, parentsOf, ancestors } from '/app/engine/tree.js';
import { nameLadder } from '/app/engine/names.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const ANCHORS = new Set(['start', 'middle', 'end']);
const BASELINES = new Set(['alphabetic', 'middle']);
const CAPS = new Set(['butt', 'round']);
const JOINS = new Set(['miter', 'round']);
const MAX_ERRORS = 40;

const state = { layoutMod: null, layout: null, trees: new Map(), fontsReady: false };
const log = (...a) => { document.getElementById('log').textContent += a.join(' ') + '\n'; };
const status = s => { document.getElementById('status').textContent = s; };
const now = () => performance.now();
const ms = t => Math.round((now() - t) * 10) / 10;

function b64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}
const nfc = s => String(s ?? '').normalize('NFC');
const collapse = s => nfc(s).split(/\s+/u).filter(Boolean).join(' ');
const errMsg = e => String((e && (e.stack || e.message)) || e).split('\n').slice(0, 6).join('\n');

async function ensureFonts() {
  if (state.fontsReady) return;
  await loadFonts(FONT_KEYS);
  await ensurePdfKit();
  setTextBackend(fonts);
  state.fontsReady = true;
}

/**
 * Import the layout module (if it exists) and load fonts + PDFKit.
 * @param {{ layoutUrl?: string }} opts
 */
async function init(opts = {}) {
  const t0 = now();
  const out = { ok: true, layout: false, layoutExports: [], charts: null, styles: null, colorModes: null, fontKeys: [...FONT_KEYS] };
  try {
    await ensureFonts();
  } catch (e) {
    return { ok: false, error: `fonts/PDFKit failed to load: ${errMsg(e)}` };
  }
  const url = opts.layoutUrl || '/app/charts/layout.js';
  try {
    const mod = await import(url);
    state.layoutMod = mod;
    state.layout = mod.layout || mod.default?.layout || (typeof mod.default === 'function' ? mod.default : null);
    out.layoutExports = Object.keys(mod);
    out.layout = typeof state.layout === 'function';
    if (!out.layout) out.layoutError = `${url} does not export layout()`;
    const list = v => (Array.isArray(v) ? [...v] : v && typeof v === 'object' ? Object.keys(v) : null);
    // optional chart engines load lazily (layout.js loadChartEngines); ask which are really there
    if (typeof mod.loadChartEngines === 'function') {
      try { out.loadedEngines = await mod.loadChartEngines(); } catch (e) { out.engineLoadError = errMsg(e); }
    }
    out.charts = list(mod.CHARTS || mod.CHART_TYPES);
    if (typeof mod.hasChart === 'function') {
      out.charts = ['fan', 'bowtie', 'pedigree'].filter(c => { try { return !!mod.hasChart(c); } catch { return false; } });
      out.chartsAuthoritative = true;
    }
    out.styles = list(mod.STYLES);
    out.colorModes = list(mod.COLOR_MODES);
  } catch (e) {
    out.layout = false;
    out.layoutError = `could not import ${url}: ${errMsg(e)}`;
  }
  out.ms = ms(t0);
  status(out.layout ? 'Ready' : 'Ready (no layout)');
  return out;
}

/** Fetch and parse one corpus file (cached by key). */
async function loadTree(key, url, name) {
  if (state.trees.has(key)) return summary(key, state.trees.get(key));
  const t0 = now();
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buffer = await res.arrayBuffer();
    const { tree } = handleParse({ buffer, name: name || url.split('/').pop() });
    state.trees.set(key, tree);
    return { ...summary(key, tree), parseMs: ms(t0) };
  } catch (e) {
    return { ok: false, key, error: errMsg(e) };
  }
}

function summary(key, tree) {
  return {
    ok: true, key,
    count: Object.keys(tree.people).length,
    families: Object.keys(tree.families).length,
    suggestedRoot: suggestRoot(tree),
    warnings: (tree.meta.warnings || []).slice(0, 10),
    charset: tree.meta.charset,
  };
}

/** Couple for the bowtie: the root and their first partner, else the root's parents. */
function coupleFor(tree, rootId) {
  const p = tree.people[rootId];
  for (const fid of p?.fams || []) {
    const fam = tree.families[fid];
    const other = fam?.partners?.find(x => x !== rootId && tree.people[x]);
    if (other) return [rootId, other];
  }
  const { father, mother } = parentsOf(tree, rootId);
  if (father && mother) return [father, mother];
  return null;
}

// ---------------------------------------------------------------------------
// Scene IR validation (docs/ARCHITECTURE.md "Scene IR (frozen)")

function validateScene(scene, job, tree) {
  const errors = [];
  let errorCount = 0;
  const err = m => { errorCount++; if (errors.length < MAX_ERRORS) errors.push(m); };
  const fin = v => typeof v === 'number' && Number.isFinite(v);
  const stats = { items: 0, paths: 0, texts: 0, glyphRuns: 0, glyphs: 0, images: 0, groups: 0, strokes: 0, minText: Infinity, minStroke: Infinity, thinStrokes: 0, offPage: 0, missingGlyphs: [] };
  if (!scene || typeof scene !== 'object') { err('layout() returned no scene'); return { errors, errorCount, stats }; }
  if (!(fin(scene.wPt) && scene.wPt > 0 && fin(scene.hPt) && scene.hPt > 0)) err(`bad page size ${scene.wPt}x${scene.hPt}`);
  if (!HEX.test(scene.bg || '')) err(`scene.bg "${scene.bg}" is not #rrggbb`);
  if (!Array.isArray(scene.items)) err('scene.items is not an array');
  if (!Array.isArray(scene.hits)) err('scene.hits is not an array');
  const W = scene.wPt, H = scene.hPt, tol = 1;
  const onPage = (x, y) => x >= -tol && x <= W + tol && y >= -tol && y <= H + tol;
  const color = (c, where) => { if (c != null && c !== 'none' && !HEX.test(c)) err(`${where}: colour "${c}" is not #rrggbb`); };
  const opacity = (o, where) => { if (o != null && !(fin(o) && o >= 0 && o <= 1)) err(`${where}: opacity ${o}`); };
  const glyphCheck = (font, str, where) => {
    if (!FONT_KEYS.includes(font)) { err(`${where}: unknown font "${font}"`); return; }
    const h = fonts.hasGlyphs(font, str);
    if (!h.ok) {
      err(`${where}: font ${font} has no glyph for ${h.missing.map(c => JSON.stringify(c)).join(' ')} in "${str.slice(0, 40)}"`);
      if (stats.missingGlyphs.length < 10) stats.missingGlyphs.push({ font, str: str.slice(0, 60), missing: h.missing });
    }
  };
  const walk = (items, path, alpha) => {
    if (!Array.isArray(items)) { err(`${path}: items is not an array`); return; }
    items.forEach((it, i) => {
      const where = `${path}[${i}]`;
      stats.items++;
      if (!it || typeof it !== 'object') { err(`${where}: not an object`); return; }
      opacity(it.opacity, where);
      const a = alpha * (it.opacity ?? 1);
      switch (it.t) {
        case 'path': {
          stats.paths++;
          if (typeof it.d !== 'string' || !it.d.trim()) { err(`${where}: empty path`); break; }
          if (/[^MLHVCQAZmlhvcqaz0-9eE.,+\-\s]/.test(it.d)) err(`${where}: path uses commands outside M L H V C Q A Z`);
          try { parsePath(it.d); } catch (e) { err(`${where}: path does not parse (${e.message})`); }
          color(it.fill, `${where}.fill`);
          color(it.stroke, `${where}.stroke`);
          if (it.stroke && it.stroke !== 'none') {
            stats.strokes++;
            if (!fin(it.sw) || it.sw <= 0) err(`${where}: stroked path with sw=${it.sw}`);
            else {
              stats.minStroke = Math.min(stats.minStroke, it.sw);
              if (it.sw < MIN_STROKE_PT - 1e-6 && a > 0) { stats.thinStrokes++; err(`${where}: stroke ${it.sw} pt is below the ${MIN_STROKE_PT} pt minimum`); }
            }
          }
          if (it.cap != null && !CAPS.has(it.cap)) err(`${where}: cap "${it.cap}"`);
          if (it.join != null && !JOINS.has(it.join)) err(`${where}: join "${it.join}"`);
          break;
        }
        case 'text': {
          stats.texts++;
          if (!(fin(it.x) && fin(it.y))) err(`${where}: non-finite position`);
          if (it.rot != null && !fin(it.rot)) err(`${where}: rot ${it.rot}`);
          if (typeof it.str !== 'string' || !it.str.length) { err(`${where}: empty text`); break; }
          if (!fin(it.size) || it.size <= 0) err(`${where}: size ${it.size}`);
          else if (a > 0) {
            stats.minText = Math.min(stats.minText, it.size);
            if (it.size < FLOOR_TEXT_PT - 1e-6) err(`${where}: "${it.str.slice(0, 30)}" at ${it.size} pt is below the ${FLOOR_TEXT_PT} pt floor`);
          }
          color(it.color, `${where}.color`);
          if (!HEX.test(it.color || '')) err(`${where}: text colour missing`);
          if (it.tracking != null && !fin(it.tracking)) err(`${where}: tracking ${it.tracking}`);
          if (it.anchor != null && !ANCHORS.has(it.anchor)) err(`${where}: anchor "${it.anchor}"`);
          if (it.baseline != null && !BASELINES.has(it.baseline)) err(`${where}: baseline "${it.baseline}"`);
          if (fin(it.x) && fin(it.y) && !onPage(it.x, it.y)) { stats.offPage++; err(`${where}: "${it.str.slice(0, 30)}" anchored off the page at (${it.x.toFixed(1)}, ${it.y.toFixed(1)})`); }
          glyphCheck(it.font, it.str, where);
          break;
        }
        case 'glyphs': {
          stats.glyphRuns++;
          if (!Array.isArray(it.g) || !it.g.length) { err(`${where}: no glyphs`); break; }
          if (!fin(it.size) || it.size <= 0) err(`${where}: size ${it.size}`);
          else if (a > 0) {
            stats.minText = Math.min(stats.minText, it.size);
            if (it.size < FLOOR_TEXT_PT - 1e-6) err(`${where}: arc text at ${it.size} pt is below the ${FLOOR_TEXT_PT} pt floor`);
          }
          if (!HEX.test(it.color || '')) err(`${where}: colour "${it.color}" is not #rrggbb`);
          let bad = 0, off = 0;
          for (const g of it.g) {
            stats.glyphs++;
            if (!g || typeof g.ch !== 'string' || !(fin(g.x) && fin(g.y) && fin(g.rot))) bad++;
            else if (!onPage(g.x, g.y)) off++;
          }
          if (bad) err(`${where}: ${bad} malformed glyph(s)`);
          if (off) { stats.offPage++; err(`${where}: ${off} glyph(s) off the page`); }
          glyphCheck(it.font, it.g.map(g => g?.ch ?? '').join(''), where);
          break;
        }
        case 'image':
          stats.images++;
          if (!(fin(it.x) && fin(it.y) && fin(it.w) && fin(it.h) && it.w > 0 && it.h > 0)) err(`${where}: bad image box`);
          if (typeof it.src !== 'string' || !it.src) err(`${where}: image without src`);
          break;
        case 'group':
          stats.groups++;
          if (it.clip != null) {
            if (typeof it.clip !== 'string') err(`${where}: clip is not a path string`);
            else { try { parsePath(it.clip); } catch (e) { err(`${where}: clip does not parse (${e.message})`); } }
          }
          walk(it.items, `${where}.items`, a);
          break;
        default:
          err(`${where}: unknown item type "${it.t}"`);
      }
    });
  };
  walk(scene.items, 'items', 1);

  const hitIds = new Set();
  (scene.hits || []).forEach((h, i) => {
    const where = `hits[${i}]`;
    if (!h || typeof h.personId !== 'string') { err(`${where}: no personId`); return; }
    hitIds.add(h.personId);
    if (!tree.people[h.personId]) err(`${where}: personId "${h.personId}" is not in the tree`);
    if (h.side != null && h.side !== 'a' && h.side !== 'b') err(`${where}: side "${h.side}"`);
    if (h.shape === 'sector') {
      if (![h.cx, h.cy, h.r0, h.r1, h.a0, h.a1].every(fin)) err(`${where}: non-finite sector`);
      else if (!(h.r1 > h.r0 && h.r0 >= 0 && h.a1 > h.a0)) err(`${where}: sector needs r0 < r1 and a0 < a1 (${h.r0}, ${h.r1}, ${h.a0}, ${h.a1})`);
    } else if (h.shape === 'rect') {
      if (![h.x, h.y, h.w, h.h].every(fin) || h.w <= 0 || h.h <= 0) err(`${where}: bad rect`);
    } else err(`${where}: shape "${h.shape}"`);
  });

  const m = scene.meta;
  if (!m || typeof m !== 'object') err('scene.meta missing');
  else {
    if (m.chart !== job.chart) err(`meta.chart "${m.chart}" != requested "${job.chart}"`);
    if (m.style !== job.style) err(`meta.style "${m.style}" != requested "${job.style}"`);
    if (m.colorMode !== job.colorMode) err(`meta.colorMode "${m.colorMode}" != requested "${job.colorMode}"`);
    if (!fin(m.generations)) err('meta.generations missing');
    else if (job.generations && m.generations > job.generations) err(`meta.generations ${m.generations} > requested ${job.generations}`);
    const c = m.counts;
    if (!c || !['slots', 'placed', 'abbreviated', 'missing'].every(k => fin(c[k]))) err('meta.counts needs slots, placed, abbreviated, missing');
    if (!Array.isArray(m.warnings)) err('meta.warnings is not an array');
    if (!Array.isArray(m.fonts)) err('meta.fonts is not an array');
    if (typeof m.title !== 'string') err('meta.title is not a string');
    if (typeof m.subtitle !== 'string') err('meta.subtitle is not a string');
    if (job.colorMode === 'atlas' && !Array.isArray(m.legend)) err('Atlas colour mode without meta.legend');
    if (Array.isArray(m.legend)) m.legend.forEach((l, i) => { if (!l || typeof l.label !== 'string' || !HEX.test(l.color || '') || !fin(l.count)) err(`meta.legend[${i}] malformed`); });
  }
  // the root (or the couple) must be on the chart
  const must = job.chart === 'bowtie' ? (job.coupleIds || []) : [job.rootId];
  for (const id of must) if (id && !hitIds.has(id)) err(`${id} (${tree.people[id]?.name || '?'}) is not on the chart (no hit region)`);
  stats.hitPeople = hitIds.size;
  if (stats.minText === Infinity) stats.minText = null;
  if (stats.minStroke === Infinity) stats.minStroke = null;
  return { errors, errorCount, stats, hitIds };
}

/** Every text run in the scene, NFC, whitespace collapsed, visible or not (opacity 0 excluded). */
function sceneTexts(items, out = [], alpha = 1) {
  for (const it of items || []) {
    const a = alpha * (it.opacity ?? 1);
    if (a <= 0) continue;
    if (it.t === 'text') out.push(collapse(it.str));
    else if (it.t === 'glyphs') out.push(collapse((it.g || []).map(g => g.ch).join('')));
    else if (it.t === 'group') sceneTexts(it.items, out, a);
  }
  return out;
}

/** People placed on the chart whose names the name font cannot draw (BRIEF §4.3 glyph preflight). */
function preflight(tree, ids) {
  const out = [];
  for (const id of ids) {
    const p = tree.people[id];
    if (!p) continue;
    const h = fonts.hasGlyphs('ebg-400', `${p.name || ''}`);
    if (!h.ok) out.push({ id, name: p.name, missing: h.missing, romanized: p.romanized || null });
  }
  return out;
}

/** Given/surname for an override name typed as "Given Names Surname". */
function splitGiven(name) {
  const words = collapse(name).split(' ');
  return words.length > 1 ? { given: words.slice(0, -1).join(' '), surname: words[words.length - 1] } : { given: words[0] || '', surname: '' };
}

/** Placed people with no trace of their name in the scene text (warning only). */
function unnamed(tree, ids, texts, privacy, overrides = {}) {
  const hay = ' ' + texts.join(' ') + ' ';
  const out = [];
  for (const id of ids) {
    const p = tree.people[id];
    const o = overrides[id] || {};
    if (!p || p.hidden || p.unknown || o.hidden || o.unknown) continue;
    if (privacy === 'living-only' && p.living) continue;
    const ladder = (o.name ? nameLadder({ ...p, name: o.name, ...splitGiven(o.name) }) : nameLadder(p)).map(collapse);
    if (!ladder.length) continue;
    if (!ladder.some(s => hay.includes(s))) out.push({ id, name: p.name });
  }
  return out;
}

async function runLayout(job, tree, overrides) {
  const opts = {
    tree,
    chart: job.chart,
    rootId: job.rootId,
    coupleIds: job.coupleIds,
    generations: job.generations,
    size: job.size,
    orientation: job.orientation || 'auto',
    style: job.style,
    colorMode: job.colorMode,
    privacy: job.privacy || 'hide-dates',
    title: job.title ?? '', subtitle: job.subtitle ?? '', dedication: job.dedication ?? '',
    showPlaces: !!job.showPlaces, trimEmpty: !!job.trimEmpty, bleed: job.output === 'bleed', colophon: !!job.colophon,
    overrides: overrides || {},
    placeOverrides: {},
    measure: fonts.measure, metrics: fonts.metrics, hasGlyphs: fonts.hasGlyphs,
  };
  if (job.sweep) opts.sweep = job.sweep;
  if (job.qaDefect) opts.qaDefect = job.qaDefect; // stub-layout.js self-test only
  if (job.chart !== 'bowtie') delete opts.coupleIds;
  return await state.layout(opts);
}

/**
 * Lay out, validate and render one matrix cell.
 * @param {object} job see matrix.mjs
 */
async function render(job) {
  const out = { ok: false, id: job.id, timings: {} };
  try {
    if (!state.layout) throw new Error('layout() is not loaded');
    const tree = state.trees.get(job.tree);
    if (!tree) throw new Error(`tree "${job.tree}" is not loaded`);
    job.rootId = job.rootId || suggestRoot(tree);
    if (job.chart === 'bowtie' && !job.coupleIds) job.coupleIds = coupleFor(tree, job.rootId);
    if (job.chart === 'bowtie' && !job.coupleIds) { out.skipped = `no couple for ${job.rootId} (no partner and no two parents)`; out.ok = true; return out; }
    out.rootId = job.rootId;
    out.coupleIds = job.coupleIds || null;
    if (job.hideAhnen) {
      // edit panel "hide this person": the override must take them (and their line) off the chart
      const id = ancestors(tree, job.chart === 'bowtie' ? job.coupleIds[0] : job.rootId, 3).get(job.hideAhnen);
      if (id) { job.overrides = { ...(job.overrides || {}), [id]: { hidden: true } }; out.hiddenId = id; }
    }

    let t = now();
    let overridesUsed = job.overrides || {};
    let scene = await runLayout(job, tree, overridesUsed);
    out.timings.layoutMs = ms(t);

    // glyph preflight: people whose names cannot be drawn; answer it like a user would
    const placed = new Set((scene?.hits || []).map(h => h.personId));
    const pre = preflight(tree, placed);
    out.preflight = { triggered: pre.map(p => ({ id: p.id, name: p.name, missing: p.missing })), fixed: false, warnings: (scene?.meta?.warnings || []).slice(0, 10) };
    if (pre.length && job.preflightFix !== false) {
      const overrides = { ...(job.overrides || {}) };
      for (const p of pre) overrides[p.id] = { ...(overrides[p.id] || {}), ...(p.romanized ? { name: p.romanized } : { hidden: true }) };
      t = now();
      scene = await runLayout(job, tree, overrides);
      overridesUsed = overrides;
      out.timings.relayoutMs = ms(t);
      out.preflight.fixed = true;
      out.preflight.overrides = overrides;
    }

    const v = validateScene(scene, job, tree);
    if (out.hiddenId && v.hitIds?.has(out.hiddenId)) { v.errorCount++; v.errors.push(`hidden person ${out.hiddenId} (${tree.people[out.hiddenId]?.name}) is still on the chart`); }
    out.irErrors = v.errors;
    out.irErrorCount = v.errorCount;
    out.stats = v.stats;
    if (!scene || !Array.isArray(scene.items)) return out;
    out.wPt = scene.wPt; out.hPt = scene.hPt;
    out.meta = scene.meta ? { ...scene.meta, legend: scene.meta.legend?.slice(0, 12) } : null;
    const texts = [...new Set(sceneTexts(scene.items).filter(Boolean))];
    out.texts = texts;
    out.unnamed = unnamed(tree, v.hitIds || [], texts, job.privacy, overridesUsed);

    // PDF
    t = now();
    let pdf;
    if (job.output === 'tiles') {
      pdf = await sceneToTiles(scene, { sheet: job.sheet || 'letter', overlapIn: 0.25 });
      const plan = planTiles(scene.wPt, scene.hPt, { sheet: job.sheet || 'letter' });
      out.tilePlan = { cols: plan.cols, rows: plan.rows, tiles: plan.tiles.length, sheetW: plan.sheetW, sheetH: plan.sheetH };
    } else if (job.output === 'bleed') {
      pdf = await sceneToPdf(scene, { bleedPt: BLEED_PT, cropMarks: true });
      out.bleedPt = BLEED_PT;
    } else {
      pdf = await sceneToPdf(scene);
    }
    out.timings.pdfMs = ms(t);
    out.pdfBytes = pdf.length;
    out.pdfB64 = b64(pdf);

    // canvas raster for the screen-vs-paper diff
    if (job.diffScale > 0 && (!job.output || job.output === 'plain')) {
      const failed = await preloadImages(scene);
      if (failed.length) out.missingImages = failed;
      const c = document.getElementById('preview');
      c.width = Math.round(scene.wPt * job.diffScale);
      c.height = Math.round(scene.hPt * job.diffScale);
      const ctx = c.getContext('2d');
      t = now();
      drawScene(ctx, scene, { scale: job.diffScale, dpr: 1 });
      ctx.getImageData(0, 0, 1, 1);
      out.timings.canvasMs = ms(t);
      out.pngB64 = c.toDataURL('image/png').split(',')[1];
    }

    // BRIEF §4.6 budget: re-render on an option change (layout + preview canvas) < 150 ms
    if (job.bench) out.bench = await bench(job, tree, scene);
    out.ok = true;
  } catch (e) {
    out.error = errMsg(e);
  }
  return out;
}

/** Warm layout + preview redraw timings (median of 5), like the studio on an option change. */
async function bench(job, tree, scene) {
  const c = document.createElement('canvas');
  const scale = 1000 / Math.max(scene.wPt, scene.hPt);
  c.width = Math.round(scene.wPt * scale * 2);
  c.height = Math.round(scene.hPt * scale * 2);
  const ctx = c.getContext('2d');
  await preloadImages(scene);
  drawScene(ctx, scene, { scale, dpr: 2 }); // warm-up
  const layoutRuns = [], canvasRuns = [], totalRuns = [];
  for (let i = 0; i < 5; i++) {
    const t0 = now();
    const s = await runLayout(job, tree, job.overrides);
    const t1 = now();
    drawScene(ctx, s, { scale, dpr: 2 });
    ctx.getImageData(0, 0, 1, 1); // force rasterisation so the timing is honest
    const t2 = now();
    layoutRuns.push(t1 - t0); canvasRuns.push(t2 - t1); totalRuns.push(t2 - t0);
  }
  const med = a => Math.round([...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] * 10) / 10;
  const t = now();
  const pdf = await sceneToPdf(scene);
  return { layoutMs: med(layoutRuns), canvasMs: med(canvasRuns), rerenderMs: med(totalRuns), pdfMs: ms(t), pdfBytes: pdf.length, items: scene.items.length, canvasPx: [c.width, c.height] };
}

/**
 * A short end-to-end session for the privacy test: parse in the real worker, lay out,
 * draw, and make every export. Returns what happened; the network log lives in Node.
 */
async function session({ sample = '/samples/almeida-novak.ged' } = {}) {
  const out = { steps: [] };
  const step = (name, ok, detail) => out.steps.push({ name, ok, detail });
  try {
    await ensureFonts();
    const buffer = await (await fetch(sample)).arrayBuffer();
    const tree = await new Promise((resolve, reject) => {
      const w = new Worker('/app/engine/worker.js', { type: 'module' });
      w.onmessage = e => { w.terminate(); e.data.type === 'tree' ? resolve(e.data.tree) : reject(new Error(e.data.message)); };
      w.onerror = e => { w.terminate(); reject(new Error(e.message || 'worker error')); };
      w.postMessage({ type: 'parse', buffer, name: sample.split('/').pop() }, [buffer]);
    });
    step('worker parse', true, `${Object.keys(tree.people).length} people`);
    if (!state.layout) {
      try { await init({}); } catch { /* reported below */ }
    }
    if (state.layout) {
      const scene = await state.layout({
        tree, chart: 'fan', rootId: suggestRoot(tree), generations: 5, size: 'letter', orientation: 'auto',
        style: 'ivory', colorMode: 'atlas', privacy: 'hide-dates', title: '', subtitle: '', dedication: '',
        showPlaces: true, trimEmpty: false, bleed: false, colophon: true, overrides: {}, placeOverrides: {},
        measure: fonts.measure, metrics: fonts.metrics, hasGlyphs: fonts.hasGlyphs,
      });
      await preloadImages(scene);
      const c = document.getElementById('preview');
      c.width = Math.round(scene.wPt); c.height = Math.round(scene.hPt);
      drawScene(c.getContext('2d'), scene, { scale: 1, dpr: 1 });
      step('layout + canvas', true, `${scene.items.length} items`);
      const pdf = await sceneToPdf(scene, { bleedPt: BLEED_PT, cropMarks: true });
      step('pdf', pdf.length > 1000, `${pdf.length} bytes`);
      const tiles = await sceneToTiles(scene, { sheet: 'a4', overlapIn: 0.25 });
      step('tiles', tiles.length > 1000, `${tiles.length} bytes`);
      const jpg = await sceneToJpeg(scene, { dpi: 72 });
      step('jpeg', jpg.blob.size > 1000, `${jpg.width}x${jpg.height}`);
      const share = await shareImage(scene, { mark: true });
      step('share image', share.size > 1000, `${share.size} bytes`);
    } else {
      step('layout', true, 'skipped: no charts/layout.js');
    }
    out.ok = out.steps.every(s => s.ok);
  } catch (e) {
    out.ok = false;
    out.error = errMsg(e);
  }
  out.done = true;
  return out;
}

window.__qa = { init, loadTree, render, session };
window.__qaReady = true;
status('Harness loaded');
log('window.__qa ready: init, loadTree, render, session');
if (new URLSearchParams(location.search).has('session')) {
  session().then(r => { window.__qaSession = r; status(r.ok ? 'Session done' : 'Session failed'); log(JSON.stringify(r, null, 2)); });
}
