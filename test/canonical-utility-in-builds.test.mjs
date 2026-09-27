// Every build keeps the canonical utility moves the player can use now. The
// coverage build may trade a canonical attack for breadth, never Rapid Spin
// or Spikes; the utility build ranks by usage, so the canonical utility moves
// seat first. Before this rule Forretress's four-attack coverage set won on
// standalone value and its card showed none of the moves the set line said
// were ready.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runPool, lineFor } from './helpers/harness.mjs';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  buildCandidateLegalityProfile,
} from '../src/teamBuilder/team-analysis.js';

const forretress = {
  id: 'forretress', name: 'Forretress', types: ['Bug', 'Steel'],
};
const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
const moves = [
  'rapidspin', 'spikes', 'bugbite', 'payback', 'selfdestruct', 'mirrorshot',
].map(legal);
// Forretress's canonical set with Stealth Rock and Gyro Ball not yet legal.
const moveUsage = new Map([
  ['rapidspin', 95], ['stealthrock', 90], ['spikes', 70], ['gyroball', 60],
]);
const idsOf = (profile) => profile.recommendedMoves.map((move) => move.id);

test('the coverage build keeps the canonical utility moves and trades attacks', () => {
  const ids = idsOf(buildCandidateLegalityProfile({
    member: forretress, moves, moveUsage, levelCap: 35,
    movePreference: 'coverage',
  }));
  assert.ok(ids.includes('rapidspin') && ids.includes('spikes'), ids);
  // Rapid Spin already covers Normal, so Self-Destruct never seats.
  assert.ok(!ids.includes('selfdestruct'), ids);
});

test('the utility build seats the canonical utility moves first', () => {
  const ids = idsOf(buildCandidateLegalityProfile({
    member: forretress, moves, moveUsage, levelCap: 35,
    movePreference: 'utility',
  }));
  assert.deepEqual(ids.slice(0, 2), ['rapidspin', 'spikes']);
});

const buildsOf = (result, inputName) => {
  const line = lineFor(result, inputName);
  const best = line.best || line.bestNonMega;
  return new Map(
    (best.buildAlternatives || [best]).map((build) => [
      build.buildKey,
      idsOf(build.legalityProfile),
    ]),
  );
};

test('Forretress fields Rapid Spin and Spikes whichever build survives', async () => {
  const result = await runPool({ pool: ['Pineco'], badge: 2, levelCap: 35 });
  // The coverage set collapses into the standard set here and is pruned as
  // its twin; whatever survives keeps both moves.
  for (const [key, ids] of buildsOf(result, 'Pineco')) {
    assert.ok(ids.includes('rapidspin') && ids.includes('spikes'), `${key}: ${ids}`);
  }
  const fielded = idsOf(result.team[0].legalityProfile);
  assert.ok(fielded.includes('rapidspin') && fielded.includes('spikes'), fielded);
});

test('Glameow keeps Fake Out in every build', async () => {
  const result = await runPool({ pool: ['Glameow'], badge: 2, levelCap: 35 });
  for (const [key, ids] of buildsOf(result, 'Glameow')) {
    assert.ok(ids.includes('fakeout'), `${key}: ${ids}`);
  }
});
