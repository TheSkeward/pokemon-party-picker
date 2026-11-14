// The stability sweep (src/teamBuilder/confidence.js): the team re-chosen
// under each one-knob change to the model, and how often each pick keeps
// its seat. The sweep works by changing the scoring constants for the
// whole thread, so what it must never do matters as much as what it
// reports: leave a change behind, let another task run while one is in
// force, or alter the result it was handed.
import assert from 'node:assert/strict';
import test from 'node:test';

const { loadShared, progressionAt, runPool } = await import(
  './helpers/harness.mjs',
);
const { CONFIDENCE_GRID, classifyFrequency, computeTeamConfidence } =
  await import('../src/teamBuilder/confidence.js');
const { SCORING_DEFAULTS, getScoringOverrides } = await import(
  '../src/teamBuilder/scoring-constants.js',
);

const POOL = [
  'Magikarp', 'Gastly', 'Torchic', 'Togepi', 'Magnemite', 'Budew',
  'Growlithe', 'Yamask', 'Shellos', 'Espurr', 'Abra', 'Machop', 'Geodude',
  'Zubat', 'Oddish', 'Venipede',
];
const progression = progressionAt({ badge: 3, levelCap: 40 });
const SETTINGS = CONFIDENCE_GRID.length + 1;

const { availability } = await loadShared();
const result = await runPool({ pool: POOL, progression });
const sweep = (extra = {}) => computeTeamConfidence({
  result, availability, family: 'singles', progression, ...extra,
});

// What the sweep could disturb in the result it reads.
const snapshot = () => JSON.stringify(result.lines.map((line) => [
  line.best?.pokemonId, line.best?.score, line.best?.teamScore,
  line.bestNonMega?.pokemonId,
  (line.choiceOptions || []).map((option) => option.pokemonId),
]));

test('a seat is core, likely, flex or fragile by how often it is kept', () => {
  assert.equal(classifyFrequency(1), 'core');
  assert.equal(classifyFrequency(0.9), 'core');
  assert.equal(classifyFrequency(0.89), 'likely');
  assert.equal(classifyFrequency(0.6), 'likely');
  assert.equal(classifyFrequency(0.59), 'flex');
  assert.equal(classifyFrequency(0.25), 'flex');
  assert.equal(classifyFrequency(0.24), 'fragile');
  assert.equal(classifyFrequency(0), 'fragile');
});

test('every setting moves a constant the model has', () => {
  const keys = CONFIDENCE_GRID.map((setting) => setting.key);
  assert.equal(new Set(keys).size, keys.length, 'setting keys are distinct');
  for (const { key, overrides } of CONFIDENCE_GRID) {
    const names = Object.keys(overrides);
    // A name the model does not read would make the setting a second
    // baseline, and every seat look steadier than it is.
    for (const name of names) {
      assert.ok(name in SCORING_DEFAULTS, `${key}: ${name}`);
    }
    assert.ok(
      names.some((name) => overrides[name] !== SCORING_DEFAULTS[name]),
      `${key} changes something`);
  }
});

test('each pick is reported with the settings that unseat it', async () => {
  const before = snapshot();
  const confidence = await sweep();
  assert.equal(confidence.settings, SETTINGS);
  assert.deepEqual(
    confidence.members.map((member) => member.inputPokemonId),
    result.team.map((choice) => choice.inputPokemonId));

  const gridKeys = new Set(CONFIDENCE_GRID.map((setting) => setting.key));
  let unseated = 0;
  for (const member of confidence.members) {
    // The baseline is one of the settings, so no pick is ever at zero.
    const kept = SETTINGS - member.dropConditions.length;
    assert.equal(member.frequency, kept / SETTINGS, member.inputName);
    assert.ok(member.frequency > 0);
    assert.equal(member.tier, classifyFrequency(member.frequency));
    assert.ok(member.dropConditions.every((key) => gridKeys.has(key)));
    assert.equal(
      new Set(member.dropConditions).size, member.dropConditions.length);
    unseated += member.dropConditions.length;
  }

  // A benched Pokémon is an alternative once it seats in a tenth of the
  // settings; the seats the alternatives take are seats a pick gave up.
  const teamIds = new Set(result.team.map((choice) => choice.inputPokemonId));
  const frequencies = confidence.alternatives.map((alt) => alt.frequency);
  let taken = 0;
  for (const alternative of confidence.alternatives) {
    assert.ok(!teamIds.has(alternative.inputPokemonId));
    assert.ok(alternative.frequency >= 0.1 && alternative.frequency < 1);
    assert.ok(POOL.includes(alternative.inputName), alternative.inputName);
    taken += Math.round(alternative.frequency * SETTINGS);
  }
  assert.deepEqual(frequencies, [...frequencies].sort((a, b) => b - a));
  assert.ok(taken <= unseated, `${taken} seats taken, ${unseated} given up`);

  // The result handed in is as it was, and no change is left in force.
  assert.equal(snapshot(), before);
  assert.equal(getScoringOverrides(), null);
});

test('the same result sweeps to the same answer', async () => {
  assert.deepEqual(await sweep(), await sweep());
});

test('no other task runs while a setting is in force', async () => {
  // A click that starts an optimize is a task. One that ran while the
  // constants were changed would score, and cache, a team under them.
  let ticks = 0;
  let ticksUnderOverrides = 0;
  let watching = true;
  const tick = () => {
    if (!watching) return;
    ticks += 1;
    if (getScoringOverrides()) ticksUnderOverrides += 1;
    setTimeout(tick, 0);
  };
  setTimeout(tick, 0);
  try {
    await sweep();
  } finally {
    watching = false;
  }
  // The sweep does stand aside, once after every setting.
  assert.ok(ticks >= CONFIDENCE_GRID.length, `${ticks} ticks`);
  assert.equal(ticksUnderOverrides, 0);
});

test('a sweep the caller gives up on stops before its next setting', async () => {
  // Says "give up" from the nth time of asking.
  let asked = 0;
  const giveUpFrom = (nth) => () => {
    asked += 1;
    return asked >= nth;
  };
  assert.equal(await sweep({ shouldAbort: giveUpFrom(1) }), null);
  assert.equal(asked, 1);

  asked = 0;
  assert.equal(await sweep({ shouldAbort: giveUpFrom(4) }), null);
  assert.equal(asked, 4);
  assert.equal(getScoringOverrides(), null);

  // Left alone, it asks once before every setting.
  asked = 0;
  await sweep({ shouldAbort: giveUpFrom(Infinity) });
  assert.equal(asked, CONFIDENCE_GRID.length);
});

test('there is nothing to sweep without a team', async () => {
  assert.equal(await sweep({ result: null }), null);
  assert.equal(await sweep({ result: { ...result, team: [] } }), null);
  assert.equal(await sweep({ result: { ...result, lines: [] } }), null);
});

test('a pool that only just fills the team keeps every seat', async () => {
  const pool = ['Torchic', 'Magnemite', 'Shellos'];
  const small = await runPool({ pool, progression });
  const confidence = await sweep({ result: small });
  assert.equal(confidence.members.length, small.team.length);
  for (const member of confidence.members) {
    assert.equal(member.frequency, 1, member.inputName);
    assert.equal(member.tier, 'core');
    assert.deepEqual(member.dropConditions, []);
  }
  assert.deepEqual(confidence.alternatives, []);
});
