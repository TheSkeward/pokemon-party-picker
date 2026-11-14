/**
 * @fileoverview Builds per-Pokémon Reborn legal-move files from Reborn's own
 * learnsets (scripts/reborn/reborn-learnsets.generated.json, decompiled from
 * the game's mons.dat) rather than mainline {@code @pkmn/dex}. Reborn is the
 * authoritative source for the game this tool targets, and it diverges from
 * mainline (e.g. Bibarel's evolution move is Water Gun in Reborn, Aqua Jet in
 * USUM). Reborn also encodes the evolution move explicitly as a level-0 entry,
 * so no heuristic is needed.
 *
 * {@code @pkmn/dex} is still used for species relationships (pre-evolution
 * chains, types) and to validate move ids; only the learnset *content* comes
 * from Reborn.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Dex } from '@pkmn/dex';
import {
  REBORN_TM_OPTIONS,
  REBORN_TMX_OPTIONS,
  REBORN_TUTOR_OPTIONS,
} from '../src/reborn/progression-options.js';
import { toId } from '../src/utils/ids.js';
import {
  createSourceTable,
  preEvolutionIds,
  resetOutputDir,
  writeLegalMoves,
} from './legal-moves/core.mjs';
import { addLearnsetSources, sketchUniverse } from './legal-moves/essentials.mjs';

const projectRoot = process.cwd();
const dataDir = path.join(projectRoot, 'site-data', 'data');
const outputDir = path.join(dataDir, 'reborn-legal-moves', 'all');
const dex = Dex.forGen(7);

const rebornTmMoveIds = new Set(REBORN_TM_OPTIONS.map((o) => toId(o.move)));
const rebornTmxMoveIds = new Set(REBORN_TMX_OPTIONS.map((o) => toId(o.move)));
const rebornTutorMoveIds =
  new Set(REBORN_TUTOR_OPTIONS.map((o) => toId(o.move)));

// Reborn code-grants the universal TMs (UNIVERSAL_TM_MOVES below) instead of
// listing them per species: they are the Reborn TMs that appear in 0 species'
// compatible-moves lists (the next-rarest TM appears in 8). These species are
// the exceptions that must NOT receive them: their machine list is empty or,
// like Wobbuffet's Safeguard, entirely explicit in the per-species data.
const NO_UNIVERSAL_TM_SPECIES = new Set([
  'caterpie', 'metapod', 'weedle', 'kakuna', 'magikarp', 'ditto', 'unown',
  'wobbuffet', 'wurmple', 'silcoon', 'cascoon', 'wynaut', 'smeargle',
  'beldum', 'kricketot', 'combee', 'tynamo',
]);

const UNIVERSAL_TM_MOVES = new Set(
  [
    'toxic', 'hiddenpower', 'facade', 'attract', 'substitute', 'frustration',
    'protect', 'round', 'confide', 'sleeptalk', 'swagger', 'return',
    'doubleteam', 'rest', 'secretpower',
  ].filter((id) => rebornTmMoveIds.has(id)),
);

const { learnsets } = JSON.parse(
  readFileSync(
    path.join(projectRoot, 'scripts', 'reborn', 'reborn-learnsets.generated.json'),
    'utf8',
  ),
);
const pokemonIndex = JSON.parse(
  readFileSync(path.join(dataDir, 'pokemon-index.json'), 'utf8'),
);

const machines = {
  tm: rebornTmMoveIds,
  tmx: rebornTmxMoveIds,
  tutor: rebornTutorMoveIds,
};
const sketchable = sketchUniverse(
  Object.values(learnsets),
  [...rebornTmMoveIds, ...rebornTmxMoveIds, ...rebornTutorMoveIds],
);

await resetOutputDir(outputDir);

let written = 0;
for (const pokemon of pokemonIndex) {
  const learnset = learnsets[pokemon.id];
  if (!learnset) continue;

  // @pkmn/dex gives the species' relationships (its line, its types);
  // the learnsets are Reborn's own.
  const species = dex.species.get(pokemon.id);
  const table = createSourceTable();
  addLearnsetSources(table, {
    pokemonId: pokemon.id,
    learnset,
    preEvolutions: preEvolutionIds(dex, species)
      .filter((id) => learnsets[id])
      .map((id) => ({ id, learnset: learnsets[id] })),
    machines,
    universalTms: UNIVERSAL_TM_MOVES,
    noUniversalTms: NO_UNIVERSAL_TM_SPECIES,
    sketchable,
  });

  await writeLegalMoves(outputDir, {
    pokemonId: pokemon.id,
    pokemonName: pokemon.name,
    types: species?.exists ? species.types : [],
    learnsetPokemonId: pokemon.id,
    learnsetPokemonName: pokemon.name,
    moves: table.moves(dex),
  });
  written += 1;
}

console.log(`[reborn-legal-moves] wrote ${written} Pokémon files (from Reborn mons.dat)`);
