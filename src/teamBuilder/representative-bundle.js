import { resolveBestAvailableLightBundle } from '../data.js';

/**
 * @return {Promise<{usage: ?Object, leads: ?Object, ranking: ?Object,
 *     trace: ?Object, lineRanking: (?Object|undefined),
 *     lineTrace: (?Object|undefined)}>} The resolver index's bundle for the
 *     mon: the first format/cutoff at or above the meaningful-usage bar,
 *     else its best trace, carrying the long-run set-source and
 *     line-identity signals; nulls when the mon is absent everywhere.
 */
export async function resolveRepresentativeLightBundle({
  family,
  pokemonId,
}) {
  // The resolver index covers every month, format and cutoff of the slice,
  // so it is authoritative: a null usage here means the mon is genuinely
  // absent everywhere.
  const bundle = await resolveBestAvailableLightBundle({
    family,
    pokemonId,
  });
  return bundle || { usage: null, leads: null };
}
