import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveAllPokemonUsage } from './build-resolver-index.mjs';
import { FAMILY_CONFIGS, extensionsOf } from './config.mjs';
import {
  DATA_ROOT,
  FALLBACK_FAMILY_ORDER,
  FAMILIES,
  OUT_ROOT,
} from './set-index/constants.mjs';
import {
  aggregateCandidateSource,
  releaseTierAggregates,
} from './set-index/aggregate-movesets.mjs';
import { getMovesetCandidates } from './set-index/candidates.mjs';
import { readJson, readJsonIfExists, writeJson } from './set-index/io.mjs';
import {
  buildSpeciesContext,
  relatedClosure,
} from './set-index/species-context.mjs';
import {
  appendRelatedSetOptions,
  stitchPokemonSetDetail,
} from './set-index/stitch-set-details.mjs';

async function main() {
  const [availability, formatsIndex, pokemonIndex] = await Promise.all([
    readJson(path.join(DATA_ROOT, 'availability.json')),
    readJson(path.join(DATA_ROOT, 'formats.json')),
    readJson(path.join(DATA_ROOT, 'pokemon-index.json')),
  ]);

  const speciesContext = buildSpeciesContext(pokemonIndex);

  // Families named on the command line are rebuilt alone, each with its
  // extensions; with none named the whole index is.
  const named = process.argv.slice(2);
  const unknown = named.filter((family) => !FAMILIES.includes(family));
  if (unknown.length) throw new Error(`Unknown family: ${unknown.join(', ')}`);
  const families = named.length
    ? FAMILIES.filter((family) => named.includes(family))
    : FAMILIES;
  const stale = named.length
    ? families.flatMap((family) => [family, ...extensionsOf(family)])
      .map((family) => path.join(OUT_ROOT, family))
    : [OUT_ROOT];
  for (const dir of stale) await fs.rm(dir, { recursive: true, force: true });

  let gen = null;
  for (const family of families) {
    // Ladders share tiers within a generation only.
    if (FAMILY_CONFIGS[family].gen !== gen) releaseTierAggregates();
    gen = FAMILY_CONFIGS[family].gen;
    const build = {
      availability, formatsIndex, pokemonIndex, selection: 'all', speciesContext,
    };
    await buildFamilySetIndex({ ...build, family });
    for (const extension of extensionsOf(family)) {
      await buildExtensionSetIndex({ ...build, base: family, extension });
    }
  }
}

async function buildFamilySetIndex({
  availability,
  family,
  formatsIndex,
  pokemonIndex,
  selection,
  speciesContext,
}) {
  const sourceFamilies = FALLBACK_FAMILY_ORDER[family] || [family];

  console.log(
    `[set-index] building ${family}/${selection} from ${sourceFamilies.join(' → ')}`,
  );

  const sourceAggregates = await buildSourceAggregates({
    availability,
    selection,
    sourceFamilies,
  });

  const written = await stitchAndWrite({
    family,
    formatsIndex,
    pokemonIndex,
    rankings: await loadFamilyRankings(family),
    selection,
    sourceAggregates,
    speciesContext,
  });

  console.log(`[set-index] ${family}/${selection}: ${written.length} Pokémon`);
}

/**
 * An extension's set index: the details of the Pokémon its own formats
 * favour, the ones the usage rule ranks on one of those formats' tiers.
 * Such a Pokémon takes its set from that tier and is stitched over the
 * extension's whole set ladder (its own tiers, then its base family's,
 * with the base family's fallback behind them). Every other Pokémon keeps
 * the base family's detail, which is not written again; `index.json` lists
 * the ones that are, for the loader.
 */
async function buildExtensionSetIndex({
  availability,
  base,
  extension,
  formatsIndex,
  pokemonIndex,
  selection,
  speciesContext,
}) {
  const sourceFamilies = [
    extension,
    ...(FALLBACK_FAMILY_ORDER[base] || [base]).slice(1),
  ];
  const sourceAggregates = await buildSourceAggregates({
    availability,
    selection,
    sourceFamilies,
  });

  // The usage rule over the extension's formats alone says which Pokémon
  // they favour and on which tier; every other Pokémon's source is the one
  // its base family's ladder gives it.
  const own = await resolveAllPokemonUsage(availability, extension, undefined, {
    formatOrder: availability.familyExtensions[extension].formatOrder,
    cutoffPriority: availability.familyConfigs[base].cutoffPriority,
  });
  const rankings = await loadFamilyRankings(base);
  for (const [pokemonId, ranking] of Object.entries(own.ranking)) {
    rankings.rankingByPokemon.set(pokemonId, ranking);
    rankings.traceByPokemon.delete(pokemonId);
  }
  const favoured = new Set(Object.keys(own.ranking));

  // A detail borrows entries from the details of its related Pokémon, so
  // those are stitched beside it and left unwritten.
  const stitched = relatedClosure(favoured, pokemonIndex, speciesContext);
  const written = await stitchAndWrite({
    family: extension,
    formatsIndex,
    pokemonIndex: pokemonIndex.filter((pokemon) => stitched.has(pokemon.id)),
    rankings,
    selection,
    sourceAggregates,
    speciesContext,
    write: (pokemon) => favoured.has(pokemon.id),
  });
  await writeJson(
    path.join(OUT_ROOT, extension, selection, 'index.json'),
    [...written].sort(),
  );

  console.log(
    `[set-index] ${extension}/${selection}: ${written.length} Pokémon ` +
    `over ${base}`,
  );
}

// Stitches each listed Pokémon from the tiers, its primary set the tier
// `rankings` names for it, lets it borrow from its related Pokémon, and
// writes those `write` admits (all of them, by default). Returns the ids
// written.
async function stitchAndWrite({
  family,
  formatsIndex,
  pokemonIndex,
  rankings: { rankingByPokemon, traceByPokemon },
  selection,
  sourceAggregates,
  speciesContext,
  write = () => true,
}) {
  const samePokemonDetails = buildSamePokemonDetails({
    family,
    formatsIndex,
    pokemonIndex,
    rankingByPokemon,
    traceByPokemon,
    selection,
    sourceAggregates,
  });

  appendRelatedDetails({
    pokemonIndex,
    samePokemonDetails,
    speciesContext,
  });

  return writeFamilyDetails({
    family,
    pokemonIndex: pokemonIndex.filter(write),
    samePokemonDetails,
    selection,
  });
}

async function buildSourceAggregates({
  availability,
  selection,
  sourceFamilies,
}) {
  const sourceAggregates = [];

  for (const sourceFamily of sourceFamilies) {
    const candidates = getMovesetCandidates(
      availability,
      sourceFamily,
      selection,
    );

    for (const candidate of candidates) {
      const aggregateByPokemon = await aggregateCandidateSource(candidate);
      sourceAggregates.push({ candidate, aggregateByPokemon });
    }
  }

  return sourceAggregates;
}

async function loadFamilyRankings(family) {
  const index = await readJsonIfExists(
    path.join(DATA_ROOT, 'resolver-index', family, 'all.json'),
  );

  const rankingByPokemon = new Map();
  const traceByPokemon = new Map();
  for (const [pokemonId, bundle] of Object.entries(index?.pokemon || {})) {
    if (bundle?.ranking) rankingByPokemon.set(pokemonId, bundle.ranking);
    else if (bundle?.trace) traceByPokemon.set(pokemonId, bundle.trace);
  }

  return { rankingByPokemon, traceByPokemon };
}

function buildSamePokemonDetails({
  family,
  formatsIndex,
  pokemonIndex,
  rankingByPokemon,
  traceByPokemon,
  selection,
  sourceAggregates,
}) {
  const samePokemonDetails = new Map();

  for (const pokemon of pokemonIndex) {
    const detail = stitchPokemonSetDetail({
      family,
      formatsIndex,
      pokemon,
      ranking: rankingByPokemon.get(pokemon.id) || null,
      trace: traceByPokemon.get(pokemon.id) || null,
      selection,
      sourceAggregates,
    });

    if (detail) samePokemonDetails.set(pokemon.id, detail);
  }

  return samePokemonDetails;
}

function appendRelatedDetails({
  pokemonIndex,
  samePokemonDetails,
  speciesContext,
}) {
  for (const pokemon of pokemonIndex) {
    const detail = samePokemonDetails.get(pokemon.id);
    if (!detail) continue;

    appendRelatedSetOptions({
      detail,
      pokemon,
      samePokemonDetails,
      speciesContext,
    });
  }
}

async function writeFamilyDetails({
  family,
  pokemonIndex,
  samePokemonDetails,
  selection,
}) {
  const written = [];
  const outDir = path.join(OUT_ROOT, family, selection);
  await fs.mkdir(outDir, { recursive: true });

  for (const pokemon of pokemonIndex) {
    const detail = samePokemonDetails.get(pokemon.id);
    if (!detail) continue;

    await writeJson(path.join(outDir, `${pokemon.id}.json`), detail);
    written.push(pokemon.id);
  }

  return written;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
