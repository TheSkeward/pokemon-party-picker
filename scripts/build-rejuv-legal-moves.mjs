/**
 * @fileoverview Builds per-Pokémon Rejuvenation legal-move files from the
 * game's own learnsets (scripts/rejuv/rejuv-learnsets.generated.json, parsed
 * from its mons.dat) in the shape every game's builder writes
 * (legal-moves/core.mjs), so the engine reads every game alike:
 *
 *   node scripts/build-rejuv-legal-moves.mjs
 *
 * Species and moves are keyed by the game's own symbols; the committed dex
 * map (rejuv-dex-map.generated.json) carries each form onto its Gen 9
 * identity. A form with no identity (Aevian forms, Rift forms, the game's
 * own species) gets no file, and a move with no identity (the game's own
 * moves) is dropped from every learnset: the engine's move tables are the
 * generation's, so neither can be scored. Where two forms of a species share
 * one identity (cosmetic forms), the first wins.
 *
 * The learnset rules are the ones Reborn's builder applies, since the two
 * games share an engine (legal-moves/essentials.mjs). Pre-evolutions come
 * from the Gen 9 evolution chain.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Dex } from '@pkmn/dex';
import {
  REJUV_HM_OPTIONS,
  REJUV_TM_OPTIONS,
  REJUV_TUTOR_OPTIONS,
} from '../src/rejuv/move-sources.js';
import { toId } from '../src/utils/ids.js';
import {
  createSourceTable,
  preEvolutionIds,
  resetOutputDir,
  writeLegalMoves,
} from './legal-moves/core.mjs';
import { addLearnsetSources, sketchUniverse } from './legal-moves/essentials.mjs';

const projectRoot = process.cwd();
const rejuvDir = path.join(projectRoot, 'scripts', 'rejuv');
const outputDir = path.join(
  projectRoot, 'site-data', 'data', 'rejuv-legal-moves', 'all');
const dex = Dex.forGen(9);

const load = (stem) =>
  JSON.parse(readFileSync(path.join(rejuvDir, `${stem}.generated.json`), 'utf8'));
const learnsetsBySymbol = load('rejuv-learnsets').data;
const dexMap = load('rejuv-dex-map');

const tmMoveIds = new Set(REJUV_TM_OPTIONS.map((o) => toId(o.move)));
const tmxMoveIds = new Set(REJUV_HM_OPTIONS.map((o) => toId(o.move)));
const tutorMoveIds = new Set(REJUV_TUTOR_OPTIONS.map((o) => o.id));

// The engine code-grants some TMs to everything with a real movepool instead
// of listing them per species (Reborn's builder found them as the TMs on no
// species' compatible list; Rejuvenation's data has the same gap: Protect
// and Rest appear on no list at all). They are derived below as the TM
// moves no form's compatible list names. These species are the exceptions
// that must NOT receive them: their machine list is empty or entirely
// explicit in the per-species data.
const NO_UNIVERSAL_TM_SPECIES = new Set([
  'caterpie', 'metapod', 'weedle', 'kakuna', 'magikarp', 'ditto', 'unown',
  'wobbuffet', 'wurmple', 'silcoon', 'cascoon', 'wynaut', 'smeargle',
  'beldum', 'kricketot', 'combee', 'tynamo', 'cosmog', 'cosmoem',
  'blipbug', 'applin', 'wiglett', 'tandemaus', 'nymble',
]);

// Game symbol -> Gen 9 move id, or null for the game's own moves.
const moveIdOf = (symbol) => dexMap.moves[symbol]?.pkmnId || null;
const dropped = new Set();
const translate = (symbols) =>
  symbols
    .map((symbol) => {
      const id = moveIdOf(symbol);
      if (!id) dropped.add(symbol);
      return id;
    })
    .filter(Boolean);

// Learnsets keyed by Gen 9 id, translated.
const learnsets = new Map();
const names = new Map();
for (const [symbol, forms] of Object.entries(learnsetsBySymbol)) {
  for (const [form, learnset] of Object.entries(forms)) {
    const mapped = dexMap.species[symbol]?.[form];
    if (!mapped?.pkmnId || learnsets.has(mapped.pkmnId)) continue;
    const levelUp = learnset.levelUp
      .map(([level, move]) => [level, moveIdOf(move)])
      .filter(([, id]) => {
        return id;
      });
    for (const [, move] of learnset.levelUp) {
      if (!moveIdOf(move)) dropped.add(move);
    }
    learnsets.set(mapped.pkmnId, {
      levelUp,
      evolutionMoves: translate(learnset.evolutionMoves),
      eggMoves: translate(learnset.eggMoves),
      compatibleMoves: translate(learnset.compatibleMoves),
    });
    names.set(mapped.pkmnId, dex.species.get(mapped.pkmnId).name);
  }
}

const namedOnSomeList = new Set();
for (const learnset of learnsets.values()) {
  for (const id of learnset.compatibleMoves) namedOnSomeList.add(id);
}
const UNIVERSAL_TM_MOVES = new Set(
  [...tmMoveIds].filter((id) => !namedOnSomeList.has(id)),
);

const machines = { tm: tmMoveIds, tmx: tmxMoveIds, tutor: tutorMoveIds };
const sketchable = sketchUniverse(
  learnsets.values(), [...tmMoveIds, ...tmxMoveIds, ...tutorMoveIds]);

await resetOutputDir(outputDir);

let written = 0;
for (const [pokemonId, learnset] of [...learnsets].sort()) {
  const species = dex.species.get(pokemonId);
  const table = createSourceTable();
  addLearnsetSources(table, {
    pokemonId,
    learnset,
    // A regional form keeps its own pre-evolution where the dex names
    // one (Perrserker's is Galarian Meowth).
    preEvolutions: preEvolutionIds(dex, species, { ownPrevoFirst: true })
      .filter((id) => learnsets.has(id))
      .map((id) => ({ id, learnset: learnsets.get(id) })),
    machines,
    universalTms: UNIVERSAL_TM_MOVES,
    noUniversalTms: NO_UNIVERSAL_TM_SPECIES,
    sketchable,
  });

  const name = names.get(pokemonId);
  await writeLegalMoves(outputDir, {
    pokemonId,
    pokemonName: name,
    types: species?.exists ? species.types : [],
    learnsetPokemonId: pokemonId,
    learnsetPokemonName: name,
    moves: table.moves(dex),
  });
  written += 1;
}

console.log(
  `[rejuv-legal-moves] wrote ${written} Pokémon files (from Rejuvenation mons.dat); ` +
    `${dropped.size} game-only moves dropped; universal TMs: ${[...UNIVERSAL_TM_MOVES].join(', ')}`,
);
