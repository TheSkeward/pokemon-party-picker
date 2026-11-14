// The level-cap investment projection (src/teamBuilder/investment.js):
// which caps it looks ahead to, which list each benched Pokémon lands in,
// and what the panel says about it. Two faults were found writing these: a
// Pokémon that seats at the next cap was filed under "do not invest yet"
// when its score rose a point more at the cap after, and a score that falls
// at a higher cap read "+-3".
import assert from 'node:assert/strict';
import test from 'node:test';

const { loadShared, progressionAt, runPool } = await import(
  './helpers/harness.mjs',
);
const { buildInvestmentPlan, computeInvestmentPlan, nextLevelCaps } =
  await import('../src/teamBuilder/investment.js');
const { getCheckpoints } = await import('../src/games/schedule.js');
const { OptimizePhase } = await import('../src/teamBuilder/optimize-phase.js');
const { renderPostAnalysisSections } = await import(
  '../src/teamBuilder/team-builder-view.js',
);

test('the next caps are the distinct caps above the current one', () => {
  const caps = [...new Set(getCheckpoints().map((c) => c.levelCap))];
  assert.deepEqual(nextLevelCaps(String(caps[2])), caps.slice(3, 5));
  // Past the last cap, and with no cap set, nothing lies ahead.
  assert.deepEqual(nextLevelCaps(String(caps.at(-1))), []);
  assert.deepEqual(nextLevelCaps(''), []);
  assert.deepEqual(nextLevelCaps(undefined), []);
});

// A choice as the optimizer returns one, cut down to what the plan reads.
function choice(id, score, species = id) {
  return {
    inputPokemonId: id,
    inputName: id[0].toUpperCase() + id.slice(1),
    score,
    legalityProfile: {
      currentId: species,
      currentName: species[0].toUpperCase() + species.slice(1),
    },
  };
}

// A result holding one line per choice, with the named inputs seated.
function resultOf(choices, seated, extra = {}) {
  return {
    lines: choices.map((best) => ({ best })),
    team: choices.filter((entry) => seated.includes(entry.inputPokemonId)),
    ...extra,
  };
}

function planFor(now, futures, extra = {}) {
  const result = resultOf(now.choices, now.seated, extra);
  return buildInvestmentPlan({
    nowByInput: new Map(now.choices.map((c) => [c.inputPokemonId, c])),
    teamIds: new Set(now.seated),
    result,
    futureResults: futures.map(({ cap, choices, seated }) => ({
      cap, result: resultOf(choices, seated),
    })),
  });
}

const SEATED = ['aa', 'bb'];
const seats = (score = 900) => SEATED.map((id) => choice(id, score));

test('a benched Pokémon is filed by what the upcoming caps do for it', () => {
  const plan = planFor(
    { choices: [...seats(), choice('magikarp', 100), choice('zubat', 400),
      choice('oddish', 300), choice('abra', 500)], seated: SEATED },
    [{
      cap: 25,
      choices: [...seats(), choice('magikarp', 800, 'gyarados'),
        choice('zubat', 430), choice('oddish', 290), choice('abra', 500)],
      seated: ['aa', 'magikarp'],
    }],
  );
  assert.deepEqual(plan.caps, [25]);
  // Seats later, or gains enough to be worth the levels: train it.
  assert.deepEqual(plan.trainSoon, [{
    inputPokemonId: 'magikarp', inputName: 'Magikarp', cap: 25, gain: 700,
    evolves: true, evolvesInto: 'Gyarados', seatsLater: true,
  }]);
  // The rest, largest gain first; a score may fall at a higher cap.
  assert.deepEqual(
    plan.holdOff.map((entry) => [entry.inputPokemonId, entry.gain]),
    [['zubat', 30], ['abra', 0], ['oddish', -10]]);
  // Today's team is in neither list.
  const listed = [...plan.trainSoon, ...plan.holdOff]
    .map((entry) => entry.inputPokemonId);
  assert.ok(!listed.some((id) => SEATED.includes(id)));
});

test('a large gain is worth training for without a seat', () => {
  const at = (score) => planFor(
    { choices: [...seats(), choice('budew', 100)], seated: SEATED },
    [{ cap: 25, choices: [...seats(), choice('budew', score)], seated: SEATED }],
  );
  assert.equal(at(350).trainSoon.length, 1);
  assert.equal(at(349).holdOff.length, 1);
});

test('one cap speaks for a Pokémon: where it seats, then where it gains most', () => {
  const now = {
    choices: [...seats(), choice('krabby', 500), choice('purrloin', 500),
      choice('horsea', 500), choice('seel', 500)],
    seated: SEATED,
  };
  const plan = planFor(now, [
    {
      cap: 40,
      choices: [...seats(), choice('krabby', 491), choice('purrloin', 500),
        choice('horsea', 520), choice('seel', 540)],
      seated: ['aa', 'krabby', 'seel'],
    },
    {
      cap: 45,
      choices: [...seats(), choice('krabby', 494), choice('purrloin', 500),
        choice('horsea', 560), choice('seel', 580)],
      seated: ['aa', 'purrloin', 'seel'],
    },
  ]);
  const entry = (id) => [...plan.trainSoon, ...plan.holdOff]
    .find((row) => row.inputPokemonId === id);
  // Seats at the nearer cap though its score is a little higher at the next.
  assert.deepEqual(
    [entry('krabby').cap, entry('krabby').gain, entry('krabby').seatsLater],
    [40, -9, true]);
  // Seats only at the further cap, the gains level.
  assert.deepEqual(
    [entry('purrloin').cap, entry('purrloin').seatsLater], [45, true]);
  // Seats at both: the cap that gains more.
  assert.deepEqual([entry('seel').cap, entry('seel').gain], [45, 80]);
  // Seats at neither: the cap that gains more.
  assert.deepEqual(
    [entry('horsea').cap, entry('horsea').gain, entry('horsea').seatsLater],
    [45, 60, false]);
  // Seats come first in the list, then the larger gain.
  assert.deepEqual(
    plan.trainSoon.map((row) => row.inputPokemonId),
    ['seel', 'purrloin', 'krabby']);
});

test('the close bench is measured against the team, not the best swap', () => {
  const now = {
    choices: [...seats(), choice('gastly', 400), choice('growlithe', 400),
      choice('geodude', 400), choice('magikarp', 100)],
    seated: SEATED,
  };
  const future = [{
    cap: 25,
    choices: [...seats(), choice('gastly', 400), choice('growlithe', 400),
      choice('geodude', 400), choice('magikarp', 800, 'gyarados')],
    seated: SEATED,
  }];
  const swaps = new Map([
    ['gastly', 9850], ['growlithe', 9849], ['geodude', 5000],
    ['magikarp', 9990], ['aa', 9999],
  ]);
  const close = (extra) => planFor(now, future, extra).closeBench
    .map((entry) => entry.inputPokemonId);
  // Within 1.5% of the team's score; a Pokémon the plan already says to
  // train is not listed twice.
  assert.deepEqual(
    close({ teamScore: 10000, benchSwapScores: swaps }), ['gastly']);
  // A bench that is weak throughout is not close to anything.
  assert.deepEqual(close({ teamScore: 20000, benchSwapScores: swaps }), []);
  // With no team score to measure against, the list stays empty.
  assert.deepEqual(close({ benchSwapScores: swaps }), []);
  assert.deepEqual(close({ teamScore: 10000 }), []);
});

const POOL = [
  'Magikarp', 'Gastly', 'Torchic', 'Togepi', 'Magnemite', 'Budew',
  'Growlithe', 'Yamask', 'Shellos',
];

test('the plan re-runs the pool at the next two caps, the first shown early', async () => {
  const { availability, pokemonIndex } = await loadShared();
  // Level 18: Magikarp is two levels short of Gyarados.
  const progression = progressionAt({ badge: 1, levelCap: 18 });
  const result = await runPool({ pool: POOL, progression });
  const benched = result.lines
    .map((line) => (line.best || line.bestNonMega).inputPokemonId)
    .filter((id) => !result.team.some((c) => c.inputPokemonId === id));
  assert.ok(benched.includes('magikarp'), 'Magikarp does not seat at 18');

  const partials = [];
  const shared = {
    availability, family: 'singles', pokemonIndex, progression,
    query: POOL.join('\n'), result,
  };
  const plan = await computeInvestmentPlan({
    ...shared, onPartial: (partial) => partials.push(partial),
  });
  const caps = nextLevelCaps(18);
  assert.equal(caps.length, 2);
  assert.deepEqual(plan.caps, caps);
  assert.ok(!plan.partial);
  // The first cap's plan arrives alone, marked as such.
  assert.equal(partials.length, 1);
  assert.deepEqual(partials[0].caps, [caps[0]]);
  assert.equal(partials[0].partial, true);
  assert.deepEqual(partials[0].pendingCaps, [caps[1]]);

  // Every benched Pokémon is in exactly one of the two lists.
  const listed = [...plan.trainSoon, ...plan.holdOff]
    .map((entry) => entry.inputPokemonId);
  assert.deepEqual([...listed].sort(), [...benched].sort());
  const magikarp = plan.trainSoon
    .find((entry) => entry.inputPokemonId === 'magikarp');
  assert.ok(magikarp, 'Magikarp is worth training');
  assert.equal(magikarp.evolves, true);
  assert.equal(magikarp.evolvesInto, 'Gyarados');
  assert.ok(magikarp.gain > 0);

  // Nothing to project: no cap ahead, no team, or the caller gave up.
  assert.equal(await computeInvestmentPlan({
    ...shared, progression: { ...progression, levelCap: '' },
  }), null);
  assert.equal(await computeInvestmentPlan({
    ...shared, result: { ...result, team: [] },
  }), null);
  assert.equal(await computeInvestmentPlan({
    ...shared, shouldAbort: () => true,
  }), null);
});

test('the panel signs a score change either way', () => {
  const row = (id, gain, extra = {}) => ({
    inputPokemonId: id, inputName: id, cap: 25, gain, evolves: false,
    evolvesInto: null, seatsLater: false, ...extra,
  });
  const html = renderPostAnalysisSections({
    result: { team: [], lines: [] },
    phase: OptimizePhase.COMPLETE,
    confidence: null,
    postAnalysisSkipReason: null,
    investment: {
      caps: [25, 35],
      trainSoon: [
        row('Magikarp', 700,
          { evolves: true, evolvesInto: 'Gyarados', seatsLater: true }),
        row('Krabby', -9, { seatsLater: true }),
      ],
      holdOff: [row('Zubat', 30), row('Oddish', -10), row('Abra', 0)],
      closeBench: [],
    },
  });
  assert.match(
    html, /Magikarp<\/strong> — evolves into Gyarados, \+700 value at cap 25, projected to SEAT/);
  assert.match(html, /Krabby<\/strong> — −9 value at cap 25, projected to SEAT/);
  assert.match(html, /Zubat — \+30 at cap 25/);
  assert.match(html, /Oddish — −10 at cap 25/);
  assert.match(html, /Abra — \+0 at cap 25/);
  assert.doesNotMatch(html, /\+-|\+−/);
});
