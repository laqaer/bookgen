// Shared by the free tools: read a dropped or chosen family tree file on this computer.
// The file is parsed by the engine in a Web Worker (web/src/app/engine/worker.js), or on the
// page itself if workers are unavailable. Nothing is sent anywhere: there is no fetch() here.

let worker = null;
let seq = 0;

function parseInWorker(buffer, name) {
  if (!worker) worker = new Worker('/app/engine/worker.js', { type: 'module' });
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const onMsg = e => {
      const msg = e.data || {};
      if (msg.id !== id) return;
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      if (msg.type === 'tree') resolve(msg);
      else reject(new Error(msg.message || 'This file could not be read.'));
    };
    const onErr = e => {
      worker.removeEventListener('message', onMsg);
      worker.removeEventListener('error', onErr);
      worker = null;
      reject(Object.assign(new Error(e.message || 'worker failed'), { workerFailed: true }));
    };
    worker.addEventListener('message', onMsg);
    worker.addEventListener('error', onErr);
    worker.postMessage({ type: 'parse', buffer, name, id }, [buffer]);
  });
}

/**
 * Read a File into an engine Tree.
 * @param {File} file
 * @returns {Promise<{ tree: object, ms: number, name: string }>}
 */
export async function readTreeFile(file) {
  const name = file.name || 'family tree';
  const bytes = await file.arrayBuffer();
  try {
    if (typeof Worker === 'undefined') throw Object.assign(new Error('no worker'), { workerFailed: true });
    const res = await parseInWorker(bytes.slice(0), name);
    return { tree: res.tree, ms: res.ms, name };
  } catch (e) {
    if (!e.workerFailed) throw e;
    const { handleParse } = await import('/app/engine/worker.js');
    const res = handleParse({ buffer: bytes, name });
    return { tree: res.tree, ms: res.ms, name };
  }
}

/**
 * Make an element a drop target and connect a file input to it.
 * @param {HTMLElement} zone the .dropzone element
 * @param {HTMLInputElement} input a type=file input
 * @param {(file: File) => void} onFile
 * @param {HTMLElement} [status] live region for short messages
 */
export function wireDropzone(zone, input, onFile, status) {
  const say = t => { if (status) status.textContent = t; };
  ['dragenter', 'dragover'].forEach(evt => zone.addEventListener(evt, e => {
    e.preventDefault();
    zone.classList.add('is-dragging');
    say('Let go to read it here.');
  }));
  ['dragleave', 'dragend'].forEach(evt => zone.addEventListener(evt, () => { zone.classList.remove('is-dragging'); say(''); }));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('is-dragging');
    const f = e.dataTransfer?.files?.[0];
    if (f) onFile(f);
  });
  input.addEventListener('change', () => {
    const f = input.files?.[0];
    if (f) onFile(f);
    input.value = '';
  });
  // the visible "Choose a file" is a <label for=…>; make Enter and Space work on it too
  const label = zone.querySelector(`label[for="${input.id}"]`);
  if (label) label.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
  });
}

/** Create an element with attributes and children (strings become text nodes). */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

/** "Seán Byrne (1868–1931)" */
export function personLine(p) {
  const by = p.birth?.date?.year, dy = p.death?.date?.year;
  const years = by || dy ? ` (${by ?? '?'}–${dy ?? (p.living ? '' : '?')})` : '';
  return `${p.name || 'Unnamed'}${years}`;
}
