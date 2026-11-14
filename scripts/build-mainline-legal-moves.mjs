/**
 * @fileoverview Builds per-Pokémon legal-move files for a mainline game from
 * its generation's {@code @pkmn/dex} learnsets, in the shape every game's
 * builder writes (legal-moves/core.mjs) so the engine reads every game
 * alike:
 *
 *   node scripts/build-mainline-legal-moves.mjs <gameId> [levelUpTable.json]
 *
 * Only the generation's own learnset entries count (no transfer moves).
 * Level-up entries keep their levels, unless a level-up table built by
 * build-bulbapedia-level-up.mjs is given: the dex carries one level-up list
 * per generation, and a game whose levels differ from its siblings'
 * (HeartGold and SoulSilver moved several from Diamond and Pearl's) takes
 * its own list from the table instead; a machine entry becomes a TM or an HM
 * source according to the game's machine tables, so a machine another game
 * of the generation has and this one lacks (Defog in HGSS) teaches
 * nothing; a tutor entry counts only for the game's own tutors; egg entries
 * are egg moves; a form-change entry (Rotom-Wash's Hydro Pump) is recorded
 * as an evolution move, granted on taking the form. Event-only entries are
 * skipped. A form whose own learnset the dex leaves empty or reduced to its
 * form-change move inherits its base species' learnset. Pre-evolution
 * level-up moves (attributed to the learner) and egg moves are carried as
 * in the Reborn builder; Smeargle may Sketch any move of the generation but
 * Chatter and Struggle.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Dex } from '@pkmn/dex';
import { getGame, listGames } from '../src/games/registry.js';
import { toId } from '../src/utils/ids.js';
import {
  UNSKETCHABLE_MOVES,
  createSourceTable,
  preEvolutionIds,
  resetOutputDir,
  writeLegalMoves,
} from './legal-moves/core.mjs';

function parseGameArg() {
  const game = getGame(process.argv[2] || '');
  if (!game) {
    const known = listGames().map((known) => known.id).join(', ');
    throw new Error(
      `usage: build-mainline-legal-moves.mjs <gameId> (known: ${known})`,
    );
  }
  return game;
}

async function main() {
  const game = parseGameArg();
  const gen = game.dexGen;
  const dex = Dex.forGen(gen);
  const levelUpTable = process.argv[3]
    ? JSON.parse(readFileSync(path.resolve(process.argv[3]), 'utf8'))
    : null;
  const missingFromTable = [];
  const outputDir = path.join(
    process.cwd(), 'site-data', 'data', game.data.legalMovesDir, 'all');

  const { tmOptions, tmxOptions, tutorOptions } = game.moveSources;
  const tmMoveIds = new Set(tmOptions.map((o) => toId(o.move)));
  const hmMoveIds = new Set(tmxOptions.map((o) => toId(o.move)));
  const tutorMoveIds = new Set(tutorOptions.map((o) => o.id));

  const universe = dex.species
    .all()
    .filter((s) => s.exists && s.gen <= gen && !s.isNonstandard);
  const sketchUniverse = dex.moves
    .all()
    .filter((m) => m.exists && m.gen <= gen && !m.isNonstandard)
    .map((m) => m.id)
    .filter((id) => !UNSKETCHABLE_MOVES.has(id));

  // The generation's entries of a species' learnset, as {moveId: [codes]}
  // with the generation digit stripped; a form with no own level-up,
  // machine, tutor, or egg entries inherits its base species' learnset plus
  // its own form-change entries. Returns the learnset and whose it is.
  const learnsetCache = new Map();
  async function learnsetOf(species) {
    if (learnsetCache.has(species.id)) return learnsetCache.get(species.id);
    const own = genEntries((await dex.learnsets.get(species.id))?.learnset);
    let result = { id: species.id, name: species.name, entries: own };
    const hasRealEntries = Object.values(own).some((codes) =>
      codes.some((code) => /^[LMTE]/.test(code)),
    );
    if (!hasRealEntries && species.baseSpecies !== species.name) {
      const base = dex.species.get(toId(species.baseSpecies));
      const inherited = genEntries(
        (await dex.learnsets.get(base.id))?.learnset);
      for (const [moveId, codes] of Object.entries(own)) {
        inherited[moveId] = [...(inherited[moveId] || []), ...codes];
      }
      result = { id: base.id, name: base.name, entries: inherited };
    }
    if (levelUpTable) {
      result.entries = withTableLevels(result.entries, species);
    }
    learnsetCache.set(species.id, result);
    return result;
  }
  // The game's own level-up list replaces the generation's; a form without
  // a list of its own takes its base species'.
  function withTableLevels(entries, species) {
    const levels =
      levelUpTable[species.id] ||
      levelUpTable[dex.species.get(toId(species.baseSpecies)).id];
    if (!levels) {
      missingFromTable.push(species.id);
      return entries;
    }
    const next = {};
    for (const [moveId, codes] of Object.entries(entries)) {
      const kept = codes.filter((code) => code[0] !== 'L');
      if (kept.length) next[moveId] = kept;
    }
    for (const [moveId, moveLevels] of Object.entries(levels)) {
      next[moveId] = [
        ...(next[moveId] || []),
        ...moveLevels.map((level) => `L${level}`),
      ];
    }
    return next;
  }
  function genEntries(learnset) {
    const entries = {};
    for (const [moveId, codes] of Object.entries(learnset || {})) {
      const own = codes
        .filter((code) => code.startsWith(String(gen)))
        .map((code) => code.slice(String(gen).length));
      if (own.length) entries[moveId] = own;
    }
    return entries;
  }

  await resetOutputDir(outputDir);

  let written = 0;
  for (const species of universe) {
    const learnset = await learnsetOf(species);
    const table = createSourceTable();
    const { get } = table;

    for (const [moveId, codes] of Object.entries(learnset.entries)) {
      for (const code of codes) {
        const kind = code[0];
        if (kind === 'L') {
          const level = Number.parseInt(code.slice(1), 10);
          if (level > 0) get(moveId).levelUp.push(level);
          else get(moveId).evolutionMove = true;
        } else if (kind === 'M') {
          if (tmMoveIds.has(moveId)) get(moveId).tm = true;
          else if (hmMoveIds.has(moveId)) get(moveId).tmx = true;
        } else if (kind === 'T') {
          if (tutorMoveIds.has(moveId)) get(moveId).tutor = true;
        } else if (kind === 'E') {
          get(moveId).egg = true;
        } else if (kind === 'R') {
          get(moveId).evolutionMove = true;
        }
      }
    }

    for (const preEvoId of preEvolutionIds(dex, species)) {
      const preLearnset = await learnsetOf(dex.species.get(preEvoId));
      for (const [moveId, codes] of Object.entries(preLearnset.entries)) {
        for (const code of codes) {
          if (code[0] === 'E') get(moveId).egg = true;
          if (code[0] !== 'L') continue;
          const level = Number.parseInt(code.slice(1), 10);
          if (level > 0) table.inheritLevelUp(moveId, level, preEvoId);
        }
      }
    }

    if (species.id === 'smeargle') {
      for (const moveId of sketchUniverse) get(moveId).sketch = true;
    }

    const moves = table.moves(dex);
    if (!moves.length) continue;

    await writeLegalMoves(outputDir, {
      pokemonId: species.id,
      pokemonName: species.name,
      types: species.types,
      learnsetPokemonId: learnset.id,
      learnsetPokemonName: learnset.name,
      moves,
    });
    written += 1;
  }
  console.log(
    `[${game.data.legalMovesDir}] wrote ${written} Pokémon files (Gen ${gen} learnsets${levelUpTable ? ', level-up table' : ''})`,
  );
  if (missingFromTable.length) {
    console.log(`  not in the level-up table: ${missingFromTable.join(', ')}`);
  }
}

await main();
