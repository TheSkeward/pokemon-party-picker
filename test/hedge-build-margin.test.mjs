// A hedge build (coverage, utility, delayed) displaces its candidate's
// Standard set only by HEDGE_BUILD_MARGIN of the Standard set's score, both
// when a line picks its representative and when the team's builds are
// assigned; the realization fallbacks pay no margin.
import test from 'node:test';
import assert from 'node:assert/strict';
import { bestChoice, progressionAt, runPool } from './helpers/harness.mjs';

const { assignTeamBuilds, chooseBuildAssignment, orderLineBuilds } =
  await import('../src/teamBuilder/team-selection.js');
const { getRealizedTeamScore, setTypeChart } = await import(
  '../src/teamBuilder/search-kernel.js',
);
const { activeTypeChart } = await import('../src/playthrough/type-chart.js');
const { SCORING_DEFAULTS } = await import(
  '../src/teamBuilder/scoring-constants.js',
);

const MARGIN_ON_1000 = SCORING_DEFAULTS.HEDGE_BUILD_MARGIN * 1000;

const build = (name, buildKey, score, singleCopyTms = []) => ({
  name,
  buildKey,
  score,
  legalityProfile: { singleCopyTms },
});
const total = (team) => team.reduce((sum, member) => sum + member.score, 0);
const keys = (rows) => rows.map((row) => row.buildKey);

test('a hedge build is fielded only when it clears its margin', () => {
  assert.equal(MARGIN_ON_1000, 4);
  const skuntank = [build('Skuntank', 'default', 900)];

  const near = [
    [build('Lopunny', 'coverage', 1003), build('Lopunny', 'default', 1000)],
    skuntank,
  ];
  const kept = chooseBuildAssignment(near, total, true);
  assert.deepEqual(keys(kept.team), ['default', 'default']);
  assert.equal(kept.score, 1900);

  const clear = [
    [build('Lopunny', 'coverage', 1010), build('Lopunny', 'default', 1000)],
    skuntank,
  ];
  const displaced = chooseBuildAssignment(clear, total, true);
  assert.deepEqual(keys(displaced.team), ['coverage', 'default']);
  // The margin decides the choice; the score stays the team's own.
  assert.equal(displaced.score, 1910);
});

test('team fit can carry a hedge over its margin', () => {
  const chart = activeTypeChart();
  setTypeChart(chart);
  const vector = (first) => {
    const coverage = new Array(chart.types.length).fill(0);
    coverage[0] = first;
    return coverage;
  };
  const row = (buildKey, score, coverage) => ({
    name: 'Lopunny',
    buildKey,
    score,
    legalityProfile: { currentTypes: ['Normal'], coverageVector: coverage },
  });
  const standard = row('default', 1000, vector(0));
  const widened = row('coverage', 1001, vector(0.1));
  const gain =
    getRealizedTeamScore([widened]) - getRealizedTeamScore([standard]);
  // One point of the gain is the build's own; the rest is team fit.
  assert.ok(widened.score - standard.score < MARGIN_ON_1000);
  assert.ok(gain > MARGIN_ON_1000, `gain ${gain}`);

  const carried = assignTeamBuilds([
    { ...standard, buildAlternatives: [standard, widened] },
  ]);
  assert.equal(carried.team[0].buildKey, 'coverage');
  assert.equal(carried.score, getRealizedTeamScore([widened]));

  const unwidened = row('coverage', 1001, vector(0));
  const kept = assignTeamBuilds([
    { ...standard, buildAlternatives: [standard, unwidened] },
  ]);
  assert.equal(kept.team[0].buildKey, 'default');
  assert.equal(kept.score, getRealizedTeamScore([standard]));
});

test('two members switching to hedges must clear both margins', () => {
  const options = [
    [build('Lopunny', 'default', 1000), build('Lopunny', 'coverage', 1003)],
    [build('Pangoro', 'default', 1000), build('Pangoro', 'coverage', 1003)],
  ];
  const withPairBonus = (bonus) => (team) =>
    total(team) +
    (team.every((member) => member.buildKey === 'coverage') ? bonus : 0);
  // 3 + 3 + 1 falls short of 4 + 4; 3 + 3 + 3 clears it.
  assert.deepEqual(
    keys(chooseBuildAssignment(options, withPairBonus(1), true).team),
    ['default', 'default'],
  );
  const both = chooseBuildAssignment(options, withPairBonus(3), true);
  assert.deepEqual(keys(both.team), ['coverage', 'coverage']);
  assert.equal(both.score, 2009);
});

test('a fallback build pays no margin when the copies need it', () => {
  const options = [
    [
      build('Gengar', 'default', 1000, ['tm30']),
      build('Gengar', 'coverage', 1001),
      build('Gengar', 'without:tm30', 998),
    ],
    [build('Espeon', 'default', 1000, ['tm30'])],
  ];
  // Charged like a hedge, the fallback would lose to the coverage set at
  // 1001 - 4; it is exempt, so it realizes the plan.
  const honored = chooseBuildAssignment(options, total, true);
  assert.deepEqual(keys(honored.team), ['without:tm30', 'default']);
  assert.equal(honored.score, 1998);
});

test('the Standard set represents the line unless a hedge clears its margin', () => {
  const rows = (...pairs) =>
    pairs.map(([buildKey, score]) => ({ buildKey, score }));

  assert.deepEqual(
    keys(orderLineBuilds(
      rows(['coverage', 1003], ['default', 1000], ['utility', 990]))),
    ['default', 'coverage', 'utility'],
  );
  assert.deepEqual(
    keys(orderLineBuilds(
      rows(['coverage', 1010], ['default', 1000], ['utility', 990]))),
    ['coverage', 'default', 'utility'],
  );
  // The highest-scoring hedge that clears the margin represents the line.
  assert.deepEqual(
    keys(orderLineBuilds(
      rows(['delayed', 1006], ['coverage', 1003], ['default', 1000]))),
    ['delayed', 'coverage', 'default'],
  );
  // A fallback never represents the line on merit.
  assert.deepEqual(
    keys(orderLineBuilds(rows(['without:tm30', 1010], ['default', 1000]))),
    ['default', 'without:tm30'],
  );
  // Without a Standard set the score order stands.
  assert.deepEqual(
    keys(orderLineBuilds(rows(['coverage', 1010], ['utility', 1000]))),
    ['coverage', 'utility'],
  );
});

test('the optimizer offers the Standard set first while a hedge is within the margin', async () => {
  const progression = progressionAt({ badge: 2, levelCap: 35 });
  const representative = async (margin) =>
    bestChoice(
      await runPool({
        pool: ['Pancham'],
        progression,
        overrides: { HEDGE_BUILD_MARGIN: margin },
      }),
      'Pancham',
    );

  const free = await representative(0);
  assert.notEqual(free.buildKey, 'default', 'a hedge leads with no margin');
  const standard = free.buildAlternatives.find(
    (alt) => alt.buildKey === 'default',
  );
  const edge = free.score / standard.score - 1;

  const within = await representative(edge * 2);
  assert.equal(within.buildKey, 'default');
  assert.equal(within.buildAlternatives[0].buildKey, 'default');

  const beyond = await representative(edge / 2);
  assert.equal(beyond.buildKey, free.buildKey);
  assert.equal(beyond.buildAlternatives[0].buildKey, free.buildKey);
});
