/**
 * @fileoverview Builds per-Pokémon Rejuvenation legal-move files from the
 * game's own learnsets (scripts/rejuv/rejuv-learnsets.generated.json, parsed
 * from its mons.dat) in the shape the Reborn builder writes
 * (build-reborn-legal-moves.mjs), so the engine reads every game alike:
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
 * The learnset rules are Reborn's, since the two games share the engine:
 * the evolution move is an explicit entry; a level-1 block longer than four
 * entries is a relearner catalog, not four starting moves; a TM, HM, or
 * tutor move is legal when the game distributes it that way AND the form's
 * compatible-moves list names it (or the mon learns every machine: Mew);
 * pre-evolution level-up moves and egg moves carry over through the Gen 9
 * evolution chain; Smeargle may Sketch anything but Chatter and Struggle.
 */

import fs from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Dex } from '@pkmn/dex';
import {
  REJUV_HM_OPTIONS,
  REJUV_TM_OPTIONS,
  REJUV_TUTOR_OPTIONS,
} from '../src/rejuv/move-sources.js';

const projectRoot = process.cwd();
const rejuvDir = path.join(projectRoot, 'scripts', 'rejuv');
const outputDir = path.join(
  projectRoot, 'site-data', 'data', 'rejuv-legal-moves', 'all');
const dex = Dex.forGen(9);
const toId = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

const load = (stem) =>
  JSON.parse(readFileSync(path.join(rejuvDir, `${stem}.generated.json`), 'utf8'));
const learnsetsBySymbol = load('rejuv-learnsets').data;
const dexMap = load('rejuv-dex-map');

const tmMoveIds = new Set(REJUV_TM_OPTIONS.map((o) => toId(o.move)));
const tmxMoveIds = new Set(REJUV_HM_OPTIONS.map((o) => toId(o.move)));
const tutorMoveIds = new Set(REJUV_TUTOR_OPTIONS.map((o) => o.id));
const LEARNS_ALL_MACHINES = new Set(['mew']);
const UNSKETCHABLE_MOVES = new Set(['chatter', 'struggle']);

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

const SKETCH_UNIVERSE = new Set([...tmMoveIds, ...tmxMoveIds, ...tutorMoveIds]);
for (const learnset of learnsets.values()) {
  for (const [, id] of learnset.levelUp) SKETCH_UNIVERSE.add(id);
  for (const id of learnset.evolutionMoves) SKETCH_UNIVERSE.add(id);
  for (const id of learnset.eggMoves) SKETCH_UNIVERSE.add(id);
  for (const id of learnset.compatibleMoves) SKETCH_UNIVERSE.add(id);
}
for (const id of UNSKETCHABLE_MOVES) SKETCH_UNIVERSE.delete(id);

await fs.rm(outputDir, { recursive: true, force: true });
await fs.mkdir(outputDir, { recursive: true });

let written = 0;
for (const [pokemonId, learnset] of [...learnsets].sort()) {
  const species = dex.species.get(pokemonId);
  const sourcesByMove = new Map();
  const get = (moveId) => {
    if (!sourcesByMove.has(moveId)) {
      sourcesByMove.set(moveId, {
        levelUp: [], tm: false, tmx: false, tutor: false, egg: false,
      });
    }
    return sourcesByMove.get(moveId);
  };

  const ownRelists = levelOneRelistIds(learnset);
  for (const [level, moveId] of learnset.levelUp) {
    if (level === 1 && ownRelists.has(moveId)) {
      get(moveId).levelOneRelist = true;
      continue;
    }
    get(moveId).levelUp.push(level);
  }
  for (const moveId of learnset.evolutionMoves) {
    get(moveId).evolutionMove = true;
  }
  for (const moveId of learnset.eggMoves) get(moveId).egg = true;

  const compatible = new Set(learnset.compatibleMoves);
  const learnsAll = LEARNS_ALL_MACHINES.has(pokemonId);
  const intrinsic = new Set([
    ...learnset.levelUp.map(([, m]) => m),
    ...learnset.evolutionMoves,
    ...learnset.eggMoves,
    ...learnset.compatibleMoves,
  ]);
  const learnsUniversalTms =
    intrinsic.size > 2 && !NO_UNIVERSAL_TM_SPECIES.has(pokemonId);
  for (const moveId of tmMoveIds) {
    if (
      learnsAll ||
      compatible.has(moveId) ||
      (learnsUniversalTms && UNIVERSAL_TM_MOVES.has(moveId))
    ) {
      get(moveId).tm = true;
    }
  }
  for (const moveId of tmxMoveIds) {
    if (learnsAll || compatible.has(moveId)) get(moveId).tmx = true;
  }
  for (const moveId of tutorMoveIds) {
    if (learnsAll || compatible.has(moveId)) get(moveId).tutor = true;
  }

  const preEvoLevelUp = new Map();
  for (const preEvoId of getPreEvolutionIds(pokemonId)) {
    const preLearnset = learnsets.get(preEvoId);
    if (!preLearnset) continue;
    for (const moveId of preLearnset.eggMoves) get(moveId).egg = true;
    const preRelists = levelOneRelistIds(preLearnset);
    for (const [level, moveId] of preLearnset.levelUp) {
      if (level === 1 && preRelists.has(moveId)) {
        get(moveId).levelOneRelist = true;
        continue;
      }
      if (!preEvoLevelUp.has(moveId)) preEvoLevelUp.set(moveId, []);
      preEvoLevelUp.get(moveId).push({ level, from: preEvoId });
    }
  }
  for (const moveId of preEvoLevelUp.keys()) get(moveId);

  if (pokemonId === 'smeargle') {
    for (const moveId of SKETCH_UNIVERSE) get(moveId).sketch = true;
  }

  const moves = [];
  for (const [moveId, sources] of sourcesByMove) {
    if (!dex.moves.get(moveId)?.exists) continue;
    moves.push({
      id: moveId,
      sources: normalizeSources(sources, preEvoLevelUp.get(moveId)),
    });
  }
  moves.sort((a, b) => a.id.localeCompare(b.id));

  const name = names.get(pokemonId);
  await fs.writeFile(
    path.join(outputDir, `${pokemonId}.json`),
    JSON.stringify({
      pokemonId,
      pokemonName: name,
      types: species?.exists ? species.types : [],
      learnsetPokemonId: pokemonId,
      learnsetPokemonName: name,
      moves,
    }) + '\n',
  );
  written += 1;
}

console.log(
  `[rejuv-legal-moves] wrote ${written} Pokémon files (from Rejuvenation mons.dat); ` +
    `${dropped.size} game-only moves dropped; universal TMs: ${[...UNIVERSAL_TM_MOVES].join(', ')}`,
);

function levelOneRelistIds(learnset) {
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

// Pre-evolution ids (closest first), walked from the base species so alternate
// forms inherit the base line's chain; a regional form keeps its own prevo
// when the dex names one (Meowth-Galar -> Perrserker).
function getPreEvolutionIds(pokemonId) {
  const species = dex.species.get(pokemonId);
  if (!species?.exists) return [];
  let current = species.prevo
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

function normalizeSources(sources, preEvolutionLevels) {
  const { evolutionMove, sketch, ...base } = sources;
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
  if (sketch) normalized.sketch = true;
  return normalized;
}
