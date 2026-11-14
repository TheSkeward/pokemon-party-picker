/**
 * @fileoverview Builds site-data/data/item-usage/<family>.json for every
 * usage family: how often each held item is run
 * (scripts/item-usage/compute.mjs), from the family's set index. Runs after
 * build:set-index in refresh:data.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { toId } from '../src/utils/ids.js';
import { FAMILY_CONFIGS } from './config.mjs';
import { DATA_ROOT } from './set-index/constants.mjs';
import { readJson, writeJson } from './set-index/io.mjs';
import { computeItemUsage } from './item-usage/compute.mjs';

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
    for (const item of data.entry?.items || []) {
      if (typeof item?.name !== 'string' || typeof item.usage !== 'number') {
        continue;
      }
      usage.set(toId(item.name), item.usage);
    }
    sets.push({ pokemonId: data.pokemonId, usage });
  }
  return sets;
}

async function main() {
  const outRoot = path.join(DATA_ROOT, 'item-usage');
  await fs.rm(outRoot, { recursive: true, force: true });
  await fs.mkdir(outRoot, { recursive: true });
  for (const family of Object.keys(FAMILY_CONFIGS)) {
    const sets = await readSets(family);
    const { pokemon, items } = computeItemUsage(sets);
    await writeJson(path.join(outRoot, `${family}.json`), {
      family,
      pokemon,
      items,
    });
    console.log(
      `[item-usage] ${family}: ${pokemon}/${sets.length} Pokémon, ` +
      `${Object.keys(items).length} items`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
