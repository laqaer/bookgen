// Lets `node --test web/test/engine/` work on Node 22: a directory argument is resolved like a
// module path, so this index loads every engine test file. Dynamic import() works whether this
// file is treated as CommonJS or as an ES module. Keep the list in sync (index.test.mjs checks).
import('./ansel.test.mjs');
import('./builder.test.mjs');
import('./dates.test.mjs');
import('./decode.test.mjs');
import('./gedcom.test.mjs');
import('./index.test.mjs');
import('./living.test.mjs');
import('./names.test.mjs');
import('./perf.test.mjs');
import('./places.test.mjs');
import('./samples.test.mjs');
import('./tree.test.mjs');
import('./worker.test.mjs');
import('./zip.test.mjs');
