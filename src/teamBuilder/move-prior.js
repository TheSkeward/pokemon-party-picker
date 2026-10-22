/**
 * @fileoverview The measured utility prior: for each move, the share of a
 * learner's ladder sets that run it, averaged over every Pokémon in the
 * usage family that can learn the move (scripts/build-move-prior.mjs, one
 * table per family under site-data/data/move-prior). It speaks where a
 * mon's own record is silent: the set builder admits a utility move with no
 * usage on this mon only when learners of the move run it often enough, and
 * breaks ties among such moves by it. The mon's own usage always outranks
 * it. It replaced a hand-written table of thirty weights that rated Thunder
 * Wave at 85 where the ladder runs it on 5% of learners' sets and left Rapid
 * Spin, Stealth Rock and Knock Off unrated.
 */
import { dataUrl } from '../utils/data-url.js';
import { fetchJsonCached } from '../utils/fetch-json-cached.js';

/**
 * Percent of learners' sets below which a move with no usage on the mon
 * itself earns no utility seat: a mon with nothing credited seats nothing
 * rather than Confide.
 * @type {number}
 */
export const UTILITY_PRIOR_FLOOR = 1;

/** @type {!Map<string, !Map<string, number>>} Loaded tables by family. */
const tablesByFamily = new Map();
/** @type {!Map<string, number>} The table the set builder reads. */
let active = new Map();

/**
 * Loads the family's table (once) and makes it the active prior. A family
 * without a table leaves an empty prior, so only recorded moves seat.
 * @param {?string} family
 * @return {!Promise<!Map<string, number>>}
 */
export async function loadMovePrior(family) {
  if (!family) return active;
  if (!tablesByFamily.has(family)) {
    let data = null;
    try {
      data = await fetchJsonCached(dataUrl(`move-prior/${family}.json`));
    } catch {
      data = null;
    }
    const table = new Map();
    for (const [id, entry] of Object.entries(data?.moves || {})) {
      table.set(id, Number(entry?.prior) || 0);
    }
    tablesByFamily.set(family, table);
  }
  active = tablesByFamily.get(family);
  return active;
}

/**
 * @param {string} moveId
 * @return {number} Mean percent of learners' sets running the move; 0 when
 *     unknown or before any table is loaded.
 */
export function movePriorOf(moveId) {
  return active.get(moveId) || 0;
}

/**
 * Installs a table directly, for tests and preloads.
 * @param {?Map<string, number>} prior Null installs an empty table.
 * @return {!Map<string, number>} The table that was active, to restore.
 */
export function setMovePrior(prior) {
  const previous = active;
  active = prior || new Map();
  return previous;
}
