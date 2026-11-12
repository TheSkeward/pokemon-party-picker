// The Move Usage table: rows are the family's move usage table joined with
// the game's move data, then cut by the learner floor and the search, and
// sorted.
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadShared } from './helpers/harness.mjs';

const { loadMoveUsage } = await import('../src/data.js');
const { buildMoveUsageRows, selectMoveUsageRows } = await import(
  '../src/views/move-usage-view.js',
);

const rows = [
  { id: 'a', name: 'Aqua Jet', type: 'Water', category: 'Physical', prior: 30, learners: 12, carry: 1 },
  { id: 'b', name: 'Bulk Up', type: 'Fighting', category: 'Status', prior: 30, learners: 40, carry: 2 },
  { id: 'c', name: 'Core Enforcer', type: 'Dragon', category: 'Special', prior: 99, learners: 1, carry: 0.1 },
  { id: 'd', name: 'Dive', type: 'Water', category: 'Physical', prior: 2, learners: 90, carry: 0.5 },
];
const names = (selected) => selected.map((row) => row.name);

test('the move table keeps moves at the learner floor, searches and sorts', () => {
  // Highest share first; equal shares put the move more Pokémon learn first.
  assert.deepEqual(names(selectMoveUsageRows(rows)), [
    'Core Enforcer', 'Bulk Up', 'Aqua Jet', 'Dive',
  ]);
  // The floor drops the signature move that would otherwise lead.
  assert.deepEqual(
    names(selectMoveUsageRows(rows, { minLearners: 10 })),
    ['Bulk Up', 'Aqua Jet', 'Dive'],
  );
  assert.deepEqual(
    names(selectMoveUsageRows(rows, { sortBy: 'learners', sortDir: 'asc' })),
    ['Core Enforcer', 'Aqua Jet', 'Bulk Up', 'Dive'],
  );
  // A search reads the name anywhere and the start of a type or category.
  assert.deepEqual(names(selectMoveUsageRows(rows, { search: 'wat' })), [
    'Aqua Jet', 'Dive',
  ]);
  assert.deepEqual(names(selectMoveUsageRows(rows, { search: 'status' })), [
    'Bulk Up',
  ]);
  assert.deepEqual(names(selectMoveUsageRows(rows, { search: ' ive ' })), [
    'Dive',
  ]);
});

test('a family table becomes named, typed rows', async () => {
  await loadShared();
  const table = await loadMoveUsage('singles');
  const built = buildMoveUsageRows(table);
  assert.equal(built.length, Object.keys(table.moves).length);
  const spin = built.find((row) => row.id === 'rapidspin');
  assert.deepEqual(
    { name: spin.name, type: spin.type, category: spin.category },
    { name: 'Rapid Spin', type: 'Normal', category: 'Physical' },
  );
  assert.equal(spin.prior, table.moves.rapidspin.prior);
  assert.equal(spin.learners, table.moves.rapidspin.learners);
  // A family with no table is an answer, not an error.
  assert.equal(await loadMoveUsage('no-such-family'), null);
});
