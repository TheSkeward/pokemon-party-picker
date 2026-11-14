// "Why these picks" (src/teamBuilder/explanations.js): the sentences that
// say why a Pokémon seats or sits out. Each is built from the same figures
// the optimizer scored with, so a sentence that drifts from them misleads
// in the model's own voice.
import assert from 'node:assert/strict';
import test from 'node:test';

const { progressionAt, runPool } = await import('./helpers/harness.mjs');
const { explainExcludedChoice, explainSeatedChoice } = await import(
  '../src/teamBuilder/explanations.js',
);
const { analysisTypes } = await import('../src/playthrough/type-chart.js');

// A coverage vector with the named types answered and the rest left at zero.
function coverage(values) {
  return analysisTypes().map((type) => values[type] || 0);
}

function seat(overrides = {}) {
  const { profile = {}, ...rest } = overrides;
  return {
    inputName: 'Torchic',
    currentRole: 'fast_attacker',
    currentFeatures: { damageQ: 0.32, speedQ: 0.46 },
    legalityProfile: profile,
    ...rest,
  };
}

const explain = (overrides, team, confidence) => {
  const choice = seat(overrides);
  return explainSeatedChoice(choice, team || [choice], confidence);
};
const roleLine = (currentRole, currentFeatures) =>
  explain({ currentRole, currentFeatures })[0];

test('a seat opens with its role and the figures that role is judged on', () => {
  const base = { damageQ: 0.32, speedQ: 0.46 };
  assert.equal(
    roleLine('fast_attacker', {
      ...base, effectiveBulkQ: 0.23, fastAttackerPenaltyQ: 0.012,
    }),
    'Seats as fast attacker (damage 32%, speed 46%, effective bulk 23%, ' +
      'frailty discount 1%).');
  // A discount that rounds to nothing is not mentioned.
  assert.equal(
    roleLine('fast_attacker', {
      ...base, effectiveBulkQ: 0.5, fastAttackerPenaltyQ: 0.004,
    }),
    'Seats as fast attacker (damage 32%, speed 46%, effective bulk 50%).');
  assert.equal(
    roleLine('bulky_attacker', {
      ...base, effectiveBulkQ: 0.55, bulkQ: 0.56, typeResilienceQ: 0.44,
    }),
    'Seats as bulky attacker (damage 32%, speed 46%, effective bulk 55%, ' +
      'raw bulk 56%, type resilience 44%).');
  // A type specialist is judged on its better side.
  assert.equal(
    roleLine('specialist_bulky_attacker', {
      ...base, physicalBulkQ: 0.11, specialBulkQ: 0.49, typeResilienceQ: 0.75,
    }),
    'Seats as type-resilient bulky attacker (damage 32%, speed 46%, ' +
      'best-side bulk 49%, type resilience 75%).');
  assert.equal(
    roleLine('tempo_attacker', {
      ...base, tempoSpeedQ: 0.6, tempoReliabilityQ: 1, bulkQ: 0.37,
    }),
    'Seats as Speed Boost tempo attacker (damage 32%, speed 46%, ' +
      'after one boost 60%, protected ramp, bulk 37%).');
  assert.equal(
    roleLine('screen_support', {
      ...base, screenProtectionQ: 0.8, screenDeliveryQ: 0.9, bulkQ: 0.4,
    }),
    'Seats as single-action team protection (damage 32%, speed 46%, ' +
      'one-action protection 80%, delivery 90%, bulk 40%).');
  // A role with no wording of its own is named as the model names it.
  assert.equal(
    roleLine('pivot', { ...base, bulkQ: 0.4 }),
    'Seats as pivot (damage 32%, speed 46%, bulk 40%).');
});

test('the build and the set are named', () => {
  const profile = {
    recommendedMoves: [{ name: 'Double Kick' }, { name: 'Ember' }],
  };
  const lines = explain({
    profile, buildKey: 'screens', buildLabel: 'dual screens',
  });
  assert.equal(lines[1], 'Runs the dual screens build.');
  assert.equal(lines[2], 'Set: Double Kick / Ember.');
  // The default build is not announced.
  assert.deepEqual(
    explain({ profile, buildKey: 'default' }).slice(1),
    ['Set: Double Kick / Ember.']);
});

test('an assumed ability says how much rides on it', () => {
  const ability = (profile, abilitySensitivity) =>
    explain({ profile, abilitySensitivity })[1];
  assert.equal(
    ability({ assumedAbility: 'Magnet Pull' }, 40),
    'Assumes Magnet Pull; not required for inclusion ' +
      '(−40 with the other ability).');
  // Past a hundred points the pick leans on it, and the entry to pin it is
  // spelt out.
  assert.equal(
    ability({ assumedAbility: 'Speed Boost' }, 233),
    'Assumes Speed Boost — the score leans on the current ability (−233 ' +
      'with the other ability); pin it with "Torchic (Speed Boost)" if ' +
      'yours matches.');
  assert.equal(
    ability({ assumedAbility: 'Leaf Guard', targetAbility: 'Technician' }, 0),
    'Assumes Leaf Guard now, then Technician after evolution; not required ' +
      'for inclusion (−0 with the other ability).');
});

test('a pinned ability is stated as the player\'s own', () => {
  const ability = (profile) => explain({ profile })[1];
  assert.equal(
    ability({ assumedAbility: 'Speed Boost', abilityKnown: true }),
    'Ability: Speed Boost (yours).');
  assert.equal(
    ability({
      assumedAbility: 'Leaf Guard', targetAbility: 'Technician',
      abilityKnown: true,
    }),
    'Ability: Leaf Guard now, then Technician after evolution (yours).');
  // A pin that does not settle what the ability becomes vouches for the
  // current one only.
  assert.equal(
    ability({
      assumedAbility: 'Shed Skin', targetAbility: 'Compound Eyes',
      abilityKnown: true, targetKnown: false,
    }),
    'Ability: Shed Skin (yours), then Compound Eyes after evolution ' +
      '(assumed; Shed Skin does not say which it becomes).');
});

test('a Mega names the ability before and after', () => {
  const ability = (profile, abilitySensitivity) =>
    explain({ profile, abilitySensitivity })[1];
  assert.equal(
    ability({
      preMegaAbility: 'Levitate', assumedAbility: 'Shadow Tag',
      abilityKnown: true,
    }),
    'Ability path: Levitate (yours), then Shadow Tag after Mega Evolution.');
  assert.equal(
    ability({
      preMegaAbility: 'Intimidate', assumedAbility: 'intimidate',
      abilityKnown: true,
    }),
    'Ability: Intimidate (yours), retained after Mega Evolution.');
  assert.equal(
    ability({ preMegaAbility: 'Levitate', assumedAbility: 'Shadow Tag' }, 12),
    'Assumes Levitate before Mega Evolution, then Shadow Tag; the starting ' +
      'ability is not required for inclusion (−12 with the other ability).');
  assert.equal(
    ability({
      preMegaAbility: 'Intimidate', assumedAbility: 'Mold Breaker',
      inputAbility: 'Intimidate',
    }, 150),
    'Assumes Intimidate before Mega Evolution, then Mold Breaker — the ' +
      'score leans on the starting ability (−150 with the other ability); ' +
      'pin it with "Torchic (Intimidate)" if yours matches.');
});

test('the evolutions assumed, held back and ruled out are each said', () => {
  const lines = explain({
    profile: {
      legalityProof: {
        evolutionSteps: [
          { to: 'combusken', reason: 'level 16' },
          { to: 'blaziken', reason: 'level 36', friction: 40 },
        ],
        delayedMoves: [
          { name: 'Flamethrower', source: 'level 43', locked: true },
          { name: 'Mirror Move', source: 'level 37' },
        ],
        buildFriction: 120,
        blockedEvolutions: [
          { to: 'togekiss', reason: 'Shiny Stone: none among your held items' },
          { to: 'notaspecies', reason: 'trade' },
        ],
      },
    },
  });
  assert.deepEqual(lines.slice(1), [
    'Evolution path: Combusken (level 16) → Blaziken (level 36, K 40).',
    'Requires delayed evolution for Flamethrower (level 43, locked), ' +
      'Mirror Move (level 37) — K 120.',
    // A species the dex does not know keeps its id.
    'Not assumed: Togekiss (Shiny Stone: none among your held items); ' +
      'notaspecies (trade).',
  ]);
});

test('a pick is credited with the types it answers best on the team', () => {
  const [first, second] = analysisTypes();
  const third = analysisTypes()[2];
  const member = (values) =>
    seat({ profile: { coverageVector: coverage(values) } });
  const lead = member({ [first]: 0.9, [second]: 0.6, [third]: 0.44 });
  const tied = member({ [first]: 0.5, [second]: 0.6 });
  const team = [lead, tied];
  // The best answer on the team, a tie counting for both; a hit under 45%
  // is not an answer at all.
  assert.equal(
    explainSeatedChoice(lead, team).at(-1),
    `Team's best answer into ${first}/${second}.`);
  assert.equal(
    explainSeatedChoice(tied, team).at(-1),
    `Team's best answer into ${second}.`);
  // With nothing to credit, nothing is said.
  const outdone = member({ [first]: 0.5 });
  assert.equal(explainSeatedChoice(outdone, [lead, outdone]).length, 1);
});

test('the stability sweep adds how firmly the seat is held', () => {
  assert.equal(
    explain({}, null, { frequency: 0.941, tier: 'core', dropConditions: [] })
      .at(-1),
    'Appears in 94% of robustness settings (core).');
  assert.equal(
    explain({}, null, {
      frequency: 0.5, tier: 'flex',
      dropConditions: ['coverage-light', 'gate-up'],
    }).at(-1),
    'Appears in 50% of robustness settings (flex). ' +
      'Drops under: coverage-light, gate-up.');
});

test('a benched Pokémon is told what it lost on', () => {
  const [first] = analysisTypes();
  const weakest = {
    inputName: 'Shellos', teamScore: 750,
    legalityProfile: { coverageVector: coverage({ [first]: 0.8 }) },
  };
  const result = { team: [{ inputName: 'Torchic', teamScore: 900 }, weakest] };
  assert.deepEqual(
    explainExcludedChoice({
      teamScore: 557.4, friction: 39.6, online: 0.2,
      legalityProfile: {
        coverageVector: coverage({ [first]: 0.7 }),
        legalityProof: {
          blockedEvolutions: [
            { to: 'arcanine', reason: 'Fire Stone: none among your held items' },
          ],
        },
      },
    }, result, { frequency: 0.147 }),
    [
      'Lower current value than the weakest seat (557 vs Shellos 750).',
      'Coverage redundant: adds no answer the team lacks.',
      'Carries friction K 40 (evolution requirements).',
      'Better forms unavailable: Arcanine — Fire Stone: none among your ' +
        'held items.',
      "Readiness gate: cannot express its line's strength at this stage.",
      'Seats in 15% of robustness settings — a genuine flex option.',
    ]);
  // Worth more than the weakest seat and bringing an answer of its own, it
  // lost on team fit; only the answer is said.
  assert.deepEqual(
    explainExcludedChoice({
      teamScore: 800,
      legalityProfile: { coverageVector: coverage({ [first]: 0.95 }) },
    }, result, null),
    [`Would add coverage into ${first}.`]);
});

test('a real team explains itself without a gap in any sentence', async () => {
  const pool = [
    'Magikarp', 'Gastly', 'Torchic', 'Togepi', 'Magnemite', 'Budew',
    'Growlithe', 'Yamask', 'Shellos',
  ];
  const result = await runPool({
    pool, progression: progressionAt({ badge: 1, levelCap: 20 }),
  });
  const teamIds = new Set(result.team.map((choice) => choice.inputPokemonId));
  const benched = result.lines
    .map((line) => line.best || line.bestNonMega)
    .filter((choice) => choice && !teamIds.has(choice.inputPokemonId));
  assert.ok(benched.length, 'the pool leaves someone out');

  const said = [
    ...result.team.map((choice) => {
      const lines = explainSeatedChoice(choice, result.team, null);
      // Role with its figures, then the set: every seat has both.
      assert.match(lines[0], /^Seats as [^()]+ \([^()]+\)\.$/, choice.inputName);
      assert.ok(
        lines.some((line) => line.startsWith('Set: ')), choice.inputName);
      return lines;
    }),
    ...benched.map((choice) => {
      const lines = explainExcludedChoice(choice, result, null);
      assert.ok(lines.length, `${choice.inputName} is given a reason`);
      return lines;
    }),
  ].flat();
  for (const line of said) {
    assert.doesNotMatch(line, /undefined|NaN|null|\(\)|\[object/, line);
  }
});
