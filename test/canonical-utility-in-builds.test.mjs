// Every build keeps the canonical utility moves the player can use now. The
// coverage build may trade a canonical attack for breadth, never Rapid Spin
// or Spikes; the utility build seats every canonical utility move before it
// ranks the rest by usage. Before this rule Forretress's four-attack
// coverage set won on standalone value and its card showed none of the
// moves the set line said were ready.
import test from 'node:test';
import assert from 'node:assert/strict';
import { lineFor, progressionAt, runPool } from './helpers/harness.mjs';
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
  // Payback out-hits Rapid Spin into every type, so sharing its type does
  // not keep it out: an attack earns a slot wherever it raises the set's
  // best damage. Self-Destruct would out-hit it, but a self-KO move seats
  // only where the record runs it, and here it does not.
  assert.ok(ids.includes('payback'), ids);
  assert.ok(!ids.includes('selfdestruct'), ids);
});

test('the utility build seats the canonical utility moves first', () => {
  const ids = idsOf(buildCandidateLegalityProfile({
    member: forretress, moves, moveUsage, levelCap: 35,
    movePreference: 'utility',
  }));
  assert.deepEqual(ids.slice(0, 2), ['rapidspin', 'spikes']);
});

// A record of four status moves is the set in every build. The score cannot
// keep Substitute, which carries no role, so the rule has to: a utility
// build capped at three support moves had seated an attack in its place.
const smeargle = { id: 'smeargle', name: 'Smeargle', types: ['Normal'] };
const sketched = [
  'batonpass', 'spore', 'stickyweb', 'substitute', 'taunt', 'seismictoss',
  'finalgambit', 'tackle',
].map(legal);
const supportRecord = new Map([
  ['batonpass', 80], ['spore', 75], ['stickyweb', 60], ['substitute', 40],
]);

test('the utility build keeps a record of four status moves whole', () => {
  const ids = idsOf(buildCandidateLegalityProfile({
    member: smeargle, moves: sketched, moveUsage: supportRecord,
    levelCap: 60, movePreference: 'utility',
  }));
  assert.deepEqual(ids, ['batonpass', 'spore', 'stickyweb', 'substitute']);
});

test('with a seat left, the utility build still takes an attack', () => {
  const ids = idsOf(buildCandidateLegalityProfile({
    member: smeargle,
    moves: sketched,
    moveUsage: new Map([['batonpass', 80], ['spore', 75], ['stickyweb', 60]]),
    levelCap: 60,
    movePreference: 'utility',
  }));
  assert.deepEqual(ids.slice(0, 3), ['batonpass', 'spore', 'stickyweb']);
  // Never Final Gambit: an attack that faints its user is no fill.
  assert.equal(ids[3], 'seismictoss', ids);
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

test('Smeargle keeps Substitute whichever build survives', async () => {
  // Its box supplies the record's moves and a Final Gambit to sketch.
  const result = await runPool({
    pool: ['Smeargle', 'Scolipede', 'Parasect', 'Shuckle', 'Primeape'],
    progression: {
      ...progressionAt({ badge: 7, levelCap: 60 }),
      moveRelearnerUnlocked: true,
      daycareUnlocked: true,
    },
    scoreAllLines: true,
  });
  const record = ['batonpass', 'spore', 'stickyweb', 'substitute'];
  for (const [key, ids] of buildsOf(result, 'Smeargle')) {
    assert.deepEqual(ids, record, key);
  }
});

test('Glameow keeps Fake Out in every build', async () => {
  const result = await runPool({ pool: ['Glameow'], badge: 2, levelCap: 35 });
  for (const [key, ids] of buildsOf(result, 'Glameow')) {
    assert.ok(ids.includes('fakeout'), `${key}: ${ids}`);
  }
});
