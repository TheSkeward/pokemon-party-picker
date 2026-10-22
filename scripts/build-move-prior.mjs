/**
 * @fileoverview Builds site-data/data/move-prior/<family>.json for every
 * usage family: the measured utility prior (scripts/move-prior/compute.mjs)
 * from the family's set index and the learnsets of the game whose dex
 * generation the family serves. Runs after build:set-index in refresh:data.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { FAMILY_CONFIGS } from './config.mjs';
import { DATA_ROOT } from './set-index/constants.mjs';
import { readJson, writeJson } from './set-index/io.mjs';
import { computeMovePrior } from './move-prior/compute.mjs';

/** The game whose legal-move files say what a generation's Pokémon learn. */
const LEARNSET_DIR_BY_GEN = {
  4: 'hgss-legal-moves',
  5: 'b2w2-legal-moves',
  7: 'reborn-legal-moves',
  9: 'rejuv-legal-moves',
};

const toId = (text) => String(text).toLowerCase().replace(/[^a-z0-9]/g, '');

async function listJson(dir) {
  try {
    return (await fs.readdir(dir)).filter((name) => name.endsWith('.json'));
  } catch {
    return [];
  }
}

async function readSets(family) {
  const dir = path.join(DATA_ROOT, 'set-index', family, 'all');
  const sets = [];
  for (const name of await listJson(dir)) {
    const data = await readJson(path.join(dir, name));
    const usage = new Map();
    for (const move of data.entry?.moves || []) {
      if (typeof move?.name !== 'string' || typeof move.usage !== 'number') {
        continue;
      }
      usage.set(toId(move.name), move.usage);
    }
    sets.push({ pokemonId: data.pokemonId, usage });
  }
  return sets;
}

async function readLearnsets(learnsetDir, pokemonIds) {
  const dir = path.join(DATA_ROOT, learnsetDir, 'all');
  const learnsets = new Map();
  for (const pokemonId of pokemonIds) {
    const file = path.join(dir, `${pokemonId}.json`);
    try {
      const data = await readJson(file);
      learnsets.set(pokemonId, new Set(data.moves.map((move) => move.id)));
    } catch {
      // No learnset for this form in this game: the Pokémon is skipped.
    }
  }
  return learnsets;
}

async function main() {
  const outRoot = path.join(DATA_ROOT, 'move-prior');
  await fs.rm(outRoot, { recursive: true, force: true });
  await fs.mkdir(outRoot, { recursive: true });
  for (const [family, config] of Object.entries(FAMILY_CONFIGS)) {
    const learnsetDir = LEARNSET_DIR_BY_GEN[config.gen];
    if (!learnsetDir) {
      console.warn(`[move-prior] ${family}: no learnset source for gen ${config.gen}`);
      continue;
    }
    const sets = await readSets(family);
    const learnsets = await readLearnsets(
      learnsetDir, sets.map((set) => set.pokemonId));
    // The generation's weights, for the carrier weight behind Heavy Slam and
    // Heat Crash; a generation without a dex module prices those at 0.
    const dexModule = await import(
      `../src/generated/gen${config.gen}BaseStats.generated.js`,
    ).catch(() => ({}));
    const weightsKg = dexModule[`GEN${config.gen}_WEIGHTS_KG`] || {};
    const { pokemon, moves } = computeMovePrior(sets, learnsets, weightsKg);
    await writeJson(path.join(outRoot, `${family}.json`), {
      family,
      learnsets: learnsetDir,
      pokemon,
      moves,
    });
    console.log(
      `[move-prior] ${family}: ${pokemon}/${sets.length} Pokémon, ` +
      `${Object.keys(moves).length} moves`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
