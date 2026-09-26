// Runs tools/qa/pdfcheck.py (PyMuPDF) with bounded concurrency.

import { execFile } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { PDFCHECK } from './env.mjs';

/** A small promise pool: limit(fn) runs fn when a slot is free. */
export function pool(size) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= size || !queue.length) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    Promise.resolve().then(fn).then(resolve, reject).finally(() => { active--; next(); });
  };
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

const limit = pool(Math.max(1, Math.min(6, availableParallelism())));

/**
 * Check one PDF. Never rejects: a crash becomes { ok: false, errors: [...] }.
 * @param {string} file
 * @param {string[]} args extra pdfcheck.py arguments
 * @returns {Promise<object>} the pdfcheck JSON report
 */
export function pdfcheck(file, args = []) {
  return limit(() => new Promise(res => {
    execFile('python3', [PDFCHECK, file, ...args], { encoding: 'utf8', maxBuffer: 32 << 20, timeout: 180000 }, (err, stdout, stderr) => {
      try {
        res(JSON.parse(stdout));
      } catch {
        res({ file, ok: false, errors: [`pdfcheck.py did not report: ${(stderr || (err && err.message) || 'no output').trim().slice(0, 500)}`] });
      }
    });
  }));
}
