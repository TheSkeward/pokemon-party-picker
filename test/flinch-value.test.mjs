// A flinch chance is priced as the action it denies: chance, times the chance
// the user moves first, times its best hit. It orders the card and ranks
// moves for slot filling; the displayed damage and the score see damage
// alone. A fast Meowth's Bite lists above a Scratch that does two more
// damage; on a slow mon the same Bite earns nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  buildCandidateLegalityProfile,
} from '../src/teamBuilder/team-analysis.js';

const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });

test('the meta carries flinch chances, and none for Fake Out', () => {
  assert.equal(legal('bite').flinch, 30);
  assert.equal(legal('airslash').flinch, 30);
  assert.equal(legal('zenheadbutt').flinch, 20);
  assert.equal(legal('fakeout').flinch, 0);
  assert.equal(legal('scratch').flinch, 0);
});

test('a fast Meowth lists Bite above Scratch', () => {
  const meowth = { id: 'meowth', name: 'Meowth', types: ['Normal'] };
  const profile = buildCandidateLegalityProfile({
    member: meowth,
    moves: ['fakeout', 'scratch', 'furyswipes', 'bite'].map(legal),
    levelCap: 20, ability: 'Technician', investmentSide: 'physical',
  });
  const ids = profile.recommendedMoves.map((move) => move.id);
  assert.ok(ids.indexOf('bite') < ids.indexOf('scratch'), ids);
  const bite = profile.recommendedMoves.find((move) => move.id === 'bite');
  const scratch = profile.recommendedMoves.find((m) => m.id === 'scratch');
  // The shown damage still favours Scratch; the click value does not.
  assert.ok(scratch.estimatedDamage > bite.estimatedDamage);
  assert.ok(bite.clickValue > scratch.clickValue);
  assert.match(bite.damageSteps.join('\n'), /30% flinch/);
});

test('a slow mon earns nothing from the same flinch', () => {
  const slow = { id: 'forretress', name: 'Forretress', types: ['Bug', 'Steel'] };
  const profile = buildCandidateLegalityProfile({
    member: slow, moves: ['bite', 'tackle'].map(legal), levelCap: 20,
  });
  const bite = profile.recommendedMoves.find((move) => move.id === 'bite');
  // Under a tenth of the move's own damage: a flinch from second place is
  // close to worthless.
  assert.ok(
    bite.flinchValue < bite.estimatedDamage * 0.1,
    `${bite.flinchValue} vs ${bite.estimatedDamage}`,
  );
});
