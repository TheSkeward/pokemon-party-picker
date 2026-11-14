/**
 * @fileoverview The learnset rules of the games built on Pokémon
 * Essentials (Reborn, Rejuvenation), which share an engine and so a
 * learnset format: level-up pairs, an explicit evolution move, egg moves,
 * and one list of the machine and tutor moves a species is compatible
 * with.
 */
import { UNSKETCHABLE_MOVES } from './core.mjs';

/** Mew learns every machine and tutor move by a rule in the engine. */
const LEARNS_ALL_MACHINES = new Set(['mew']);

/**
 * The level-1 entries of a learnset that are relists, not starting moves.
 * The engine gives a level-1 Pokémon only the last four moves of its
 * level-1 block, so the entries before them (by convention the relearner's
 * catalog) are never known at level 1. Evolution moves are exempt: they
 * are granted on evolving and tracked on their own.
 * @param {!Object} learnset
 * @return {!Set<string>}
 */
export function levelOneRelistIds(learnset) {
  const block = learnset.levelUp
    .filter(([level]) => level <= 1)
    .map(([, moveId]) => moveId);
  if (block.length <= 4) return new Set();
  const natural = new Set(block.slice(-4));
  const evolution = new Set(learnset.evolutionMoves);
  return new Set(
    block.filter((moveId) => !natural.has(moveId) && !evolution.has(moveId)),
  );
}

const learnsetMoves = (learnset) => [
  ...learnset.levelUp.map(([, moveId]) => moveId),
  ...learnset.evolutionMoves,
  ...learnset.eggMoves,
  ...(learnset.relearnerMoves || []),
  ...learnset.compatibleMoves,
];

/**
 * Every move Smeargle could Sketch: all that exist anywhere in the game's
 * data, in a learnset or as a machine or tutor move. The progression
 * narrows this at run time to what the player's other Pokémon can use.
 * @param {!Iterable<!Object>} learnsets
 * @param {!Iterable<string>} machineMoveIds
 * @return {!Set<string>}
 */
export function sketchUniverse(learnsets, machineMoveIds) {
  const universe = new Set(machineMoveIds);
  for (const learnset of learnsets) {
    for (const moveId of learnsetMoves(learnset)) universe.add(moveId);
  }
  for (const moveId of UNSKETCHABLE_MOVES) universe.delete(moveId);
  return universe;
}

// Level-up entries, with a relist flagged for the relearner in place of a
// level-1 source that does not exist; a later natural level of the same
// move is unaffected.
function addLevelUp(learnset, onLevel, table) {
  const relists = levelOneRelistIds(learnset);
  for (const [level, moveId] of learnset.levelUp) {
    if (level === 1 && relists.has(moveId)) {
      table.get(moveId).levelOneRelist = true;
    } else {
      onLevel(moveId, level);
    }
  }
}

/**
 * Fills a source table from a Pokémon's learnset and its pre-evolutions'.
 * @param {!Object} table A source table (core.mjs).
 * @param {{pokemonId: string, learnset: !Object,
 *     preEvolutions: !Array<{id: string, learnset: !Object}>,
 *     machines: {tm: !Set<string>, tmx: !Set<string>, tutor: !Set<string>},
 *     universalTms: !Set<string>, noUniversalTms: !Set<string>,
 *     sketchable: !Set<string>}} params `machines` are the moves the game
 *     hands out each way. `universalTms` are the TMs the engine grants to
 *     everything with a real movepool instead of listing them per species;
 *     `noUniversalTms` are the species that must not receive them, whose
 *     machine list is empty or wholly explicit. `sketchable` is the
 *     Sketch universe.
 */
export function addLearnsetSources(table, {
  pokemonId, learnset, preEvolutions, machines, universalTms,
  noUniversalTms, sketchable,
}) {
  addLevelUp(
    learnset, (moveId, level) => table.get(moveId).levelUp.push(level), table);
  for (const moveId of learnset.evolutionMoves) {
    table.get(moveId).evolutionMove = true;
  }
  for (const moveId of learnset.eggMoves) table.get(moveId).egg = true;
  for (const moveId of learnset.relearnerMoves || []) {
    table.get(moveId).rebornRelearner = true;
  }

  // A machine or tutor move is legal when the game hands it out that way
  // and the Pokémon can learn it: it is on its compatible list, or it is a
  // universal TM, or the Pokémon learns everything.
  const compatible = new Set(learnset.compatibleMoves);
  const learnsAll = LEARNS_ALL_MACHINES.has(pokemonId);
  const intrinsic = new Set([
    ...learnset.levelUp.map(([, moveId]) => moveId),
    ...learnset.evolutionMoves,
    ...learnset.eggMoves,
    ...learnset.compatibleMoves,
  ]);
  const learnsUniversalTms =
    intrinsic.size > 2 && !noUniversalTms.has(pokemonId);
  for (const moveId of machines.tm) {
    if (
      learnsAll ||
      compatible.has(moveId) ||
      (learnsUniversalTms && universalTms.has(moveId))
    ) {
      table.get(moveId).tm = true;
    }
  }
  for (const moveId of machines.tmx) {
    if (learnsAll || compatible.has(moveId)) table.get(moveId).tmx = true;
  }
  for (const moveId of machines.tutor) {
    if (learnsAll || compatible.has(moveId)) table.get(moveId).tutor = true;
  }

  // Egg moves pass down the line, and a move a pre-evolution learns by
  // level is reachable before evolving. A pre-evolution's relists stay
  // teachable by the relearner on this line (relearn, then evolve), so
  // they carry the same flag.
  for (const { id, learnset: preLearnset } of preEvolutions) {
    for (const moveId of preLearnset.eggMoves) table.get(moveId).egg = true;
    addLevelUp(
      preLearnset,
      (moveId, level) => table.inheritLevelUp(moveId, level, id),
      table);
  }

  if (pokemonId === 'smeargle') {
    for (const moveId of sketchable) table.get(moveId).sketch = true;
  }
}
