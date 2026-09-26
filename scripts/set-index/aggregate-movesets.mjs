import path from 'node:path';
import { DATA_ROOT, HIDDEN_ENTRY_KEYS } from './constants.mjs';
import { readJsonIfExists } from './io.mjs';
import { normalizeName } from './string-utils.mjs';

/**
 * Aggregates a candidate's monthly moveset sidecars, weighting each entry's
 * usage% by that month's rawCount so the final percentages are count-based.
 * Each aggregate also carries the tier's mean usage share (`value`) and
 * ladder position (`tierRank`), so set sourcing can rank the tiers that
 * actually hold moveset data by the same stepped rule as the resolver index.
 *
 * @param {{family: string, selection: string, formatId: string,
 *     cutoff: number, months: !Array<string>, tierRank: number}} candidate
 * @return {!Promise<!Map<string, !Object>>} pokemonId → aggregate with a
 *     monthly-summed `entry` (moves/items/abilities/spreads).
 */
export async function aggregateCandidateSource(candidate) {
  const byPokemon = new Map();

  for (const month of candidate.months) {
    const sourceDir = path.join(
      DATA_ROOT,
      'sources',
      month,
      candidate.formatId,
      String(candidate.cutoff),
    );

    const source = await readJsonIfExists(path.join(sourceDir, 'moveset.json'));
    if (!source?.pokemon) continue;
    const usage = await readJsonIfExists(path.join(sourceDir, 'usage.json'));

    for (const [pokemonId, entry] of Object.entries(source.pokemon)) {
      const aggregate = getOrCreateAggregate({
        byPokemon,
        candidate,
        entry,
        pokemonId,
      });

      aggregate.monthsPresent += 1;
      aggregate.rawCount += entry.rawCount || 0;
      aggregate.usageTotal += usage?.pokemon?.[pokemonId]?.usage || 0;
      aggregate.name = entry.name || aggregate.name;

      accumulateSection(
        aggregate.sections.moves,
        filterVisibleEntries(entry.moves),
        entry.rawCount,
      );
      accumulateSection(
        aggregate.sections.items,
        filterVisibleEntries(entry.items),
        entry.rawCount,
      );
      accumulateSection(
        aggregate.sections.abilities,
        filterVisibleEntries(entry.abilities),
        entry.rawCount,
      );
      accumulateSection(
        aggregate.sections.spreads,
        filterVisibleEntries(entry.spreads),
        entry.rawCount,
      );
    }
  }

  return finalizeAggregates(byPokemon);
}

function getOrCreateAggregate({ byPokemon, candidate, entry, pokemonId }) {
  let aggregate = byPokemon.get(pokemonId);

  if (!aggregate) {
    aggregate = {
      selection: candidate.selection,
      family: candidate.family,
      month: candidate.selection === 'all' ? null : candidate.months[0],
      formatId: candidate.formatId,
      cutoff: candidate.cutoff,
      monthsAvailable: candidate.months.length,
      monthsPresent: 0,
      tierRank: candidate.tierRank,
      pokemonId,
      name: entry.name,
      rawCount: 0,
      usageTotal: 0,
      sections: {
        moves: new Map(),
        items: new Map(),
        abilities: new Map(),
        spreads: new Map(),
      },
    };

    byPokemon.set(pokemonId, aggregate);
  }

  return aggregate;
}

function finalizeAggregates(byPokemon) {
  const finalized = new Map();

  for (const [pokemonId, aggregate] of byPokemon.entries()) {
    if (!aggregate.rawCount || !aggregate.monthsPresent) continue;

    finalized.set(pokemonId, {
      selection: aggregate.selection,
      family: aggregate.family,
      month: aggregate.month,
      formatId: aggregate.formatId,
      cutoff: aggregate.cutoff,
      monthsAvailable: aggregate.monthsAvailable,
      monthsPresent: aggregate.monthsPresent,
      tierRank: aggregate.tierRank,
      // Mean usage share over the tier's months, as the resolver index
      // averages it; zero when the tier has moveset data but no usage row.
      value: aggregate.usageTotal / aggregate.monthsAvailable,
      entry: {
        pokemonId,
        name: aggregate.name,
        rawCount: aggregate.rawCount,
        moves: finalizeSection(aggregate.sections.moves, aggregate.rawCount),
        items: finalizeSection(aggregate.sections.items, aggregate.rawCount),
        abilities: finalizeSection(
          aggregate.sections.abilities,
          aggregate.rawCount,
        ),
        spreads: finalizeSection(
          aggregate.sections.spreads, aggregate.rawCount),
      },
    });
  }

  return finalized;
}

function accumulateSection(targetMap, entries = [], rawCount = 0) {
  for (const entry of entries) {
    const weight = ((entry.usage || 0) / 100) * (rawCount || 0);
    targetMap.set(entry.name, (targetMap.get(entry.name) || 0) + weight);
  }
}

function finalizeSection(sourceMap, totalRawCount) {
  return [...sourceMap.entries()]
    .map(([name, weight]) => ({
      name,
      usage: totalRawCount > 0 ? (weight / totalRawCount) * 100 : 0,
    }))
    .sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name));
}

function filterVisibleEntries(entries = []) {
  return entries.filter(
    (entry) => !HIDDEN_ENTRY_KEYS.has(normalizeName(entry.name)),
  );
}
