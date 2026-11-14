/**
 * @fileoverview The size past which a result's optional analysis (the
 * stability sweep and the investment plan) is not run. Both re-run the
 * optimizer many times over, and on a large pool that is minutes of every
 * core for panels the player did not ask for.
 */

const MAX_POOL_SIZE = 80;
const MAX_BUILDS = 200;

function countBuilds(result) {
  return (result?.lines || []).reduce((total, line) => {
    const representative = line.best || line.bestNonMega;
    if (!representative) return total;
    const alternatives = representative.buildAlternatives;
    return total + (Array.isArray(alternatives) ? alternatives.length : 1);
  }, 0);
}

/**
 * @param {?Object} result An optimizer result.
 * @return {?{poolSize: number, builds: number, poolLimit: number,
 *     buildLimit: number}} Why the analysis is skipped, or null when the
 *     result is within both limits.
 */
export function postAnalysisSkipReason(result) {
  const poolSize =
    result?.telemetryMeta?.poolSize || (result?.lines || []).length || 0;
  const builds = result?.telemetryMeta?.builds || countBuilds(result);
  if (poolSize <= MAX_POOL_SIZE && builds <= MAX_BUILDS) return null;
  return {
    poolSize,
    builds,
    poolLimit: MAX_POOL_SIZE,
    buildLimit: MAX_BUILDS,
  };
}
