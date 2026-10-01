// The one gate for paid actions in the studio.
//
// Every paid action (poster sizes, styles other than Ivory, color modes other than
// Style tones, the bowtie, bleed, tiled home print, photo-lab JPEG) calls
// requirePaid(action, context). The decision belongs to commerce/license.js
// (status() and requireTier(), docs/ARCHITECTURE.md "Commerce"); this adapter only
// loads it lazily and keeps the studio working while that module is missing or
// failing: then the tier is 'free' and paid actions are refused, never granted.
//
//   const res = await requirePaid('pdf', { size: '24x36', style: 'midnight', rootId, rootName, birthYear });
//   if (res.ok) export(); else openPaywall(res);

import { isFreeExport } from '../charts/sizes.js';

const LICENSE_URL = '../commerce/license.js';
let modPromise = null;

/** Load commerce/license.js once; null when it is not there (yet). */
export function licenseModule() {
  if (!modPromise) {
    modPromise = import(LICENSE_URL).then(m => m, () => null);
  }
  return modPromise;
}

/** For tests: forget the cached module. */
export function resetGate() {
  modPromise = null;
}

/**
 * Current license status; { tier: 'free' } when the module is missing or throws.
 * @returns {Promise<{ tier: string, key?: string, pending?: boolean }>}
 */
export async function licenseStatus() {
  const m = await licenseModule();
  if (!m || typeof m.status !== 'function') return { tier: 'free' };
  try {
    const s = await m.status();
    if (s && typeof s === 'object' && typeof s.tier === 'string') return s;
    if (typeof s === 'string') return { tier: s };
  } catch { /* fall through */ }
  return { tier: 'free' };
}

/**
 * Which settings of an export need a license, as short plain labels ("6 generations", "Midnight Gilt").
 * @param {{ kind: 'pdf'|'tiles'|'jpeg'|'share', size: string, generations: number, chart: string, style: string, colorMode: string, bleed?: boolean }} x
 * @returns {string[]} reasons, empty when the export is free
 */
export function paidReasons(x) {
  const out = [];
  if (x.kind === 'share') return out;
  if (x.kind === 'tiles') out.push('tiled home printing');
  if (x.kind === 'jpeg') out.push('JPEG');
  if (!isFreeExport(x.size, x.generations)) {
    out.push(x.size === 'letter' || x.size === 'a4' ? `${x.generations} generations` : (x.sizeText || 'poster size'));
  }
  if (x.chart === 'bowtie') out.push('two families');
  if (x.style !== 'ivory') out.push(x.styleLabel || 'another style');
  if (x.colorMode !== 'tones') out.push(x.colorMode === 'atlas' ? 'color by birthplace' : x.colorMode === 'lines' ? 'color by family line' : 'this color mode');
  if (x.bleed) out.push('bleed');
  return [...new Set(out)];
}

function normalize(r, tier) {
  if (r === true) return { ok: true, tier };
  if (r === false || r == null) return { ok: false, tier };
  if (typeof r === 'object') {
    const ok = !!(r.ok ?? r.allowed ?? r.granted ?? r.unlocked ?? false);
    return { ...r, ok, tier: r.tier || tier };
  }
  return { ok: false, tier };
}

/**
 * The gate. Resolves { ok: true } when the current license covers the action.
 * Never throws; any failure refuses (and the studio shows the paywall).
 * @param {string} action 'pdf' | 'tiles' | 'jpeg' | 'bowtie' | ...
 * @param {object} [context] root and export details for the license module (no tree data leaves the browser)
 * @returns {Promise<{ ok: boolean, tier: string, reason?: string }>}
 */
export async function requirePaid(action, context = {}) {
  const m = await licenseModule();
  const st = await licenseStatus();
  if (m && typeof m.requireTier === 'function') {
    try {
      return normalize(await m.requireTier(context.tier || 'heirloom', { action, ...context }), st.tier);
    } catch (e) {
      return { ok: false, tier: st.tier, reason: e && e.message ? e.message : String(e) };
    }
  }
  return { ok: st.tier !== 'free', tier: st.tier };
}

/**
 * Checkout link for a product, from license.js when it offers one.
 * @param {string} product e.g. 'heirloom'
 * @param {{ src?: string }} [opts]
 * @param {{ enabled?: boolean, store?: string, heirloom?: string }} [config] site.json checkout block
 * @returns {Promise<string|null>} null when checkout is not open yet
 */
export async function checkoutLink(product, opts = {}, config = {}) {
  const m = await licenseModule();
  if (m && typeof m.checkoutUrl === 'function') {
    try {
      const u = await m.checkoutUrl(product, opts);
      if (u) return u;
    } catch { /* fall through */ }
  }
  const variant = config && config[product];
  if (!config || !config.enabled || !config.store || !variant) return null;
  const src = encodeURIComponent(opts.src || 'studio');
  return `https://${config.store}.lemonsqueezy.com/buy/${encodeURIComponent(variant)}?checkout[custom][src]=${src}`;
}
