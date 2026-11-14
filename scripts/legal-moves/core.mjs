/**
 * @fileoverview What every game's legal-move builder shares: the table of
 * sources a Pokémon's moves are collected into, the walk up its evolution
 * line, and the file written for it. Each builder reads its own game's
 * learnsets and fills the table by that game's rules; the engine reads the
 * files of every game alike.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

import { toId } from '../../src/utils/ids.js';

/** Moves Sketch cannot copy. */
export const UNSKETCHABLE_MOVES = new Set(['chatter', 'struggle']);

/**
 * The ways one Pokémon can come by each move, collected as the builder
 * reads its learnset.
 * @return {{get: function(string): !Object,
 *     inheritLevelUp: function(string, number, string),
 *     moves: function(!Object): !Array<{id: string, sources: !Object}>}}
 *     `get` returns the sources of a move, adding the move if it is new.
 *     `inheritLevelUp` records a level at which a pre-evolution learns a
 *     move. `moves` returns the finished list, for the moves the dex
 *     knows, by id.
 */
export function createSourceTable() {
  const sourcesByMove = new Map();
  const preEvolutionLevels = new Map();

  function get(moveId) {
    if (!sourcesByMove.has(moveId)) {
      sourcesByMove.set(moveId, {
        levelUp: [], tm: false, tmx: false, tutor: false, egg: false,
      });
    }
    return sourcesByMove.get(moveId);
  }

  // Which ancestor learns the move decides which evolution must be delayed
  // for it (Slaking's Play Rough is Slakoth's at 38, its Focus Punch
  // Vigoroth's at 37), so each level keeps the form it comes from.
  function inheritLevelUp(moveId, level, from) {
    if (!preEvolutionLevels.has(moveId)) preEvolutionLevels.set(moveId, []);
    preEvolutionLevels.get(moveId).push({ level, from });
  }

  function moves(dex) {
    // A move only a pre-evolution learns has no sources of its own yet.
    for (const moveId of preEvolutionLevels.keys()) get(moveId);
    return [...sourcesByMove]
      .filter(([moveId]) => dex.moves.get(moveId)?.exists)
      .map(([moveId, sources]) => ({
        id: moveId,
        sources: normalizeSources(sources, preEvolutionLevels.get(moveId)),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  return { get, inheritLevelUp, moves };
}

function normalizeSources(sources, preEvolutionLevels) {
  const { evolutionMove, rebornRelearner, sketch, ...base } = sources;
  const normalized = {
    ...base,
    levelUp: [...new Set(sources.levelUp)].sort((a, b) => a - b),
  };
  const seen = new Set();
  const preEvolutionLevelUp = (preEvolutionLevels || [])
    .filter((entry) => {
      const key = `${entry.level}|${entry.from}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.level - b.level || a.from.localeCompare(b.from));
  if (preEvolutionLevelUp.length) {
    normalized.preEvolutionLevelUp = preEvolutionLevelUp;
  }
  if (evolutionMove) normalized.evolutionMove = true;
  if (rebornRelearner) normalized.rebornRelearner = true;
  if (sketch) normalized.sketch = true;
  return normalized;
}

/**
 * A species' pre-evolutions, nearest first. An alternate form walks its
 * base species' line, so a Mega inherits what the line learns.
 * @param {!Object} dex A generation's @pkmn/dex.
 * @param {!Object} species A species of that dex.
 * @param {{ownPrevoFirst: (boolean|undefined)}=} options `ownPrevoFirst`
 *     lets a form with a pre-evolution of its own keep it, where the dex
 *     names one (Perrserker's is Galarian Meowth).
 * @return {!Array<string>}
 */
export function preEvolutionIds(dex, species, { ownPrevoFirst = false } = {}) {
  if (!species?.exists) return [];
  let current = ownPrevoFirst && species.prevo
    ? species
    : species.baseSpecies
      ? dex.species.get(toId(species.baseSpecies))
      : species;
  const ids = [];
  const seen = new Set();
  while (current?.prevo && !seen.has(current.id)) {
    seen.add(current.id);
    const prevo = dex.species.get(toId(current.prevo));
    if (!prevo?.exists) break;
    ids.push(prevo.id);
    current = prevo;
  }
  return ids;
}

/**
 * Empties a game's legal-move directory, to be filled again.
 * @param {string} outputDir
 */
export async function resetOutputDir(outputDir) {
  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });
}

/**
 * Writes one Pokémon's legal-move file.
 * @param {string} outputDir
 * @param {{pokemonId: string, pokemonName: string, types: !Array<string>,
 *     learnsetPokemonId: string, learnsetPokemonName: string,
 *     moves: !Array<!Object>}} record `learnsetPokemon*` name the species
 *     whose learnset was read, which is the base species for a form the
 *     dex gives none of its own.
 */
export async function writeLegalMoves(outputDir, record) {
  const {
    pokemonId, pokemonName, types,
    learnsetPokemonId, learnsetPokemonName, moves,
  } = record;
  await fs.writeFile(
    path.join(outputDir, `${pokemonId}.json`),
    JSON.stringify({
      pokemonId, pokemonName, types,
      learnsetPokemonId, learnsetPokemonName, moves,
    }) + '\n',
  );
}
