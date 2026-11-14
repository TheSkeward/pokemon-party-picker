import { dataUrl } from './utils/data-url.js';
import { toId as normalizeSearch } from './utils/ids.js';
import { dex } from './games/dex.js';

const LEAD_SMOOTHING_K = 200;

const jsonCache = new Map();
const resolverSummaryCache = new Map();
const resolverIndexCache = new Map();

/** @return {!Promise<!Array<!Object>>} */
export async function loadFormatsIndex() {
  return loadJson(dataUrl('formats.json'));
}
/** @return {!Promise<!Object>} */
export async function loadAvailability() {
  return loadJson(dataUrl('availability.json'));
}
/**
 * @return {!Promise<!Array<!Object>>} The species index narrowed to the
 *     active game (see filterToActiveGame).
 */
export async function loadPokemonIndex() {
  return filterToActiveGame(await loadJson(dataUrl('pokemon-index.json')));
}

/**
 * The species the active game can field: the index is built from the widest
 * dex, so a game on an older generation keeps only the entries its own dex
 * knows (the Gen 7 index is a subset of the Gen 7 dex, so Reborn keeps all).
 * @param {!Array<{id: string, name: string}>} pokemonIndex
 * @return {!Array<{id: string, name: string}>}
 */
export function filterToActiveGame(pokemonIndex) {
  const known = dex().progressionSpecies;
  return pokemonIndex.filter((entry) => entry.id in known);
}
/**
 * @param {string} formatId
 * @return {!Promise<!Object>}
 */
export async function loadFormatData(formatId) {
  return loadJson(dataUrl(`by-format/${formatId}.json`));
}

/**
 * A format's movesets aggregated across every month the data holds
 * (scripts/build-aggregate-movesets.mjs). The monthly moveset files are
 * build inputs that no deployment ships.
 * @param {string} formatId
 * @return {!Promise<?Object>} Moveset data, or null when the format has
 *     none (404).
 */
export async function loadAggregateMovesets(formatId) {
  return loadOptionalJson(dataUrl(`aggregate-movesets/${formatId}.json`));
}

/**
 * A family's move usage table (scripts/build-move-prior.mjs): for each
 * move, the share of its learners' sets that run it, how many Pokémon learn
 * it, and the share of all the family's sets that run it.
 * @param {string} family
 * @return {!Promise<?Object>} The table, or null when the family has none
 *     (404).
 */
export async function loadMoveUsage(family) {
  return loadOptionalJson(dataUrl(`move-prior/${family}.json`));
}

/**
 * A family's item usage table (scripts/build-item-usage.mjs): for each held
 * item, the share of all the family's sets that hold it and how many
 * Pokémon hold it more than any other item.
 * @param {string} family
 * @return {!Promise<?Object>} The table, or null when the family has none
 *     (404).
 */
export async function loadItemUsage(family) {
  return loadOptionalJson(dataUrl(`item-usage/${family}.json`));
}

// A file some formats and families do not have: its 404 is an answer, null,
// and is cached like any other.
async function loadOptionalJson(url) {
  if (jsonCache.has(url)) return jsonCache.get(url);
  const response = await fetch(url);
  if (response.status === 404) {
    jsonCache.set(url, null);
    return null;
  }
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  const data = await response.json();
  jsonCache.set(url, data);
  return data;
}

async function loadJson(url) {
  if (jsonCache.has(url)) return jsonCache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}`);
  const data = await response.json();
  jsonCache.set(url, data);
  return data;
}

/**
 * The usage-data families in pipeline order (scripts/config.mjs), as the
 * availability index publishes them.
 * @param {?Object} availability
 * @return {!Array<{id: string, label: string}>}
 */
export function listFamilies(availability) {
  return Object.entries(availability?.familyConfigs || {}).map(
    ([id, config]) => ({ id, label: config.label || id }),
  );
}
/**
 * @param {?Object} availability
 * @param {string} family
 * @return {string} The family's default browser format; '' when the
 *     availability index has no such family.
 */
export function getDefaultBrowserFormat(availability, family) {
  return availability?.familyConfigs?.[family]?.defaultBrowserFormat || '';
}
/** @return {boolean} */
export function formatBelongsToFamily(formatsIndex, formatId, family) {
  const format = formatsIndex.find((entry) => entry.id === formatId);
  return format ? format.family === family : false;
}

/**
 * @param {!Object} dataset A format's by-format file.
 * @return {!Array<!Object>} Usage rows aggregated across the format's
 *     months, with lead metrics attached.
 */
export function getAggregateRows(dataset) {
  return addLeadMetrics(buildAggregateRows(dataset));
}

/**
 * @param {{months: (!Array<string>|undefined)}} dataset
 * @return {string} The span of months a format's data covers
 *     ("2014-11 → 2026-10"); '' with no months.
 */
export function describeDatasetMonths(dataset) {
  const months = dataset?.months || [];
  return months.length ? `${months[0]} → ${months[months.length - 1]}` : '';
}

/** @return {string} */
export function getDatasetLabel(dataset) {
  const span = describeDatasetMonths(dataset);
  return span ? `All available (${span})` : 'All available';
}

/** @return {?Object} */
export function getMovesetEntry(movesetData, pokemonId) {
  return movesetData?.pokemon?.[pokemonId] || null;
}
/** @return {!Array<string>} Sorted month keys. */
function getAvailabilityMonths(availability) {
  return Object.keys(availability?.months || {}).sort();
}
/** @return {string} */
export function getAvailabilityLabel(availability) {
  const months = getAvailabilityMonths(availability);
  if (!months.length) return 'All available';
  return `All available (${months[0]} → ${months[months.length - 1]})`;
}

/**
 * @return {!Array<{id: string, name: string, isMega: boolean,
 *     isExact: boolean}>} Deduplicated evolution-line representative
 *     candidates; the Pokémon itself when the line table has no entry.
 */
export function getLineRepresentativeCandidates(pokemonId, pokemonIndex) {
  const nameById = new Map(pokemonIndex.map((entry) => [entry.id, entry.name]));
  const rawCandidates = dex().lineRepresentativeCandidates[pokemonId] || [
    {
      id: pokemonId,
      name: nameById.get(pokemonId) || pokemonId,
      isMega: false,
    },
  ];

  const seen = new Set();
  return rawCandidates
    .filter((candidate) => {
      if (!candidate?.id || seen.has(candidate.id)) return false;
      seen.add(candidate.id);
      return true;
    })
    .map((candidate) => ({
      id: candidate.id,
      name: nameById.get(candidate.id) || candidate.name || candidate.id,
      isMega: Boolean(candidate.isMega),
      isExact: candidate.id === pokemonId,
    }));
}

/**
 * @param {?string} query Names separated by commas or newlines.
 * @return {!Array<string>} The names as typed, trimmed, in order.
 */
export function splitQueryNames(query) {
  return String(query || '')
    .split(/[,\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

/**
 * Resolves a comma/newline-separated query against the Pokémon index. Per
 * token, the first non-empty match tier wins: exact, then prefix, then
 * substring.
 * @return {!Array<{id: string, name: string, token: string,
 *     matchMode: string, broadMatch: boolean}>}
 */
export function resolveQueryEntries(query, pokemonIndex) {
  const tokens = splitQueryNames(query);
  if (!tokens.length) return [];

  const indexed = pokemonIndex.map((entry) => ({
    ...entry,
    normalizedName: normalizeSearch(entry.name),
  }));

  const seen = new Set();
  const results = [];

  for (const token of tokens) {
    const normalizedToken = normalizeSearch(token);
    if (!normalizedToken) continue;

    const exactMatches =
      indexed.filter((entry) => entry.normalizedName === normalizedToken);
    const prefixMatches = indexed.filter(
      (entry) => entry.normalizedName.startsWith(normalizedToken));
    const substringMatches =
      indexed.filter((entry) => entry.normalizedName.includes(normalizedToken));

    const [matches, matchMode] = exactMatches.length > 0
      ? [exactMatches, 'exact']
      : prefixMatches.length > 0
        ? [prefixMatches, 'prefix']
        : [substringMatches, 'substring'];

    const limit = normalizedToken.length <= 2 ? 250 : 200;

    const orderedMatches = [...matches]
      .sort((a, b) => {
        const aPrefix = a.normalizedName.startsWith(normalizedToken) ? 0 : 1;
        const bPrefix = b.normalizedName.startsWith(normalizedToken) ? 0 : 1;
        if (aPrefix !== bPrefix) return aPrefix - bPrefix;
        return a.name.localeCompare(b.name);
      })
      .slice(0, limit);

    for (const match of orderedMatches) {
      const seenKey = `${normalizedToken}:${match.id}`;
      if (seen.has(seenKey)) continue;
      seen.add(seenKey);

      results.push({
        id: match.id,
        name: match.name,
        token,
        matchMode,
        broadMatch: normalizedToken.length <= 2 || matchMode === 'substring',
      });
    }
  }

  return results;
}

// The resolver index holds one slice per family, every month aggregated.
async function loadResolverIndex(family) {
  if (resolverIndexCache.has(family)) return resolverIndexCache.get(family);

  // Cache the in-flight load, not only its resolved value. A large scoring pool
  // asks for hundreds of summaries concurrently; without promise sharing every
  // caller fetched and parsed the same complete resolver index.
  const promise = (async () => {
    const response = await fetch(
      dataUrl(`resolver-index/${family}/all.json`),
    );
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Failed to load resolver index for ${family}`);
    }
    return response.json();
  })();
  resolverIndexCache.set(family, promise);
  try {
    return await promise;
  } catch (error) {
    resolverIndexCache.delete(family);
    throw error;
  }
}

/**
 * @return {!Promise<!Object>} One Pokémon's usage/leads summaries (each null
 *     when absent everywhere) plus canonical ranking/trace facts, read from
 *     the family's resolver index.
 */
export async function resolveBestAvailableLightBundle({ family, pokemonId }) {
  const cacheKey = `${family}:${pokemonId}`;
  if (resolverSummaryCache.has(cacheKey)) return resolverSummaryCache.get(
    cacheKey);

  // The resolver index is precomputed from every source file of the slice,
  // aggregating every Pokémon present in any of them, so it is
  // authoritative: a miss means the Pokémon is absent everywhere.
  const resolverIndex = await loadResolverIndex(family);
  const bundle = resolverIndex?.pokemon?.[pokemonId] || {
    usage: null,
    leads: null,
  };
  resolverSummaryCache.set(cacheKey, bundle);
  return bundle;
}

function buildAggregateRows(dataset) {
  const months = dataset.months || [];
  const monthCount = months.length;
  if (!monthCount) return [];
  return Object.entries(dataset.history || {}).map(([pokemonId, entry]) => {
    let usageSum = 0;
    let rawCountSum = 0;
    let leadRawCountSum = 0;
    for (const month of months) {
      const monthData = entry.months[month];
      if (!monthData) continue;
      usageSum += monthData.usage;
      rawCountSum += monthData.rawCount;
      leadRawCountSum += monthData.leadRawCount || 0;
    }
    return {
      pokemonId,
      name: entry.name,
      usage: usageSum / monthCount,
      rawCount: rawCountSum,
      leadRawCount: leadRawCountSum,
    };
  }).filter((row) => row.rawCount > 0)
    .sort((a, b) =>
      b.usage - a.usage || b.rawCount - a.rawCount ||
      a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

function addLeadMetrics(rows) {
  const totalUsageRaw = rows.reduce((sum, row) => sum + (row.rawCount || 0), 0);
  const totalLeadRaw =
    rows.reduce((sum, row) => sum + (row.leadRawCount || 0), 0);
  const prior = totalUsageRaw > 0 ? totalLeadRaw / totalUsageRaw : 0;
  return rows.map((row) => {
    const rawCount = row.rawCount || 0;
    const leadRawCount = row.leadRawCount || 0;
    const leadTendency = rawCount > 0
      ? ((leadRawCount + LEAD_SMOOTHING_K * prior) /
        (rawCount + LEAD_SMOOTHING_K)) * 100
      : prior * 100;
    return { ...row, leadRawCount, leadTendency };
  });
}
