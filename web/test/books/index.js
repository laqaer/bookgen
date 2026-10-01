// Lets `node --test web/test/books/` work on Node 22: a directory argument is resolved like a
// module path, so this index loads every *.test.mjs file in this folder. New test files are
// picked up without editing this list.
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(here).filter((n) => n.endsWith('.test.mjs')).sort()) {
  await import(`./${f}`);
}
