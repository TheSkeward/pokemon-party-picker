/**
 * @fileoverview The generation argument shared by the dex-module generators:
 * `node scripts/build-<module>.mjs [gen]`, default 7. Each generator writes
 * src/generated/gen<G><Module>.generated.js and exports GEN<G>_* names, so a
 * game's dex bundle (src/games/dex-gen<G>.js) imports one generation's set.
 */

/**
 * @param {!Array<string>=} argv
 * @return {number} The generation, 1–9.
 */
export function parseGenArg(argv = process.argv) {
  const raw = argv[2] || '7';
  const gen = Number(raw);
  if (!Number.isInteger(gen) || gen < 1 || gen > 9) {
    throw new Error(`Unsupported generation: ${raw}`);
  }
  return gen;
}

// Generations whose usage prior is National Dex play, which legalizes the
// content the dex marks Past (Megas, Z-Moves, Hidden Power): a Gen 9 game
// on this registry (Rejuvenation) fields all of it.
const NATIONAL_DEX_GENS = new Set([9]);

/**
 * Whether a species or move belongs to a generation's tables. Gen 7 keeps
 * the whole dex object as {@code @pkmn/dex} serves it (Reborn fields
 * community Megas the dex marks Future and later-generation moves); a
 * National Dex generation keeps its standard content plus the dex's Past
 * content; any other generation keeps only its standard content.
 * @param {number} gen
 * @param {{gen: number, isNonstandard: ?string}} entity
 * @return {boolean}
 */
export function inUniverse(gen, entity) {
  if (gen === 7) return true;
  if (entity.gen > gen) return false;
  if (entity.isNonstandard == null) return true;
  return NATIONAL_DEX_GENS.has(gen) && entity.isNonstandard === 'Past';
}
