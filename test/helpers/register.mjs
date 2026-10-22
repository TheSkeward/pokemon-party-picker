// Entry for `node --import`: installs the loader hooks so app modules resolve,
// then installs the committed singles utility prior. The browser loads the
// prior per family before any analysis; the tests see the same table from
// the start, so a unit test of the set builder reads the data the app does.
import { readFileSync } from 'node:fs';
import { register } from 'node:module';
register('./loader.mjs', import.meta.url);

const { setMovePrior } = await import('../../src/teamBuilder/move-prior.js');
const table = JSON.parse(readFileSync(
  new URL('../../site-data/data/move-prior/singles.json', import.meta.url),
  'utf8',
));
setMovePrior(
  new Map(Object.entries(table.moves).map(([id, e]) => [id, e.prior])),
);
