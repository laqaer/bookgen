// PDF renderer for the Scene IR (PDFKit 0.20.2, vendored as a global).
//
// Matches render-canvas.js item for item:
//   * paths come from path.js (arcs -> cubics, quadratics raised exactly; PDFKit's
//     own parser NaNs on zero-length arcs and its quadraticCurveTo is not quadratic);
//   * text is written as raw text objects with an explicit text matrix: the anchor,
//     rotation and 'middle' baseline use the same fonts.js widths and metrics as the
//     canvas, and glyph positions (kerning) come from the same fontkit layout that
//     measured them. Tracking is PDF character spacing (Tc);
//   * arc glyphs share one text object; their per-glyph text is marked with an
//     ActualText span and the whole string is repeated as invisible text (Tr 3)
//     along the arc's chord, so copy/search/QA extraction read "Dvořák", not
//     "D v o ř á k" on separate lines;
//   * fonts are embedded as Type0/CIDFontType2 subsets from the same patched bytes
//     the canvas uses; group opacity multiplies into children; groups clip.

import { parsePathCached, tracePath, pathBounds } from './path.js';
import { fonts as defaultFonts, ensurePdfKit, textFeatures } from './fonts.js';
import { baselineOffset, graphemes } from './text.js';

const DEG = Math.PI / 180;
const WS = /^\s+$/u;
const painted = c => c && c !== 'none' && c !== 'transparent';

/** Crop mark geometry (points). */
export const CROP_MARK = Object.freeze({ gap: 3, length: 18, margin: 6, width: 0.3 });

function n(v) {
  if (!Number.isFinite(v)) throw new RangeError(`non-finite number in PDF output: ${v}`);
  const r = Math.round(v * 10000) / 10000;
  return Object.is(r, -0) ? '0' : String(r);
}

/** Every font key used by a scene. */
export function sceneFontKeys(scene) {
  const keys = new Set();
  const walk = items => {
    for (const it of items || []) {
      if (it.t === 'text' || it.t === 'glyphs') keys.add(it.font);
      else if (it.t === 'group') walk(it.items);
    }
  };
  walk(scene.items);
  return [...keys];
}

/**
 * Fetch every ImageItem's bytes.
 * @param {object} scene
 * @param {(src: string) => Promise<Uint8Array|ArrayBuffer>} [loadImage]
 * @returns {Promise<Map<string, Uint8Array>>}
 */
export async function loadSceneImages(scene, loadImage) {
  const srcs = new Set();
  const walk = items => { for (const it of items || []) { if (it.t === 'image') srcs.add(it.src); else if (it.t === 'group') walk(it.items); } };
  walk(scene.items);
  const load = loadImage || (async src => {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`image ${src}: HTTP ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  });
  const out = new Map();
  await Promise.all([...srcs].map(async src => {
    try {
      const b = await load(src);
      if (b) out.set(src, b instanceof Uint8Array ? b : new Uint8Array(b));
    } catch { /* reported as missing when drawn */ }
  }));
  return out;
}

/**
 * Resolve when PDFKit finishes; returns the file as one Uint8Array.
 * Attach before calling doc.end().
 */
export function collectPdf(doc) {
  const chunks = [];
  doc.on('data', c => chunks.push(c));
  return new Promise((resolve, reject) => {
    doc.on('error', reject);
    doc.on('end', () => {
      const len = chunks.reduce((s, c) => s + c.length, 0);
      const out = new Uint8Array(len);
      let o = 0;
      for (const c of chunks) { out.set(c, o); o += c.length; }
      resolve(out);
    });
  });
}

/**
 * Writes Scene items into a PDFKit document. Shared by sceneToPdf and tiles.js.
 */
export class SceneWriter {
  /**
   * @param {any} doc PDFKit document
   * @param {{ fonts?: object, images?: Map<string, Uint8Array> }} [opts]
   */
  constructor(doc, opts = {}) {
    this.doc = doc;
    this.fonts = opts.fonts || defaultFonts;
    this.imageBytes = opts.images || new Map();
    this.pdfImages = new Map();
    this.pdfFonts = new Map();
    this.st = { fa: 1, sa: 1, fill: null, stroke: null, lw: null, cap: null, join: null };
    this.stack = [];
    this.stats = { paths: 0, strokes: 0, fills: 0, texts: 0, glyphs: 0, images: 0, missingImages: [], minTextSize: Infinity };
    this.bboxCache = new WeakMap();
  }

  /** Call at the start of every page: graphics state resets per page. */
  beginPage() {
    this.st = { fa: 1, sa: 1, fill: null, stroke: null, lw: null, cap: null, join: null };
    this.stack = [];
  }

  push() { this.doc.save(); this.stack.push({ ...this.st }); }
  pop() { this.doc.restore(); this.st = this.stack.pop(); }

  font(key) {
    const rk = this.fonts.resolveFontKey(key);
    let f = this.pdfFonts.get(rk);
    if (!f) {
      this.doc.registerFont(`gr:${rk}`, this.fonts.fontBytes(rk));
      f = this.doc.font(`gr:${rk}`)._font;
      this.pdfFonts.set(rk, f);
    }
    if (this.doc.page.fonts[f.id] == null) this.doc.page.fonts[f.id] = f.ref();
    return f;
  }

  alpha(fa, sa) {
    if (fa !== this.st.fa) { this.doc.fillOpacity(fa); this.st.fa = fa; }
    if (sa !== this.st.sa) { this.doc.strokeOpacity(sa); this.st.sa = sa; }
  }
  fillColor(c) { if (c !== this.st.fill) { this.doc.fillColor(c); this.st.fill = c; } }
  strokeColor(c) { if (c !== this.st.stroke) { this.doc.strokeColor(c); this.st.stroke = c; } }
  lineStyle(w, cap, join) {
    if (w !== this.st.lw) { this.doc.lineWidth(w); this.st.lw = w; }
    if (cap !== this.st.cap) { this.doc.lineCap(cap); this.st.cap = cap; }
    if (join !== this.st.join) { this.doc.lineJoin(join); this.st.join = join; }
  }

  /** Paint the whole page area (and bleed) with the scene background. */
  background(scene, bleed = 0) {
    if (!painted(scene.bg)) return;
    this.alpha(1, this.st.sa);
    this.fillColor(scene.bg);
    this.doc.rect(-bleed, -bleed, scene.wPt + 2 * bleed, scene.hPt + 2 * bleed).fill();
  }

  /**
   * Draw a list of items.
   * @param {object[]} items
   * @param {number} [alpha=1]
   * @param {{ cull?: {x0:number,y0:number,x1:number,y1:number}, skipText?: boolean }} [opts]
   */
  items(items, alpha = 1, opts = {}) {
    const list = items || [];
    for (let i = 0; i < list.length; i++) {
      const it = list[i];
      if (opts.cull && !this.intersects(it, opts.cull)) continue;
      if (it.t === 'text' && !opts.skipText) {
        const chain = this.textChain(list, i);
        if (chain.length > 1) { this.textChainDraw(chain, alpha); i += chain.length - 1; continue; }
      }
      switch (it.t) {
        case 'path': this.path(it, alpha); break;
        case 'text': if (!opts.skipText) this.text(it, alpha); break;
        case 'glyphs': if (!opts.skipText) this.glyphs(it, alpha); break;
        case 'image': this.image(it, alpha); break;
        case 'group': this.group(it, alpha, opts); break;
        default: throw new Error(`unknown scene item type "${it.t}"`);
      }
    }
  }

  path(it, alpha) {
    const sw = it.sw ?? 1;
    const hasFill = painted(it.fill);
    const hasStroke = painted(it.stroke) && sw > 0;
    const a = alpha * (it.opacity ?? 1);
    if ((!hasFill && !hasStroke) || a <= 0) return;
    const cmds = parsePathCached(it.d);
    if (!cmds.length) return;
    this.alpha(hasFill ? a : this.st.fa, hasStroke ? a : this.st.sa);
    if (hasFill) this.fillColor(it.fill);
    if (hasStroke) {
      this.strokeColor(it.stroke);
      this.lineStyle(sw, it.cap || 'butt', it.join || 'miter');
    }
    tracePath(this.doc, cmds);
    if (hasFill && hasStroke) this.doc.fillAndStroke();
    else if (hasFill) this.doc.fill();
    else this.doc.stroke();
    this.stats.paths++;
    if (hasStroke) this.stats.strokes++;
    if (hasFill) this.stats.fills++;
  }

  /**
   * Write one shaped run as a text object.
   * @param {any} f PDFKit EmbeddedFont
   * @param {number} size
   * @param {string} str
   * @param {number[]} m text matrix [a b c d e f] in user space (y down)
   * @param {{ tracking?: number, mode?: number, hscale?: number }} [o]
   */
  run(f, size, str, m, o = {}) {
    const [enc, pos] = f.encode(str, textFeatures());
    const out = ['BT', `/${f.id} ${n(size)} Tf`];
    if (o.mode) out.push(`${o.mode} Tr`);
    if (o.tracking) out.push(`${n(o.tracking)} Tc`);
    if (o.hscale && o.hscale !== 100) out.push(`${n(o.hscale)} Tz`);
    const k = size / 1000;
    const tm = (u, v) => `${n(m[0])} ${n(m[1])} ${n(m[2])} ${n(m[3])} ${n(m[4] + m[0] * u + m[2] * v)} ${n(m[5] + m[1] * u + m[3] * v)} Tm`;
    out.push(tm(0, 0));
    let seg = [];
    const flush = () => { if (seg.length) { out.push(`[${seg.join(' ')}] TJ`); seg = []; } };
    let pen = 0;
    let reset = false;
    const hs = (o.hscale || 100) / 100;
    for (let i = 0; i < enc.length; i++) {
      const p = pos[i];
      if (p.xOffset || p.yOffset) {
        flush();
        out.push(tm(pen + p.xOffset * k * hs, p.yOffset * k));
        out.push(`<${enc[i]}> Tj`);
        reset = true;
      } else {
        if (reset) { flush(); out.push(tm(pen, 0)); reset = false; }
        seg.push(`<${enc[i]}>`);
        const adj = p.xAdvance - p.advanceWidth;
        if (adj) seg.push(n(-adj));
      }
      pen += (p.xAdvance * k + (o.tracking || 0)) * hs;
    }
    flush();
    // Tc, Tz and Tr are graphics state and outlive ET: put them back
    if (o.mode) out.push('0 Tr');
    if (o.tracking) out.push('0 Tc');
    if (o.hscale && o.hscale !== 100) out.push('100 Tz');
    out.push('ET');
    this.doc.addContent(out.join('\n'));
    return pen;
  }

  /** Baseline start, direction and width of a TextItem (same maths as the canvas). */
  textGeom(it) {
    const { fonts } = this;
    const size = it.size;
    const tracking = it.tracking || 0;
    const width = fonts.measure(it.font, size, it.str) + (tracking ? tracking * (graphemes(it.str).length - 1) : 0);
    const x0 = it.anchor === 'middle' ? -width / 2 : it.anchor === 'end' ? -width : 0;
    const dy = baselineOffset(fonts.metrics(it.font), size, it.baseline);
    const rot = (it.rot || 0) * DEG;
    const c = Math.cos(rot), s = Math.sin(rot);
    return { width, c, s, tracking, m: [c, s, s, -c, it.x + x0 * c - dy * s, it.y + x0 * s + dy * c] };
  }

  text(it, alpha) {
    const a = alpha * (it.opacity ?? 1);
    if (a <= 0 || !it.str) return;
    const f = this.font(it.font);
    const size = it.size;
    const { width, c, s, tracking, m } = this.textGeom(it);
    this.alpha(a, this.st.sa);
    this.fillColor(it.color);
    if (tracking > 0.1 * size) {
      // Wide letter-spacing makes extractors insert spaces ("T H E"): show the
      // tracked glyphs as a marked span and give extraction an untracked,
      // invisible twin centred on the same baseline.
      this.doc.markContent('Span', { actual: ' ' });
      this.run(f, size, it.str, m, { tracking });
      this.doc.endMarkedContent();
      this.twin(f, it.font, size, it.str, m[4] + c * width / 2, m[5] + s * width / 2, c, s);
    } else {
      this.run(f, size, it.str, m, { tracking });
    }
    this.stats.texts++;
    this.stats.minTextSize = Math.min(this.stats.minTextSize, size);
  }

  /**
   * Consecutive TextItems that continue one another on the same baseline
   * (e.g. text.js smallCapsText runs of two sizes). Returns [it] when alone.
   */
  textChain(list, i) {
    const chain = [list[i]];
    if (!list[i].str) return chain;
    let g = this.textGeom(list[i]);
    for (let j = i + 1; j < list.length; j++) {
      const nx = list[j], prev = chain[chain.length - 1];
      if (nx.t !== 'text' || !nx.str) break;
      if (nx.font !== prev.font || nx.color !== prev.color || (nx.rot || 0) !== (prev.rot || 0) ||
          (nx.opacity ?? 1) !== (prev.opacity ?? 1) || (nx.tracking || 0) !== (prev.tracking || 0)) break;
      const ng = this.textGeom(nx);
      const adv = g.width + g.tracking;
      if (Math.hypot(ng.m[4] - (g.m[4] + g.c * adv), ng.m[5] - (g.m[5] + g.s * adv)) > 0.05) break;
      chain.push(nx);
      g = ng;
    }
    return chain;
  }

  textChainDraw(chain, alpha) {
    const first = chain[0];
    const a = alpha * (first.opacity ?? 1);
    if (a <= 0) return;
    const f = this.font(first.font);
    this.alpha(a, this.st.sa);
    this.fillColor(first.color);
    this.doc.markContent('Span', { actual: ' ' });
    let g0 = null, gl = null;
    for (const it of chain) {
      const g = this.textGeom(it);
      g0 ||= g; gl = g;
      this.run(f, it.size, it.str, g.m, { tracking: g.tracking });
      this.stats.texts++;
      this.stats.minTextSize = Math.min(this.stats.minTextSize, it.size);
    }
    this.doc.endMarkedContent();
    const ex = gl.m[4] + gl.c * gl.width, ey = gl.m[5] + gl.s * gl.width;
    const size = Math.max(...chain.map(it => it.size));
    this.twin(f, first.font, size, chain.map(it => it.str).join(''), (g0.m[4] + ex) / 2, (g0.m[5] + ey) / 2, g0.c, g0.s);
  }

  glyphs(it, alpha) {
    const a = alpha * (it.opacity ?? 1);
    if (a <= 0 || !it.g || !it.g.length) return;
    const f = this.font(it.font);
    const size = it.size;
    this.alpha(a, this.st.sa);
    this.fillColor(it.color);
    const drawn = it.g.filter(g => g.ch && !WS.test(g.ch));
    if (!drawn.length) return;
    // visible glyphs: extraction reads them as a single space (the string follows as invisible text)
    this.doc.markContent('Span', { actual: ' ' });
    for (const g of drawn) {
      const r = (g.rot || 0) * DEG;
      const c = Math.cos(r), s = Math.sin(r);
      this.run(f, size, g.ch, [c, s, s, -c, g.x, g.y]);
      this.stats.glyphs++;
    }
    this.doc.endMarkedContent();
    // invisible copy of the whole string, centred on the middle glyph and
    // running along the chord from the first glyph to the end of the last
    const str = it.g.map(g => g.ch).join('').trim();
    if (str) {
      const first = drawn[0], last = drawn[drawn.length - 1], mid = drawn[Math.floor((drawn.length - 1) / 2)];
      const end = g => {
        const r = (g.rot || 0) * DEG, w = this.fonts.measure(it.font, size, g.ch);
        return [g.x + Math.cos(r) * w, g.y + Math.sin(r) * w, r, w];
      };
      const [ex, ey] = end(last);
      let dx = ex - first.x, dy = ey - first.y;
      let len = Math.hypot(dx, dy);
      if (len < 1e-3) { const r = (first.rot || 0) * DEG; dx = Math.cos(r); dy = Math.sin(r); len = 1; }
      const [, , mr, mw] = end(mid);
      const odd = drawn.length % 2 === 1;
      const mx = odd ? mid.x + Math.cos(mr) * mw / 2 : mid.x + Math.cos(mr) * mw;
      const my = odd ? mid.y + Math.sin(mr) * mw / 2 : mid.y + Math.sin(mr) * mw;
      this.twin(f, it.font, size, str, mx, my, dx / len, dy / len);
    }
    this.stats.texts++;
    this.stats.minTextSize = Math.min(this.stats.minTextSize, size);
  }

  /**
   * Invisible (Tr 3) copy of a string for text extraction, centred on (cx, cy)
   * with its baseline along the unit direction (c, s).
   */
  twin(f, key, size, str, cx, cy, c, s) {
    const w = this.fonts.measure(key, size, str);
    this.run(f, size, str, [c, s, s, -c, cx - c * w / 2, cy - s * w / 2], { mode: 3 });
  }

  image(it, alpha) {
    const a = alpha * (it.opacity ?? 1);
    if (a <= 0) return;
    let img = this.pdfImages.get(it.src);
    if (!img) {
      const bytes = this.imageBytes.get(it.src);
      if (!bytes) { this.stats.missingImages.push(it.src); return; }
      img = this.doc.openImage(bytes);
      this.pdfImages.set(it.src, img);
    }
    this.push();
    this.alpha(a, a);
    this.doc.image(img, it.x, it.y, { width: it.w, height: it.h });
    this.pop();
    this.stats.images++;
  }

  group(it, alpha, opts) {
    const a = alpha * (it.opacity ?? 1);
    if (a <= 0) return;
    this.push();
    if (it.clip) {
      tracePath(this.doc, parsePathCached(it.clip));
      this.doc.clip();
    }
    this.items(it.items, a, opts);
    this.pop();
  }

  /** Conservative bounding box of an item (points). */
  bbox(it) {
    let b = this.bboxCache.get(it);
    if (b) return b;
    switch (it.t) {
      case 'path': {
        const pb = pathBounds(parsePathCached(it.d));
        const pad = painted(it.stroke) ? (it.sw ?? 1) * 5 : 0;
        b = pb ? { x0: pb.x0 - pad, y0: pb.y0 - pad, x1: pb.x1 + pad, y1: pb.y1 + pad } : { x0: 0, y0: 0, x1: -1, y1: -1 };
        break;
      }
      case 'text': {
        const r = this.fonts.measure(it.font, it.size, it.str) + (it.tracking || 0) * it.str.length + it.size * 1.5;
        b = { x0: it.x - r, y0: it.y - r, x1: it.x + r, y1: it.y + r };
        break;
      }
      case 'glyphs': {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const g of it.g) { x0 = Math.min(x0, g.x); y0 = Math.min(y0, g.y); x1 = Math.max(x1, g.x); y1 = Math.max(y1, g.y); }
        const pad = it.size * 2;
        b = { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
        break;
      }
      case 'image': b = { x0: it.x, y0: it.y, x1: it.x + it.w, y1: it.y + it.h }; break;
      case 'group': {
        if (it.clip) b = pathBounds(parsePathCached(it.clip));
        else {
          b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
          for (const c of it.items || []) {
            const cb = this.bbox(c);
            b = { x0: Math.min(b.x0, cb.x0), y0: Math.min(b.y0, cb.y0), x1: Math.max(b.x1, cb.x1), y1: Math.max(b.y1, cb.y1) };
          }
        }
        break;
      }
      default: b = { x0: -Infinity, y0: -Infinity, x1: Infinity, y1: Infinity };
    }
    this.bboxCache.set(it, b);
    return b;
  }

  intersects(it, r) {
    const b = this.bbox(it);
    return b.x1 >= r.x0 && b.x0 <= r.x1 && b.y1 >= r.y0 && b.y0 <= r.y1;
  }
}

/** Draw printer's crop marks around a trim box (user space, y down). */
export function drawCropMarks(doc, x, y, w, h, bleed = 0) {
  const off = bleed + CROP_MARK.gap, len = CROP_MARK.length;
  doc.save();
  doc.lineWidth(CROP_MARK.width).strokeColor('#000000').strokeOpacity(1);
  for (const [cx, sx] of [[x, -1], [x + w, 1]]) {
    for (const [cy, sy] of [[y, -1], [y + h, 1]]) {
      doc.moveTo(cx + sx * off, cy).lineTo(cx + sx * (off + len), cy);
      doc.moveTo(cx, cy + sy * off).lineTo(cx, cy + sy * (off + len));
    }
  }
  doc.stroke();
  doc.restore();
}

/**
 * Render a Scene to a vector PDF.
 * @param {object} scene
 * @param {{ bleedPt?: number, cropMarks?: boolean, fonts?: object, PDFDocument?: any,
 *           loadImage?: (src: string) => Promise<Uint8Array>, compress?: boolean,
 *           info?: Record<string,string> }} [opts]
 * @returns {Promise<Uint8Array>}
 */
export async function sceneToPdf(scene, opts = {}) {
  const fonts = opts.fonts || defaultFonts;
  const PDFDocument = opts.PDFDocument || await ensurePdfKit();
  await fonts.loadFonts(sceneFontKeys(scene));
  const images = await loadSceneImages(scene, opts.loadImage);
  const bleed = Math.max(0, opts.bleedPt || 0);
  const marks = !!opts.cropMarks;
  const slug = marks ? bleed + CROP_MARK.gap + CROP_MARK.length + CROP_MARK.margin : bleed;
  const W = scene.wPt + 2 * slug, H = scene.hPt + 2 * slug;
  const meta = scene.meta || {};
  const doc = new PDFDocument({
    size: [W, H], margin: 0, autoFirstPage: false, font: null, compress: opts.compress ?? true,
    pdfVersion: '1.7', displayTitle: true, lang: 'en',
    info: {
      Title: meta.title || 'Family tree chart',
      Subject: meta.subtitle || '',
      Creator: 'Gildroot (gildroot.com)',
      ...(opts.info || {}),
    },
  });
  const done = collectPdf(doc);
  doc.addPage({ size: [W, H], margin: 0 });
  const pageDict = doc.page.dictionary.data;
  pageDict.TrimBox = [slug, slug, slug + scene.wPt, slug + scene.hPt];
  pageDict.BleedBox = [slug - bleed, slug - bleed, slug + scene.wPt + bleed, slug + scene.hPt + bleed];
  const w = new SceneWriter(doc, { fonts, images });
  w.beginPage();
  w.push();
  if (slug) doc.translate(slug, slug);
  w.background(scene, bleed);
  w.items(scene.items, 1);
  w.pop();
  if (marks) drawCropMarks(doc, slug, slug, scene.wPt, scene.hPt, bleed);
  doc.end();
  const bytes = await done;
  sceneToPdf.lastStats = w.stats;
  return bytes;
}
