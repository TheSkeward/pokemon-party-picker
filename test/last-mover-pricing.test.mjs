// Payback, Avalanche and Revenge double once the target has acted. The model
// prices that by the chance the user moves second against the dex at this
// level, the way flinch value uses the chance it moves first: a 38-Speed
// Forretress's Payback is nearly a 100-power move, a Ninjask's stays near 50,
// and Avalanche always doubles because its priority puts it last.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  lastMoverPowerMultiplier,
} from '../src/teamBuilder/damage-model.js';
import {
  buildCandidateLegalityProfile,
} from '../src/teamBuilder/team-analysis.js';
import {
  bestChoice,
  progressionAt,
  runPool,
} from './helpers/harness.mjs';

const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });

test('the multiplier follows the user\'s speed, or priority', () => {
  // Forretress at 35, Relaxed with no Speed investment: 38 Speed.
  const slow = lastMoverPowerMultiplier('payback', 35, 'forretress', 38);
  assert.ok(slow > 1.85 && slow <= 2, slow);
  // Ninjask at 35 with full investment outruns nearly everything.
  const fast = lastMoverPowerMultiplier('payback', 35, 'ninjask', 130);
  assert.ok(fast < 1.15, fast);
  // Negative priority goes last whatever the speed.
  assert.equal(lastMoverPowerMultiplier('avalanche', 35, 'ninjask', 130), 2);
  assert.equal(lastMoverPowerMultiplier('revenge', 35, 'ninjask', 130), 2);
  assert.equal(lastMoverPowerMultiplier('tackle', 35, 'forretress', 38), 1);
});

test('a slow Forretress\'s Payback out-hits its Bug Bite and seats for it', () => {
  const forretress = {
    id: 'forretress', name: 'Forretress', types: ['Bug', 'Steel'],
  };
  const spread = 'Relaxed:252/4/252/0/0/0';
  const priced = buildCandidateLegalityProfile({
    member: forretress,
    moves: ['payback', 'bugbite', 'rapidspin', 'spikes'].map(legal),
    levelCap: 35, ability: 'Sturdy', investmentSide: 'physical', spread,
  });
  const byId = new Map(priced.recommendedMoves.map((m) => [m.id, m]));
  assert.ok(
    byId.get('payback').estimatedDamage > byId.get('bugbite').estimatedDamage,
    `${byId.get('payback').estimatedDamage} vs ${byId.get('bugbite').estimatedDamage}`,
  );
  assert.match(
    byId.get('payback').damageSteps.join('\n'), /doubles after the target acts/,
  );

  // With Explosion carried, Bug Bite's only claim was the Ghost gap; Payback
  // fills it harder and takes the slot.
  const built = buildCandidateLegalityProfile({
    member: forretress,
    moves: ['rapidspin', 'spikes', 'explosion', 'payback', 'bugbite', 'protect']
      .map(legal),
    moveUsage: new Map([
      ['rapidspin', 94], ['stealthrock', 66], ['gyroball', 64], ['spikes', 61],
    ]),
    levelCap: 35, ability: 'Sturdy', investmentSide: 'physical', spread,
  });
  const ids = built.recommendedMoves.map((move) => move.id);
  assert.deepEqual(
    new Set(ids), new Set(['rapidspin', 'spikes', 'explosion', 'payback']), ids,
  );
});

test('the real Pineco line at badge 2 runs Payback', async () => {
  const result = await runPool({
    pool: ['Pineco'],
    progression: progressionAt({ badge: 2, levelCap: 35 }),
  });
  const ids = bestChoice(result, 'Pineco').legalityProfile.recommendedMoves
    .map((move) => move.id);
  assert.ok(ids.includes('payback') && !ids.includes('bugbite'), ids);
});
