/**
 * @fileoverview The measured utility prior: for each move, the share of a
 * learner's ladder sets that run it, averaged with equal weight over every
 * Pokémon in a usage family that can learn the move. Equal weight, not
 * ladder weight: the question is "given a Pokémon has this move, how often
 * is it worth a slot", and a ladder-weighted mean would let the handful of
 * OU staples answer it for everyone. Alongside it, each move's carry rate
 * (the share of all the family's sets that run it, learners or not) and,
 * where weights are known, the typical weight of the Pokémon that carry it,
 * which side-effect pricing reads for the weight-ratio attacks. Pure: the
 * builder feeds it files, the tests feed it fixtures.
 */

/**
 * @param {!Array<{pokemonId: string, usage: !Map<string, number>}>} sets
 *     One entry per Pokémon in the family's set index: its id and the usage
 *     percent of each move its primary-tier record lists.
 * @param {!Map<string, !Set<string>>} learnsets Pokémon id to the ids of
 *     every move it can learn. A Pokémon without a learnset is skipped.
 * @param {!Object<string, number>=} weightsKg Pokémon id to weight in kg.
 * @return {{pokemon: number, moves: !Object<string, {prior: number,
 *     learners: number, carry: number, carrierWeightKg: (number|undefined)}>}}
 *     `prior` is the mean percent of learners' sets that run the move, to
 *     one decimal; `learners` the Pokémon counted; `carry` the mean percent
 *     over every Pokémon counted, to two decimals; `carrierWeightKg` the
 *     carry-weighted mean weight of the Pokémon that run it, when known.
 */
export function computeMovePrior(sets, learnsets, weightsKg = {}) {
  const totals = new Map();
  const total = (moveId) => {
    if (!totals.has(moveId)) {
      totals.set(moveId, {
        sum: 0, learners: 0, carrySum: 0, weightSum: 0, weightUsage: 0,
      });
    }
    return totals.get(moveId);
  };
  let pokemon = 0;
  for (const set of sets) {
    const learnable = learnsets.get(set.pokemonId);
    if (!learnable) continue;
    pokemon++;
    for (const moveId of learnable) {
      const entry = total(moveId);
      entry.sum += set.usage.get(moveId) || 0;
      entry.learners++;
    }
    for (const [moveId, usage] of set.usage) {
      if (!usage) continue;
      const entry = total(moveId);
      entry.carrySum += usage;
      const kg = weightsKg[set.pokemonId];
      if (kg > 0) {
        entry.weightSum += usage * kg;
        entry.weightUsage += usage;
      }
    }
  }
  const moves = {};
  for (const moveId of [...totals.keys()].sort()) {
    const entry = totals.get(moveId);
    if (!entry.learners) continue;
    const row = {
      prior: Math.round((entry.sum / entry.learners) * 10) / 10,
      learners: entry.learners,
      carry: Math.round((entry.carrySum / pokemon) * 100) / 100,
    };
    if (entry.weightUsage > 0) {
      row.carrierWeightKg =
        Math.round((entry.weightSum / entry.weightUsage) * 10) / 10;
    }
    moves[moveId] = row;
  }
  return { pokemon, moves };
}
