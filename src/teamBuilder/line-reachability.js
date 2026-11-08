import { getLineRepresentativeCandidates } from '../data';
import {
  canHatchLine,
} from '../playthrough/breeding.js';
import {
  isStrictPreEvolutionOf,
} from '../playthrough/current-species.js';
import { buildInputGroups } from './input-groups';
import { normalizeName } from './name-utils';
import { parseAbilityAnnotations } from './pool-parsing';
import { dex } from '../games/dex.js';

/**
 * Whether a pool entry describes the Pokémon in hand rather than its line:
 * a caught ability, a move lock or a met level is a fact about one
 * individual, so that entry fields only what it can itself become, never a
 * form the line could only hatch.
 * @param {?Object} input
 * @param {!Object=} progression With the pool's marks stamped in.
 * @param {?Map<string, string>=} abilityAnnotations
 * @return {boolean}
 */
export function describesIndividual(
  input,
  progression = {},
  abilityAnnotations = null,
) {
  if (!input?.id) return false;
  if (abilityAnnotations?.get(normalizeName(input.name))) return true;
  if ((progression?.lockedMovesByPokemon?.[input.id] || []).length) return true;
  return progression?.metLevelByPokemon?.[input.id] != null;
}

/**
 * Which family forms can this input actually become? Descendants and their
 * Megas always qualify. Strict pre-evolutions and sibling branches require the
 * daycare on a hatchable line, because hatching is the route back down/across,
 * and an entry that describes the individual in hand (describesIndividual)
 * never takes that route: the hatch would be another Pokémon.
 */
export function getReachableLineCandidates(
  group,
  pokemonIndex,
  progression = {},
  abilityAnnotations = null,
) {
  const input = group?.input;
  if (group?.unresolved || !input) return [];

  const inputBaseId =
    dex().progressionSpecies[input.id]?.baseSpeciesId || input.id;
  const daycareReach =
    Boolean(progression?.daycareUnlocked) &&
    canHatchLine(input.id) &&
    !describesIndividual(input, progression, abilityAnnotations);
  return getLineRepresentativeCandidates(input.id, pokemonIndex).filter(
    (candidate) => {
      if (daycareReach) return true;
      const candidateBaseId = candidate.isMega
        ? dex().progressionSpecies[candidate.id]?.baseSpeciesId || candidate.id
        : candidate.id;
      return (
        candidateBaseId === input.id ||
        isStrictPreEvolutionOf(input.id, candidateBaseId) ||
        (inputBaseId !== input.id &&
          (candidateBaseId === inputBaseId ||
            isStrictPreEvolutionOf(inputBaseId, candidateBaseId)))
      );
    },
  );
}

/**
 * The asset identity of an input: its reachable TERMINAL forms under the
 * current progression. Stages of one line share their terminal form
 * (Bulbasaur and Ivysaur are both a future Venusaur); branching families
 * retain their distinct terminal sets — except under daycare closure, where
 * any hatchable-family member can breed back and re-evolve across branches,
 * so every member shares the family's full terminal set (a Vaporeon's best
 * reachable form may be Espeon). Two inputs with equal keys are one
 * fieldable asset.
 */
export function getReachableAssetKey(candidates = [], fallbackId = '') {
  const nonMega = candidates.filter((candidate) => !candidate.isMega);
  const rows = nonMega.length ? nonMega : candidates;
  const ids = new Set(rows.map((candidate) => candidate.id));
  const terminalIds = rows
    .filter((candidate) => {
      const evolutions = dex().progressionSpecies[candidate.id]?.evos || [];
      return !evolutions.some((id) => ids.has(id));
    })
    .map((candidate) => candidate.id);
  return [...new Set(terminalIds.length ? terminalIds : [...ids])]
    .sort()
    .join('|') || fallbackId;
}

/**
 * How many evolution steps separate a form from its family root (0 for a
 * basic form). Cycle-safe against malformed prevo data.
 * @param {string} pokemonId
 * @return {number}
 */
export function getEvolutionDepth(pokemonId) {
  let depth = 0;
  let cursor = dex().progressionSpecies[pokemonId];
  const seen = new Set();
  while (cursor?.prevoId && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    depth += 1;
    cursor = dex().progressionSpecies[cursor.prevoId];
  }
  return depth;
}

/**
 * Lightweight, unscored pool lines for real-team ownership matching. This is
 * deliberately built from the complete query, not the optimizer's bounded
 * working set: the 126-line cap controls score/search cost only.
 */
export function buildFieldablePoolLines({
  query = '',
  pokemonIndex = [],
  progression = {},
} = {}) {
  if (!query || !pokemonIndex?.length) return [];

  const abilityAnnotations = parseAbilityAnnotations(query, pokemonIndex);
  return buildInputGroups(query, pokemonIndex)
    .filter((group) => !group.unresolved)
    .map((group) => {
      const candidates = getReachableLineCandidates(
        group,
        pokemonIndex,
        progression,
        abilityAnnotations,
      );
      const choices = (candidates.length ? candidates : [group.input]).map(
        (candidate) => ({
          inputPokemonId: group.input.id,
          inputName: group.input.name,
          pokemonId: candidate.id,
          name: candidate.name,
        }),
      );
      return {
        best: choices[0],
        bestNonMega: null,
        choiceOptions: choices.slice(1),
      };
    });
}
