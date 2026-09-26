// Web Worker entry (module worker): parses a dropped file off the main thread.
//   new Worker('/app/engine/worker.js', { type: 'module' })
//   worker.postMessage({ type: 'parse', buffer, name }, [buffer])
//   -> { type: 'tree', tree, ms } or { type: 'error', message }
// An optional `id` on the request is echoed back. Importing this module on the main thread has
// no side effects; handleParse() can then be called directly as a fallback.

import { parseGedcom } from './gedcom.js';
import { extractGedcom, isZip, isGzip } from './zip.js';

function toU8(buffer) {
  if (buffer instanceof Uint8Array) return buffer;
  if (buffer instanceof ArrayBuffer) return new Uint8Array(buffer);
  if (ArrayBuffer.isView(buffer)) return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return null;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Parse one request. Throws with a plain-language message on unreadable input.
 * @param {{ buffer?: ArrayBuffer|Uint8Array, text?: string, name?: string, nowYear?: number }} msg
 * @returns {{ type: 'tree', tree: object, ms: number }}
 */
export function handleParse(msg) {
  const t0 = now();
  const name = typeof msg.name === 'string' ? msg.name : '';
  let input;
  if (typeof msg.text === 'string') input = msg.text;
  else {
    input = toU8(msg.buffer);
    if (!input || !input.length) throw new Error('This file is empty.');
    if (isZip(input) || isGzip(input) || /\.(zip|gdz)$/i.test(name)) input = extractGedcom(input);
  }
  const tree = parseGedcom(input, { fileName: name, nowYear: msg.nowYear });
  if (!tree.meta.count) {
    const why = tree.meta.warnings.find(w => /GEDCOM file|No people/.test(w));
    throw new Error(why && /GEDCOM file/.test(why) ? 'This file does not look like a family tree (GEDCOM) file.' : 'We could not find any people in this file.');
  }
  return { type: 'tree', tree, ms: Math.round(now() - t0) };
}

const scope = typeof self !== 'undefined' && self && typeof self.postMessage === 'function' && typeof window === 'undefined' ? self : null;
if (scope) {
  scope.onmessage = (e) => {
    const msg = (e && e.data) || {};
    const reply = (obj) => { if (msg.id !== undefined) obj.id = msg.id; scope.postMessage(obj); };
    if (msg.type !== 'parse') { reply({ type: 'error', message: `Unknown request "${msg.type}".` }); return; }
    try {
      reply(handleParse(msg));
    } catch (err) {
      reply({ type: 'error', message: err && err.message ? err.message : 'This file could not be read.' });
    }
  };
}
