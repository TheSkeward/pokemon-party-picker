// A status move's side effects, priced: a weight change is worth what the
// weight-scaled attacks the ladder carries lose or gain against the mon, as
// a share of a reference hit; PP is the share of a long fight's clicks a move
// cannot cover. Autotomize's shed weight is a small, strictly positive gain
// on a Fighting-weak Klink; the five extra PP of Rock Polish are worth zero.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  ppPenalty,
  statusSideValue,
  weightChangeValue,
} from '../src/teamBuilder/move-side-value.js';
import { setMovePrior } from '../src/teamBuilder/move-prior.js';

await import('./helpers/harness.mjs');

const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
// The ladder's measured carry rates, pinned so the test does not move with
// the data: Low Kick on 0.37% of sets, Grass Knot 1.17%, Heavy Slam 0.71%
// carried by Pokémon averaging 400 kg, Heat Crash on none.
const LADDER = new Map([
  ['lowkick', { prior: 5, carry: 0.37 }],
  ['grassknot', { prior: 8, carry: 1.17 }],
  ['heavyslam', { prior: 10, carry: 0.71, carrierWeightKg: 400 }],
  ['heatcrash', { prior: 0, carry: 0 }],
]);
const withLadder = (run) => {
  const previous = setMovePrior(LADDER);
  try {
    return run();
  } finally {
    setMovePrior(previous);
  }
};

test('the meta carries what the pricing reads', () => {
  assert.deepEqual(legal('shiftgear').raises, { spe: 2, atk: 1 });
  assert.deepEqual(legal('autotomize').raises, { spe: 2 });
  assert.equal(legal('autotomize').weightChangeKg, -100);
  assert.equal(legal('autotomize').pp, 15);
  assert.equal(legal('rockpolish').pp, 20);
  assert.deepEqual(legal('shellsmash').selfDrops, { def: 1, spd: 1 });
  assert.equal(legal('bellydrum').hpCost, 0.5);
  assert.equal(legal('thunderwave').inflicts, 'par');
  assert.equal(legal('stunspore').inflicts, 'par');
  assert.equal(legal('toxic').inflicts, 'tox');
});

test('shedding weight is a small, strictly positive gain for Klink', () => {
  withLadder(() => {
    const klink = { id: 'klink', types: ['Steel'] };
    const value = weightChangeValue(klink, -100);
    // Low Kick (x2 into Steel) and Grass Knot (x0.5) drop from 40 to 20
    // power; Heavy Slam's 400 kg carriers already deal 120 to a 21 kg
    // target, so nothing is lost there.
    assert.ok(value > 0.002 && value < 0.005, value);
    assert.equal(weightChangeValue(klink, 0), 0);
    // An unknown weight prices nothing.
    assert.equal(weightChangeValue({ id: 'nosuchmon', types: [] }, -100), 0);
  });
});

test('the sign follows what the mon is weak to', () => {
  withLadder(() => {
    // Garchomp (95 kg) takes Grass Knot at x2: shedding weight is worth more
    // to it than to Klink, Heavy Slam's gain notwithstanding.
    const garchomp = { id: 'garchomp', types: ['Dragon', 'Ground'] };
    const klink = { id: 'klink', types: ['Steel'] };
    assert.ok(
      weightChangeValue(garchomp, -100) > weightChangeValue(klink, -100),
    );
    // Regice (175 kg, Ice) is weak to Steel: Heavy Slam's carriers go from
    // 60 to 120 power against it, which outweighs the Low Kick and Grass
    // Knot relief.
    const regice = { id: 'regice', types: ['Ice'] };
    const value = weightChangeValue(regice, -100);
    assert.ok(value < 0, value);
  });
});

test('PP costs nothing a move will not run out of', () => {
  // Once per switch-in: Shift Gear's 10 PP and Autotomize's 15 cover it.
  assert.equal(ppPenalty(legal('autotomize')), 0);
  assert.equal(ppPenalty(legal('rockpolish')), 0);
  assert.equal(ppPenalty(legal('shiftgear')), 0);
  // Clicked every turn it is up: a five-PP Synthesis runs dry in a long
  // fight, a ten-PP Roost less so, a twenty-PP Thunder Wave never.
  assert.ok(Math.abs(ppPenalty(legal('synthesis')) - (1 - 5 / 12)) < 1e-9);
  assert.ok(Math.abs(ppPenalty(legal('roost')) - (1 - 10 / 12)) < 1e-9);
  assert.equal(ppPenalty(legal('thunderwave')), 0);
  // Unknown PP prices nothing.
  assert.equal(ppPenalty({ id: 'x', pp: 0, roles: [] }), 0);
});

test('Autotomize out-prices Rock Polish on Klink', () => {
  withLadder(() => {
    const klink = { id: 'klink', types: ['Steel'] };
    const autotomize = statusSideValue(legal('autotomize'), klink);
    const rockPolish = statusSideValue(legal('rockpolish'), klink);
    assert.ok(autotomize > 0, autotomize);
    assert.equal(rockPolish, 0);
  });
});
