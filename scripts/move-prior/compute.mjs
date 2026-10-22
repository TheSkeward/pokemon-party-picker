/**
 * @fileoverview The measured utility prior: for each move, the share of a
 * learner's ladder sets that run it, averaged with equal weight over every
 * Pokémon in a usage family that can learn the move. Equal weight, not
 * ladder weight: the question is "given a Pokémon has this move, how often
 * is it worth a slot", and a ladder-weighted mean would let the handful of
 * OU staples answer it for everyone. Pure: the builder feeds it files, the
 * tests feed it fixtures.
 */

/**
 * @param {!Array<{pokemonId: string, usage: !Map<string, number>}>} sets
 *     One entry per Pokémon in the family's set index: its id and the usage
 *     percent of each move its primary-tier record lists.
 * @param {!Map<string, !Set<string>>} learnsets Pokémon id to the ids of
 *     every move it can learn. A Pokémon without a learnset is skipped.
 * @return {{pokemon: number, moves: !Object<string, {prior: number,
 *     learners: number}>}} `prior` is the mean percent of learners' sets that
 *     run the move, to one decimal; `learners` the Pokémon counted.
 */
export function computeMovePrior(sets, learnsets) {
  const totals = new Map();
  let pokemon = 0;
  for (const set of sets) {
    const learnable = learnsets.get(set.pokemonId);
    if (!learnable) continue;
    pokemon++;
    for (const moveId of learnable) {
      const total = totals.get(moveId) || { sum: 0, learners: 0 };
      total.sum += set.usage.get(moveId) || 0;
      total.learners++;
      totals.set(moveId, total);
    }
  }
  const moves = {};
  for (const moveId of [...totals.keys()].sort()) {
    const { sum, learners } = totals.get(moveId);
    moves[moveId] = {
      prior: Math.round((sum / learners) * 10) / 10,
      learners,
    };
  }
  return { pokemon, moves };
}
