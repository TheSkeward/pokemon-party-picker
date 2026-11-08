// The analysis panels follow the run's phase, not the booleans the phase
// replaced: each phase draws exactly its own notice or placeholder.
import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.__ENV__ ??= { BASE_URL: '/' };
const { OptimizePhase } = await import('../src/teamBuilder/optimize-phase.js');
const { renderPostAnalysisSections } = await import(
  '../src/teamBuilder/team-builder-view.js',
);

const base = {
  result: { team: [], lines: [] },
  confidence: null,
  investment: null,
  postAnalysisSkipReason: null,
};
const confidence = { members: [], alternatives: [], settings: 20 };

test('analyzing shows the sweep placeholder, then the investment one', () => {
  const sweeping = renderPostAnalysisSections({
    ...base,
    phase: OptimizePhase.ANALYZING,
  });
  assert.ok(sweeping.includes('Sweeping alternative model settings'));
  assert.ok(!sweeping.includes('Evaluating the pool'));
  assert.ok(!sweeping.includes('compute-post-analysis-button'));

  const investing = renderPostAnalysisSections({
    ...base,
    phase: OptimizePhase.ANALYZING,
    confidence,
  });
  assert.ok(investing.includes('Evaluating the pool at the next level caps'));
  assert.ok(!investing.includes('Sweeping alternative model settings'));
});

test('a deferred step offers the button; a skipped one explains the limit', () => {
  const deferred = renderPostAnalysisSections({
    ...base,
    phase: OptimizePhase.ANALYSIS_DEFERRED,
  });
  assert.ok(deferred.includes('id="compute-post-analysis-button"'));

  const skipped = renderPostAnalysisSections({
    ...base,
    phase: OptimizePhase.ANALYSIS_SKIPPED,
    postAnalysisSkipReason: {
      poolSize: 120,
      builds: 300,
      poolLimit: 80,
      buildLimit: 200,
    },
  });
  assert.ok(skipped.includes('120 Pokemon, 300 candidate builds'));
  assert.ok(!skipped.includes('compute-post-analysis-button'));
});

test('a settled step shows only the panels that landed', () => {
  for (const phase of [
    OptimizePhase.IDLE,
    OptimizePhase.OPTIMIZING,
    OptimizePhase.COMPLETE,
    OptimizePhase.FAILED,
  ]) {
    assert.equal(
      renderPostAnalysisSections({ ...base, phase }).trim(),
      '',
      phase,
    );
  }
  const complete = renderPostAnalysisSections({
    ...base,
    phase: OptimizePhase.COMPLETE,
    confidence,
  });
  assert.ok(complete.includes('Inclusion frequency across 20 settings'));
  assert.ok(!complete.includes('Evaluating the pool'));
});
