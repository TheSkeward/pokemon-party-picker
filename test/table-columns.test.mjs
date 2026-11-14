// A column of figures is named on its cells ("num"), in the header and in
// every row, so the stylesheet aligns it by what it holds. Styling columns
// by position put the wrong rule on the wrong column when one was dropped,
// and right-aligned and greyed the set panel that opens under a team row,
// whose one cell stood where the rank does.
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadShared } from './helpers/harness.mjs';

const { loadItemUsage, loadMoveUsage } = await import('../src/data.js');
const { defaultTableState } = await import('../src/views/table-parts.js');
const { ITEM_USAGE_TABLE, renderItemUsageTable } = await import(
  '../src/views/item-usage-view.js',
);
const { MOVE_USAGE_TABLE, renderMoveUsageTable } = await import(
  '../src/views/move-usage-view.js',
);
const { POKEMON_USAGE_TABLE, renderPokemonUsageTable } = await import(
  '../src/views/pokemon-usage-view.js',
);
const { renderResolverResults } = await import(
  '../src/views/resolver-results-view.js',
);

await loadShared();

// Whether each cell of a row is a figure, read from its class.
const figures = (rowHtml, tag) =>
  [...rowHtml.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'g'))]
    .map(([, attrs]) => /class="[^"]*\bnum\b/.test(attrs));

// The header's figure columns and each body row's, for one rendered table.
function columnsOf(html) {
  const head = /<thead>([\s\S]*?)<\/thead>/.exec(html)[1];
  const body = /<tbody>([\s\S]*?)<\/tbody>/.exec(html)[1];
  const rows = body.split(/<tr\b/).slice(1);
  assert.ok(rows.length, 'the table has rows');
  return {
    head: figures(head, 'th'),
    rows: rows.map((row) => figures(row, 'td')),
  };
}

function assertColumns(html, expected) {
  const { head, rows } = columnsOf(html);
  assert.deepEqual(head, expected, 'header');
  for (const row of rows) assert.deepEqual(row, expected, 'row');
}

const render = (renderTable, ...args) => {
  const container = { innerHTML: '' };
  renderTable(container, ...args);
  return container.innerHTML;
};
const stateFor = (table, extra = {}) => ({
  tables: { [table.id]: defaultTableState(table) }, ...extra,
});

test('the Pokémon table: rank and the three figures', () => {
  const rows = [
    { pokemonId: 'gengar', name: 'Gengar', rank: 1, usage: 7.73,
      leadTendency: 15.3, rawCount: 120000 },
    { pokemonId: 'togekiss', name: 'Togekiss', rank: 2, usage: 0.33,
      leadTendency: 12.4, rawCount: 4000 },
  ];
  const html = render(
    renderPokemonUsageTable, rows,
    stateFor(POKEMON_USAGE_TABLE, { selectedPokemon: null }));
  assertColumns(html, [true, false, true, true, true]);
  // The rank is marked as one, on its cell alone.
  assert.equal(html.split('class="num rank"').length - 1, rows.length);
});

test('the move table: its last three columns', async () => {
  const html = render(
    renderMoveUsageTable, await loadMoveUsage('singles'),
    stateFor(MOVE_USAGE_TABLE, { moveMinLearners: 5 }));
  assertColumns(html, [false, false, false, false, true, true, true]);
});

test('the item table: its last two columns', async () => {
  const html = render(
    renderItemUsageTable, await loadItemUsage('singles'),
    stateFor(ITEM_USAGE_TABLE));
  assertColumns(html, [false, false, true, true]);
});

test('Set Lookup: usage and lead rate', () => {
  const row = (pokemonId, value) => ({
    pokemonId, name: pokemonId, inputName: pokemonId,
    bundle: {
      usage: { selection: 'all', formatId: 'gen7ou', cutoff: 1825, value },
      leads: { value: 12.5 }, ranking: null, trace: null,
    },
  });
  const html = render(
    renderResolverResults,
    [row('gengar', 7.7), row('togekiss', 0.3)],
    { resolverQuery: 'gengar, togekiss', resolverSelectedPokemon: null },
    [{ id: 'gen7ou', label: 'Gen 7 OU' }],
    'All available');
  assertColumns(html, [false, true, true, false]);
});
