// Reborn's learnset extraction (scripts/reborn/extract-reborn-learnsets.mjs):
// a forme with its own Reborn moveset gets that moveset, and a forme the game
// lacks is left out rather than handed the base species' learnset.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const { learnsets } = JSON.parse(
  fs.readFileSync(
    path.resolve('scripts', 'reborn', 'reborn-learnsets.generated.json'),
    'utf8',
  ),
);
const levelUpMoves = (id) => learnsets[id].levelUp.map(([, move]) => move);
const legalMoves = (id) =>
  JSON.parse(
    fs.readFileSync(
      path.resolve('site-data', 'data', 'reborn-legal-moves', 'all', `${id}.json`),
      'utf8',
    ),
  ).moves;

test('a forme named with its species takes its own moveset', () => {
  // Reborn calls the forms "Hoopa Confined" and "Hoopa Unbound".
  assert.ok(levelUpMoves('hoopaunbound').includes('hyperspacefury'));
  assert.ok(!levelUpMoves('hoopaunbound').includes('hyperspacehole'));
  assert.ok(levelUpMoves('hoopa').includes('hyperspacehole'));
  assert.ok(levelUpMoves('kyuremwhite').includes('iceburn'));
  assert.ok(legalMoves('hoopaunbound').some((move) => move.id === 'hyperspacefury'));
});

test('formes Reborn lacks are absent, not given the base learnset', () => {
  for (const id of ['arcaninehisui', 'zapdosgalar', 'wooperpaldea', 'dialgaorigin']) {
    assert.equal(learnsets[id], undefined, id);
  }
  // Formes that share the base learnset still resolve to it.
  assert.ok(learnsets.venusaurmega);
  assert.ok(learnsets.pikachuoriginal);
});
