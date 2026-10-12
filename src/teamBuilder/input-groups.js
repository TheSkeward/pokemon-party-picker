import { resolveQueryEntries } from '../data';
import { parseMetLevels, parsePoolTokens } from './pool-parsing';
import { normalizeName } from './name-utils';

/**
 * The pool's met levels by species id ("Munna@14" -> { munna: 14 }),
 * resolved through the same lookup the groups use, so the id is the one the
 * legality pass keys on.
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {!Object<string, number>}
 */
export function metLevelsByPokemonId(query, pokemonIndex) {
  const byName = parseMetLevels(query, pokemonIndex);
  const byId = {};
  if (!byName.size) return byId;
  for (const group of buildInputGroups(query, pokemonIndex)) {
    if (group.unresolved) continue;
    const level = byName.get(normalizeName(group.input.name));
    if (level != null && byId[group.input.id] == null) {
      byId[group.input.id] = level;
    }
  }
  return byId;
}

/**
 * The progression with the pool's met levels stamped in as
 * metLevelByPokemon, so every legality pass (optimizer, analysis, legal-moves
 * panel, availability list) reads the same ones. The progression itself when
 * the pool carries none, so cache keys are untouched for pools without them.
 * @param {!Object} progression
 * @param {string} query
 * @param {Array<Object>} pokemonIndex
 * @return {!Object}
 */
export function withMetLevels(progression, query, pokemonIndex) {
  if (!query || !Array.isArray(pokemonIndex)) return progression;
  const metLevelByPokemon = metLevelsByPokemonId(query, pokemonIndex);
  if (!Object.keys(metLevelByPokemon).length) return progression;
  return { ...progression, metLevelByPokemon };
}

/**
 * @param {string} query
 * @param {Object} pokemonIndex
 * @return {Array<{token: string, input: Object, entries: Array<Object>,
 *     unresolved: boolean}>} One group per pool token; unresolved tokens
 *     carry a synthetic input and empty entries.
 */
export function buildInputGroups(query, pokemonIndex) {
  const tokens = parsePoolTokens(query, pokemonIndex);
  const groups = [];

  for (const token of tokens) {
    const entries = resolveQueryEntries(token, pokemonIndex);

    if (!entries.length) {
      groups.push({
        token,
        input: { id: normalizeName(token), name: token, token },
        entries: [],
        unresolved: true,
      });
      continue;
    }

    const exact = entries.find(
      (entry) => normalizeName(entry.name) === normalizeName(token),
    );
    const chosen = exact || entries[0];

    groups.push({
      token,
      input: chosen,
      entries: [chosen],
      ambiguousCount: entries.length,
      unresolved: false,
    });
  }

  return groups;
}
