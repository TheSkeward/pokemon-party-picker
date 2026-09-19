import fs from 'node:fs/promises';
import path from 'node:path';
import { Dex } from '@pkmn/dex';
import { parseGenArg } from './dex-gen.mjs';

const projectRoot = process.cwd();
const pokemonIndexPath = path.join(projectRoot, 'site-data', 'data', 'pokemon-index.json');
const GEN = parseGenArg();
const outputPath = path.join(
  projectRoot,
  'src',
  'generated',
  `gen${GEN}ProgressionSpecies.generated.js`,
);
const dex = Dex.forGen(GEN);

// The species universe. Gen 7 follows the usage index, as it always has (the
// Reborn engine's contract); another generation takes every standard species
// of that generation and earlier from the dex.
const pokemonIndex =
  GEN === 7
    ? JSON.parse(await fs.readFile(pokemonIndexPath, 'utf8'))
    : dex.species
      .all()
      .filter(
        (species) =>
          species.exists && species.gen <= GEN && !species.isNonstandard,
      )
      .map((species) => ({ id: species.id, name: species.name }));
const pokemonIds = new Set(pokemonIndex.map((pokemon) => pokemon.id));
const speciesById = {};

// Level-up learnsets, used to resolve levelMove evolutions (evolve by knowing
// a move — e.g. Tangela needs Ancient Power for Tangrowth) to the level at
// which the pre-evo actually learns that move, so reachability can be gated
// by the level cap instead of guessed. Gen 7 reads Reborn's own learnsets
// (the authoritative source for the game this generation serves); another
// generation reads the dex's learnsets for that generation.
const rebornLearnsets =
  GEN === 7
    ? JSON.parse(
      await fs.readFile(
        path.join(
          projectRoot, 'scripts', 'reborn', 'reborn-learnsets.generated.json'),
        'utf8',
      ),
    ).learnsets
    : null;

async function levelMoveLearnLevel(prevoId, moveName) {
  const moveId = toId(moveName);
  if (rebornLearnsets) {
    const levelUp = rebornLearnsets[prevoId]?.levelUp || [];
    const levels = levelUp
      .filter(([, id]) => toId(id) === moveId)
      .map(([level]) => level);
    return levels.length ? Math.min(...levels) : null;
  }
  const learnset = (await dex.learnsets.get(prevoId))?.learnset?.[moveId] || [];
  const levels = learnset
    .filter((source) => source.startsWith(`${GEN}L`))
    .map((source) => Number(source.slice(2)))
    .filter((level) => Number.isFinite(level));
  return levels.length ? Math.min(...levels) : null;
}

for (const pokemon of pokemonIndex) {
  const species = dex.species.get(pokemon.id);
  if (!species?.exists) continue;

  speciesById[pokemon.id] = {
    id: pokemon.id,
    name: pokemon.name,
    prevoId: toId(species.prevo),
    evos: (species.evos || []).map(toId).filter((id) => pokemonIds.has(id)),
    evoLevel: Number.isFinite(species.evoLevel) ? species.evoLevel : null,
    evoType: species.evoType || '',
    // What the evolution actually requires, so legality can be checked and
    // priced instead of blanket-blocking whole evoTypes: the item (useItem /
    // levelHold / trade-with-item), the known move (levelMove), and any extra
    // condition text (day/night, gender, location, ...).
    evoItem: species.evoItem || '',
    evoMove: species.evoMove || '',
    evoMoveLevel:
      species.evoType === 'levelMove' && species.evoMove
        ? await levelMoveLearnLevel(toId(species.prevo), species.evoMove)
        : null,
    evoCondition: species.evoCondition || '',
    // Region-locked evolutions (Gen 7: the three Alolan-region ones). Reborn's
    // equivalent of Alola is Apophyll; legality gates on reaching it.
    evoRegion: species.evoRegion || '',
    baseSpeciesId: toId(species.baseSpecies),
    eggGroups: species.eggGroups || [],
    // Fixed-gender marker: "M" male-only, "F" female-only, "N" genderless,
    // "" mixed. Breeding legality needs it: the mother fixes the offspring
    // species (a Ditto pair hatches the non-Ditto parent's species, so Ditto
    // never moves a move across lines), so an egg-move donor must be able to
    // be MALE (female-only lines like NidoranF can never donate across
    // lines) and a recipient line must be able to field a female mother.
    gender: species.gender || '',
    isMega: Boolean(species.isMega),
  };
}

const body = `// Generated from @pkmn/dex Gen ${GEN} species progression data.
export const GEN${GEN}_PROGRESSION_SPECIES = ${JSON.stringify(speciesById, null, 2)};
`;

await fs.writeFile(outputPath, body);
console.log(`[progression-species] wrote ${Object.keys(speciesById).length} species`);

function toId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}
