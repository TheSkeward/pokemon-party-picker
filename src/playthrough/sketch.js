import { buildInputGroups } from '../teamBuilder/input-groups.js';
import { toId } from '../utils/ids.js';
import { digest } from '../utils/digest.js';
import {
  acquisitionOf,
  applyBreedingContextToProgression,
  buildBreedingContext,
  canHatchLine,
  familyForms,
} from './breeding.js';
import { getReachableSpecies } from './current-species.js';
import { ownedEvolutionItems } from './evolution-requirements.js';
import {
  getAvailableMoves,
  getMoveSourcePriority,
  loadLegalMoveData,
} from './legal-moves.js';
import { dex } from '../games/dex.js';
import { getActiveGame } from '../games/registry.js';
import { getMoveMetaById } from '../move-meta.js';
import { stableStringify } from '../utils/stable-stringify.js';

const SMEARGLE_ID = 'smeargle';

// Building the contexts walks every owned species' move pool against every
// donor, and each consumer of one gamestate asks for the same pair: the
// optimizer before it can key its caches, the item recommendations, the
// Sets & coverage panel, the legal-moves panel. The pair depends only on the
// game, the progression, the owned species and whether routes are kept, so
// it is built once per such input and shared. A roster lock changes none of
// those. Twelve entries hold the current gamestate and the investment
// plan's future caps, with room to come back to a few earlier ones.
const TRANSFER_MEMO_ENTRIES = 12;
/** @type {!Map<string, !Promise<!Object>>} Least recently used first. */
const transferMemo = new Map();

/**
 * Resolve the two move-transfer systems in dependency order. Breeding first
 * establishes every partner's real move pool; Sketch then copies from those
 * partners. A final breeding pass lets a partner-backed Smeargle serve as an
 * egg donor without ever allowing Sketch to bootstrap itself.
 * @return {!Promise<{breedingContext: !Object, sketchContext: !Object}>}
 *     Shared between callers with the same inputs, so never to be mutated.
 */
export function buildMoveTransferContexts(options = {}) {
  const key = transferMemoKey(options);
  if (key === null) return resolveMoveTransferContexts(options);

  const known = transferMemo.get(key);
  if (known) {
    // Re-inserting moves the entry to the recently used end.
    transferMemo.delete(key);
    transferMemo.set(key, known);
    return known;
  }
  const building = resolveMoveTransferContexts(options);
  transferMemo.set(key, building);
  if (transferMemo.size > TRANSFER_MEMO_ENTRIES) {
    transferMemo.delete(transferMemo.keys().next().value);
  }
  // A failed build must not answer the next request.
  building.catch(() => {
    if (transferMemo.get(key) === building) transferMemo.delete(key);
  });
  return building;
}

/**
 * @return {?string} The memo key, or null for a build steered by an option
 *     the key does not describe; such a build is not shared.
 */
function transferMemoKey({
  pokemonIndex = [],
  progression = {},
  query = '',
  retainRoutes = false,
  sketchContext = null,
  preferredPartnerIds = null,
  preferredMoveIdsByPartnerId = null,
}) {
  if (sketchContext || preferredPartnerIds || preferredMoveIdsByPartnerId) {
    return null;
  }
  // Both builders read the pool text only for the species it resolves to,
  // and the owned items only for the ones an evolution spends: a held item
  // added to the bag must not rebuild what the whole donor box can pass on.
  const ownedIds = buildInputGroups(query, pokemonIndex)
    .filter((group) => !group.unresolved && group.input?.id)
    .map((group) => group.input.id);
  return digest([
    getActiveGame().id,
    retainRoutes ? 'routes' : 'plain',
    ownedIds.join(','),
    stableStringify({
      ...progression,
      ownedItems: ownedEvolutionItems(progression),
    }),
  ].join('|'));
}

async function resolveMoveTransferContexts(options) {
  let breedingContext = await buildBreedingContext(options);
  const sketchContext = await buildSketchContext({
    ...options,
    breedingContext,
  });
  if (
    options.progression?.daycareUnlocked &&
    sketchContext.byPokemonId?.[SMEARGLE_ID]?.moveIds?.length
  ) {
    breedingContext = await buildBreedingContext({
      ...options,
      sketchContext,
    });
  }
  return { breedingContext, sketchContext };
}

/**
 * Builds Smeargle's practical Sketch pool. A move is available only when a
 * different, currently fieldable Pokemon from the user's pool can already use
 * it under the same progression. The partner's own egg moves may participate
 * when breeding really is available, but Sketch itself has no daycare or
 * egg-group gate.
 * @return {!Promise<{byPokemonId: !Object, ownedSpecies: !Array<!Object>}>}
 */
export async function buildSketchContext({
  pokemonIndex = [],
  progression = {},
  query = '',
  breedingContext = null,
  preferredPartnerIds = new Set(),
  preferredMoveIdsByPartnerId = new Map(),
  retainRoutes = false,
} = {}) {
  const ownedSpecies = getOwnedFieldableSpecies({
    pokemonIndex,
    progression,
    query,
  });
  if (!ownedSpecies.some((species) => species.id === SMEARGLE_ID)) {
    return emptyContext();
  }

  const routes = (
    await Promise.all(
      ownedSpecies
        .filter((species) => species.id !== SMEARGLE_ID)
        .map(async (species) => {
          const legalMoveData = await loadLegalMoveData(species.id);
          if (!legalMoveData) return [];
          const partnerProgression = applyBreedingContextToProgression(
            progression,
            species.id,
            breedingContext,
          );
          return getAvailableMoves(legalMoveData, partnerProgression)
            .map((move) => partnerRoute(move, species, progression))
            .filter(Boolean);
        }),
    )
  ).flat();

  const routesByMoveId = new Map();
  for (const route of routes) {
    if (!routesByMoveId.has(route.moveId)) {
      routesByMoveId.set(route.moveId, []);
    }
    routesByMoveId.get(route.moveId).push(route);
  }

  return buildContextFromRoutes({
    routesByMoveId,
    ownedSpecies,
    preferredPartnerIds,
    preferredMoveIdsByPartnerId,
    retainRoutes,
  });
}

/**
 * Re-rank an already-built context for display without loading the full pool a
 * second time. Team analysis requests retained routes; optimizer contexts stay
 * compact and omit them.
 */
export function rerankSketchContext(sketchContext, {
  preferredPartnerIds = new Set(),
  preferredMoveIdsByPartnerId = new Map(),
  retainRoutes = false,
} = {}) {
  if (!sketchContext?.routesByMoveId) return sketchContext;
  return buildContextFromRoutes({
    routesByMoveId: sketchContext.routesByMoveId,
    ownedSpecies: sketchContext.ownedSpecies || [],
    preferredPartnerIds,
    preferredMoveIdsByPartnerId,
    retainRoutes,
  });
}

// A partner that leaves the field cannot be sketched. Sketch copies the last
// move its target chose; aimed at a fainted ally it goes to a foe instead
// (Battler.rb pbFindUser), and a Pokémon that has just come in has chosen no
// move (pbInitEffects). So a move that switches or faints its user is copied
// only on a turn the game stops it short of that, which it does after
// recording the move as used (Battler.rb, "Record move as having been used",
// and the Selfdestruct check above it). What stops each move is read from
// Reborn's battle scripts.

function nobodyToSwitchTo(partnerName) {
  return `Bring no other Pokémon able to battle, so ${partnerName} has nobody to switch to and stays on the field.`;
}

function nobodyToReplaceIt(partnerName) {
  return `Bring no other Pokémon able to battle, so the move fails and ${partnerName} does not faint.`;
}

function dampOnTheField(partnerName) {
  return `Have a Pokémon with Damp on the field, which stops the move so that ${partnerName} does not faint.`;
}

function ghostTarget(partnerName) {
  return `Have ${partnerName} aim it at a Ghost type, which it does not affect, so that ${partnerName} does not faint.`;
}

function protectedTarget(partnerName) {
  return `Have ${partnerName} aim it at a Pokémon that is protecting itself, which stops the move so that ${partnerName} does not faint.`;
}

/**
 * What keeps the user of a move that faints it on the field, by move id.
 * @type {!Map<string, function(string): string>}
 */
const STAY_FOR_FAINTING_MOVE = new Map([
  // Damp returns false from pbOnStartUse, before the user's HP is spent.
  ['explosion', dampOnTheField],
  ['selfdestruct', dampOnTheField],
  ['mistyexplosion', dampOnTheField],
  // pbEffect returns on a Ghost-type target before the user's HP is spent.
  ['finalgambit', ghostTarget],
  // Once pbEffect runs the user faints whatever the target does; Protect
  // stops the move in pbSuccessCheck, before that.
  ['memento', protectedTarget],
  // Both fail when pbCanChooseNonActive? finds nobody to come in.
  ['healingwish', nobodyToReplaceIt],
  ['lunardance', nobodyToReplaceIt],
]);

/**
 * How Smeargle gets a move from a partner, with what keeps the partner on
 * the field when the move would take it off.
 * @param {{moveName: string, partnerName: string}} route
 * @param {string} moveId
 * @return {string}
 */
function sketchInstruction(route, moveId) {
  const switchesOut =
    (getMoveMetaById(moveId)?.roles || []).includes('pivot');
  const stay = STAY_FOR_FAINTING_MOVE.get(moveId) ||
    (switchesOut ? nobodyToSwitchTo : null);
  const copy = `${route.moveName}: have ${route.partnerName} use it beside Smeargle in a Double Battle, then have Smeargle use Sketch on that partner.`;
  return stay ? `${copy} ${stay(route.partnerName)}` : copy;
}

function buildContextFromRoutes({
  routesByMoveId,
  ownedSpecies,
  preferredPartnerIds,
  preferredMoveIdsByPartnerId,
  retainRoutes,
}) {
  const moveIds = [...routesByMoveId.keys()].sort();
  const sources = {};
  for (const moveId of moveIds) {
    const rankedRoutes = routesByMoveId.get(moveId).sort((a, b) =>
      comparePartnerRoutes(a, b, {
        preferredPartnerIds,
        preferredMoveIdsByPartnerId,
      }),
    );
    const route = rankedRoutes[0];
    const alternatives = collectAlternativeRoutes(rankedRoutes);
    const partnerSourceText = formatPartnerSource(route.partnerSource);
    sources[moveId] = {
      kind: 'sketch',
      label: `Sketch via ${route.partnerName}`,
      detail: partnerSourceText,
      sourceTitle: [
        sketchInstruction(route, moveId),
        partnerSourceText
          ? `${route.partnerName}'s source: ${partnerSourceText}.`
          : null,
        route.partnerSource.sourceTitle || null,
        alternatives.length
          ? `Other pool routes: ${alternatives.map(formatPartnerRoute).join('; ')}.`
          : null,
      ]
        .filter(Boolean)
        .join('\n'),
      partnerId: route.partnerId,
      partnerName: route.partnerName,
      partnerInputId: route.partnerInputId,
      partnerSource: route.partnerSource,
      partnerLevel: route.cost.levelingLevel,
    };
  }

  const context = {
    byPokemonId: {
      [SMEARGLE_ID]: { moveIds, sources },
    },
    ownedSpecies,
  };
  if (retainRoutes) context.routesByMoveId = routesByMoveId;
  return context;
}

/** Stamp one Pokemon's pool-backed Sketch moves into its progression. */
export function applySketchContextToProgression(
  progression,
  pokemonId,
  sketchContext,
) {
  const sketch = sketchContext?.byPokemonId?.[toId(pokemonId)];
  return {
    ...progression,
    availableSketchMoveIdsForPokemon: sketch?.moveIds || [],
    availableSketchMoveSourcesForPokemon: sketch?.sources || {},
  };
}

/**
 * Compact cache signature that changes with both move availability and the
 * displayed partner receipt, without putting hundreds of tooltip strings in
 * every optimizer cache key.
 */
export function sketchContextSignature(sketchContext) {
  const sketch = sketchContext?.byPokemonId?.[SMEARGLE_ID];
  if (!sketch?.moveIds?.length) return 'none';
  const text = sketch.moveIds
    .map((moveId) => {
      const source = sketch.sources?.[moveId] || {};
      const partnerSource = source.partnerSource || {};
      return [
        moveId,
        source.partnerId || '',
        source.partnerInputId || '',
        source.partnerLevel ?? '',
        partnerSource.kind || '',
        partnerSource.label || '',
        partnerSource.detail || '',
      ].join(':');
    })
    .join('|');
  return `${sketch.moveIds.length}:${digest(text)}`;
}

function getOwnedFieldableSpecies({ pokemonIndex, progression, query }) {
  const byId = new Map();
  for (const group of buildInputGroups(query, pokemonIndex)) {
    if (group.unresolved || !group.input?.id) continue;
    const inputId = group.input.id;
    let forms;
    if (progression.daycareUnlocked && canHatchLine(inputId)) {
      const rootId = familyForms(inputId)[0]?.id || inputId;
      forms = getReachableSpecies(rootId, progression);
    } else {
      forms = getReachableSpecies(inputId, progression);
    }
    if (!forms.length) forms = [group.input];
    for (const form of forms) {
      if (!form?.id || byId.has(form.id)) continue;
      byId.set(form.id, {
        id: form.id,
        name: form.name || form.id,
        inputId,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function partnerRoute(move, species, progression) {
  const partnerSources = [...(move.availableSources || [])]
    .filter((source) => source.kind !== 'sketch')
    .map((source) => ({
      source,
      cost: sourceCost(source, species, progression),
    }))
    .sort((a, b) => compareRouteCosts(a.cost, b.cost, a.source, b.source));
  if (!partnerSources.length) return null;
  const { source: partnerSource, cost } = partnerSources[0];
  return {
    // Hidden Power variants are expanded only after the base move passes its
    // availability gate. One partner variant therefore unlocks the base entry;
    // Smeargle's own type is selected by the same Type Changer progression.
    moveId: move.id.startsWith('hiddenpower') ? 'hiddenpower' : move.id,
    moveName: move.name,
    partnerId: species.id,
    partnerName: species.name,
    partnerInputId: species.inputId,
    partnerSource,
    cost,
  };
}

function comparePartnerRoutes(a, b, preferences) {
  return (
    preferenceRank(a, preferences) - preferenceRank(b, preferences) ||
    compareRouteCosts(a.cost, b.cost, a.partnerSource, b.partnerSource) ||
    a.partnerName.localeCompare(b.partnerName) ||
    a.partnerId.localeCompare(b.partnerId)
  );
}

function preferenceRank(route, {
  preferredPartnerIds,
  preferredMoveIdsByPartnerId,
}) {
  if (!preferredPartnerIds.has(route.partnerId)) return 2;
  const moveIds = preferredMoveIdsByPartnerId.get(route.partnerId);
  return moveIds?.has(route.moveId) ? 0 : 1;
}

function compareRouteCosts(costA, costB, sourceA, sourceB) {
  return (
    costA.transferSteps - costB.transferSteps ||
    costA.level - costB.level ||
    costA.hassle - costB.hassle ||
    costA.kind - costB.kind ||
    String(sourceA.label || '').localeCompare(String(sourceB.label || '')) ||
    String(sourceA.detail || '').localeCompare(String(sourceB.detail || ''))
  );
}

function sourceCost(source, species, progression) {
  const acquisition = acquisitionOf(
    { availableSources: [source] },
    species.id,
    {
      inputId: species.inputId,
      ownedItems: progression.ownedItems || {},
    },
  );
  return {
    // Any direct route beats first arranging another breeding transfer.
    transferSteps: source.kind === 'egg' ? 1 : 0,
    // acquisitionOf prices evolution moves at the real evolution level and
    // also retains scarce-item costs, rather than treating level:null as free.
    level: acquisition.level,
    // The ranking level may include scarce-item offsets. Interim-donor
    // guidance needs the literal level where this partner learns the move.
    levelingLevel:
      source.kind === 'level-up' && Number.isFinite(source.level)
        ? source.level
        : source.onEvolution
          ? dex().progressionSpecies[species.id]?.evoLevel ?? null
          : null,
    hassle: acquisition.hassle || 0,
    kind: getMoveSourcePriority(source),
  };
}

function collectAlternativeRoutes(rankedRoutes) {
  const alternatives = [];
  const seenFamilies = new Set([familyRootId(rankedRoutes[0]?.partnerId)]);
  for (const route of rankedRoutes.slice(1)) {
    const family = familyRootId(route.partnerId);
    if (seenFamilies.has(family)) continue;
    seenFamilies.add(family);
    alternatives.push(route);
    if (alternatives.length >= 2) break;
  }
  return alternatives;
}

function familyRootId(pokemonId) {
  let id = pokemonId;
  const seen = new Set();
  while (dex().progressionSpecies[id]?.prevoId && !seen.has(id)) {
    seen.add(id);
    id = dex().progressionSpecies[id].prevoId;
  }
  return id;
}

function formatPartnerRoute(route) {
  const source = formatPartnerSource(route.partnerSource);
  return source ? `${route.partnerName} — ${source}` : route.partnerName;
}

function formatPartnerSource(source) {
  if (!source) return '';
  return source.detail
    ? `${source.label}: ${source.detail}`
    : String(source.label || 'currently available');
}

function emptyContext() {
  return { byPokemonId: {}, ownedSpecies: [] };
}
