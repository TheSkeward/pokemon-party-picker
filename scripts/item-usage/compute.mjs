/**
 * @fileoverview Item usage across a usage family: for each held item, the
 * share of a Pokémon's ladder sets that hold it, averaged with equal weight
 * over every Pokémon in the family, and the number of Pokémon that hold it
 * more than any other item. Equal weight for the move table's reason
 * (scripts/move-prior/compute.mjs): a ladder-weighted mean would let the
 * handful of OU staples answer for everyone. Pure: the builder feeds it
 * files, the tests feed it fixtures.
 */

/**
 * @param {!Array<{pokemonId: string, usage: !Map<string, number>}>} sets
 *     One entry per Pokémon in the family's set index: its id and the usage
 *     percent of each item its primary-tier record lists. A Pokémon whose
 *     record lists no item is skipped.
 * @return {{pokemon: number, items: !Object<string, {carry: number,
 *     top: number}>}} `pokemon` is the Pokémon counted; `carry` the mean
 *     percent of their sets that hold the item, to two decimals; `top` the
 *     Pokémon whose most-held item it is, the first listed winning a tie.
 */
export function computeItemUsage(sets) {
  const totals = new Map();
  let pokemon = 0;
  for (const set of sets) {
    let topId = null;
    let topUsage = 0;
    for (const [itemId, usage] of set.usage) {
      if (!(usage > 0)) continue;
      if (!totals.has(itemId)) totals.set(itemId, { sum: 0, top: 0 });
      totals.get(itemId).sum += usage;
      if (usage > topUsage) {
        topId = itemId;
        topUsage = usage;
      }
    }
    if (topId == null) continue;
    pokemon++;
    totals.get(topId).top++;
  }
  const items = {};
  for (const itemId of [...totals.keys()].sort()) {
    const entry = totals.get(itemId);
    items[itemId] = {
      carry: Math.round((entry.sum / pokemon) * 100) / 100,
      top: entry.top,
    };
  }
  return { pokemon, items };
}
