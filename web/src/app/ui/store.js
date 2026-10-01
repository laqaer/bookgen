// Project autosave in this browser (IndexedDB through the vendored idb-keyval).
// Nothing here touches the network: the project lives on this computer only.
//
// Two slots, so trying a sample never overwrites the project made from your own file:
//   'file'   a project made from a dropped file (the file's bytes are kept, so it can be re-read)
//   'sample' a project made from one of the sample families (only the sample's name is kept)
//
// Stored shape (version 1):
//   { v: 1, slot, savedAt, source: { kind: 'file'|'sample', name, sample?, bytes? },
//     people, title, options, overrides, placeOverrides, romanized }

import { get, set, del } from '../../vendor/idb-keyval.module.js';

const KEY = slot => `gildroot.project.${slot}.v1`;
export const SLOTS = Object.freeze(['file', 'sample']);

/** True when IndexedDB is usable here (private windows in some browsers say no). */
export async function storageAvailable() {
  try {
    if (typeof indexedDB === 'undefined') return false;
    await get('gildroot.probe');
    return true;
  } catch {
    return false;
  }
}

/**
 * Save a project. Resolves false (never throws) when storage is unavailable or full.
 * @param {object} project
 */
export async function saveProject(project) {
  const slot = project.source && project.source.kind === 'file' ? 'file' : 'sample';
  const rec = { ...project, v: 1, slot, savedAt: Date.now() };
  try {
    await set(KEY(slot), rec);
    return true;
  } catch {
    return false;
  }
}

/**
 * Saved projects, newest first.
 * @returns {Promise<object[]>}
 */
export async function savedProjects() {
  const out = [];
  for (const slot of SLOTS) {
    try {
      const rec = await get(KEY(slot));
      if (rec && rec.v === 1 && rec.source && rec.options) out.push(rec);
    } catch { /* unreadable slot: ignore */ }
  }
  return out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

/** Remove a saved project from this computer. */
export async function forgetProject(slot) {
  try { await del(KEY(slot)); return true; } catch { return false; }
}
