/**
 * @fileoverview The team builder's run lifecycle as one named phase.
 *
 * An optimize walks idle → optimizing → analyzing → complete, or leaves the
 * analysis step early as analysis-deferred (a background run with no saved
 * analysis, offered on request) or analysis-skipped (a pool too large for
 * the optional diagnostics), or fails. A newer run restarts the walk at
 * optimizing; an edit that discards the result returns it to idle. The
 * widget moves the phase and the view switches on it, so neither re-derives
 * what a run is doing from which panels happen to have landed.
 */

/** @enum {string} */
export const OptimizePhase = Object.freeze({
  /** No run in progress; the page shows whatever the last run left. */
  IDLE: 'idle',
  /** The optimizer core, team item loading and the first team render. */
  OPTIMIZING: 'optimizing',
  /** The team is on screen; the stability sweep and investment plan run. */
  ANALYZING: 'analyzing',
  /**
   * A background run found no saved analysis, so the panel offers to
   * compute it rather than pay two more optimizer runs unasked.
   */
  ANALYSIS_DEFERRED: 'analysis-deferred',
  /** The pool exceeds the optional diagnostics' size limits. */
  ANALYSIS_SKIPPED: 'analysis-skipped',
  /**
   * The analysis step has settled for the current result; its panels show
   * whatever landed.
   */
  COMPLETE: 'complete',
  /** The optimize threw; the status message carries the error. */
  FAILED: 'failed',
});
