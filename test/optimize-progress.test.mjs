// Every progress report the optimizer emits is spelled from the shared
// vocabulary, so the widget's caption switch can never meet a string it
// does not know.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadShared, progressionAt } from './helpers/harness.mjs';

const { optimizeTeamFromPool } = await import(
  '../src/teamBuilder/team-optimizer.js',
);
const { ProgressPhase, SearchStage } = await import(
  '../src/teamBuilder/optimize-progress.js',
);

test('a cold optimize reports only the shared phases and stages', async () => {
  const { availability, pokemonIndex } = await loadShared();
  const reports = [];
  await optimizeTeamFromPool({
    availability,
    family: 'singles',
    pokemonIndex,
    progression: progressionAt({ badge: 3, levelCap: 40 }),
    query: 'Gengar\nEevee\nPikachu\nMudkip\nTorchic\nTreecko\nFroakie\nRiolu',
    selection: 'all',
    onProgress: (report) => reports.push(report),
  });

  const phases = new Set(Object.values(ProgressPhase));
  const stages = new Set(Object.values(SearchStage));
  assert.ok(reports.length > 0);
  for (const report of reports) {
    assert.ok(phases.has(report.phase), `phase ${report.phase}`);
    if (report.stage !== undefined) {
      assert.ok(stages.has(report.stage), `stage ${report.stage}`);
    }
  }

  // A cold run walks resolve and search (rank only when the pool exceeds the
  // scored limit; items is the widget's own).
  const seen = new Set(reports.map((report) => report.phase));
  for (const phase of [ProgressPhase.RESOLVE, ProgressPhase.SEARCH]) {
    assert.ok(seen.has(phase), phase);
  }
  assert.ok(reports.some((report) => report.stage === SearchStage.SYNERGY));
  assert.ok(reports.some((report) => report.stage === SearchStage.REALIZE));
});
