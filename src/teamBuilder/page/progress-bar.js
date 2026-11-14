/**
 * @fileoverview The optimize progress bar and its caption.
 *
 * The bar spans the whole optimizer window using per-phase time budgets
 * estimated from this browser's telemetry for the pool's size (static
 * defaults on a first run). Countable work (line scoring) advances by its
 * real fraction; time-only phases (the search) advance by elapsed against
 * budget with an asymptotic tail, so the bar keeps moving through the slow
 * part instead of parking at 100%. Width is elapsed over elapsed plus the
 * estimated remainder, capped at 97% until the run finishes. A ticker
 * repaints during phases that report nothing.
 */
import { ProgressPhase, SearchStage } from '../optimize-progress.js';
import { estimateRunBudget } from '../telemetry.js';

const TICK_MS = 150;
const MAX_FRACTION = 0.97;

function formatComboCount(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

/**
 * @param {!Object} report An optimizer progress report
 *     (optimize-progress.js).
 * @return {string} The caption for the work the report describes.
 */
export function progressCaption({
  phase = ProgressPhase.RESOLVE, completed, total, stage, detail,
}) {
  if (phase === ProgressPhase.RANK) {
    return total
      ? `Ranking ${completed}/${total} pool lines by usage...`
      : 'Ranking pool lines by usage...';
  }
  if (phase === ProgressPhase.ITEMS) {
    return 'Loading item usage for the team...';
  }
  if (phase !== ProgressPhase.SEARCH) {
    return total
      ? `Scoring ${completed}/${total} Pokémon...`
      : 'Optimizing pool...';
  }
  switch (stage) {
    case SearchStage.SYNERGY:
      return 'Search prep — loading teammate synergy...';
    case SearchStage.POLISH:
      return `Search done — auditing shortlist swaps (round ${detail?.round || 1})...`;
    case SearchStage.REALIZE:
      return 'Search done — realizing best builds...';
    case SearchStage.BENCH:
      return 'Search done — ranking bench swaps...';
    default: {
      if (!total) return 'Searching team combinations...';
      const percent =
        Math.min(99, Math.floor((100 * (completed || 0)) / total));
      return `Searching team combinations — ${percent}% of ${formatComboCount(total)}...`;
    }
  }
}

/**
 * @param {!Object} model The bar's state: `phase`, `phaseStart`,
 *     `completed`, `total`, `searchFraction` and the run's `budget`.
 * @param {number} now
 * @return {number} Milliseconds the run is estimated to have left.
 */
export function estimateRemainingMs(model, now) {
  const { budget } = model;
  const phaseElapsed = now - model.phaseStart;
  const counted = model.total ? model.completed / model.total : 0;
  if (model.phase === ProgressPhase.RANK) {
    return 500 * (1 - counted) +
      budget.resolveMs + budget.searchMs + budget.tailMs;
  }
  if (model.phase === ProgressPhase.RESOLVE) {
    return budget.resolveMs * (1 - counted) + budget.searchMs + budget.tailMs;
  }
  if (model.phase === ProgressPhase.SEARCH) {
    const scanned = model.searchFraction || 0;
    // Real worker progress: project the remainder from the measured scan
    // rate instead of the pre-run guess.
    if (scanned > 0.02) {
      return (phaseElapsed * (1 - scanned)) / scanned + budget.tailMs;
    }
    // Past its budget the floor keeps the bar creeping rather than
    // claiming to be done.
    return Math.max(budget.searchMs - phaseElapsed, budget.searchMs * 0.08) +
      budget.tailMs;
  }
  return Math.max(budget.tailMs - phaseElapsed, 120);
}

/**
 * @param {!Element} root The page; the bar and caption are found in it at
 *     each paint, since a render replaces them.
 * @return {{start: function(number), stop: function(),
 *     report: function(!Object)}} `start` takes the pool's size; `report`
 *     takes an optimizer progress report.
 */
export function createProgressBar(root) {
  let model = null;

  function paint() {
    const bar = root.querySelector('[data-optimize-progress-bar]');
    if (!model || !bar) return;
    const now = Date.now();
    const elapsed = now - model.start;
    const remaining = Math.max(estimateRemainingMs(model, now), 1);
    // Never backwards within a run: the estimate changes formula (budget
    // guess, then measured rate) and can jump up.
    model.maxFraction = Math.max(
      model.maxFraction,
      Math.min(MAX_FRACTION, elapsed / (elapsed + remaining)),
    );
    bar.style.width = `${(model.maxFraction * 100).toFixed(1)}%`;
    // Far past the search budget: pulse to say the estimate was wrong, not
    // the run dead.
    const late =
      model.phase === ProgressPhase.SEARCH &&
      now - model.phaseStart > 2 * model.budget.searchMs;
    bar.style.animation = late
      ? 'pool-progress-pulse 1.2s ease-in-out infinite'
      : '';
  }

  function stop() {
    if (model) clearInterval(model.timer);
    model = null;
  }

  function start(poolSize) {
    stop();
    model = {
      start: Date.now(),
      phase: ProgressPhase.RESOLVE,
      phaseStart: Date.now(),
      completed: 0,
      total: poolSize || 0,
      searchFraction: 0,
      maxFraction: 0,
      budget: estimateRunBudget(poolSize),
      timer: setInterval(paint, TICK_MS),
    };
    paint();
  }

  function report(progress) {
    const { phase = ProgressPhase.RESOLVE, completed, total } = progress;
    const caption = root.querySelector('[data-optimize-progress-label]');
    if (caption) caption.textContent = progressCaption(progress);
    if (!model) return;
    if (phase !== model.phase) {
      model.phase = phase;
      model.phaseStart = Date.now();
      model.searchFraction = 0;
    }
    if (phase === ProgressPhase.RESOLVE || phase === ProgressPhase.RANK) {
      model.completed = completed || 0;
      if (total) model.total = total;
    }
    if (phase === ProgressPhase.SEARCH && total) {
      model.searchFraction = Math.min(1, (completed || 0) / total);
    }
    paint();
  }

  return { start, stop, report };
}
