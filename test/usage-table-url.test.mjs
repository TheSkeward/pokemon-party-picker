// The Usage Data page's URL: one search and sort, belonging to the table
// the `table` param names, beside that table's own params.
import assert from 'node:assert/strict';
import test from 'node:test';

const { DEFAULT_STATE } = await import('../src/state.js');
const { readStateFromUrl, writeStateToUrl } = await import('../src/router.js');
const { nextSort } = await import('../src/views/table-parts.js');
const { USAGE_TABLES, usageTableById } = await import(
  '../src/views/usage-tables.js',
);

// Reads `search` as the page's query string; returns what a write puts back.
function atUrl(search) {
  const written = [];
  globalThis.window = {
    location: { pathname: '/', search },
    history: { replaceState: (_state, _title, url) => written.push(url) },
  };
  return written;
}

const paramsOf = (url) => Object.fromEntries(new URLSearchParams(url.slice(2)));

test('the search and sort in a URL are the named table\'s', () => {
  atUrl('?view=browser&table=moves&search=fairy&sortBy=taught&sortDir=asc&minLearners=20');
  const state = readStateFromUrl();
  assert.equal(state.usageTable, 'moves');
  assert.deepEqual(state.tables.moves, {
    search: 'fairy', sortBy: 'taught', sortDir: 'asc',
  });
  assert.equal(state.moveMinLearners, 20);
  // The other tables open as they do by default.
  assert.deepEqual(state.tables.pokemon, DEFAULT_STATE.tables.pokemon);
  assert.deepEqual(state.tables.items, DEFAULT_STATE.tables.items);
});

test('an unknown table or column falls back to the default', () => {
  atUrl('?view=browser&table=berries&search=oran');
  let state = readStateFromUrl();
  assert.equal(state.usageTable, USAGE_TABLES[0].id);
  assert.equal(state.tables.pokemon.search, 'oran');
  // `learners` is a move column; the item table keeps its own sort.
  atUrl('?view=browser&table=items&sortBy=learners&sortDir=sideways');
  state = readStateFromUrl();
  assert.deepEqual(state.tables.items, DEFAULT_STATE.tables.items);
  // The move table was a view of its own once; that link opens the default.
  atUrl('?view=moves');
  assert.equal(readStateFromUrl().view, DEFAULT_STATE.view);
});

test('a URL carries the open table\'s params and no other table\'s', () => {
  const tables = {
    ...DEFAULT_STATE.tables,
    pokemon: { search: 'char', sortBy: 'usage', sortDir: 'desc' },
    items: { search: 'berry', sortBy: 'obtained', sortDir: 'asc' },
  };
  const state = {
    ...DEFAULT_STATE,
    view: 'browser',
    family: 'singles',
    format: 'gen7ou',
    selectedPokemon: 'charizard',
    moveMinLearners: 50,
    tables,
  };

  let written = atUrl('');
  writeStateToUrl({ ...state, usageTable: 'items' });
  assert.deepEqual(paramsOf(written[0]), {
    view: 'browser', family: 'singles', table: 'items', search: 'berry',
    sortBy: 'obtained', sortDir: 'asc',
  });

  written = atUrl('');
  writeStateToUrl({ ...state, usageTable: 'pokemon' });
  assert.deepEqual(paramsOf(written[0]), {
    view: 'browser', family: 'singles', search: 'char', sortBy: 'usage',
    sortDir: 'desc', format: 'gen7ou', pokemon: 'charizard',
  });

  // The move table at its defaults adds only its learner floor.
  written = atUrl('');
  writeStateToUrl({ ...state, usageTable: 'moves' });
  assert.deepEqual(paramsOf(written[0]), {
    view: 'browser', family: 'singles', table: 'moves', minLearners: '50',
  });

  // Another view writes none of them.
  written = atUrl('');
  writeStateToUrl({ ...state, view: 'resolver', resolverQuery: 'gengar' });
  assert.deepEqual(paramsOf(written[0]), {
    view: 'resolver', family: 'singles', resolverQuery: 'gengar',
  });
});

test('a header click reverses its column or opens another', () => {
  const items = usageTableById('items');
  const opened = DEFAULT_STATE.tables.items;
  assert.deepEqual(opened, { search: '', sortBy: 'carry', sortDir: 'desc' });
  assert.deepEqual(nextSort(items, opened, 'carry'), {
    sortBy: 'carry', sortDir: 'asc',
  });
  // A count opens high-first, a name or a badge low-first.
  assert.deepEqual(nextSort(items, opened, 'top'), {
    sortBy: 'top', sortDir: 'desc',
  });
  assert.deepEqual(nextSort(items, opened, 'obtained'), {
    sortBy: 'obtained', sortDir: 'asc',
  });
});
