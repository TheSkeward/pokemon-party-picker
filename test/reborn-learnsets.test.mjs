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
});

test('a forme with no form entry is in the game only as the default form', () => {
  // Reborn has no Large Gourgeist, no Ash-Greninja (its Battle Bond raises
  // stats), no Eternal Floette and no totems. Nor has it what the dex splits
  // off and the game does not tell apart: a cap Pikachu, or the Own Tempo
  // Rockruff.
  for (const id of [
    'gourgeistlarge', 'pumpkaboolarge', 'greninjaash', 'floetteeternal',
    'raticatealolatotem', 'marowakalolatotem', 'kommoototem',
    'pikachuoriginal', 'pikachualola', 'rockruffdusk',
  ]) {
    assert.equal(learnsets[id], undefined, id);
    assert.throws(() => legalMoves(id), /ENOENT/, id);
  }
});

test('a form evolves from the pre-evolution the game has for it', async () => {
  // Any Rockruff becomes Lycanroc-Dusk when it evolves between 19:00 and
  // 20:00 (Evolution.rb); the dex gives that form to an Own Tempo Rockruff.
  const { GEN7_PROGRESSION_SPECIES: species } = await import(
    '../src/generated/gen7ProgressionSpecies.generated.js',
  );
  const { LINE_REPRESENTATIVE_CANDIDATES: lines } = await import(
    '../src/generated/gen7LineRepresentativeCandidates.generated.js',
  );
  assert.equal(species.lycanrocdusk.prevoId, 'rockruff');
  assert.deepEqual(
    species.rockruff.evos, ['lycanroc', 'lycanrocmidnight', 'lycanrocdusk']);
  assert.deepEqual(
    lines.rockruff.map((member) => member.id),
    ['rockruff', 'lycanroc', 'lycanrocdusk', 'lycanrocmidnight'],
  );
  const rockruffMoves = legalMoves('lycanrocdusk').flatMap(
    (move) => move.sources.preEvolutionLevelUp || []);
  assert.ok(rockruffMoves.length > 0);
  assert.ok(rockruffMoves.every((entry) => entry.from === 'rockruff'));
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
