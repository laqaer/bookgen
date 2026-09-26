import test from 'node:test';
import assert from 'node:assert/strict';
import { fixtureBytes, sampleBytes } from './helpers.mjs';

// Simulate a module worker scope: worker.js attaches onmessage to `self` when it has postMessage
// and there is no window.
const posted = [];
globalThis.self = { postMessage: (m) => posted.push(m) };
const mod = await import('../../src/app/engine/worker.js');
const scope = globalThis.self;
delete globalThis.self;

const send = (data) => {
  posted.length = 0;
  scope.onmessage({ data });
  return posted[0];
};

test('parse message -> tree message', () => {
  const bytes = sampleBytes('victoria.ged');
  const buffer = bytes.slice().buffer;
  const reply = send({ type: 'parse', buffer, name: 'victoria.ged', id: 7 });
  assert.equal(reply.type, 'tree');
  assert.equal(reply.id, 7);
  assert.equal(reply.tree.meta.count, 298);
  assert.equal(reply.tree.meta.fileName, 'victoria.ged');
  assert.equal(typeof reply.ms, 'number');
  assert.deepEqual(structuredClone(reply.tree), reply.tree); // crosses postMessage intact
});

test('zip and gdz files are unpacked in the worker', () => {
  const r1 = send({ type: 'parse', buffer: fixtureBytes('gedcom7.gdz').slice().buffer, name: 'family.gdz' });
  assert.equal(r1.type, 'tree');
  assert.equal(r1.tree.meta.version, '7.0');
  const r2 = send({ type: 'parse', buffer: fixtureBytes('zipped-export.zip'), name: 'export.zip' });
  assert.equal(r2.tree.meta.count, 10);
});

test('text input and ANSEL bytes', () => {
  assert.equal(send({ type: 'parse', text: '0 HEAD\n0 @I1@ INDI\n1 NAME A /B/\n0 TRLR' }).tree.people.I1.name, 'A B');
  const ansel = send({ type: 'parse', buffer: fixtureBytes('ansel.ged').slice().buffer, name: 'old.ged' });
  assert.equal(ansel.tree.meta.charset, 'ANSEL');
  assert.equal(ansel.tree.people.I1.name, 'Seán Dvořák');
});

test('errors come back as { type: "error", message } in plain words', () => {
  const junk = send({ type: 'parse', buffer: new TextEncoder().encode('Dear Anna, happy birthday!').buffer, name: 'letter.ged', id: 'x' });
  assert.deepEqual(junk, { type: 'error', message: 'This file does not look like a family tree (GEDCOM) file.', id: 'x' });
  assert.equal(send({ type: 'parse', buffer: new ArrayBuffer(0) }).message, 'This file is empty.');
  assert.equal(send({ type: 'parse', buffer: new Uint8Array([0x50, 0x4B, 3, 4, 1, 2, 3]).buffer, name: 'x.zip' }).type, 'error');
  assert.equal(send({ type: 'parse', text: '0 HEAD\n0 TRLR' }).message, 'We could not find any people in this file.');
  assert.equal(send({ type: 'render' }).type, 'error');
});

test('handleParse is exported for a main-thread fallback', () => {
  const r = mod.handleParse({ text: '0 HEAD\n0 @I1@ INDI\n1 NAME A /B/\n0 TRLR' });
  assert.equal(r.type, 'tree');
});
