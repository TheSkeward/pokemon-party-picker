// The assumed investment goes to the side of the mon's strongest obtainable
// attack, not its higher base stat, and the whole set is priced under it.
// Swellow's Attack is higher, but its real set is special: once Boomburst is
// legal the set is priced as the special build it would be, and while Facade
// is its best attack it stays physical. Off-side moves are priced off the
// empty stat they would really have, so a special attacker does not pick up
// a physical filler priced as if it were built for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  buildCandidateLegalityProfile,
} from '../src/teamBuilder/team-analysis.js';
import { getAttackingStats } from '../src/teamBuilder/damage-model.js';

const swellow = { id: 'swellow', name: 'Swellow', types: ['Normal', 'Flying'] };
const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
const stepsOf = (profile, id) =>
  profile.recommendedMoves.find((move) => move.id === id).damageSteps.join('\n');

test('the caller can name the invested side', () => {
  const physical = getAttackingStats({
    pokemonId: 'swellow', levelCap: 35, side: 'physical',
  });
  const special = getAttackingStats({
    pokemonId: 'swellow', levelCap: 35, side: 'special',
  });
  const assumed = getAttackingStats({ pokemonId: 'swellow', levelCap: 35 });
  assert.deepEqual(assumed, physical);
  assert.ok(special.spa > physical.spa && special.atk < physical.atk);
  assert.match(special.spreadLabel, /in SpA$/);
});

test('Swellow is physical while Facade is its best attack', () => {
  const profile = buildCandidateLegalityProfile({
    member: swellow, moves: ['airslash', 'facade', 'aerialace'].map(legal),
    levelCap: 35,
  });
  assert.match(stepsOf(profile, 'facade'), /nature in Atk/);
  assert.match(stepsOf(profile, 'airslash'), /nature in Atk/);
});

test('Swellow is special once Boomburst is legal', () => {
  const profile = buildCandidateLegalityProfile({
    member: swellow,
    moves: ['boomburst', 'airslash', 'facade', 'aerialace'].map(legal),
    levelCap: 55,
  });
  assert.match(stepsOf(profile, 'boomburst'), /nature in SpA/);
  assert.match(stepsOf(profile, 'airslash'), /nature in SpA/);
  const byId = new Map(profile.recommendedMoves.map((m) => [m.id, m]));
  assert.ok(byId.get('airslash').estimatedDamage >
    (byId.get('aerialace')?.estimatedDamage ?? 0));
});

test('a special attacker does not take a physical filler priced as built', () => {
  const meowstic = { id: 'meowstic', name: 'Meowstic', types: ['Psychic'] };
  const profile = buildCandidateLegalityProfile({
    member: meowstic,
    moves: ['psyshock', 'chargebeam', 'facade', 'reflect', 'lightscreen']
      .map(legal),
    levelCap: 35,
  });
  const ids = profile.recommendedMoves.map((move) => move.id);
  assert.ok(ids.includes('chargebeam') && !ids.includes('facade'), ids);
});
