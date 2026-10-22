// An attack earns a fill slot where it raises the set's best damage into a
// defensive typing the game's dex contains, pairs included. Judged on single
// types alone, Skuntank's Flamethrower (a 90-power special move off an
// uninvested special side) rounds one point under Night Slash into pure
// Steel and never seats, although it doubles Night Slash into Steel/Fairy
// and quadruples it into Bug/Steel.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  bestChoice,
  progressionAt,
  runPool,
} from './helpers/harness.mjs';

const { dex } = await import('../src/games/dex.js');
const { analysisTypes, defensiveTypings } = await import(
  '../src/playthrough/type-chart.js',
);
const { coverageDamageIntoType } = await import(
  '../src/teamBuilder/damage-model.js',
);
const { buildCandidateLegalityProfile } = await import(
  '../src/teamBuilder/team-analysis.js',
);

test('the defensive typings are every type alone plus every dex pair', () => {
  const typings = defensiveTypings();
  const pairKeys = Object.keys(dex().typeCombinationShares)
    .filter((key) => key.includes('/'));
  assert.equal(typings.length, analysisTypes().length + pairKeys.length);
  for (const type of analysisTypes()) {
    assert.ok(typings.some((t) => t.length === 1 && t[0] === type), type);
  }
  const key = (typing) => typing.join('/');
  assert.ok(typings.some((t) => key(t) === 'Steel/Fairy'));
  assert.ok(!typings.some((t) => key(t) === 'Fairy/Steel'));
  // Cached: the same bundle returns the same array.
  assert.equal(defensiveTypings(), typings);
});

test('damage into a pair multiplies both halves, immunities and all', () => {
  const into = (type, damage, typing, ability = null) =>
    coverageDamageIntoType('move', type, damage, typing, ability);
  assert.equal(into('Fire', 28, ['Steel', 'Fairy']), 56);
  assert.equal(into('Dark', 57, ['Steel', 'Fairy']), 28.5);
  assert.equal(into('Fire', 28, ['Bug', 'Steel']), 112);
  assert.equal(into('Electric', 40, ['Water', 'Ground']), 0);
  // A single type still reads as before, string or one-element array.
  assert.equal(into('Fire', 28, 'Steel'), 56);
  assert.equal(into('Fire', 28, ['Steel']), 56);
  // Scrappy sees through the Ghost half only; Steel still resists Normal.
  assert.equal(into('Normal', 50, ['Ghost', 'Steel'], 'Scrappy'), 25);
  assert.equal(into('Normal', 50, ['Ghost'], 'Scrappy'), 50);
  // Fixed damage ignores multipliers but not an immunity in either half.
  assert.equal(
    coverageDamageIntoType('seismictoss', 'Fighting', 35, ['Normal', 'Ghost']),
    0,
  );
  assert.equal(
    coverageDamageIntoType('seismictoss', 'Fighting', 35, ['Rock', 'Steel']),
    35,
  );
});

test('Skuntank seats Flamethrower for the pairs that resist Dark', () => {
  const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
  const profile = buildCandidateLegalityProfile({
    member: { id: 'skuntank', name: 'Skuntank', types: ['Poison', 'Dark'] },
    moves: ['bite', 'nightslash', 'slash', 'flamethrower', 'acidspray', 'feint']
      .map(legal),
    levelCap: 35,
    ability: 'Aftermath',
    investmentSide: 'physical',
    spread: 'Jolly:4/252/0/0/0/252',
  });
  const ids = profile.recommendedMoves.map((move) => move.id);
  assert.ok(ids.includes('flamethrower'), ids);
  assert.ok(ids.includes('nightslash'), ids);
  const nightSlash = profile.recommendedMoves.find((m) => m.id === 'nightslash');
  const flamethrower = profile.recommendedMoves.find(
    (m) => m.id === 'flamethrower',
  );
  // Into pure Steel the Fire move still lands under Night Slash; the seat
  // comes from the pairs.
  assert.ok(
    coverageDamageIntoType(
      'flamethrower', 'Fire', flamethrower.estimatedDamage, 'Steel') <
    nightSlash.estimatedDamage,
  );
  assert.ok(
    coverageDamageIntoType(
      'flamethrower', 'Fire', flamethrower.estimatedDamage, ['Steel', 'Fairy'],
    ) >
    coverageDamageIntoType(
      'nightslash', 'Dark', nightSlash.estimatedDamage, ['Steel', 'Fairy']),
  );
});

test('the real Skuntank at badge 2 carries Flamethrower', async () => {
  const result = await runPool({
    pool: ['Stunky'],
    progression: progressionAt({ badge: 2, levelCap: 35 }),
  });
  const choice = bestChoice(result, 'Stunky');
  const ids = choice.legalityProfile.recommendedMoves.map((move) => move.id);
  assert.ok(ids.includes('flamethrower'), ids);
});
