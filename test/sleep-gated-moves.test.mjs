// Snore and Sleep Talk work only while the user sleeps, so a set earns them
// only by carrying Rest, or on a Comatose user. The gate reads the set being
// built, live: a Rest seated earlier enables them, a Rest merely legal does
// not. Before the gate covered Sleep Talk, a badge-3 Ampharos with no Rest
// before TM44 was handed Sleep Talk as its fourth move.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  buildCandidateLegalityProfile,
  isUsableDamagingMove,
} from '../src/teamBuilder/team-analysis.js';
import { runPool } from './helpers/harness.mjs';

const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
const idsOf = (profile) => profile.recommendedMoves.map((move) => move.id);
const BUILDS = ['default', 'coverage', 'utility'];
const buildAll = (member, moves, moveUsage, ability = null) =>
  BUILDS.map((movePreference) => [
    movePreference,
    idsOf(buildCandidateLegalityProfile({
      member, moves, moveUsage, ability, levelCap: 40, movePreference,
    })),
  ]);

const ampharos = { id: 'ampharos', name: 'Ampharos', types: ['Electric'] };

test('Snore is a usable attack only with Rest in the set or Comatose', () => {
  const snore = legal('snore');
  assert.equal(isUsableDamagingMove(snore, [snore], null), false);
  assert.equal(isUsableDamagingMove(snore, [snore, legal('rest')], null), true);
  assert.equal(isUsableDamagingMove(snore, [snore], null, 'Comatose'), true);
});

test('Sleep Talk without Rest seats in no build', () => {
  const moves = ['thunderbolt', 'powergem', 'sleeptalk', 'snore'].map(legal);
  // Canonical Sleep Talk, and nothing else to fill the slots it would take.
  const moveUsage = new Map([
    ['thunderbolt', 90], ['sleeptalk', 60], ['powergem', 40],
  ]);
  for (const [build, ids] of buildAll(ampharos, moves, moveUsage)) {
    assert.ok(!ids.includes('sleeptalk'), `${build}: ${ids}`);
    assert.ok(!ids.includes('snore'), `${build}: ${ids}`);
  }
});

test('a canonical Rest ahead of Sleep Talk seats both in every build', () => {
  const moves = ['thunderbolt', 'rest', 'sleeptalk'].map(legal);
  const moveUsage = new Map([
    ['rest', 90], ['sleeptalk', 85], ['thunderbolt', 80],
  ]);
  for (const [build, ids] of buildAll(ampharos, moves, moveUsage)) {
    assert.ok(ids.includes('rest') && ids.includes('sleeptalk'),
      `${build}: ${ids}`);
  }
});

test('Sleep Talk ranked above Rest seats once Rest has', () => {
  const moves = ['thunderbolt', 'rest', 'sleeptalk'].map(legal);
  const moveUsage = new Map([
    ['sleeptalk', 90], ['rest', 85], ['thunderbolt', 80],
  ]);
  for (const [build, ids] of buildAll(ampharos, moves, moveUsage)) {
    assert.ok(ids.includes('rest') && ids.includes('sleeptalk'),
      `${build}: ${ids}`);
  }
});

test('Comatose seats Sleep Talk and Snore without Rest', () => {
  const komala = { id: 'komala', name: 'Komala', types: ['Normal'] };
  const moves = ['woodhammer', 'sleeptalk', 'snore'].map(legal);
  const moveUsage = new Map([
    ['woodhammer', 90], ['sleeptalk', 60], ['snore', 30],
  ]);
  const [[build, ids]] = buildAll(komala, moves, moveUsage, 'Comatose');
  assert.ok(ids.includes('sleeptalk') && ids.includes('snore'),
    `${build}: ${ids}`);
});

test('a badge-3 Mareep line carries Sleep Talk only beside Rest', async () => {
  // Rest's TM arrives after badge 5 and Sleep Talk's after badge 2.
  const result = await runPool({ pool: ['Mareep'], badge: 3, levelCap: 40 });
  const sets = [];
  for (const line of result.lines) {
    for (const choice of [line.best, line.bestNonMega].filter(Boolean)) {
      for (const build of choice.buildAlternatives || [choice]) {
        const ids = idsOf(build.legalityProfile);
        sets.push([choice.pokemonId, build.buildKey, ids]);
      }
    }
  }
  for (const row of result.team) {
    sets.push([row.pokemonId, row.buildKey, idsOf(row.legalityProfile)]);
  }
  assert.ok(sets.length > 0);
  for (const [pokemonId, build, ids] of sets) {
    assert.ok(!ids.includes('sleeptalk') || ids.includes('rest'),
      `${pokemonId} ${build}: ${ids}`);
  }
});
