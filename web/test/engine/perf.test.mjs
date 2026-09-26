import test from 'node:test';
import assert from 'node:assert/strict';
import { generateLargeGedcom } from '../fixtures/gen-large.mjs';
import { parseGedcom } from '../../src/app/engine/gedcom.js';
import { suggestRoot, stats, searchPeople, ancestors } from '../../src/app/engine/tree.js';

test('50,000 people parse in under 3 seconds', () => {
  const bytes = new TextEncoder().encode(generateLargeGedcom(50000));
  assert.ok(bytes.length > 10e6, 'the synthetic file should be realistically large');
  const t0 = performance.now();
  const tree = parseGedcom(bytes);
  const ms = performance.now() - t0;
  assert.equal(tree.meta.count, 50000);
  assert.ok(Object.keys(tree.families).length > 20000);
  assert.ok(ms < 3000, `parse took ${ms.toFixed(0)} ms`);
  console.log(`# 50k parse: ${ms.toFixed(0)} ms (${(bytes.length / 1e6).toFixed(1)} MB)`);

  const t1 = performance.now();
  const root = suggestRoot(tree);
  const s = stats(tree);
  const hits = searchPeople(tree, 'byrne', 10);
  const a = ancestors(tree, root, 8);
  const ms2 = performance.now() - t1;
  assert.ok(root && s.people === 50000 && hits.length === 10 && a.size > 100);
  assert.ok(ms2 < 2000, `queries took ${ms2.toFixed(0)} ms`);
});
