// Multi-turn moves are priced over the expected stint: escalating chains run
// for the stint and no further, two-turn moves land on alternate turns, and
// per-strike accuracy moves stop at the first miss.
import test from 'node:test';
import assert from 'node:assert/strict';

const { getEffectiveHitMultiplier } = await import(
  '../src/teamBuilder/team-analysis.js',
);
const { EXPECTED_STINT_TURNS: stint } = await import(
  '../src/teamBuilder/damage-model.js',
);
const near = (a, b) => Math.abs(a - b) < 1e-9;
const chain = (ratio, hitChance) => {
  let total = 0;
  for (let turn = 0; turn < stint; turn += 1) {
    total += ratio(turn) * hitChance ** turn;
  }
  return total / stint;
};

test('escalating chains run for the stint, discounted by chain-ending misses', () => {
  const rollout = getEffectiveHitMultiplier({ id: 'rollout', accuracy: 90 });
  assert.ok(near(rollout, chain((turn) => 2 ** Math.min(turn, 4), 0.9)));
  // A five-turn Rollout never lands its last doubling in a four-turn stint.
  assert.ok(rollout < (1 + 2 + 4 + 8 + 16) / 5);
  const perfect = getEffectiveHitMultiplier({ id: 'rollout', accuracy: 100 });
  assert.ok(near(perfect, chain((turn) => 2 ** Math.min(turn, 4), 1)));
  assert.ok(near(
    getEffectiveHitMultiplier({ id: 'furycutter', accuracy: 95 }),
    chain((turn) => Math.min(2 ** turn, 4), 0.95),
  ));
  assert.ok(near(
    getEffectiveHitMultiplier({ id: 'echoedvoice', accuracy: 100 }),
    chain((turn) => Math.min(turn + 1, 5), 1),
  ));
});

test('two-turn moves land on alternate turns; the user\'s own sun skips the charge', () => {
  const hitFirst = Math.ceil(stint / 2) / stint;
  const hitSecond = Math.floor(stint / 2) / stint;
  const hyperBeam = { id: 'hyperbeam', basePower: 150, recharge: true };
  const solarBeam = { id: 'solarbeam', basePower: 120, charge: true };
  const fly = { id: 'fly', basePower: 90, charge: true };
  const phantomForce = { id: 'phantomforce', basePower: 90, charge: true };
  assert.equal(getEffectiveHitMultiplier(hyperBeam), hitFirst);
  assert.equal(getEffectiveHitMultiplier(solarBeam), hitSecond);
  assert.equal(getEffectiveHitMultiplier(fly), hitSecond);
  assert.equal(getEffectiveHitMultiplier(phantomForce), hitSecond);
  assert.equal(getEffectiveHitMultiplier(solarBeam, 'Drought'), 1);
  assert.equal(getEffectiveHitMultiplier(fly, 'Drought'), hitSecond);
  assert.equal(getEffectiveHitMultiplier(
    { id: 'electroshot', basePower: 130, charge: true }, 'Drizzle'), 1);
  assert.ok(near(getEffectiveHitMultiplier({ id: 'focuspunch', basePower: 150 }), 1 / 3));
});

test('per-strike accuracy moves stop at the first miss, once the first strike is paid', () => {
  const p = 0.9;
  const bomb = { id: 'populationbomb', accuracy: 90, multihit: 10 };
  let expected = 0;
  for (let k = 1; k <= 10; k += 1) expected += p ** k;
  // The estimate applies the move's accuracy once more, so the multiplier
  // carries the expectation divided by that first-strike chance.
  assert.ok(near(getEffectiveHitMultiplier(bomb), expected / p));
  assert.ok(near(getEffectiveHitMultiplier(bomb) * p, expected));
  assert.equal(getEffectiveHitMultiplier(bomb, 'Skill Link'), 10);
  const axel = { id: 'tripleaxel', accuracy: 90, multihit: 3 };
  assert.ok(near(
    getEffectiveHitMultiplier(axel) * p, p + 2 * p ** 2 + 3 * p ** 3,
  ));
  assert.equal(getEffectiveHitMultiplier(axel, 'Skill Link'), 6);
});
