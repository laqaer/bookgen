#!/usr/bin/env node
// Chart render matrix (the command docs/ARCHITECTURE.md "Testing" names). Same as
// `node web/test/run-all.mjs --only matrix`; accepts the same matrix options
// (--quick, --files, --charts, --styles, --modes, --sizes, --keep, --no-diff, --jobs, --layout).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const runAll = fileURLToPath(new URL('../run-all.mjs', import.meta.url));
const r = spawnSync(process.execPath, [runAll, '--only', 'matrix', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
