/**
 * @fileoverview Builds per-Pokémon legal-move files for a mainline game from
 * its generation's {@code @pkmn/dex} learnsets, in the shape the Reborn
 * builder writes (build-reborn-legal-moves.mjs) so the engine reads every
 * game alike:
 *
 *   node scripts/build-mainline-legal-moves.mjs <gameId>
 *
 * Only the generation's own learnset entries count (no transfer moves).
 * Level-up entries keep their levels; a machine entry becomes a TM or an HM
 * source according to the game's machine tables, so a machine another game
 * of the generation has and this one lacks (Defog in SoulSilver) teaches
 * nothing; a tutor entry counts only for the game's own tutors; egg entries
 * are egg moves; a form-change entry (Rotom-Wash's Hydro Pump) is recorded
 * as an evolution move, granted on taking the form. Event-only entries are
 * skipped. A form whose own learnset the dex leaves empty or reduced to its
 * form-change move inherits its base species' learnset. Pre-evolution
 * level-up moves (attributed to the learner) and egg moves are carried as
 * in the Reborn builder; Smeargle may Sketch any move of the generation but
 * Chatter and Struggle.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { Dex } from '@pkmn/dex';
import { getGame, listGames } from '../src/games/registry.js';

const UNSKETCHABLE_MOVES = new Set(['chatter', 'struggle']);

const toId = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');

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
    learnsetCache.set(species.id, result);
    return result;
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

  await fs.rm(outputDir, { recursive: true, force: true });
  await fs.mkdir(outputDir, { recursive: true });

  let written = 0;
  for (const species of universe) {
    const learnset = await learnsetOf(species);
    const sourcesByMove = new Map();
    const get = (moveId) => {
      if (!sourcesByMove.has(moveId)) {
        sourcesByMove.set(moveId, {
          levelUp: [], tm: false, tmx: false, tutor: false, egg: false,
        });
      }
      return sourcesByMove.get(moveId);
    };

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

    const preEvoLevelUp = new Map();
    for (const preEvoId of getPreEvolutionIds(dex, species)) {
      const preLearnset = await learnsetOf(dex.species.get(preEvoId));
      for (const [moveId, codes] of Object.entries(preLearnset.entries)) {
        for (const code of codes) {
          if (code[0] === 'E') get(moveId).egg = true;
          if (code[0] !== 'L') continue;
          const level = Number.parseInt(code.slice(1), 10);
          if (!(level > 0)) continue;
          if (!preEvoLevelUp.has(moveId)) preEvoLevelUp.set(moveId, []);
          preEvoLevelUp.get(moveId).push({ level, from: preEvoId });
        }
      }
    }
    for (const moveId of preEvoLevelUp.keys()) get(moveId);

    if (species.id === 'smeargle') {
      for (const moveId of sketchUniverse) get(moveId).sketch = true;
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
    if (!moves.length) continue;

    await fs.writeFile(
      path.join(outputDir, `${species.id}.json`),
      JSON.stringify({
        pokemonId: species.id,
        pokemonName: species.name,
        types: species.types,
        learnsetPokemonId: learnset.id,
        learnsetPokemonName: learnset.name,
        moves,
      }) + '\n',
    );
    written += 1;
  }
  console.log(
    `[${game.data.legalMovesDir}] wrote ${written} Pokémon files (Gen ${gen} learnsets)`,
  );
}

// Pre-evolution ids (closest first), walked from the base species so forms
// inherit the base line's chain.
function getPreEvolutionIds(dex, species) {
  let current = species.baseSpecies !== species.name
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

await main();
