// Studio analytics: named events with bucketed values only (company/BRIEF.md §4.6):
// chart type, style, generations, size and a people-count bucket. Never names, places,
// dates, file names or anything else from the tree. Sent only when the page has a
// Plausible domain configured; otherwise this is a no-op.

const ALLOWED = new Set(['chart', 'style', 'mode', 'gens', 'size', 'people', 'kind', 'source', 'tier']);

let domain = '';

/** Set the Plausible domain (from site.json analytics.plausibleDomain). Empty disables. */
export function configureAnalytics(d) {
  domain = typeof d === 'string' ? d.trim() : '';
}

/**
 * Record an event. Properties outside the allow-list are dropped.
 * @param {string} name e.g. 'Studio: file read', 'Studio: export'
 * @param {Record<string, string|number>} [props]
 */
export function track(name, props = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(props)) {
    if (ALLOWED.has(k) && (typeof v === 'string' || typeof v === 'number') && String(v).length <= 24) clean[k] = String(v);
  }
  if (typeof window !== 'undefined') (window.__gildrootEvents ||= []).push({ name, props: clean });
  if (!domain || typeof navigator === 'undefined') return;
  const body = JSON.stringify({ n: name, u: location.origin + location.pathname, d: domain, p: clean });
  try {
    if (navigator.sendBeacon) navigator.sendBeacon('https://plausible.io/api/event', new Blob([body], { type: 'text/plain' }));
    else fetch('https://plausible.io/api/event', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
  } catch { /* analytics never breaks the studio */ }
}
