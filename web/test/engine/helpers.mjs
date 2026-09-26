// Shared paths and loaders for the engine tests (not a test file itself).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB = join(HERE, '..', '..');
export const FIXTURES = join(WEB, 'test', 'fixtures');
export const SAMPLES = join(WEB, 'src', 'samples');
export const ENGINE = join(WEB, 'src', 'app', 'engine');

/** Read a fixture as bytes (Uint8Array). */
export function fixtureBytes(name) {
  const b = readFileSync(join(FIXTURES, name));
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

/** Read a sample as bytes (Uint8Array). */
export function sampleBytes(name) {
  const b = readFileSync(join(SAMPLES, name));
  return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
}

/** Load the vendored lz-string (a classic script defining `LZString`) without touching globals. */
export function loadLZString() {
  const src = readFileSync(join(WEB, 'src', 'vendor', 'lz-string.min.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  return new Function('define', 'module', 'angular', `${src}\nreturn LZString;`)(undefined, undefined, undefined);
}

/** Names of all people in a tree, in file order. */
export const names = tree => Object.values(tree.people).map(p => p.name);
