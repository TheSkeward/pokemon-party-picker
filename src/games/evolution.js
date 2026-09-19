/**
 * @fileoverview The active game's evolution rules: how it handles trades,
 * which access gate stands in for a region-locked evolution, which location
 * evolutions it simply lacks, its form-split notes, and the ordered list of
 * access gates its progression exposes. Reads the descriptor's `evolution`;
 * see games/reborn.js for the field shapes.
 */
import { getActiveGame } from './registry.js';

/** @return {!Object} The active game's evolution rules. */
export function evolutionRules() {
  return getActiveGame().evolution;
}

/**
 * @return {!Array<{key: string, label: string, item: (string|undefined)}>}
 *     The access gates in the order the progression UI lists them.
 */
export function accessFields() {
  return evolutionRules().accessFields;
}
