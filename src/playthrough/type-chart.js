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

// Cached against the bundle it was built from, so a game switch rebuilds it.
let typingsCache = { bundle: null, typings: [] };

/**
 * Every defensive typing a Pokémon in the active game's dex actually has:
 * each type alone, then each pair the dex contains. Coverage judged on
 * single types alone rounds a 90-power move at 2x under a 70-power STAB
 * move at 1x and never sees the resisted-plus-weak or 4x pairs (Steel/Fairy,
 * Bug/Steel) that a second attacking type is usually for.
 * @return {!Array<!Array<string>>}
 */
export function defensiveTypings() {
  const bundle = dex();
  if (typingsCache.bundle !== bundle) {
    const pairs = Object.keys(bundle.typeCombinationShares || {})
      .filter((key) => key.includes('/'))
      .map((key) => key.split('/'));
    typingsCache = {
      bundle,
      typings: [...bundle.types.map((type) => [type]), ...pairs],
    };
  }
  return typingsCache.typings;
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
