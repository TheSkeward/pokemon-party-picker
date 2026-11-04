// A self-KO move lands once per stint and seats only where the record runs
// it; the seat of a canonical attack a build cannot seat is refilled only
// from attacks the record runs meaningfully, else by a utility move. The
// case that set the rule: Forretress's record runs Gyro Ball in six sets of
// ten and Heavy Slam in one of a hundred, Explosion in one of twenty. At cap
// 45 Gyro Ball needs a Pineco held to 42; the build without the hold may
// not put Heavy Slam, Explosion or Payback in its seat, so the held set wins
// on score. At cap 50 Gyro Ball is a level-up move and the Standard set
// stands.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bestChoice, progressionAt, runPool } from './helpers/harness.mjs';
import { hydrateLegalMove } from '../src/move-meta.js';
import { EXPECTED_STINT_TURNS } from '../src/teamBuilder/damage-model.js';
import {
  getEffectiveHitMultiplier,
} from '../src/teamBuilder/team-analysis.js';

const ids = (choice) =>
  choice.legalityProfile.recommendedMoves.map((move) => move.id);
const at = (badge, levelCap) => ({
  ...progressionAt({ badge, levelCap }),
  moveRelearnerUnlocked: true,
  daycareUnlocked: true,
});
const FILLS = ['explosion', 'heavyslam', 'payback', 'doubleedge'];

test('a self-KO move lands once per stint', () => {
  const explosion = hydrateLegalMove({ id: 'explosion', sources: ['level'] });
  assert.equal(explosion.selfKO, true);
  assert.equal(
    getEffectiveHitMultiplier(explosion), 1 / EXPECTED_STINT_TURNS,
  );
  // Truant loafs on a turn the user is already gone: no second discount.
  assert.equal(
    getEffectiveHitMultiplier(explosion, 'Truant'), 1 / EXPECTED_STINT_TURNS,
  );
  const tackle = hydrateLegalMove({ id: 'tackle', sources: ['level'] });
  assert.equal(tackle.selfKO, false);
  assert.equal(getEffectiveHitMultiplier(tackle), 1);
});

test('Forretress at cap 45 holds a Pineco to 42 for Gyro Ball', async () => {
  const result = await runPool({
    pool: ['Forretress'], progression: at(4, 45),
  });
  const forretress = bestChoice(result, 'Forretress');
  assert.equal(forretress.buildKey, 'delayed', forretress.buildLabel);
  assert.match(forretress.buildLabel, /Gyro Ball; Pineco to 42/);
  const moves = ids(forretress);
  assert.ok(moves.includes('gyroball') && moves.includes('rapidspin'), moves);
  for (const id of FILLS) assert.ok(!moves.includes(id), moves);
  assert.equal(forretress.legalityProfile.legalityProof.heldLevels, 11);

  // The build without the hold seats a utility move in Gyro Ball's seat
  // rather than an attack the record does not run, and loses on score, so
  // the held set wins without any selection rule.
  const standard = (forretress.buildAlternatives || []).find(
    (build) => build.buildKey === 'default',
  );
  assert.ok(standard, 'the Standard set is still offered');
  const standardMoves = ids(standard);
  for (const id of FILLS) assert.ok(!standardMoves.includes(id), standardMoves);
  assert.ok(standard.score < forretress.score);
});

test('Forretress at cap 50 keeps Gyro Ball in the Standard set', async () => {
  const result = await runPool({
    pool: ['Forretress'], progression: at(5, 50),
  });
  const forretress = bestChoice(result, 'Forretress');
  assert.equal(forretress.buildKey, 'default', forretress.buildLabel);
  const moves = ids(forretress);
  assert.ok(moves.includes('gyroball'), moves);
  for (const id of FILLS) assert.ok(!moves.includes(id), moves);
  // No hedge build evicts Gyro Ball for a fill either.
  for (const alt of forretress.buildAlternatives || []) {
    const altMoves = ids(alt);
    for (const id of FILLS) {
      assert.ok(!altMoves.includes(id), `${alt.buildKey}: ${altMoves}`);
    }
  }
});

test('the held Gyro Ball set is fielded on a team at cap 45', async () => {
  const result = await runPool({
    pool: ['Forretress', 'Ninjask', 'Meowstic', 'Drapion', 'Klang', 'Mawile'],
    progression: at(4, 45),
  });
  const forretress = result.team.find(
    (member) => (member.inputName || member.name) === 'Forretress',
  );
  assert.ok(forretress, 'Forretress is on the team');
  const moves = ids(forretress);
  assert.ok(moves.includes('gyroball') && !moves.includes('explosion'), moves);
});
