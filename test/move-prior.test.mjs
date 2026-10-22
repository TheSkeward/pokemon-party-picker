// The measured utility prior: how often learners of a move run it across the
// ladder. It admits a utility move the mon's own record is silent on, and
// orders such moves, with a floor so a mon with nothing credited seats
// nothing rather than filler. The mon's own usage always outranks it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import { computeMovePrior } from '../scripts/move-prior/compute.mjs';
import {
  UTILITY_PRIOR_FLOOR,
  loadMovePrior,
  movePriorOf,
  setMovePrior,
} from '../src/teamBuilder/move-prior.js';
import {
  buildCandidateLegalityProfile,
} from '../src/teamBuilder/team-analysis.js';

test('the prior is the equal-weight mean over learners, to one decimal', () => {
  const sets = [
    { pokemonId: 'a', usage: new Map([['recover', 90], ['toxic', 10]]) },
    { pokemonId: 'b', usage: new Map([['recover', 30]]) },
    // No learnset: skipped, and its moves count for nothing.
    { pokemonId: 'c', usage: new Map([['recover', 100], ['spore', 100]]) },
  ];
  const learnsets = new Map([
    ['a', new Set(['recover', 'toxic', 'protect'])],
    ['b', new Set(['recover', 'protect'])],
  ]);
  const { pokemon, moves } = computeMovePrior(sets, learnsets);
  assert.equal(pokemon, 2);
  assert.deepEqual(moves.recover, { prior: 60, learners: 2 });
  assert.deepEqual(moves.toxic, { prior: 10, learners: 1 });
  // Learnable, never run: a real zero, not an absence.
  assert.deepEqual(moves.protect, { prior: 0, learners: 2 });
  assert.equal(moves.spore, undefined);
  assert.deepEqual(Object.keys(moves), ['protect', 'recover', 'toxic']);
});

test('the committed singles table reads as the ladder plays', async () => {
  // The harness shims fetch to the committed data; here the preload has
  // already installed the same table, and loading it again agrees.
  await import('./helpers/harness.mjs');
  const table = await loadMovePrior('singles');
  assert.ok(table.size > 500, `${table.size} moves`);
  assert.ok(movePriorOf('spore') > 50, movePriorOf('spore'));
  assert.ok(movePriorOf('recover') > movePriorOf('toxic'));
  assert.ok(movePriorOf('toxic') > movePriorOf('thunderwave'));
  assert.ok(movePriorOf('rapidspin') > 30, movePriorOf('rapidspin'));
  assert.ok(movePriorOf('confide') < UTILITY_PRIOR_FLOOR);
  assert.equal(movePriorOf('notamove'), 0);
});

test('an unrecorded utility move seats on the prior, under a floor', () => {
  // Four attacks that each earn a slot by coverage and two status moves with
  // no usage on this mon: the utility seat before the fill goes to whichever
  // status move the prior admits, and when neither clears the floor the set
  // is four attacks.
  const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
  const tauros = { id: 'tauros', name: 'Tauros', types: ['Normal'] };
  const moves = [
    'return', 'earthquake', 'firepunch', 'icepunch', 'protect', 'reflect',
  ].map(legal);
  const setFor = (prior) => {
    const previous = setMovePrior(prior);
    try {
      const profile = buildCandidateLegalityProfile({
        member: tauros, moves, levelCap: 35,
      });
      return new Set(profile.recommendedMoves.map((move) => move.id));
    } finally {
      setMovePrior(previous);
    }
  };
  assert.deepEqual(
    setFor(new Map([['protect', 5], ['reflect', 2]])),
    new Set(['return', 'protect', 'earthquake', 'firepunch']),
  );
  assert.deepEqual(
    setFor(new Map([['protect', 0.5], ['reflect', 2]])),
    new Set(['return', 'reflect', 'earthquake', 'firepunch']),
  );
  assert.deepEqual(
    setFor(new Map([['protect', 0.9], ['reflect', 0.9]])),
    new Set(['return', 'earthquake', 'firepunch', 'icepunch']),
  );
});

test('the mon\'s own usage outranks the prior', () => {
  const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
  const tauros = { id: 'tauros', name: 'Tauros', types: ['Normal'] };
  const moves = [
    'return', 'earthquake', 'firepunch', 'icepunch', 'protect', 'reflect',
  ].map(legal);
  const previous = setMovePrior(new Map([['protect', 50], ['reflect', 2]]));
  try {
    const profile = buildCandidateLegalityProfile({
      member: tauros, moves, levelCap: 35,
      moveUsage: new Map([['reflect', 3]]),
    });
    const ids = new Set(profile.recommendedMoves.map((move) => move.id));
    assert.ok(ids.has('reflect') && !ids.has('protect'), [...ids]);
  } finally {
    setMovePrior(previous);
  }
});
