// The Item Usage table: a family's item usage table (built from its set
// index) joined with the game's held-item names and each item's supply,
// then cut by the search and sorted.
import assert from 'node:assert/strict';
import test from 'node:test';

import { computeItemUsage } from '../scripts/item-usage/compute.mjs';
import { loadShared } from './helpers/harness.mjs';

const { loadItemUsage } = await import('../src/data.js');
const { buildItemUsageRows, selectItemUsageRows } = await import(
  '../src/views/item-usage-view.js',
);

// One supply step: a counted copy, or the source that restocks.
const copy = (badge, copies) =>
  ({ badge, copies, source: { kind: 'single', badge, via: '' } });
const restock = (kind, badge) =>
  ({ badge, copies: Infinity, source: { kind, badge, via: '' } });
const rows = [
  { id: 'a', name: 'Assault Vest', supply: [copy(14, 1)], carry: 3, top: 20 },
  { id: 'b', name: 'Berry Juice', supply: [], carry: 3, top: 25 },
  { id: 'c', name: 'Choice Scarf', supply: [copy(16, 1), restock('shop', 18)], carry: 7, top: 80 },
  { id: 'd', name: 'Damp Rock', supply: [restock('wild', 3)], carry: 1, top: 2 },
  { id: 'e', name: 'Electric Seed', supply: [], carry: 0.5, top: 0 },
];
const names = (selected) => selected.map((row) => row.name);

test('item usage counts every Pokémon equally and names each top item', () => {
  const set = (pokemonId, usage) => ({
    pokemonId, usage: new Map(Object.entries(usage)),
  });
  const { pokemon, items } = computeItemUsage([
    set('snorlax', { leftovers: 90, choiceband: 10 }),
    set('gengar', { lifeorb: 50, leftovers: 30, focussash: 20 }),
    // Level on the top share: the first listed is the top item.
    set('ditto', { choicescarf: 50, leftovers: 50 }),
    // No item recorded: not a Pokémon whose sets the shares average over.
    set('unown', {}),
  ]);
  assert.equal(pokemon, 3);
  assert.deepEqual(items.leftovers, { carry: 56.67, top: 1 });
  assert.deepEqual(items.choicescarf, { carry: 16.67, top: 1 });
  assert.deepEqual(items.lifeorb, { carry: 16.67, top: 1 });
  assert.deepEqual(items.focussash, { carry: 6.67, top: 0 });
  assert.deepEqual(Object.keys(items), [...Object.keys(items)].sort());
});

test('the item table searches and sorts, untracked items last', () => {
  // Most held first; equal shares go by name.
  assert.deepEqual(names(selectItemUsageRows(rows)), [
    'Choice Scarf', 'Assault Vest', 'Berry Juice', 'Damp Rock',
    'Electric Seed',
  ]);
  assert.deepEqual(
    names(selectItemUsageRows(rows, { sortBy: 'top', sortDir: 'desc' })),
    ['Choice Scarf', 'Berry Juice', 'Assault Vest', 'Damp Rock',
      'Electric Seed'],
  );
  // Earliest first copy first. Items with no supply go last in both
  // directions, most held first.
  assert.deepEqual(
    names(selectItemUsageRows(rows, { sortBy: 'obtained', sortDir: 'asc' })),
    ['Damp Rock', 'Assault Vest', 'Choice Scarf', 'Berry Juice',
      'Electric Seed'],
  );
  assert.deepEqual(
    names(selectItemUsageRows(rows, { sortBy: 'obtained', sortDir: 'desc' })),
    ['Choice Scarf', 'Assault Vest', 'Damp Rock', 'Berry Juice',
      'Electric Seed'],
  );
  // A search reads the name anywhere and the start of the kind of source
  // that restocks it; a single copy is not one.
  assert.deepEqual(names(selectItemUsageRows(rows, { search: ' ce ' })), [
    'Choice Scarf', 'Berry Juice',
  ]);
  assert.deepEqual(names(selectItemUsageRows(rows, { search: 'shop' })), [
    'Choice Scarf',
  ]);
  assert.deepEqual(names(selectItemUsageRows(rows, { search: 'wi' })), [
    'Damp Rock',
  ]);
  assert.deepEqual(names(selectItemUsageRows(rows, { search: 'single' })), []);
  const planted = { id: 'f', name: 'Figy Berry', supply: [restock('regrow', 13)], carry: 0.1, top: 0 };
  assert.deepEqual(
    names(selectItemUsageRows([...rows, planted], { search: 'Regrows' })),
    ['Figy Berry'],
  );
});

test("a row names the item and the game's supply of it", async () => {
  await loadShared();
  const table = await loadItemUsage('singles');
  const built = buildItemUsageRows(table);
  assert.equal(built.length, Object.keys(table.items).length);
  const row = (id) => built.find((entry) => entry.id === id);
  const supply = (id) => row(id).supply.map(({ badge, copies, source }) =>
    [badge, copies, source.kind]);
  // Reborn hands out one Life Orb after badge 16 and sells it from 17.
  assert.deepEqual(
    { ...row('lifeorb'), supply: supply('lifeorb') },
    {
      id: 'lifeorb',
      name: 'Life Orb',
      supply: [[16, 1, 'single'], [17, Infinity, 'shop']],
      uncounted: false,
      carry: table.items.lifeorb.carry,
      top: table.items.lifeorb.top,
    },
  );
  // One Assault Vest until the post-game point counter.
  assert.deepEqual(
    supply('assaultvest'), [[14, 1, 'single'], [18, Infinity, 'shop']]);
  // Mined from the badge the Mining Kit arrives, but sold a badge sooner.
  assert.deepEqual(supply('lightclay'), [[2, Infinity, 'shop']]);
  // Reborn replaces the terrain seeds, so its data tracks none.
  assert.deepEqual(supply('electricseed'), []);
  assert.equal(row('electricseed').uncounted, false);
  // A family with no table is an answer, not an error.
  assert.equal(await loadItemUsage('no-such-family'), null);
});
