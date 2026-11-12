// The Item Usage table: a family's item usage table (built from its set
// index) joined with the game's held-item names and item sources, then cut
// by the search and sorted.
import assert from 'node:assert/strict';
import test from 'node:test';

import { computeItemUsage } from '../scripts/item-usage/compute.mjs';
import { loadShared } from './helpers/harness.mjs';

const { loadItemUsage } = await import('../src/data.js');
const { getItemSource } = await import('../src/games/items.js');
const { buildItemUsageRows, selectItemUsageRows } = await import(
  '../src/views/item-usage-view.js',
);

const source = (badge, renewable = null) => ({ badge, via: '', renewable });
const rows = [
  { id: 'a', name: 'Assault Vest', source: source(14), carry: 3, top: 20 },
  { id: 'b', name: 'Berry Juice', source: null, carry: 3, top: 25 },
  { id: 'c', name: 'Choice Scarf', source: source(18, { kind: 'shop', badge: 18 }), carry: 7, top: 80 },
  { id: 'd', name: 'Damp Rock', source: source(3, { kind: 'mining', badge: 3 }), carry: 1, top: 2 },
  { id: 'e', name: 'Electric Seed', source: null, carry: 0.5, top: 0 },
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
  // Earliest badge first. Items the game does not track go last in both
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
  // A search reads the name anywhere and the start of what restocks it.
  assert.deepEqual(names(selectItemUsageRows(rows, { search: ' ce ' })), [
    'Choice Scarf', 'Berry Juice',
  ]);
  assert.deepEqual(names(selectItemUsageRows(rows, { search: 'shop' })), [
    'Choice Scarf',
  ]);
  assert.deepEqual(names(selectItemUsageRows(rows, { search: 'min' })), [
    'Damp Rock',
  ]);
});

test("a row names the item and the game's source for it", async () => {
  await loadShared();
  const table = await loadItemUsage('singles');
  const built = buildItemUsageRows(table);
  assert.equal(built.length, Object.keys(table.items).length);
  const row = (id) => built.find((entry) => entry.id === id);
  // Reborn hands out one Leftovers after badge 13 and sells it from 17.
  assert.deepEqual(row('leftovers'), {
    id: 'leftovers',
    name: 'Leftovers',
    source: {
      badge: 13,
      via: 'npc',
      renewable: { kind: 'shop', badge: 17 },
    },
    carry: table.items.leftovers.carry,
    top: table.items.leftovers.top,
  });
  // A one-off pickup has nothing to restock it.
  assert.deepEqual(row('assaultvest').source, {
    badge: 14, via: 'poké ball', renewable: null,
  });
  // Mined from the badge the Mining Kit arrives, but sold a badge sooner.
  assert.deepEqual(row('lightclay').source, {
    badge: 2, via: 'shop', renewable: { kind: 'shop', badge: 2 },
  });
  // Reborn replaces the terrain seeds, so its data tracks none.
  assert.equal(row('electricseed').source, null);
  assert.equal(getItemSource('notanitem'), null);
  // A family with no table is an answer, not an error.
  assert.equal(await loadItemUsage('no-such-family'), null);
});
