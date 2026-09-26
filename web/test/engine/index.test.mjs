import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, ENGINE } from './helpers.mjs';

test('index.js loads every *.test.mjs file in this folder', () => {
  const listed = [...readFileSync(join(HERE, 'index.js'), 'utf8').matchAll(/import\('\.\/([^']+)'\)/g)].map(m => m[1]).sort();
  const actual = readdirSync(HERE).filter(f => f.endsWith('.test.mjs')).sort();
  assert.deepEqual(listed, actual);
});

test('engine modules have no DOM or network access', () => {
  for (const f of readdirSync(ENGINE).filter(n => n.endsWith('.js'))) {
    const src = readFileSync(join(ENGINE, f), 'utf8');
    for (const banned of ['document.', 'window.', 'localStorage', 'fetch(', 'XMLHttpRequest']) {
      assert.ok(!src.includes(banned), `${f} uses ${banned}`);
    }
  }
});
