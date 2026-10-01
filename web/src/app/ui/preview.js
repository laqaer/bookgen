// The studio preview: the Scene drawn on a canvas, fitted to its box, with zoom
// (buttons, wheel, pinch), pan (drag), hover and tap to point at a person, and
// keyboard movement between people. A second canvas on top carries the
// highlighted line back to the center, so hovering never redraws the chart.

import { html, useEffect, useRef } from '../../vendor/preact-htm.module.js';
import { drawScene, hitTest, fitToBox, preloadImages } from '../charts/render-canvas.js';
import { sectorPath, rectPath } from '../charts/path.js';
import { lineKeys, lineKey, hitCenter, nextHit } from './describe.js';

const PAD = 28; // CSS px around the paper at "fit"
const MAX_SCALE = 5; // CSS px per point at most (6 pt text reads at 30 px)
const MIN_ZOOM = 0.5;
const TAP_SLOP = 6;

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const v = parseInt(m[1], 16);
  const ch = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch(v >> 16) + 0.7152 * ch((v >> 8) & 255) + 0.0722 * ch(v & 255);
}

/**
 * @param {{ scene: object|null, selected: object|null, hovered: object|null,
 *   onHover: (hit|null) => void, onSelect: (hit|null, how: string) => void, onActivate: (hit) => void,
 *   onZoom?: (zoom: number) => void, controls?: { current: object }, label: string, describedBy?: string,
 *   resetKey?: string }} props
 */
export function Preview(props) {
  const wrapRef = useRef(null);
  const baseRef = useRef(null);
  const overRef = useRef(null);
  const st = useRef({
    w: 0, h: 0, dpr: 1, zoom: 1, cx: 0, cy: 0, fit: null, scene: null, resetKey: null,
    drawMs: 0, pending: 0, pointers: new Map(), gesture: null, snapshot: null, snapView: null, idleTimer: 0,
  }).current;
  const propsRef = useRef(props);
  propsRef.current = props;

  // ---- view math
  const view = () => {
    const scale = st.fit.scale * st.zoom;
    return { scale, offsetX: st.w / 2 - st.cx * scale, offsetY: st.h / 2 - st.cy * scale };
  };
  const toScene = (px, py) => { const v = view(); return { x: (px - v.offsetX) / v.scale, y: (py - v.offsetY) / v.scale }; };
  const maxZoom = () => Math.max(1.5, MAX_SCALE / (st.fit ? st.fit.scale : 1));
  const clampCenter = () => {
    const sc = st.scene;
    if (!sc) return;
    st.cx = Math.max(0, Math.min(sc.wPt, st.cx));
    st.cy = Math.max(0, Math.min(sc.hPt, st.cy));
  };
  const refit = () => {
    const sc = st.scene;
    if (!sc || !st.w || !st.h) return;
    st.fit = fitToBox(sc, st.w, st.h, Math.min(PAD, st.w * 0.05));
  };
  const resetView = () => {
    const sc = st.scene;
    if (!sc) return;
    refit();
    st.zoom = 1; st.cx = sc.wPt / 2; st.cy = sc.hPt / 2;
  };

  // ---- drawing
  const sizeCanvas = (cv) => {
    const W = Math.max(1, Math.round(st.w * st.dpr)), H = Math.max(1, Math.round(st.h * st.dpr));
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  };

  const drawFull = () => {
    const cv = baseRef.current, sc = st.scene;
    if (!cv || !sc || !st.fit) return;
    sizeCanvas(cv);
    const ctx = cv.getContext('2d');
    const t0 = performance.now();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const v = view();
    // the paper is a physical object: a soft shadow under it
    ctx.save();
    ctx.shadowColor = 'rgba(20, 18, 16, 0.22)';
    ctx.shadowBlur = 22 * st.dpr;
    ctx.shadowOffsetY = 8 * st.dpr;
    ctx.fillStyle = sc.bg || '#ffffff';
    ctx.fillRect(v.offsetX * st.dpr, v.offsetY * st.dpr, sc.wPt * v.scale * st.dpr, sc.hPt * v.scale * st.dpr);
    ctx.restore();
    try {
      drawScene(ctx, sc, { scale: v.scale, dpr: st.dpr, offsetX: v.offsetX, offsetY: v.offsetY });
    } catch (e) {
      console.error('preview draw failed', e);
    }
    st.drawMs = performance.now() - t0;
    // keep a copy for fast pans and zooms on slow devices
    if (st.drawMs > 14) {
      if (!st.snapshot) st.snapshot = document.createElement('canvas');
      st.snapshot.width = cv.width; st.snapshot.height = cv.height;
      st.snapshot.getContext('2d').drawImage(cv, 0, 0);
      st.snapView = { ...v };
    } else {
      st.snapView = null;
    }
    drawOverlay();
  };

  const drawFast = () => {
    const cv = baseRef.current;
    if (!cv || !st.snapView || !st.snapshot) return drawFull();
    const ctx = cv.getContext('2d');
    const v = view(), s0 = st.snapView;
    const k = v.scale / s0.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, (v.offsetX - s0.offsetX * k) * st.dpr, (v.offsetY - s0.offsetY * k) * st.dpr);
    ctx.drawImage(st.snapshot, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawOverlay();
    clearTimeout(st.idleTimer);
    st.idleTimer = setTimeout(drawFull, 140);
  };

  const schedule = (fast = false) => {
    if (st.pending) return;
    st.pending = requestAnimationFrame(() => {
      st.pending = 0;
      if (fast && st.drawMs > 14) drawFast(); else drawFull();
    });
  };

  const drawOverlay = () => {
    const cv = overRef.current, sc = st.scene;
    if (!cv || !sc || !st.fit) return;
    sizeCanvas(cv);
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    const p = propsRef.current;
    const focus = p.hovered || p.selected;
    if (!focus) return;
    const keys = lineKeys(focus, sc);
    const v = view();
    const k = v.scale * st.dpr;
    ctx.setTransform(k, 0, 0, k, v.offsetX * st.dpr, v.offsetY * st.dpr);
    const dark = luminance(sc.bg) < 0.35;
    const color = dark ? '#E6C98A' : '#C9301A';
    ctx.lineJoin = 'round';
    for (const h of sc.hits || []) {
      if (!keys.has(lineKey(h, sc))) continue;
      const path = new Path2D(h.shape === 'rect' ? rectPath(h.x, h.y, h.w, h.h) : sectorPath(h.cx, h.cy, h.r0, h.r1, h.a0, h.a1));
      const here = h === focus;
      ctx.globalAlpha = here ? 0.2 : 0.11;
      ctx.fillStyle = color;
      ctx.fill(path);
      ctx.globalAlpha = here ? 1 : 0.85;
      ctx.strokeStyle = color;
      ctx.lineWidth = (here ? 3 : 2) / v.scale;
      ctx.stroke(path);
    }
    // the person the keyboard is on gets a second, outer ring so focus is never color alone
    if (p.selected && p.selectedHow === 'keyboard') {
      const h = p.selected;
      const path = new Path2D(h.shape === 'rect' ? rectPath(h.x - 3 / v.scale, h.y - 3 / v.scale, h.w + 6 / v.scale, h.h + 6 / v.scale) : sectorPath(h.cx, h.cy, Math.max(0, h.r0 - 3 / v.scale), h.r1 + 3 / v.scale, h.a0, h.a1));
      ctx.globalAlpha = 1;
      ctx.strokeStyle = dark ? '#FFFFFF' : '#141210';
      ctx.setLineDash([6 / v.scale, 4 / v.scale]);
      ctx.lineWidth = 2 / v.scale;
      ctx.stroke(path);
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  };

  // ---- zoom helpers (also exposed to the toolbar)
  const emitZoom = () => { const p = propsRef.current; if (p.onZoom) p.onZoom(st.zoom); };
  const zoomAt = (factor, px = st.w / 2, py = st.h / 2) => {
    if (!st.fit) return;
    const before = toScene(px, py);
    const z = Math.max(MIN_ZOOM, Math.min(maxZoom(), st.zoom * factor));
    if (z === st.zoom) return;
    st.zoom = z;
    const scale = st.fit.scale * z;
    st.cx = before.x + (st.w / 2 - px) / scale;
    st.cy = before.y + (st.h / 2 - py) / scale;
    clampCenter();
    schedule(true);
    emitZoom();
  };
  const fit = () => { resetView(); schedule(); emitZoom(); };

  if (props.controls) {
    props.controls.current = {
      zoomIn: () => zoomAt(1.4),
      zoomOut: () => zoomAt(1 / 1.4),
      fit,
      zoom: () => st.zoom,
      canvas: () => baseRef.current,
    };
  }

  // ---- scene changes
  useEffect(() => {
    const sc = props.scene;
    const prev = st.scene;
    st.scene = sc;
    if (!sc) return;
    const reset = !prev || prev.wPt !== sc.wPt || prev.hPt !== sc.hPt || st.resetKey !== props.resetKey;
    st.resetKey = props.resetKey;
    if (reset) resetView(); else refit();
    let alive = true;
    preloadImages(sc).then(() => { if (alive && st.scene === sc) schedule(); });
    schedule();
    if (reset) emitZoom();
    return () => { alive = false; };
  }, [props.scene, props.resetKey]);

  useEffect(() => { drawOverlay(); }, [props.hovered, props.selected, props.selectedHow]);

  // ---- size
  useEffect(() => {
    const el = wrapRef.current;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const w = Math.round(r.width), h = Math.round(r.height);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      if (w === st.w && h === st.h && dpr === st.dpr) return;
      st.w = w; st.h = h; st.dpr = dpr;
      refit();
      if (st.scene && !st.cx && !st.cy) resetView();
      schedule();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ---- pointer, wheel and keyboard
  useEffect(() => {
    const el = wrapRef.current;
    const local = e => { const r = el.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    const hitAt = (px, py) => {
      if (!st.scene || !st.fit) return null;
      const s = toScene(px, py);
      return hitTest(st.scene, s.x, s.y);
    };

    const down = e => {
      if (e.button !== undefined && e.button > 0) return;
      el.setPointerCapture?.(e.pointerId);
      const p = local(e);
      st.pointers.set(e.pointerId, p);
      if (st.pointers.size === 1) {
        st.gesture = { kind: 'maybe-tap', x0: p.x, y0: p.y, cx0: st.cx, cy0: st.cy, type: e.pointerType };
      } else if (st.pointers.size === 2) {
        const [a, b] = [...st.pointers.values()];
        st.gesture = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: st.zoom, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, anchor: toScene((a.x + b.x) / 2, (a.y + b.y) / 2) };
      }
    };
    const move = e => {
      const p = local(e);
      if (!st.pointers.has(e.pointerId)) {
        if (e.pointerType === 'mouse') {
          const h = hitAt(p.x, p.y);
          const cur = propsRef.current.hovered;
          if (h !== cur) propsRef.current.onHover(h);
          el.style.cursor = h ? 'pointer' : st.zoom > 1.01 ? 'grab' : 'default';
        }
        return;
      }
      st.pointers.set(e.pointerId, p);
      const g = st.gesture;
      if (!g) return;
      if (g.kind === 'pinch' && st.pointers.size >= 2) {
        const [a, b] = [...st.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        st.zoom = Math.max(MIN_ZOOM, Math.min(maxZoom(), g.z0 * d / g.d0));
        const scale = st.fit.scale * st.zoom;
        st.cx = g.anchor.x + (st.w / 2 - mid.x) / scale;
        st.cy = g.anchor.y + (st.h / 2 - mid.y) / scale;
        clampCenter();
        schedule(true);
        emitZoom();
        return;
      }
      if (g.kind === 'maybe-tap' && Math.hypot(p.x - g.x0, p.y - g.y0) > TAP_SLOP) g.kind = 'pan';
      if (g.kind === 'pan') {
        const scale = st.fit.scale * st.zoom;
        st.cx = g.cx0 - (p.x - g.x0) / scale;
        st.cy = g.cy0 - (p.y - g.y0) / scale;
        clampCenter();
        el.style.cursor = 'grabbing';
        schedule(true);
      }
    };
    const up = e => {
      const g = st.gesture;
      const p = local(e);
      st.pointers.delete(e.pointerId);
      if (g && g.kind === 'maybe-tap' && st.pointers.size === 0) {
        const h = hitAt(p.x, p.y);
        propsRef.current.onSelect(h, g.type === 'mouse' ? 'mouse' : 'touch');
      }
      if (st.pointers.size === 0) {
        st.gesture = null;
        el.style.cursor = '';
        if (st.snapView) { clearTimeout(st.idleTimer); st.idleTimer = setTimeout(drawFull, 60); }
      } else if (st.pointers.size === 1) {
        const [only] = [...st.pointers.values()];
        st.gesture = { kind: 'pan', x0: only.x, y0: only.y, cx0: st.cx, cy0: st.cy };
      }
    };
    const leave = e => {
      if (e.pointerType === 'mouse' && !st.pointers.size && propsRef.current.hovered) propsRef.current.onHover(null);
    };
    const wheel = e => {
      if (!st.scene) return;
      e.preventDefault();
      const p = local(e);
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY;
      const factor = Math.exp(-Math.max(-60, Math.min(60, dy)) * (e.ctrlKey ? 0.012 : 0.0035));
      zoomAt(factor, p.x, p.y);
    };
    const dbl = e => { const p = local(e); zoomAt(1.8, p.x, p.y); };

    const key = e => {
      const sc = st.scene;
      if (!sc) return;
      const p = propsRef.current;
      const hits = sc.hits || [];
      const cur = p.selected && hits.includes(p.selected) ? p.selected : null;
      const first = () => hits.find(h => h.ahnen === 1) || hits.find(h => !h.ahnen && !h.side) || hits[0];
      let next = null;
      switch (e.key) {
        case 'ArrowUp': case 'ArrowDown': case 'ArrowLeft': case 'ArrowRight':
          next = cur ? nextHit(hits, cur, e.key.slice(5).toLowerCase()) : first();
          if (!next) { e.preventDefault(); return; }
          break;
        case 'Home': next = first(); break;
        case 'Enter': case ' ':
          if (cur) { e.preventDefault(); p.onActivate(cur); }
          return;
        case 'Escape':
          if (cur) { e.preventDefault(); p.onSelect(null, 'keyboard'); }
          return;
        case '+': case '=': e.preventDefault(); zoomAt(1.4); return;
        case '-': case '_': e.preventDefault(); zoomAt(1 / 1.4); return;
        case '0': e.preventDefault(); fit(); return;
        default: return;
      }
      e.preventDefault();
      if (next) {
        p.onSelect(next, 'keyboard');
        ensureVisible(next);
      }
    };
    const ensureVisible = h => {
      const c = hitCenter(h);
      const v = view();
      const x = c.x * v.scale + v.offsetX, y = c.y * v.scale + v.offsetY;
      const m = 40;
      if (x < m || x > st.w - m || y < m || y > st.h - m) {
        st.cx = c.x; st.cy = c.y; clampCenter(); schedule();
      }
    };
    const focus = () => {
      const p = propsRef.current;
      let keyboard = true;
      try { keyboard = el.matches(':focus-visible'); } catch { /* old browsers: assume keyboard */ }
      if (keyboard && !p.selected && st.scene) {
        const hits = st.scene.hits || [];
        const h = hits.find(x => x.ahnen === 1) || hits[0];
        if (h) p.onSelect(h, 'keyboard');
      }
    };

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', leave);
    el.addEventListener('wheel', wheel, { passive: false });
    el.addEventListener('dblclick', dbl);
    el.addEventListener('keydown', key);
    el.addEventListener('focus', focus);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('pointerleave', leave);
      el.removeEventListener('wheel', wheel);
      el.removeEventListener('dblclick', dbl);
      el.removeEventListener('keydown', key);
      el.removeEventListener('focus', focus);
      cancelAnimationFrame(st.pending);
      clearTimeout(st.idleTimer);
    };
  }, []);

  return html`
    <div class="preview" ref=${wrapRef} tabindex="0" role="group" aria-roledescription="chart preview"
      aria-label=${props.label} aria-describedby=${props.describedBy}>
      <canvas class="preview__base" ref=${baseRef} aria-hidden="true"></canvas>
      <canvas class="preview__over" ref=${overRef} aria-hidden="true"></canvas>
    </div>`;
}
