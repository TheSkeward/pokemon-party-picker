import { getCurrentSpeciesForChoice } from '../playthrough/current-species.js';
import {
  getAvailableMoves,
  loadLegalMoveData,
} from '../playthrough/legal-moves';
import { applyBreedingContextToProgression } from '../playthrough/breeding.js';
import {
  applySketchContextToProgression,
  buildMoveTransferContexts,
} from '../playthrough/sketch.js';
import { MAX_TRACKED_ITEM_COUNT } from '../playthrough/progression';
import { dex } from '../games/dex.js';

/**
 * Builds the plain-text "here are my available Pokémon and items" list from
 * the resolved pool lines and the current progression. Each Pokémon is
 * reported as its current playable form with the moves that are currently
 * legal/available, egg and Sketch moves included, as every other legality
 * pass sees them.
 * @param {{lines: Array<Object>, progression: Object,
 *     pokemonIndex: ?Array<Object>, poolQuery: ?string}} state The
 *     progression already carries the pool's met levels; poolQuery is the
 *     pool joined with the donor box (withDonors), which together decide the
 *     breeding and Sketch partners.
 * @return {Promise<string>}
 */
export async function buildPoolAvailabilityText({
  lines,
  progression,
  pokemonIndex,
  poolQuery,
}) {
  const resolvedLines = (lines || []).filter(
    (line) => line && !line.unresolved && (line.best || line.bestNonMega),
  );

  const transferContexts = await buildMoveTransferContexts({
    pokemonIndex,
    progression,
    query: poolQuery,
  });

  const entries = await Promise.all(
    resolvedLines.map((line) =>
      describeLine(line, progression, transferContexts),
    ),
  );

  const seenIds = new Set();
  const dedupedEntries = [];

  for (const entry of entries) {
    if (!entry) continue;
    if (seenIds.has(entry.id)) continue;
    seenIds.add(entry.id);
    dedupedEntries.push(entry);
  }

  // Sort by the Pokémon's current display name so the printed list reads
  // alphabetically — input order follows the pool/line order otherwise, which
  // looks scrambled once evolutions rename a line (e.g. Steenee under
  // "Bounsweet").
  dedupedEntries.sort((a, b) => a.name.localeCompare(b.name));

  const monLines = dedupedEntries.map((entry) => {
    const moves = entry.moves.length ? entry.moves.join(', ') : '(none available yet)';
    return `${entry.name} - available move pool: ${moves}`;
  });

  const sections = ['Here are my available Pokémon.', ...monLines];

  const itemsLine = describeOwnedItems(progression.ownedItems);
  sections.push('', `Here are my available held items: ${itemsLine}`);

  return sections.join('\n');
}

async function describeLine(
  line,
  progression,
  { breedingContext, sketchContext },
) {
  const choice = line.best || line.bestNonMega;
  if (!choice) return null;

  const species = getCurrentSpeciesForChoice(choice, progression);
  const speciesId = species?.id || choice.pokemonId;
  const speciesName = species?.name || choice.name;

  let moves = [];

  try {
    const legalMoveData = await loadLegalMoveData(speciesId);
    if (legalMoveData) {
      const progressionWithMoveTransfers = applySketchContextToProgression(
        applyBreedingContextToProgression(
          progression,
          legalMoveData.pokemonId,
          breedingContext,
        ),
        legalMoveData.pokemonId,
        sketchContext,
      );
      moves = getAvailableMoves(legalMoveData, progressionWithMoveTransfers)
        .map((move) => move.name)
        .sort((a, b) => a.localeCompare(b));
    }
  } catch {
    moves = [];
  }

  return { id: speciesId, name: speciesName, moves };
}

function describeOwnedItems(ownedItems = {}) {
  const owned = Object.entries(ownedItems)
    .map(([id, count]) => ({
      name: dex().heldItemsById[id]?.name || id,
      count,
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!owned.length) return '(none tracked yet)';

  return owned
    .map((entry) => {
      if (entry.count <= 1) return entry.name;
      const quantity =
        entry.count >= MAX_TRACKED_ITEM_COUNT
          ? `${MAX_TRACKED_ITEM_COUNT}+`
          : `${entry.count}`;
      return `${entry.name} x${quantity}`;
    })
    .join(', ');
}
