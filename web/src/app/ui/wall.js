// "On the wall": the current chart in a CSS frame and mat on a wall, drawn to scale
// above a 32-inch sideboard so a 24 × 36 poster reads as big as it really is.

import { html, useEffect, useRef, useState } from '../../vendor/preact-htm.module.js';
import { drawScene, preloadImages } from '../charts/render-canvas.js';

export const FINISHES = Object.freeze([
  { key: 'oak', label: 'Oak' },
  { key: 'walnut', label: 'Walnut' },
  { key: 'black', label: 'Black' },
  { key: 'ash', label: 'Ash' },
]);

const SIDEBOARD_H = 32; // inches
const GAP = 9; // inches between sideboard and frame
const SIDEBOARD_SHOWN = 14; // inches of the sideboard kept in view (enough to read as furniture)

async function sceneImage(scene, longPx = 1400) {
  await preloadImages(scene);
  const k = longPx / Math.max(scene.wPt, scene.hPt);
  const c = document.createElement('canvas');
  c.width = Math.round(scene.wPt * k);
  c.height = Math.round(scene.hPt * k);
  drawScene(c.getContext('2d'), scene, { scale: k, dpr: 1 });
  const blob = await new Promise(r => c.toBlob(r, 'image/png'));
  c.width = c.height = 0;
  return blob ? URL.createObjectURL(blob) : null;
}

/**
 * @param {{ scene: object, label: string, dark: boolean }} props
 */
export function OnTheWall({ scene, label, dark }) {
  const roomRef = useRef(null);
  const [src, setSrc] = useState(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [finish, setFinish] = useState(dark ? 'black' : 'oak');

  useEffect(() => {
    let alive = true, url = null;
    setSrc(null);
    sceneImage(scene).then(u => { url = u; if (alive) setSrc(u); else if (u) URL.revokeObjectURL(u); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [scene]);

  useEffect(() => {
    const el = roomRef.current;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setBox({ w: r.width, h: r.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const wIn = scene.wPt / 72, hIn = scene.hPt / 72;
  const mat = Math.max(wIn, hIn) > 15 ? 3 : 2;
  const moulding = Math.max(wIn, hIn) > 15 ? 1.4 : 1;
  const fw = wIn + 2 * (mat + moulding), fh = hIn + 2 * (mat + moulding);
  const sideW = Math.max(52, fw * 1.3);
  const headroom = Math.max(5, fh * 0.18);
  const roomH = SIDEBOARD_SHOWN + GAP + fh + headroom;
  const roomW = Math.max(fw + 16, Math.min(sideW + 12, 90));
  const ppi = box.w && box.h ? Math.min(box.h / roomH, box.w / roomW) : 0;
  // the floor sits below the visible area: only the sideboard's top shows
  const floor = SIDEBOARD_H - SIDEBOARD_SHOWN;
  const px = v => `${Math.round(v * ppi * 10) / 10}px`;
  const sizeText = `${Math.round(wIn * 10) / 10} × ${Math.round(hIn * 10) / 10} in`;

  return html`
    <div class="wall-view">
      <div class="wall-view__room" ref=${roomRef}>
        ${ppi > 0 && html`
          <figure class="wall-view__piece" style=${{ width: px(fw), bottom: px(SIDEBOARD_H + GAP - floor) }}>
            <div class=${`frame frame--${finish}`} style=${{ '--frame': px(moulding), '--mat': px(mat) }}>
              <div class="frame__mat">
                ${src
                  ? html`<img src=${src} width=${Math.round(wIn * 100)} height=${Math.round(hIn * 100)} alt=${`${label}, framed on a wall.`} />`
                  : html`<div class="wall-view__blank" style=${{ aspectRatio: `${wIn} / ${hIn}` }}></div>`}
              </div>
            </div>
          </figure>
          <div class="wall-view__sideboard" style=${{ width: px(sideW), height: px(SIDEBOARD_H), bottom: px(-floor) }} aria-hidden="true"></div>`}
      </div>
      <div class="wall-view__caption">
        <div class="museum-label">
          <span class="museum-label__title">${scene.meta.title}</span>
          <span class="museum-label__meta">${label} · ${sizeText}</span>
          <span>Shown to scale above a sideboard 32 inches high, with a ${mat}-inch mat.</span>
        </div>
        <fieldset class="fieldset wall-view__finish">
          <legend>Frame</legend>
          <div class="chips">
            ${FINISHES.map(f => html`
              <label class="chip">
                <input type="radio" name="wall-finish" value=${f.key} checked=${finish === f.key} onChange=${() => setFinish(f.key)} />
                <span>${f.label}</span>
              </label>`)}
          </div>
        </fieldset>
      </div>
    </div>`;
}
