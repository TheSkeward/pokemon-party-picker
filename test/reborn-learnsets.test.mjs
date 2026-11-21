// Reborn's learnset extraction (scripts/reborn/extract-reborn-learnsets.mjs):
// a forme with its own Reborn moveset gets that moveset, and a forme the game
// lacks is left out rather than handed the base species' learnset.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const { learnsets, defaultFormes } = JSON.parse(
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

test('a forme with no form entry stands only for a form that is it', () => {
  // Reborn has no Large Gourgeist, no Ash-Greninja (its Battle Bond raises
  // stats) and no Eternal Floette: no form of theirs has those stats. It
  // has no totems either: a totem has its species' stats at several times
  // the weight.
  for (const id of [
    'gourgeistlarge', 'pumpkaboolarge', 'greninjaash', 'floetteeternal',
    'raticatealolatotem', 'marowakalolatotem', 'kommoototem',
  ]) {
    assert.equal(learnsets[id], undefined, id);
    assert.throws(() => legalMoves(id), /ENOENT/, id);
  }
  // Own Tempo Rockruff is Reborn's Rockruff in all but ability, and
  // Lycanroc-Dusk's line runs through it.
  assert.deepEqual(learnsets.rockruffdusk, learnsets.rockruff);
});

test('the default form goes by the forme whose stats it has', () => {
  // Reborn's Pumpkaboo and Gourgeist come in two sizes: Small, and a default
  // with the stats the dex gives the Super size. The dex's default, the
  // Average size, is not in the game.
  assert.deepEqual(defaultFormes, {
    gourgeist: 'gourgeistsuper', pumpkaboo: 'pumpkaboosuper',
  });
  for (const id of ['gourgeist', 'pumpkaboo']) {
    assert.equal(learnsets[id], undefined, id);
  }
  for (const id of [
    'gourgeistsuper', 'gourgeistsmall', 'pumpkaboosuper', 'pumpkaboosmall',
  ]) {
    assert.ok(learnsets[id], id);
  }
});
