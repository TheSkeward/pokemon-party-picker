import fs from 'node:fs/promises';
import path from 'node:path';
import { compareTraceUsage } from '../src/teamBuilder/trace-usage.js';
import { isLineUsageFormat } from '../src/teamBuilder/usage-line-ranking.js';

const projectRoot = process.cwd();
const dataRoot = path.join(projectRoot, 'site-data', 'data');
const outputRoot = path.join(dataRoot, 'resolver-index');
const LEAD_SMOOTHING_K = 200;

async function main() {
  const availability = await readJson(path.join(dataRoot, 'availability.json'));
  const families =
    Object.keys(availability.familyConfigs || { singles: {}, doubles: {} });

  await fs.rm(outputRoot, { recursive: true, force: true });

  for (const family of families) {
    console.log(`[resolver-index] building ${family}/all`);
    const index = await buildFamilyAllIndex(availability, family);

    const outDir = path.join(outputRoot, family);
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(path.join(outDir, 'all.json'), JSON.stringify(index, null, 2) + '\n');

    console.log(`[resolver-index] ${family}/all: ${Object.keys(index.pokemon).length} pokemon`);
  }
}

// Hard floor for "real signal": a tier's usage must be at least this percent
// for the mon to count as meaningful there. Sourced from the scoring
// constants (single knob): the runtime meaningful-usage judgement, the Usage
// column's first-meaningful tier, and the set-index tier sourcing all move
// together when it changes — regenerate this index and the set index in the
// same commit.
import { SCORING_DEFAULTS } from '../src/teamBuilder/scoring-constants.js';
const MEANINGFUL_USAGE_PERCENT = SCORING_DEFAULTS.MIN_MEANINGFUL_USAGE_PERCENT;

async function buildFamilyAllIndex(availability, family) {
  const {
    resolved: usageByPokemon,
    ranking: rankingByPokemon,
    trace: traceByPokemon,
    lineRanking: lineRankingByPokemon,
    lineTrace: lineTraceByPokemon,
  } = await resolveAllPokemonUsage(availability, family);
  const leadsByPokemon = await resolveAllPokemonLeads(availability, family);

  const pokemon = {};
  const ids =
    new Set([...Object.keys(usageByPokemon), ...Object.keys(leadsByPokemon)]);

  for (const pokemonId of [...ids].sort()) {
    pokemon[pokemonId] = {
      usage: usageByPokemon[pokemonId] || null,
      leads: leadsByPokemon[pokemonId] || null,
      // The first tier (descending the format×cutoff ladder) whose usage
      // clears the meaningful bar — the signal used to rank low-usage mons
      // against each other, since the headline tier's raw count is noise.
      ranking: rankingByPokemon[pokemonId] || null,
      // First tier at the first successful five-game relaxation step. Shared
      // by set sourcing, canonical forms, and bench labels; still not a rank.
      trace: traceByPokemon[pokemonId] || null,
      // Evolutionary representatives use the same relaxation, excluding
      // LC/NFE. Keep their signals even when the set source ranks in LC/NFE.
      lineRanking: lineRankingByPokemon[pokemonId] || null,
      lineTrace: lineTraceByPokemon[pokemonId] || null,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    family,
    selection: 'all',
    latestMonth: availability.latestMonth || null,
    pokemon,
  };
}

async function resolveAllPokemonUsage(availability, family) {
  const resolved = {}; // first tier the mon appears in at all (the headline)
  const ranking = {}; // first tier whose usage clears the meaningful bar
  // For mons that never clear the meaningful bar anywhere: the single best
  // sub-bar row (first qualifying five-game horizon, then earliest tier).
  const trace = {};
  const lineRanking = {};
  const lineTrace = {};
  let tierRank = -1;

  for (const candidate of iterateCandidateSources(availability, family, 'usage')) {
    tierRank += 1;
    const aggregate = new Map();

    for (const month of candidate.months) {
      const source = await readSourceData(month, candidate.formatId, candidate.cutoff, 'usage');
      if (!source?.pokemon) continue;

      for (const [pokemonId, entry] of Object.entries(source.pokemon)) {
        if (resolved[pokemonId] && ranking[pokemonId] &&
          lineRanking[pokemonId]) continue;

        const current = aggregate.get(pokemonId) || {
          pokemonId,
          name: entry.name,
          totalUsage: 0,
          totalRawCount: 0,
          monthsPresent: 0,
        };

        current.name = entry.name || current.name;
        current.totalUsage += entry.usage || 0;
        current.totalRawCount += entry.rawCount || 0;
        current.monthsPresent += 1;

        aggregate.set(pokemonId, current);
      }
    }

    for (const [pokemonId, entry] of aggregate.entries()) {
      if (entry.monthsPresent === 0) continue;

      const value = entry.totalUsage / candidate.months.length;
      const tierRow = {
        tierRank,
        formatId: candidate.formatId,
        cutoff: candidate.cutoff,
        value,
      };

      if (!resolved[pokemonId]) {
        resolved[pokemonId] = {
          selection: 'all',
          family,
          month: null,
          formatId: candidate.formatId,
          cutoff: candidate.cutoff,
          monthsAvailable: candidate.months.length,
          monthsPresent: entry.monthsPresent,
          entry: {
            pokemonId,
            name: entry.name,
            usage: value,
            rawCount: entry.totalRawCount,
          },
          value,
        };
      }

      if (!ranking[pokemonId] && value >= MEANINGFUL_USAGE_PERCENT) {
        ranking[pokemonId] = {
          ...tierRow,
          rawCount: entry.totalRawCount,
        };
      }

      // Rescan the ladder at 30, 35, 40, ... games without repeatedly walking
      // the sources: shortest horizon wins, then tier priority, not raw %.
      if (!ranking[pokemonId] && value > 0) {
        const current = trace[pokemonId];
        const next = {
          ...tierRow,
          name: entry.name,
        };
        if (!current || compareTraceUsage(next, current) < 0) {
          trace[pokemonId] = next;
        }
      }

      if (isLineUsageFormat(candidate.formatId) && !lineRanking[pokemonId]) {
        if (value >= MEANINGFUL_USAGE_PERCENT) {
          lineRanking[pokemonId] = {
            ...tierRow, rawCount: entry.totalRawCount,
          };
        } else if (value > 0) {
          const next = { ...tierRow, name: entry.name };
          if (!lineTrace[pokemonId] ||
            compareTraceUsage(next, lineTrace[pokemonId]) < 0) {
            lineTrace[pokemonId] = next;
          }
        }
      }
    }
  }

  for (const pokemonId of Object.keys(trace)) {
    if (ranking[pokemonId]) delete trace[pokemonId];
  }
  for (const pokemonId of Object.keys(lineTrace)) {
    if (lineRanking[pokemonId]) delete lineTrace[pokemonId];
  }

  return { resolved, ranking, trace, lineRanking, lineTrace };
}

async function resolveAllPokemonLeads(availability, family) {
  const resolved = {};

  for (const candidate of iterateCandidateSources(availability, family, 'leads')) {
    const aggregate = new Map();
    let totalUsageRawForPrior = 0;
    let totalLeadRawForPrior = 0;

    for (const month of candidate.months) {
      const [usageSource, leadsSource] = await Promise.all([
        readSourceData(month, candidate.formatId, candidate.cutoff, 'usage'),
        readSourceData(month, candidate.formatId, candidate.cutoff, 'leads'),
      ]);

      if (!usageSource?.pokemon || !leadsSource?.pokemon) continue;

      totalUsageRawForPrior += leadsSource.summary?.totalUsageRaw || 0;
      totalLeadRawForPrior += leadsSource.summary?.totalLeadRaw || 0;

      for (
        const [pokemonId, usageEntry] of Object.entries(usageSource.pokemon)) {
        if (resolved[pokemonId]) continue;

        const current = aggregate.get(pokemonId) || {
          pokemonId,
          name: usageEntry.name,
          usageRawCount: 0,
          leadRawCount: 0,
          monthsPresent: 0,
        };

        current.name = usageEntry.name || current.name;
        current.usageRawCount += usageEntry.rawCount || 0;
        current.monthsPresent += 1;

        const leadEntry = leadsSource.pokemon[pokemonId];
        if (leadEntry) current.leadRawCount += leadEntry.leadRawCount || 0;

        aggregate.set(pokemonId, current);
      }
    }

    const prior = totalUsageRawForPrior > 0
      ? totalLeadRawForPrior / totalUsageRawForPrior
      : 0;

    for (const [pokemonId, entry] of aggregate.entries()) {
      if (resolved[pokemonId]) continue;
      if (entry.usageRawCount === 0 || entry.monthsPresent === 0) continue;

      const value =
        ((entry.leadRawCount + LEAD_SMOOTHING_K * prior) /
          (entry.usageRawCount + LEAD_SMOOTHING_K)) *
        100;

      resolved[pokemonId] = {
        selection: 'all',
        family,
        month: null,
        formatId: candidate.formatId,
        cutoff: candidate.cutoff,
        monthsAvailable: candidate.months.length,
        monthsPresent: entry.monthsPresent,
        entry: {
          pokemonId,
          name: entry.name,
          usageRawCount: entry.usageRawCount,
          leadRawCount: entry.leadRawCount,
        },
        value,
      };
    }
  }

  return resolved;
}

function* iterateCandidateSources(availability, family, dataKind) {
  const familyConfig = availability?.familyConfigs?.[family];
  const formatOrder = familyConfig?.formatOrder || [];
  const cutoffPriority = familyConfig?.cutoffPriority || [];
  const months = Object.keys(availability?.months || {}).sort();

  for (const formatId of formatOrder) {
    for (const cutoff of cutoffPriority) {
      const candidateMonths = months.filter((month) =>
        availability?.months?.[month]?.[formatId]?.[dataKind]?.includes(cutoff),
      );

      if (candidateMonths.length === 0) continue;

      yield {
        family,
        selection: 'all',
        formatId,
        cutoff,
        months: candidateMonths,
      };
    }
  }
}

async function readSourceData(month, formatId, cutoff, dataKind) {
  return readJsonNullable(
    path.join(dataRoot, 'sources', month, formatId, String(cutoff), `${dataKind}.json`),
  );
}

async function readJsonNullable(filePath) {
  try {
    return await readJson(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
