// Stored Power and Power Trip are priced at the positive stages their build
// holds: one use of each setup move in the set, the user's Speed Boost over
// the stint, and the best Baton Pass another pool line could hand them. The
// pass is a team fact, so the team search withdraws its credit from a team
// no passer makes. Future Sight lands two turns late and takes the charge
// rate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestChoice,
  loadShared,
  progressionAt,
  runPool,
} from './helpers/harness.mjs';

const {
  MAX_PASSED_STAGES,
  abilityBoostStages,
  boostScaledPower,
  setupStages,
} = await import('../src/teamBuilder/damage-model.js');
const { getTeamScore, setTypeChart } = await import(
  '../src/teamBuilder/search-kernel.js',
);
const { activeTypeChart } = await import('../src/playthrough/type-chart.js');
const { buildTeamAnalysis } = await import(
  '../src/teamBuilder/team-analysis.js',
);
const { withDonors } = await import('../src/teamBuilder/pool-parsing.js');

const daycare = {
  ...progressionAt({ badge: 5, levelCap: 50 }),
  daycareUnlocked: true,
  moveRelearnerUnlocked: true,
};
const ids = (choice) =>
  choice.legalityProfile.recommendedMoves.map((move) => move.id);
const moveOf = (choice, id) =>
  choice.legalityProfile.recommendedMoves.find((move) => move.id === id);

test('a boost-scaling attack is 20 power plus 20 per positive stage', () => {
  assert.equal(boostScaledPower('storedpower'), 20);
  assert.equal(boostScaledPower('powertrip', 5), 120);
  assert.equal(boostScaledPower('psychic', 5), null);
  // Shell Smash's drops never count against it.
  assert.equal(setupStages({ raises: { atk: 2, spa: 2, spe: 2 } }), 6);
  assert.equal(setupStages({ raises: { spa: 1, spd: 1 } }), 2);
  assert.equal(setupStages({}), 0);
  // Speed Boost averages 1.5 stages over a four-turn stint and holds 3 on
  // the turn a passer hands them on.
  assert.equal(abilityBoostStages('Speed Boost'), 1.5);
  assert.equal(abilityBoostStages('Speed Boost', true), 3);
  assert.equal(abilityBoostStages('Magic Bounce'), 0);
  assert.equal(MAX_PASSED_STAGES, 6);
});

test('the team search withdraws the pass credit a team cannot deliver', () => {
  setTypeChart(activeTypeChart());
  const profile = { currentTypes: ['Psychic'], coverageVector: [] };
  const receiver = {
    name: 'Espeon', pokemonId: 'espeon', inputPokemonId: 'eevee',
    teamScore: 100, passCredit: 40, passStages: 5, legalityProfile: profile,
  };
  const passer = (passableStages) => ({
    name: 'Scolipede', pokemonId: 'scolipede', inputPokemonId: 'venipede',
    teamScore: 50, passableStages, legalityProfile: profile,
  });
  const full = getTeamScore([receiver, passer(5)]);
  const none = getTeamScore([receiver, passer(0)]);
  const half = getTeamScore([receiver, passer(2.5)]);
  const over = getTeamScore([receiver, passer(6)]);
  assert.equal(full - none, 40);
  assert.equal(full - half, 20);
  assert.equal(over, full);
  // A mon never passes to itself.
  const alone = getTeamScore([{ ...receiver, passableStages: 5 }]);
  const aloneNoCredit = getTeamScore([{ ...receiver, passCredit: 0 }]);
  assert.equal(alone, aloneNoCredit - 40);
});

test('Stored Power is priced at the pool\'s best pass and seats on Espeon', async () => {
  const pool = ['Eevee', 'Venipede'];
  const donorPool = ['Munna@14'];
  const result = await runPool({ pool, donorPool, progression: daycare });
  const espeon = bestChoice(result, 'Eevee');
  assert.equal(espeon.name, 'Espeon');
  assert.ok(ids(espeon).includes('storedpower'), ids(espeon).join(', '));
  // Scolipede's Iron Defense and three Speed Boosts: +5, so 120 power.
  const stored = moveOf(espeon, 'storedpower');
  assert.equal(stored.basePower, 120);
  assert.equal(espeon.passStages, 5);
  assert.ok(espeon.passCredit > 0);
  // A boosted Stored Power out-hits Psychic, so Psychic is no upgrade and
  // Future Sight, at the charge rate, never is.
  assert.ok(!ids(espeon).includes('psychic'));
  assert.ok(!ids(espeon).includes('futuresight'));

  const scolipede = bestChoice(result, 'Venipede');
  assert.equal(scolipede.name, 'Scolipede');
  assert.ok(ids(scolipede).includes('batonpass'));
  assert.equal(scolipede.passableStages, 5);

  // The card prices the pass from the teammate actually on the team.
  const { pokemonIndex } = await loadShared();
  const analysis = await buildTeamAnalysis(result.team, daycare, {
    family: 'singles',
    lines: result.lines,
    pokemonIndex,
    query: withDonors(pool.join('\n'), donorPool.join('\n')),
  });
  const profile = analysis.profiles.find(
    (entry) => entry.currentId === 'espeon',
  );
  const shown = profile.recommendedMoves.find(
    (move) => move.id === 'storedpower',
  );
  assert.ok(
    shown.damageSteps.some((step) => /Scolipede's Baton Pass \+5/.test(step)),
    shown.damageSteps.join(' | '),
  );
});

test('without a passer Stored Power stays at 20 and Future Sight is no nuke', async () => {
  const result = await runPool({
    pool: ['Eevee'],
    donorPool: ['Munna@14'],
    progression: daycare,
  });
  const espeon = bestChoice(result, 'Eevee');
  assert.equal(espeon.passCredit, 0);
  assert.equal(espeon.passStages, 0);
  const stored = moveOf(espeon, 'storedpower');
  if (stored) assert.equal(stored.basePower, 20);
  // Psychic out-hits an unboosted Stored Power and a half-rate Future Sight,
  // so it seats as the upgrade and Future Sight seats nowhere.
  assert.ok(ids(espeon).includes('psychic'), ids(espeon).join(', '));
  assert.ok(!ids(espeon).includes('futuresight'), ids(espeon).join(', '));
  assert.notEqual(espeon.legalityProfile.bestDamagingMove.id, 'futuresight');
});
