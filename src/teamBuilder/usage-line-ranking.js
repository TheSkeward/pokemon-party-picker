import { compareTraceUsage, gamesToLikelySee } from './trace-usage.js';

/**
 * Six team slots plus four numbered 30-slot bench boxes. Pool entries beyond
 * this limit still participate in move-transfer contexts; they simply skip
 * the expensive build-resolution and team-search path.
 */
export const SCORED_POOL_LIMIT = 126;

/** LC/NFE can supply sets, but cannot nominate an evolutionary target. */
export function isLineUsageFormat(formatId) {
  return !/(?:lc|nfe)$/i.test(String(formatId || ''));
}

function lineSignals(bundle = {}) {
  // New indexes keep this independent of set sourcing: an LC-ranked mon
  // may still have an admissible AG trace that must not be discarded.
  if (bundle.lineRanking !== undefined || bundle.lineTrace !== undefined) {
    return { ranking: bundle.lineRanking, trace: bundle.lineTrace };
  }
  // Legacy/test bundles have only the original signals. Never let a known
  // LC/NFE source qualify, even when the independent fields are absent.
  return {
    ranking: isLineUsageFormat(bundle.ranking?.formatId)
      ? bundle.ranking : null,
    trace: isLineUsageFormat(bundle.trace?.formatId) ? bundle.trace : null,
  };
}

/**
 * The line's best form by usage ranking: shallowest meaningful tier, then
 * highest usage there. This deliberately ignores current-cap set readiness,
 * matching the numbered bench's eventual-value ordering.
 *
 * @param {!Array<!Object>} candidates Rows carrying { candidate, bundle }.
 * @return {?Object}
 */
export function getLineCeilingRanking(candidates = []) {
  let best = null;
  for (const row of candidates) {
    const ranking = lineSignals(row.bundle).ranking;
    if (!ranking) continue;
    const next = {
      tierRank: ranking.tierRank,
      value: ranking.value,
      formatId: ranking.formatId,
      cutoff: ranking.cutoff,
      pokemonId: row.candidate?.id,
      name: row.candidate?.name,
    };
    if (
      !best ||
      next.tierRank < best.tierRank ||
      (next.tierRank === best.tierRank && next.value > best.value)
    ) {
      best = next;
    }
  }
  return best;
}

/**
 * Canonical trace row for a line with no meaningful usage anywhere.
 *
 * @param {!Array<!Object>} candidates Rows carrying { candidate, bundle }.
 * @return {?Object}
 */
export function getLineTraceRanking(candidates = []) {
  let best = null;
  for (const row of candidates) {
    const trace = lineSignals(row.bundle).trace;
    if (!trace || !(trace.value > 0)) continue;
    if (
      !best ||
      compareTraceUsage(trace, best) < 0
    ) {
      best = {
        tierRank: trace.tierRank,
        value: trace.value,
        formatId: trace.formatId,
        cutoff: trace.cutoff,
        pokemonId: row.candidate?.id,
        name: trace.name || row.candidate?.name,
      };
    }
  }
  if (!best) return null;
  const games = gamesToLikelySee(best.value);
  return games == null ? null : { ...best, games };
}

/**
 * Produces the shared numbered-bench ordering key for one evolutionary line.
 *
 * @param {!Array<!Object>} candidates Rows carrying { candidate, bundle }.
 * @param {string} fallbackName Input name used for deterministic final ties.
 * @return {!Object}
 */
export function getLineUsageOrder(candidates, fallbackName = '') {
  const ceiling = getLineCeilingRanking(candidates);
  return {
    ceiling,
    trace: ceiling ? null : getLineTraceRanking(candidates),
    fallbackName,
  };
}

/**
 * Canonical evolutionary target, plus a canonical non-Mega fallback when
 * necessary. Mechanical scores choose teams/builds, not the line's identity.
 * With no usage signal at all, leave the caller's existing fallback intact.
 */
export function getCanonicalLineCandidates(candidates = []) {
  const select = (rows) => {
    const order = getLineUsageOrder(rows);
    const id = order.ceiling?.pokemonId || order.trace?.pokemonId;
    return id ? rows.find((row) => row.candidate?.id === id) : null;
  };
  const canonical = select(candidates);
  if (!canonical) return candidates;
  if (!canonical.candidate.isMega) return [canonical];
  const nonMega = candidates.filter((row) => !row.candidate?.isMega);
  const fallback = select(nonMega) || nonMega[0];
  return fallback ? [canonical, fallback] : [canonical];
}

/**
 * Best-first comparison used both by the scoring-pool cutoff and by the
 * numbered bench's documented order: meaningful tiers first (shallowest tier,
 * then highest usage), followed by trace rows (shortest visibility horizon,
 * tier ladder, usage), with absent lines last.
 *
 * @param {!Object} a
 * @param {!Object} b
 * @return {number}
 */
export function compareLineUsageBestFirst(a, b) {
  const strength = compareLineUsageStrength(a, b);
  if (strength) return strength;
  return (
    signalName(a).localeCompare(signalName(b)) ||
    a.fallbackName.localeCompare(b.fallbackName)
  );
}

/**
 * Same ordering without display-name tie breakers. This is used to choose one
 * owned input when several resolve to the same bench entry.
 */
export function compareLineUsageStrength(a, b) {
  if (Boolean(a.ceiling) !== Boolean(b.ceiling)) return a.ceiling ? -1 : 1;
  if (a.ceiling && b.ceiling) {
    return (
      a.ceiling.tierRank - b.ceiling.tierRank ||
      b.ceiling.value - a.ceiling.value
    );
  }

  if (Boolean(a.trace) !== Boolean(b.trace)) return a.trace ? -1 : 1;
  if (a.trace && b.trace) {
    return compareTraceUsage(a.trace, b.trace);
  }

  return 0;
}

/**
 * Stable top-N cut over entries carrying a precomputed `usageOrder`.
 *
 * @param {!Array<!Object>} entries
 * @param {number=} limit
 * @return {!Array<!Object>}
 */
export function takeTopUsageEntries(entries, limit = SCORED_POOL_LIMIT) {
  return [...entries]
    .sort((a, b) =>
      compareLineUsageBestFirst(a.usageOrder, b.usageOrder),
    )
    .slice(0, Math.max(0, limit));
}

/**
 * Collapses raw inputs that are the same fieldable asset — equal reachable
 * terminal forms under the current progression (entry.assetKey), so a
 * pre-evolution with its own usage rows never holds a second slot for the
 * asset its evolution already occupies. The strongest usage signal wins;
 * exact ownership of the displayed form and then the more-evolved input
 * break true ties (Swanna over Ducklett, for example).
 */
export function deduplicateUsageEntries(entries = []) {
  const bestByAsset = new Map();
  for (const entry of entries) {
    // Ability annotations change a line's builds, so an annotated input is
    // never a duplicate of a differently-annotated one, even on the same
    // asset (Froakie (Protean) beside a plain Greninja).
    const key =
      `${entry.assetKey || entry.displayKey}|${entry.abilityAnnotation || ''}`;
    const current = bestByAsset.get(key);
    if (!current || compareDuplicateRepresentatives(entry, current) < 0) {
      bestByAsset.set(key, entry);
    }
  }
  return [...bestByAsset.values()].sort((a, b) =>
    compareLineUsageBestFirst(a.usageOrder, b.usageOrder),
  );
}

function compareDuplicateRepresentatives(a, b) {
  const strength = compareLineUsageStrength(a.usageOrder, b.usageOrder);
  if (strength) return strength;

  const aExact = a.inputPokemonId === a.displayKey;
  const bExact = b.inputPokemonId === b.displayKey;
  if (aExact !== bExact) return aExact ? -1 : 1;

  return (
    (b.inputEvolutionDepth || 0) - (a.inputEvolutionDepth || 0) ||
    compareLineUsageBestFirst(a.usageOrder, b.usageOrder)
  );
}

function signalName(order) {
  return order.ceiling?.name || order.trace?.name || order.fallbackName || '';
}
