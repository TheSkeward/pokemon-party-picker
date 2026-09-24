/**
 * @fileoverview Canonical-source relaxation of the meaningful-usage bar: when
 * nothing clears the baseline, iteratively add 5 to the number of games
 * played in the "50% chance of having been seen in N games" calculation.
 *
 * The meaningful bar itself is that calculation at N = 25:
 * MIN_MEANINGFUL_USAGE_PERCENT = 100·(1 − 0.5^(1/25)) ≈ 2.73% — a mon at the
 * bar has even odds of appearing within 25 games. A mon below it everywhere
 * still qualifies at some LARGER horizon: gamesToLikelySee inverts the
 * formula and steps N up in 5s (30, 35, 40, …), giving the bench tail its
 * label — "ZU 1500 (30)" reads "at its ZU-1500 usage, 50% odds of seeing one
 * within 30 games". The same ordering selects set sources and evolutionary
 * representatives. A relaxed source remains trace, never a meaningful rank
 * or an inflated usage prior.
 */

/** Baseline horizon N (games) of the 50%-seen-within-N calculation. */
export const BASE_SEEN_GAMES = 25;
/** Increment (games) between candidate horizons above the baseline. */
export const SEEN_GAMES_STEP = 5;

/**
 * Smallest N in {30, 35, 40, …} such that usage `valuePercent` gives a ≥50%
 * chance of at least one appearance within N games: (1 − v/100)^N ≤ 0.5.
 * Null for zero/absent usage — that stays honest "no usage data".
 * @param {number} valuePercent
 * @return {?number}
 */
export function gamesToLikelySee(valuePercent) {
  if (!Number.isFinite(valuePercent) || !(valuePercent > 0) ||
    valuePercent >= 100) return null;
  const exact = Math.log(0.5) / Math.log1p(-valuePercent / 100);
  const games = Math.max(
    BASE_SEEN_GAMES + SEEN_GAMES_STEP,
    Math.ceil(exact / SEEN_GAMES_STEP) * SEEN_GAMES_STEP,
  );
  // Inclusive boundary: inversion can put an exact cutoff a few floating-
  // point bits above its horizon. Compare the preceding step directly.
  const previous = games - SEEN_GAMES_STEP;
  return previous > BASE_SEEN_GAMES &&
    valuePercent >= 100 * (1 - 0.5 ** (1 / previous))
    ? previous : games;
}

/**
 * First qualifying relaxation step, then the earliest tier, then usage
 * within that tier. This is equivalent to rescanning the tier ladder at
 * N = 30, 35, 40, ...; highest usage alone is NOT the fallback rule.
 * Null/zero rows cannot supply a canonical source and sort last.
 */
export function compareTraceUsage(a, b) {
  const aGames = gamesToLikelySee(a?.value);
  const bGames = gamesToLikelySee(b?.value);
  if (aGames == null || bGames == null) {
    return aGames == null ? (bGames == null ? 0 : 1) : -1;
  }
  return aGames - bGames ||
    a.tierRank - b.tierRank || b.value - a.value;
}
