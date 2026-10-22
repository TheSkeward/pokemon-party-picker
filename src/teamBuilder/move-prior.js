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
 *
 * The same table carries each move's carry rate, the share of all the
 * family's sets that run it, and for the weight-ratio attacks the typical
 * weight of the Pokémon that carry them, which side-effect pricing reads.
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

/**
 * @typedef {{prior: number, carry: number, carrierWeightKg: number}}
 */
let MovePriorEntry;

/** @type {!Map<string, !Map<string, !MovePriorEntry>>} Tables by family. */
const tablesByFamily = new Map();
/** @type {!Map<string, !MovePriorEntry>} The table the set builder reads. */
let active = new Map();

/**
 * @param {*} value A table entry, or a bare prior percent.
 * @return {!MovePriorEntry}
 */
function normalizeEntry(value) {
  if (typeof value === 'number') {
    return { prior: value, carry: 0, carrierWeightKg: 0 };
  }
  return {
    prior: Number(value?.prior) || 0,
    carry: Number(value?.carry) || 0,
    carrierWeightKg: Number(value?.carrierWeightKg) || 0,
  };
}

/**
 * @param {?Object|?Map} source Entries by move id.
 * @return {!Map<string, !MovePriorEntry>}
 */
function toTable(source) {
  const table = new Map();
  const entries =
    source instanceof Map ? source.entries() : Object.entries(source || {});
  for (const [id, value] of entries) table.set(id, normalizeEntry(value));
  return table;
}

/**
 * Loads the family's table (once) and makes it the active prior. A family
 * without a table leaves an empty prior, so only recorded moves seat.
 * @param {?string} family
 * @return {!Promise<!Map<string, !MovePriorEntry>>}
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
    tablesByFamily.set(family, toTable(data?.moves));
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
  return active.get(moveId)?.prior || 0;
}

/**
 * @param {string} moveId
 * @return {number} Percent of all the family's sets that run the move.
 */
export function moveCarryOf(moveId) {
  return active.get(moveId)?.carry || 0;
}

/**
 * @param {string} moveId
 * @return {number} Carry-weighted mean weight in kg of the Pokémon that run
 *     the move; 0 when none do or weights are unknown.
 */
export function moveCarrierWeightOf(moveId) {
  return active.get(moveId)?.carrierWeightKg || 0;
}

/**
 * Installs a table directly, for tests and preloads. Values may be full
 * entries or bare prior percents.
 * @param {?Map|?Object} prior Null installs an empty table.
 * @return {!Map<string, !MovePriorEntry>} The table that was active.
 */
export function setMovePrior(prior) {
  const previous = active;
  active = prior ? toTable(prior) : new Map();
  return previous;
}
