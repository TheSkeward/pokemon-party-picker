// The Team Builder page's logic that needs no page (src/teamBuilder/page):
// when a team has gone stale, when its analysis is too large to run, what
// the progress bar says and how far along it is, and where a selection
// sits after a render. All of it lived inside the page controller, which
// no unit test could load.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProgressPhase, SearchStage,
} from '../src/teamBuilder/optimize-progress.js';
import {
  postAnalysisSkipReason,
} from '../src/teamBuilder/page/post-analysis-limits.js';
import {
  estimateRemainingMs, progressCaption,
} from '../src/teamBuilder/page/progress-bar.js';
import { progressionKey } from '../src/teamBuilder/page/result-freshness.js';
import {
  selectionAfterRender,
} from '../src/teamBuilder/page/text-focus.js';

test('a team is stale once the progression it depends on has changed', () => {
  const progression = {
    levelCap: '35',
    availableTmIds: ['tm01', 'tm02'],
    opponentTypeBias: { Fire: 1, Water: 2 },
    ownedItems: { leftovers: 1, firestone: 1, waterstone: 2 },
  };
  const spendable = new Set(['firestone']);
  const key = progressionKey(progression, spendable);
  const changed = (change) =>
    progressionKey({ ...progression, ...change }, spendable);

  // The same progression, however its fields and lists are ordered.
  assert.equal(progressionKey({
    ownedItems: { waterstone: 2, firestone: 1, leftovers: 1 },
    opponentTypeBias: { Water: 2, Fire: 1 },
    availableTmIds: ['tm02', 'tm01'],
    levelCap: '35',
  }, spendable), key);

  assert.notEqual(changed({ levelCap: '40' }), key);
  assert.notEqual(changed({ availableTmIds: ['tm01'] }), key);
  assert.notEqual(changed({ opponentTypeBias: { Fire: 2, Water: 2 } }), key);

  // Held items feed the item recommendations, not the team: only an
  // evolution item a line of the pool can spend counts.
  const owning = (ownedItems) => changed({ ownedItems });
  assert.equal(owning({ firestone: 1, leftovers: 6, lifeorb: 1 }), key);
  assert.equal(owning({ firestone: 1, waterstone: 0 }), key);
  assert.notEqual(owning({ firestone: 2 }), key);
  assert.notEqual(owning({}), key);
  // None held is the same as never listed.
  assert.equal(owning({ firestone: 0 }), owning({}));
  assert.equal(progressionKey(null, []), progressionKey({}, []));
});

test('the analysis is skipped for a pool or a build count past its limits', () => {
  const lines = (count, builds = 1) => Array.from({ length: count }, () => ({
    best: builds > 1
      ? { buildAlternatives: Array.from({ length: builds }, () => ({})) }
      : {},
  }));
  assert.equal(postAnalysisSkipReason({ lines: lines(80) }), null);
  assert.deepEqual(postAnalysisSkipReason({ lines: lines(81) }), {
    poolSize: 81, builds: 81, poolLimit: 80, buildLimit: 200,
  });
  // Each line counts its builds, or one when it has no alternatives.
  assert.equal(postAnalysisSkipReason({ lines: lines(40, 5) }), null);
  assert.equal(postAnalysisSkipReason({ lines: lines(41, 5) }).builds, 205);
  // A line the optimizer could not resolve has nothing to count.
  assert.equal(
    postAnalysisSkipReason({ lines: [...lines(80), {}] }).builds, 80);
  // The optimizer's own counts are used where it gave them.
  assert.deepEqual(
    postAnalysisSkipReason({
      lines: lines(3), telemetryMeta: { poolSize: 126, builds: 240 },
    }),
    { poolSize: 126, builds: 240, poolLimit: 80, buildLimit: 200 });
  assert.equal(postAnalysisSkipReason(null), null);
});

test('the caption names the work in hand', () => {
  const caption = (report) => progressCaption(report);
  assert.equal(caption({}), 'Optimizing pool...');
  assert.equal(
    caption({ phase: ProgressPhase.RESOLVE, completed: 3, total: 12 }),
    'Scoring 3/12 Pokémon...');
  assert.equal(
    caption({ phase: ProgressPhase.RANK, completed: 40, total: 300 }),
    'Ranking 40/300 pool lines by usage...');
  assert.equal(
    caption({ phase: ProgressPhase.RANK }), 'Ranking pool lines by usage...');
  assert.equal(
    caption({ phase: ProgressPhase.ITEMS }),
    'Loading item usage for the team...');

  const search = (report) =>
    caption({ phase: ProgressPhase.SEARCH, ...report });
  assert.equal(search({}), 'Searching team combinations...');
  assert.equal(
    search({ completed: 450_000, total: 1_947_792 }),
    'Searching team combinations — 23% of 1.9M...');
  // Never a hundred while the search is still reporting.
  assert.equal(
    search({ completed: 38_760, total: 38_760 }),
    'Searching team combinations — 99% of 39k...');
  assert.equal(search({ completed: 5, total: 924 }),
    'Searching team combinations — 0% of 924...');
  assert.equal(
    search({ stage: SearchStage.SYNERGY }),
    'Search prep — loading teammate synergy...');
  assert.equal(
    search({ stage: SearchStage.POLISH, detail: { round: 3 } }),
    'Search done — auditing shortlist swaps (round 3)...');
  assert.equal(
    search({ stage: SearchStage.POLISH }),
    'Search done — auditing shortlist swaps (round 1)...');
  assert.equal(
    search({ stage: SearchStage.REALIZE }),
    'Search done — realizing best builds...');
  assert.equal(
    search({ stage: SearchStage.BENCH }),
    'Search done — ranking bench swaps...');
});

test('the time left follows counted work, then the measured search rate', () => {
  const budget = { resolveMs: 4000, searchMs: 10_000, tailMs: 600 };
  const left = (model, elapsedInPhase = 0) => estimateRemainingMs(
    { budget, phaseStart: 0, completed: 0, total: 0, ...model },
    elapsedInPhase);

  // Scoring lines: the unscored share of the resolve budget, then the rest.
  assert.equal(
    left({ phase: ProgressPhase.RESOLVE, completed: 5, total: 20 }),
    3000 + 10_000 + 600);
  assert.equal(
    left({ phase: ProgressPhase.RESOLVE }), 4000 + 10_000 + 600);
  // Ranking comes before all of it.
  assert.equal(
    left({ phase: ProgressPhase.RANK, completed: 150, total: 300 }),
    250 + 4000 + 10_000 + 600);

  // Searching: the budget's remainder until the workers have scanned
  // enough to measure, then the rate they are actually going at.
  const search = { phase: ProgressPhase.SEARCH };
  assert.equal(left(search, 2500), 7500 + 600);
  assert.equal(left({ ...search, searchFraction: 0.01 }, 2500), 7500 + 600);
  assert.equal(left({ ...search, searchFraction: 0.25 }, 3000), 9000 + 600);
  // Past its budget the estimate keeps a floor, so the bar still creeps.
  assert.equal(left(search, 60_000), 800 + 600);

  // The tail (items, render) counts down to a floor of its own.
  assert.equal(left({ phase: ProgressPhase.ITEMS }, 100), 500);
  assert.equal(left({ phase: ProgressPhase.ITEMS }, 5000), 120);
});

test('a selection is put back where its words now sit', () => {
  const focused = {
    id: 'pool-query-input', value: 'Froakie, Onix, Spearow',
    start: 9, end: 13, direction: 'forward', scrollTop: 0,
  };
  // The text as it was: the same place.
  assert.deepEqual(
    selectionAfterRender(focused, focused.value), { start: 9, end: 13 });
  // Rewritten by the render (a normalize sorts the pool): the same words.
  assert.deepEqual(
    selectionAfterRender(focused, 'Onix, Froakie, Spearow'),
    { start: 0, end: 4 });
  // Words that are gone, or a bare caret in text that moved, are not
  // guessed at.
  assert.equal(selectionAfterRender(focused, 'Froakie, Spearow'), null);
  assert.equal(
    selectionAfterRender({ ...focused, start: 9, end: 9 }, 'Onix, Froakie'),
    null);
  // A control with no selection to give.
  assert.equal(
    selectionAfterRender({ ...focused, start: null, end: null }, focused.value),
    null);
});
