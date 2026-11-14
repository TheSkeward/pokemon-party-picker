/**
 * @fileoverview Whether a result still answers for the progression on the
 * page. A result is stamped with the key of the progression it was
 * optimized against; once the page's progression keys differently, the
 * team is stale.
 */
import { stableStringify } from '../../utils/stable-stringify.js';

/**
 * The part of a progression a team depends on, as a key.
 *
 * Ordinary owned items drive item recommendations, which are recomputed on
 * every render, so they are left out: adding a Leftovers must not flag the
 * team stale. Owned evolution items are the exception, since a copy
 * evolves one candidate, but only those a line of the pool can spend: a
 * Fire Stone changes nothing for a pool with nothing to use it on.
 *
 * The key ignores the order of fields and of lists. Progression objects
 * are built by several helpers, and two equal ones that differed in order
 * would flag a current team stale.
 * @param {?Object} progression
 * @param {!Iterable<string>} usedEvolutionItemIds The evolution items the
 *     result's lines can spend.
 * @return {string}
 */
export function progressionKey(progression, usedEvolutionItemIds) {
  const { ownedItems, ...rest } = progression || {};
  const evolutionItems = {};
  for (const id of usedEvolutionItemIds) {
    if (ownedItems?.[id] > 0) evolutionItems[id] = ownedItems[id];
  }
  return stableStringify({ ...rest, evolutionItems });
}
