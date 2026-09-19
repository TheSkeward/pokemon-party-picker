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
