/**
 * @fileoverview The set index: one stitched set detail per Pokémon for each
 * usage family, every month aggregated (scripts/build-set-index.mjs). A
 * family extension (usage-family.js) stores the details of the Pokémon whose
 * usage source is one of its formats and lists them; every other Pokémon's
 * is its base family's.
 * Every reader of a set detail goes through here, so the card, the damage
 * model and the item step read the same file for a Pokémon.
 */
import { dataUrl } from '../utils/data-url.js';
import { fetchJsonCached } from '../utils/fetch-json-cached.js';
import { baseFamilyOf, isFamilyExtension } from '../usage-family.js';

// The ids an extension holds its own detail for; an unreadable listing
// holds none, which leaves every Pokémon on the base family's detail.
async function heldBy(family) {
  try {
    const ids = await fetchJsonCached(
      dataUrl(`set-index/${family}/all/index.json`),
    );
    return new Set(Array.isArray(ids) ? ids : []);
  } catch {
    return new Set();
  }
}

/**
 * @param {{family: string, pokemonId: string}} target
 * @return {!Promise<?Object>} The Pokémon's set detail under the usage
 *     family; null when the index has none. Rejects when the fetch fails.
 */
export async function fetchSetDetail({ family, pokemonId }) {
  const source =
    isFamilyExtension(family) && !(await heldBy(family)).has(pokemonId)
      ? baseFamilyOf(family)
      : family;
  return fetchJsonCached(
    dataUrl(`set-index/${source}/all/${pokemonId}.json`),
  );
}
