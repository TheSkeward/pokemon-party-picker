// The assumed investment goes to the attacking side the competitive spread
// builds toward, and the whole set is priced under it: a player builds one
// side, natures and EVs are costly to change, and moves are cheap. Swellow's
// Attack is higher, but its top spread is Timid with 252 SpA, so it is priced
// as that special build even while a physical Facade is its best legal
// attack. Without a spread side, the strongest obtainable attack decides.
// Off-side moves are priced off the empty stat they would really have, so a
// special attacker does not pick up a physical filler priced as if it were
// built for it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  buildCandidateLegalityProfile,
} from '../src/teamBuilder/team-analysis.js';
import {
  getAttackingStats,
  investmentSideOfSpread,
  mirrorSpreadSide,
} from '../src/teamBuilder/damage-model.js';

test('a spread mirrors to the other attacking side with its shape kept', () => {
  assert.equal(mirrorSpreadSide('Timid:0/0/0/252/4/252'), 'Jolly:0/252/0/0/4/252');
  assert.equal(mirrorSpreadSide('Adamant:4/252/0/0/0/252'), 'Modest:4/0/0/252/0/252');
  assert.equal(mirrorSpreadSide('Bold:252/0/252/0/4/0'), 'Impish:252/0/252/0/4/0');
  // A neutral nature has no counterpart and keeps its name.
  assert.equal(mirrorSpreadSide('Hardy:252/4/252/0/0/0'), 'Hardy:252/0/252/4/0/0');
  assert.equal(mirrorSpreadSide(null), null);
});

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

test('a spread names the side it builds toward', () => {
  assert.equal(investmentSideOfSpread('Timid:0/0/0/252/4/252'), 'special');
  assert.equal(investmentSideOfSpread('Jolly:0/252/4/0/0/252'), 'physical');
  // EVs decide before the nature: a wall with its spare 4 EVs in Atk.
  assert.equal(investmentSideOfSpread('Relaxed:252/4/252/0/0/0'), 'physical');
  // No attacking EVs: the nature's spared or boosted stat decides.
  assert.equal(investmentSideOfSpread('Bold:252/0/252/0/4/0'), 'special');
  assert.equal(investmentSideOfSpread('Careful:252/0/4/0/252/0'), 'physical');
  assert.equal(investmentSideOfSpread('Hardy:252/0/252/0/4/0'), null);
  assert.equal(investmentSideOfSpread(null), null);
});

test('Swellow follows its special spread even while Facade hits hardest', () => {
  const profile = buildCandidateLegalityProfile({
    member: swellow, moves: ['airslash', 'facade', 'aerialace'].map(legal),
    levelCap: 35, investmentSide: 'special',
  });
  assert.match(stepsOf(profile, 'airslash'), /nature in SpA/);
  assert.match(stepsOf(profile, 'facade'), /nature in SpA/);
  const byId = new Map(profile.recommendedMoves.map((m) => [m.id, m]));
  assert.ok(byId.get('airslash').estimatedDamage >
    byId.get('aerialace').estimatedDamage);
});

test('without a spread side, Swellow is physical while Facade is its best attack', () => {
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
