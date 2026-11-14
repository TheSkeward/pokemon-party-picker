/**
 * @fileoverview The Team Builder page's optimize run: the optimizer call,
 * the team's item loading, the analysis that follows (stability sweep and
 * investment plan), and the debounced re-optimize after an edit.
 *
 * Two rules hold the runs together. The newest run owns the page: a run
 * checks its token after every wait and stops quietly once a newer one has
 * started or an edit has disowned it. And no optimizer scoring runs while
 * a sweep setting is in force: the sweep changes the scoring constants for
 * the whole thread, so an optimize asks a live analysis to stop and waits
 * for it before it scores anything.
 *
 * The run owns these fields of the page's state: `result`, the stamp of
 * the progression it was optimized against (`resultProgressionKey`,
 * `resultEvolutionItemIds`), `phase`, `confidence`, `investment`,
 * `postAnalysisSkipReason`, and the team's item usage, context and
 * recommendations.
 */
import { evolutionItemsAbove } from '../../playthrough/evolution-requirements.js';
import { computeTeamConfidence } from '../confidence.js';
import { computeInvestmentPlan } from '../investment.js';
import { loadTeamItemUsage } from '../item-recommendations';
import { OptimizePhase } from '../optimize-phase.js';
import { ProgressPhase } from '../optimize-progress.js';
import { getPoolStats, normalizePoolText, withDonors } from '../pool-parsing';
import { setScoringOverrides } from '../scoring-constants.js';
import { getTeamItemContext } from '../team-analysis';
import { optimizeTeamFromPool, persistPostAnalysis } from '../team-optimizer';
import { recordOptimizerSample } from '../telemetry.js';
import { SCORED_POOL_LIMIT } from '../usage-line-ranking.js';
import { postAnalysisSkipReason } from './post-analysis-limits.js';
import { createProgressBar } from './progress-bar.js';
import { progressionKey } from './result-freshness.js';
import { savePool } from './saved-inputs.js';

// After a progression change that invalidates the team, the optimizer
// re-runs by itself, debounced so rapid edits (a dragged slider, several
// TMs) settle into one run.
const REOPTIMIZE_DELAY_MS = 600;
/**
 * The debounce for edits that come in bursts a few seconds apart (a shop
 * haul of items, a badge's worth of TM boxes), which must not pay a full
 * recompute per pause.
 */
export const BATCH_EDIT_REOPTIMIZE_DELAY_MS = 5000;
// How long the analysis waits for the Sets & coverage panel before it
// starts regardless, so a wedged panel never blocks it.
const PANEL_WAIT_MS = 20_000;

function waitForPaint() {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, 100);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(fallback);
        resolve();
      }),
    );
  });
}

function summarize(result, saved) {
  const polishSwaps = result.searchPolish?.swaps?.length || 0;
  return [
    `Optimized ${result.team.length} picks from ${result.linesConsidered} resolved inputs.`,
    result.searchExact
      ? ''
      : ' Pool too large for an exact search — used a fast approximate one.',
    // A repair by the swap audit means the shortlist heuristics missed a
    // seat; the healthy case (audit ran, nothing found) is reported in the
    // provenance footer instead.
    polishSwaps
      ? ` The full-pool swap audit then improved it (${polishSwaps} swap${polishSwaps === 1 ? '' : 's'}).`
      : '',
    result.degraded
      ? ' Some data failed to load, so parts of the pool were skipped — optimize again to retry.'
      : '',
    saved
      ? ''
      : ' Pool could not be saved locally; browser storage is full.',
  ].join('');
}

// One telemetry sample per completed interactive pipeline: the optimizer's
// phases from its own meta, the item, render and analysis phases measured
// by the run.
function recordPipelineSample(result, pipeline) {
  const meta = result.telemetryMeta;
  const swaps = result.searchPolish?.swaps;
  try {
    recordOptimizerSample({
      cache: meta.cache,
      resolveMs: meta.resolveMs,
      searchMs: meta.searchMs,
      poolSize: meta.poolSize,
      builds: meta.builds,
      dataSignature: meta.dataSignature,
      phases: pipeline.phases,
      totalMs: pipeline.totalMs,
      movesetMs: pipeline.movesetMs ?? null,
      fullMs: Date.now() - pipeline.pipelineStart,
      // Repairs applied by the full-pool swap audit, null on exact paths
      // where no audit runs. Their rate across runs says whether the
      // shortlist heuristics are good enough.
      polishSwaps: swaps ? swaps.length : null,
      polishGain: swaps
        ? swaps.reduce((sum, swap) => sum + (swap.gain || 0), 0)
        : null,
    });
  } catch {
    // Telemetry must never break the pipeline.
  }
}

/**
 * @param {!Object} page The page (pool-widget.js).
 * @return {{optimize: function(!Object=): !Promise,
 *     analyzeDeferred: function(), discardResult: function(): boolean,
 *     isResultStale: function(): boolean,
 *     scheduleReoptimize: function(boolean, number=)}}
 */
export function createOptimizeRun(page) {
  const { state, data, setDetails } = page;
  const progress = createProgressBar(page.app);

  let runToken = 0;
  let sweepAbortRequested = false;
  let activeAnalysis = Promise.resolve();
  let reoptimizeTimer = null;

  /** @return {boolean} Whether the progression has moved on from the team. */
  function isResultStale() {
    return Boolean(
      state.result &&
        state.resultProgressionKey &&
        state.resultProgressionKey !== progressionKey(
          state.progression, state.resultEvolutionItemIds),
    );
  }

  /**
   * Drops the result and what was derived from it, for an edit that makes
   * it answer the wrong question. That ends the run that produced it: a
   * sweep in flight sees the result change and stops itself, and an
   * optimize in flight is disowned, since the team it would land is for
   * the pool as it was. (The optimizer finishes unheard and its result
   * stays cached.)
   * @return {boolean} Whether an optimize was interrupted, which leaves
   *     its progress panel on the page for the caller to render away.
   */
  function discardResult() {
    state.result = null;
    state.resultProgressionKey = '';
    state.teamItemUsage = null;
    state.teamItemContext = null;
    state.itemRecommendations = {};
    const interrupted = state.phase === OptimizePhase.OPTIMIZING;
    if (interrupted) {
      runToken += 1;
      progress.stop();
    }
    state.phase = OptimizePhase.IDLE;
    return interrupted;
  }

  /**
   * @param {{exhaustive: (boolean|undefined),
   *     background: (boolean|undefined)}=} options `exhaustive` asks for
   *     an exact search, which the Optimize button and other direct
   *     triggers do; a `background` run is one the page started itself
   *     (a load with a saved pool, the debounced re-optimize, an import),
   *     which accepts the fast approximation and leaves a cold analysis
   *     for the panel's button.
   */
  async function optimize({ exhaustive = true, background = false } = {}) {
    setDetails.cancel();

    const token = ++runToken;
    const superseded = () => token !== runToken;
    // Ask a live sweep to stop at its next setting, and wait for it.
    sweepAbortRequested = true;
    await activeAnalysis;
    if (superseded()) return;

    state.phase = OptimizePhase.OPTIMIZING;
    state.statusMessage = 'Optimizing pool...';
    state.confidence = null;
    state.investment = null;
    state.postAnalysisSkipReason = null;
    page.render();
    progress.start(Math.min(
      getPoolStats(state.query, data.pokemonIndex).uniqueCount,
      SCORED_POOL_LIMIT,
    ));
    await waitForPaint();
    if (superseded()) return;

    // The clock the player feels: everything between the click and the
    // team on screen, item loading and rendering included.
    const pipelineStart = Date.now();
    const phases = {};

    try {
      state.query = normalizePoolText(state.query, data.pokemonIndex);
      page.absorbPool();
      const saved = savePool(state.query);

      // The inputs this run is computed against. Stamping the result from
      // live state after the wait would let an edit made mid-run mark the
      // old inputs' result as fresh.
      const runProgression = state.progression;

      const result = await optimizeTeamFromPool({
        availability: data.availability,
        family: state.family,
        pokemonIndex: data.pokemonIndex,
        progression: runProgression,
        query: state.query,
        donorQuery: state.donorQuery,
        onProgress: progress.report,
        exhaustive,
      });
      if (superseded()) return;
      state.result = result;
      state.resultEvolutionItemIds = evolutionItemsAbove(
        result.lines
          .filter((line) => !line.unresolved)
          .map((line) => line.inputName),
      );
      state.resultProgressionKey =
        progressionKey(runProgression, state.resultEvolutionItemIds);
      const meta = result.telemetryMeta;
      if (meta) {
        phases.setup = meta.setupMs;
        phases.resolve = meta.resolveMs;
        phases.search = meta.searchMs;
      }

      // Each member's recommended-move types and real top-set ability,
      // resolved once so gem recommendations can be gated on them.
      progress.report({ phase: ProgressPhase.ITEMS });
      const itemsStart = Date.now();
      const teamItemContext = await getTeamItemContext(
        result.team,
        state.progression,
        {
          family: state.family,
          pokemonIndex: data.pokemonIndex,
          query: withDonors(state.query, state.donorQuery),
        },
      );
      if (superseded()) return;
      state.teamItemContext = teamItemContext;
      state.teamItemUsage = await loadTeamItemUsage({
        team: result.team,
        family: state.family,
        itemContext: teamItemContext,
      });
      if (superseded()) return;
      page.recomputeItemRecommendations();
      phases.items = Date.now() - itemsStart;

      setDetails.cancel();
      progress.stop();
      // The team is in. The analysis owns the phase from here, so the
      // render below shows its panels as pending rather than the bar.
      state.phase = OptimizePhase.ANALYZING;
      state.statusMessage = summarize(result, saved);

      page.writeUrl();
      const renderStart = Date.now();
      const handle = page.render();
      phases.render = Date.now() - renderStart;

      // The analysis is computed after the team renders so the click stays
      // quick; each part re-renders as it lands.
      activeAnalysis = analyze(result, {
        pipelineStart,
        phases,
        totalMs: Date.now() - pipelineStart,
        background,
        analysisPanelReady: handle?.analysisPanelReady || null,
      });
    } catch (error) {
      if (superseded()) return;
      console.error('Team Builder optimization failed', error);
      progress.stop();
      state.phase = OptimizePhase.FAILED;
      state.result = null;
      state.statusMessage = `Optimization failed: ${error?.message || error}`;
      setDetails.cancel();
      page.render();
    }
  }

  // Leaves the analysis step with a phase that needs no computing.
  function settle(phase, pipeline) {
    state.phase = phase;
    if (pipeline) {
      pipeline.phases.confidence = 0;
      pipeline.phases.investment = 0;
    }
    page.render();
  }

  /**
   * The stability sweep, then the investment plan, for a result on the
   * page. Entered after an optimize and from the deferred panel's button.
   * @param {!Object} forResult
   * @param {?Object} pipeline The optimize's timings, to be completed and
   *     recorded; null from the button.
   */
  async function analyze(forResult, pipeline = null) {
    sweepAbortRequested = false;
    state.phase = OptimizePhase.ANALYZING;
    state.confidence = null;
    state.investment = null;
    state.postAnalysisSkipReason = null;
    const current = () => state.result === forResult;
    const shouldAbort = () => sweepAbortRequested || !current();
    let superseded = false;
    try {
      if (forResult.postAnalysis) {
        state.confidence = forResult.postAnalysis.confidence || null;
        state.investment = forResult.postAnalysis.investment || null;
        settle(OptimizePhase.COMPLETE, pipeline);
        return;
      }

      const skipReason = postAnalysisSkipReason(forResult);
      if (skipReason) {
        state.postAnalysisSkipReason = skipReason;
        settle(OptimizePhase.ANALYSIS_SKIPPED, pipeline);
        return;
      }

      // A run the page started itself never pays for a cold analysis: the
      // investment plan alone is two more optimizer runs at future caps.
      // A saved analysis (above) still restores at once; without one the
      // panel offers a button, and an Optimize click computes everything.
      if (pipeline?.background) {
        settle(OptimizePhase.ANALYSIS_DEFERRED, pipeline);
        return;
      }

      const pendingHandle = page.render();
      // The sweep's settings run as long synchronous blocks that starve
      // every pending continuation, so the Sets & coverage panel the
      // player is reading lands first. Its build is memoized: this
      // render's handle is the build the optimize's render started.
      const panelReady =
        pendingHandle?.analysisPanelReady ||
        pipeline?.analysisPanelReady ||
        null;
      if (panelReady) {
        await Promise.race([
          panelReady.catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, PANEL_WAIT_MS)),
        ]);
        if (pipeline) {
          pipeline.movesetMs = Date.now() - pipeline.pipelineStart;
        }
        if (!current()) {
          superseded = true;
          return;
        }
      }

      const confidenceStart = Date.now();
      const confidence = await computeTeamConfidence({
        result: forResult,
        availability: data.availability,
        family: state.family,
        progression: state.progression,
        shouldAbort,
      });
      if (!confidence || !current()) {
        superseded = true;
        return;
      }
      if (pipeline) pipeline.phases.confidence = Date.now() - confidenceStart;
      state.confidence = confidence;
      page.render();

      const investmentStart = Date.now();
      const investment = await computeInvestmentPlan({
        availability: data.availability,
        family: state.family,
        pokemonIndex: data.pokemonIndex,
        progression: state.progression,
        query: state.query,
        donorQuery: state.donorQuery,
        result: forResult,
        shouldAbort,
        // The first future cap's plan renders as soon as it lands, marked
        // partial, instead of waiting for the second.
        onPartial: (partialPlan) => {
          if (shouldAbort()) return;
          state.investment = partialPlan;
          page.render();
        },
      });
      if (!current()) {
        superseded = true;
        return;
      }
      if (pipeline) pipeline.phases.investment = Date.now() - investmentStart;
      state.investment = investment;
      // Both landed for the current result: they are written through to
      // the cached record, so the next hit restores the panels. Not after
      // an abort, which also returns a null plan: stored, that would
      // replay an empty panel on every later hit. A plan that is null
      // because no cap lies ahead is stored like any other.
      if (!sweepAbortRequested) {
        persistPostAnalysis(forResult, { confidence, investment });
      }
    } catch (error) {
      console.warn('Post-analysis failed', error);
    } finally {
      setScoringOverrides(null);
      if (current()) {
        // A step still analyzing has settled, panels landed or not; the
        // early exits above already named their phase.
        if (state.phase === OptimizePhase.ANALYZING) {
          state.phase = OptimizePhase.COMPLETE;
        }
        // Superseded runs are dropped: partial timings would skew the
        // distributions. Recorded before the final render so the footer's
        // numbers include this run.
        if (pipeline && !superseded && forResult.telemetryMeta) {
          recordPipelineSample(forResult, pipeline);
        }
        page.render();
      }
    }
  }

  /** Runs the analysis a background run left for the panel's button. */
  function analyzeDeferred() {
    if (!state.result || state.phase !== OptimizePhase.ANALYSIS_DEFERRED) {
      return;
    }
    activeAnalysis = analyze(state.result, null);
  }

  /**
   * Re-optimizes once edits have settled, when they left the team stale.
   * @param {boolean} stale
   * @param {number=} delayMs
   */
  function scheduleReoptimize(stale, delayMs = REOPTIMIZE_DELAY_MS) {
    if (!stale || !state.result || !state.query.trim()) return;
    if (reoptimizeTimer) clearTimeout(reoptimizeTimer);
    reoptimizeTimer = setTimeout(() => {
      reoptimizeTimer = null;
      if (state.phase === OptimizePhase.OPTIMIZING) {
        scheduleReoptimize(true, delayMs);
        return;
      }
      void optimize({ exhaustive: false, background: true });
    }, delayMs);
  }

  return {
    optimize,
    analyzeDeferred,
    discardResult,
    isResultStale,
    scheduleReoptimize,
  };
}
