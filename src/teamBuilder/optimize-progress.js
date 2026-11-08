/**
 * @fileoverview What an optimize reports it is doing while it runs, for the
 * progress caption and bar: the coarse phase the work is in and, during the
 * search, the finer stage. The optimizer emits these through its onProgress
 * callback and the widget switches on them, so neither side spells the
 * other's strings. This is a run's progress, not its lifecycle
 * (optimize-phase.js) and not the telemetry timing buckets (telemetry.js),
 * which name some of the same work.
 */

/**
 * The phases in the order a cold run visits them, after an opening resolve
 * report that only sizes the pool.
 * @enum {string}
 */
export const ProgressPhase = Object.freeze({
  /**
   * Ranking the pool's lines by usage to choose the scored subset; only a
   * pool over the scored limit visits it.
   */
  RANK: 'rank',
  /** Resolving each scored line's forms, builds and legality. */
  RESOLVE: 'resolve',
  /** The team search, from pair-evidence loading through bench swaps. */
  SEARCH: 'search',
  /** Loading the chosen team's item usage (reported by the widget). */
  ITEMS: 'items',
});

/**
 * The search phase's stages after the combination scan, each captioned on
 * its own: on a fast machine the scan is sub-second and these are the
 * visible search time.
 * @enum {string}
 */
export const SearchStage = Object.freeze({
  /** Fetching teammate and core lift before the scan starts. */
  SYNERGY: 'synergy',
  /** Auditing shortlist swaps over the full pool; `detail.round` counts. */
  POLISH: 'polish',
  /** Realizing concrete builds for the top candidates. */
  REALIZE: 'realize',
  /** Ranking bench swaps against the chosen team. */
  BENCH: 'bench',
});

/**
 * One progress report. `completed` and `total` count the phase's units
 * (lines, or combinations scanned); `stage` and `detail` ride only on
 * search reports.
 * @typedef {{phase: ProgressPhase, completed: (number|undefined),
 *     total: (number|undefined), stage: (SearchStage|undefined),
 *     detail: (?Object|undefined)}}
 */
export let OptimizeProgressReport;
