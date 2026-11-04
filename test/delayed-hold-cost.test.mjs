// Holding a level evolution to learn a pre-evolution's move costs the levels
// held, each dearer than the last, not a flat sum. Five levels of Stufful
// for Hammer Arm is a short grind and the delayed set headlines on a modest
// gain; seventeen levels of Mareep for Discharge is a long stretch fought as
// a Mareep, and the default set keeps the headline.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestChoice,
  progressionAt,
  runPool,
} from './helpers/harness.mjs';

const { getAvailableMoves, loadLegalMoveData } = await import(
  '../src/playthrough/legal-moves.js',
);
const { SCORING_DEFAULTS } = await import(
  '../src/teamBuilder/scoring-constants.js',
);

test('a delayed route says how many levels the evolution is held', async () => {
  const forretress = await loadLegalMoveData('forretress');
  const explosion = getAvailableMoves(forretress, { levelCap: '35' })
    .find((move) => move.id === 'explosion');
  const source = explosion.availableSources[0];
  assert.equal(source.delayedEvolution, true);
  assert.equal(source.learnerId, 'pineco');
  // Pineco evolves at 31 and learns Explosion at 34.
  assert.equal(source.heldLevels, 3);
  assert.match(source.sourceTitle, /3 levels past its evolution/);

  const staraptor = await loadLegalMoveData('staraptor');
  const braveBird = getAvailableMoves(staraptor, { levelCap: '40' })
    .find((move) => move.id === 'bravebird');
  // Starly evolves at 14 and learns Brave Bird at 37.
  assert.equal(braveBird.availableSources[0].heldLevels, 23);
});

test('a five-level hold for Hammer Arm headlines; seventeen for Discharge does not', async () => {
  // The hold's cost alone decides here; the hedge margin is zeroed so the
  // delayed set competes on score, which hedge-build-margin.test.mjs
  // covers.
  const result = await runPool({
    pool: ['Stufful', 'Mareep'],
    progression: progressionAt({ badge: 2, levelCap: 35 }),
    overrides: { HEDGE_BUILD_MARGIN: 0 },
  });
  const bewear = bestChoice(result, 'Stufful');
  assert.equal(bewear.buildKey, 'delayed', bewear.buildLabel);
  assert.match(bewear.buildLabel, /Hammer Arm; Stufful to 32/);
  const ids = bewear.legalityProfile.recommendedMoves.map((m) => m.id);
  assert.ok(ids.includes('hammerarm'), ids);
  const proof = bewear.legalityProfile.legalityProof;
  assert.equal(proof.heldLevels, 5);
  // The k-th level held costs k units: 1 + 2 + 3 + 4 + 5.
  assert.equal(
    proof.buildFriction, 15 * SCORING_DEFAULTS.DELAYED_EVO_FRICTION_PER_LEVEL,
  );
  assert.deepEqual(proof.delayedMoves, [
    { name: 'Hammer Arm', source: 'Level 32 (Stufful)', heldLevels: 5 },
  ]);

  const ampharos = bestChoice(result, 'Mareep');
  assert.equal(ampharos.buildKey, 'default', ampharos.buildLabel);
  const delayed = (ampharos.buildAlternatives || []).find(
    (build) => build.buildKey === 'delayed',
  );
  assert.ok(delayed, 'the Discharge hold is still offered as an alternative');
  assert.equal(delayed.legalityProfile.legalityProof.heldLevels, 17);
});
