// What Set Lookup tells the reader beyond its rows: which typed names
// matched nothing, and, in the moveset panel it opens, a source that a run
// of rows shares said once over them. A design review found a misspelt
// name vanishing behind a count that looked complete, and "Related:
// Gengar (base)" repeated on eighteen item rows of nineteen.
import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.__ENV__ ??= { BASE_URL: '/' };
const { unmatchedQueryNames } = await import(
  '../src/resolver/representatives.js',
);
const { renderResolverResults } = await import(
  '../src/views/resolver-results-view.js',
);
const { renderMovesetPanel } = await import('../src/views/moveset-view.js');

const POKEMON_INDEX = [
  { id: 'gengar', name: 'Gengar' },
  { id: 'gengarmega', name: 'Gengar-Mega' },
  { id: 'togekiss', name: 'Togekiss' },
];

function resultsHtml(rows, status) {
  const container = { innerHTML: '' };
  renderResolverResults(
    container,
    rows,
    { resolverQuery: 'query', resolverSelectedPokemon: null },
    [],
    'All available',
    status,
  );
  return container.innerHTML;
}

function movesetHtml(movesetEntry) {
  const container = {
    innerHTML: '',
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  renderMovesetPanel(container, {
    selectedPokemonName: 'Gengar-Mega', movesetEntry, aggregate: true,
  });
  return container.innerHTML;
}

test('a typed name that matches no Pokémon is named, once, as typed', () => {
  assert.deepEqual(
    unmatchedQueryNames('gengar, Notapokemon\ntoge, Notapokemon', POKEMON_INDEX),
    ['Notapokemon']);
  assert.deepEqual(unmatchedQueryNames('gen, kiss', POKEMON_INDEX), []);
  assert.deepEqual(unmatchedQueryNames('  ', POKEMON_INDEX), []);
});

test('the results say which names were not recognised', () => {
  const row = {
    pokemonId: 'gengar', name: 'Gengar', inputName: 'Gengar',
    bundle: { usage: null, leads: null, ranking: null, trace: null },
  };
  const some = resultsHtml([row], { unmatched: ['notapokemon'] });
  assert.match(some, /1 Pokémon resolved/);
  assert.match(some, /Not recognised: notapokemon/);
  // With no row at all the names are the whole answer.
  const none = resultsHtml([], { unmatched: ['notapokemon', 'alsonot'] });
  assert.match(none, /Not recognised: notapokemon, alsonot/);
  assert.doesNotMatch(none, /No matching Pokémon found/);
  assert.doesNotMatch(resultsHtml([row], {}), /Not recognised/);
  // A name that opens its movesets reads as a link.
  assert.match(some, /<span class="row-link-name">Gengar<\/span>/);
});

test('a source shared by a run of additional options is said once', () => {
  const related = 'Related — Gengar (base form)';
  const html = movesetHtml({
    moves: [],
    abilities: [],
    spreads: [],
    items: [
      { name: 'Gengarite', usage: 100 },
      { name: 'Focus Sash', kind: 'additional', sourceText: related },
      { name: 'Leftovers', kind: 'additional', sourceText: related },
      { name: 'Life Orb', kind: 'additional', sourceText: 'Gen 7 OU' },
    ],
  });
  // The run's source joins the divider that opens the additional options…
  assert.match(
    html,
    /section-divider">Additional set options · Related · Gengar \(base\)</);
  // …and is on neither of its rows; a row alone keeps its own.
  assert.equal(html.split('Gengar (base)').length - 1, 1);
  assert.match(html, /Gen 7 OU/);
});

test('the method notes fold under one line', () => {
  const html = movesetHtml({
    moves: [], abilities: [], spreads: [], items: [],
  });
  assert.match(
    html,
    /<details class="moveset-method">\s*<summary>How these numbers are made<\/summary>\s*<p>Aggregated across/);
});
