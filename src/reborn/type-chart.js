/**
 * @fileoverview Type effectiveness for the active game's dex: the ordered
 * analysis type list (coverage vectors index by it) and the multiplier of an
 * attacking type into a defensive typing. Both come from the game's dex
 * bundle, so a generation without Fairy, or with Steel resisting Ghost,
 * reads correctly without any engine change.
 */
import { dex } from '../games/dex.js';

/** @return {!Array<string>} The active game's types, in analysis-grid order. */
export function analysisTypes() {
  return dex().types;
}

/**
 * @return {{types: !Array<string>, damageTaken: !Object}} The chart the
 *     search kernel scores with; sent to each worker with its range.
 */
export function activeTypeChart() {
  return { types: dex().types, damageTaken: dex().typeDamageTaken };
}

/**
 * Combined effectiveness of an attacking type against a defensive typing:
 * the product of the per-type multipliers (0 on any immunity), so 0–4 for
 * standard dual types. Unknown type names contribute ×1.
 * @param {string} attackType
 * @param {Array<string>} defenseTypes
 * @return {number}
 */
export function getTypeMultiplier(attackType, defenseTypes = []) {
  const table = dex().typeDamageTaken;
  let multiplier = 1;
  for (const defenseType of defenseTypes) {
    const code = table[defenseType]?.[attackType];
    if (code === 3) return 0;
    if (code === 1) multiplier *= 2;
    if (code === 2) multiplier *= 0.5;
  }
  return multiplier;
}
