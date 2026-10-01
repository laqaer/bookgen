// Export actions and the paywall. Presentational: the studio decides what each
// button does, and every paid action goes through ui/gate.js first.
//   ExportBar   the one filled button (and one quiet alternative), pinned under the options
//   ExportMore  the other ways to print, as a section of the options
//   Paywall     "Your chart is ready." States limits before payment (voice rule 9).

import { html, useEffect, useRef } from '../../vendor/preact-htm.module.js';

/**
 * @param {{ free: { label: string, short: string }, needsLicense: boolean, reasons: string[], paid: boolean,
 *   price: number, sizeText: string, busy: string|null, status: { text: string, kind: string }|null,
 *   onFreePdf: () => void, onPdf: () => void, onPoster: () => void, preflight: any }} p
 */
export function ExportBar(p) {
  const busy = !!p.busy;
  let body;
  if (p.paid) {
    body = html`
      <button type="button" class="btn btn--primary btn--block" disabled=${busy} onClick=${p.onPdf}>Download PDF, ${p.sizeText}</button>`;
  } else if (p.needsLicense) {
    body = html`
      <p class="export__why">Printing it as shown (${p.reasons.join(', ')}) is part of Heirloom.</p>
      <button type="button" class="btn btn--primary btn--block" disabled=${busy} onClick=${p.onPoster}>Make it a poster, $${p.price}</button>
      <button type="button" class="btn--quiet export__alt" disabled=${busy} onClick=${p.onFreePdf}>Or the free ${p.free.short}</button>`;
  } else {
    body = html`
      <button type="button" class="btn btn--primary btn--block" disabled=${busy} onClick=${p.onFreePdf}>${p.free.label}</button>
      <button type="button" class="btn--quiet export__alt" disabled=${busy} onClick=${p.onPoster}>Make it a poster, $${p.price}</button>`;
  }
  return html`
    <section class="export" aria-labelledby="export-title">
      <h2 class="visually-hidden" id="export-title">Print it</h2>
      ${p.preflight}
      ${body}
      <p class=${`export__status${p.status && !p.busy ? ` export__status--${p.status.kind}` : ''}`} role="status" aria-live="polite">
        ${p.busy ? html`<span class="spinner" aria-hidden="true"></span>${p.busy}` : (p.status && p.status.text) || ''}
      </p>
    </section>`;
}

/**
 * @param {{ paid: boolean, busy: string|null, bleed: boolean, onBleed: (v: boolean) => void, tileSheet: string,
 *   freeHint: string, onShare: () => void, onTiles: () => void, onJpeg: () => void }} p
 */
export function ExportMore(p) {
  const busy = !!p.busy;
  const tag = p.paid ? '' : html` <span class="tag">Heirloom</span>`;
  return html`
    <ul class="export__list" role="list">
      <li>
        <button type="button" class="btn--quiet" disabled=${busy} onClick=${p.onShare}>Picture for sharing</button>
        <span class="hint">1080 × 1350 pixels, with a small Gildroot mark. Free, in any style.</span>
      </li>
      <li>
        <button type="button" class="btn--quiet" disabled=${busy} onClick=${p.onTiles}>Print at home on ${p.tileSheet} sheets</button>${tag}
        <span class="hint">The poster split into pages that overlap by 0.25 in, with a first page that shows how they fit together.</span>
      </li>
      <li>
        <button type="button" class="btn--quiet" disabled=${busy} onClick=${p.onJpeg}>JPEG for a photo counter</button>${tag}
        <span class="hint">200 dpi up to 18 × 24 in, 150 dpi above. On an iPhone or iPad, up to 16.7 megapixels.</span>
      </li>
      <li>
        <label class="check export__bleed">
          <input type="checkbox" checked=${p.bleed} onChange=${e => p.onBleed(e.currentTarget.checked)} />
          <span>Add 0.125 in bleed and crop marks to the PDF, for a print shop${tag}</span>
        </label>
      </li>
    </ul>
    <p class="hint">${p.freeHint}</p>`;
}

/**
 * The paywall, as a modal dialog.
 * @param {{ open: boolean, onClose: () => void, price: number, checkout: string|null,
 *   unprintable: number, onFree: () => void, freeLabel: string, onCheckout?: () => void }} p
 */
export function Paywall(p) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    if (!p.open && d.open) { if (d.close) d.close(); else d.removeAttribute('open'); }
  }, [p.open]);
  return html`
    <dialog class="paywall" ref=${ref} aria-labelledby="paywall-title" onClose=${p.onClose} onCancel=${p.onClose}>
      <div class="paywall__inner">
        <p class="eyebrow">Heirloom · $${p.price} once</p>
        <h2 id="paywall-title" class="paywall__title">Your chart is ready.</h2>
        <p class="paywall__lead">Make it a poster for $${p.price}: every size, every style, re-export it forever.</p>
        <ul class="price-card__terms">
          <li>Every size up to 24 × 36 in and A1, up to 8 generations</li>
          <li>All six styles, all three color modes, and the two-family chart</li>
          <li>Print-shop PDF with bleed, tiled home printing, and JPEG for photo counters</li>
          <li>No “Made with Gildroot” line at the bottom</li>
          <li>One family: one person, or one couple, in the center. Family Historian ($59) covers every tree you make.</li>
        </ul>
        ${p.unprintable > 0 && html`<p class="notice notice--warn"><span>${p.unprintable === 1 ? '1 name' : `${p.unprintable} names`} on this chart can’t be printed yet (Chinese, Japanese, Korean, Hebrew or Arabic letters). Type a romanized form for each before you buy.</span></p>`}
        ${p.checkout
          ? html`<a class="btn btn--primary btn--block" href=${p.checkout} target="_blank" rel="noopener" onClick=${p.onCheckout}>Buy Heirloom, $${p.price}</a>
                 <p class="hint">Checkout opens in a new tab, so your chart stays open here. Your family tree is never sent to the checkout.</p>`
          : html`<p class="notice notice--soon"><span>Checkout opens soon. Your chart is saved in this browser, so it will be here when you come back. <a href="/pricing/">See pricing</a>.</span></p>`}
        <p class="paywall__links">
          <a href="/unlock/" target="_blank" rel="noopener">I already have a key</a>
          <span aria-hidden="true">·</span>
          <button type="button" class="btn--quiet" onClick=${p.onFree}>${p.freeLabel}</button>
        </p>
        <p class="hint">30-day refund, no questions asked: reply to your receipt.</p>
        <button type="button" class="icon-btn paywall__close" aria-label="Close" onClick=${p.onClose}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg>
        </button>
      </div>
    </dialog>`;
}
