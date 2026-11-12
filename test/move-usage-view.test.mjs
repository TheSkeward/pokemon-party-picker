// The Move Usage table: rows are the family's move usage table joined with
// the game's move data and its machines and tutors, then cut by the learner
// floor and the search, and sorted.
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadShared } from './helpers/harness.mjs';

const { loadMoveUsage } = await import('../src/data.js');
const { teachingRoutesByMove } = await import('../src/games/legality.js');
const { buildMoveUsageRows, selectMoveUsageRows } = await import(
  '../src/views/move-usage-view.js',
);

const route = (kind, label, badge) => ({ kind, label, badge });
const rows = [
  { id: 'a', name: 'Aqua Jet', type: 'Water', category: 'Physical', taught: [], prior: 30, learners: 12, carry: 1 },
  { id: 'b', name: 'Bulk Up', type: 'Fighting', category: 'Status', taught: [route('tm', 'TM08', 14)], prior: 30, learners: 40, carry: 2 },
  { id: 'c', name: 'Core Enforcer', type: 'Dragon', category: 'Special', taught: [], prior: 99, learners: 1, carry: 0.1 },
  { id: 'd', name: 'Dive', type: 'Water', category: 'Physical', taught: [route('tmx', 'TMX6', 10)], prior: 2, learners: 90, carry: 0.5 },
  { id: 'e', name: 'Endeavor', type: 'Normal', category: 'Physical', taught: [route('tutor', 'Tutor', 4)], prior: 5, learners: 60, carry: 0.3 },
];
const names = (selected) => selected.map((row) => row.name);

test('the move table keeps moves at the learner floor, searches and sorts', () => {
  // Highest share first; equal shares put the move more Pokémon learn first.
  assert.deepEqual(names(selectMoveUsageRows(rows)), [
    'Core Enforcer', 'Bulk Up', 'Aqua Jet', 'Endeavor', 'Dive',
  ]);
  // The floor drops the signature move that would otherwise lead.
  assert.deepEqual(
    names(selectMoveUsageRows(rows, { minLearners: 10 })),
    ['Bulk Up', 'Aqua Jet', 'Endeavor', 'Dive'],
  );
  assert.deepEqual(
    names(selectMoveUsageRows(rows, { sortBy: 'learners', sortDir: 'asc' })),
    ['Core Enforcer', 'Aqua Jet', 'Bulk Up', 'Endeavor', 'Dive'],
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

test('the move table searches and sorts by what teaches a move', () => {
  // The start of a route's label: every machine, one machine, the tutors.
  assert.deepEqual(names(selectMoveUsageRows(rows, { search: 'tm' })), [
    'Bulk Up', 'Dive',
  ]);
  assert.deepEqual(names(selectMoveUsageRows(rows, { search: 'tm08' })), [
    'Bulk Up',
  ]);
  assert.deepEqual(names(selectMoveUsageRows(rows, { search: 'tutor' })), [
    'Endeavor',
  ]);
  // Earliest badge first. Moves nothing teaches go last in both directions.
  assert.deepEqual(
    names(selectMoveUsageRows(rows, { sortBy: 'taught', sortDir: 'asc' })),
    ['Endeavor', 'Dive', 'Bulk Up', 'Aqua Jet', 'Core Enforcer'],
  );
  assert.deepEqual(
    names(selectMoveUsageRows(rows, { sortBy: 'taught', sortDir: 'desc' })),
    ['Bulk Up', 'Dive', 'Endeavor', 'Aqua Jet', 'Core Enforcer'],
  );
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

test("a row names the game's machine or tutor for its move", async () => {
  await loadShared();
  const built = buildMoveUsageRows(await loadMoveUsage('singles'));
  const taught = (id) => built.find((row) => row.id === id).taught;
  assert.deepEqual(taught('rapidspin'), []);
  assert.deepEqual(taught('toxic'), [{
    kind: 'tm',
    label: 'TM06',
    badge: 13,
    available: 'After Badge 13',
    location: 'Peridot Ward',
  }]);
  assert.deepEqual(taught('surf').map((entry) => entry.label), ['TMX3']);
  // Two tutors teach Giga Drain, after badges 2 and 13; the row names the
  // first.
  assert.deepEqual(
    teachingRoutesByMove().get('gigadrain').map((entry) => entry.badge),
    [2, 13],
  );
  assert.deepEqual(taught('gigadrain'), [{
    kind: 'tutor',
    label: 'Tutor',
    badge: 2,
    available: 'After Badge 02',
    location: 'Rhodochrine Jungle',
  }]);
});
