import { getLineRepresentativeCandidates } from '../data.js';
import {
  canHatchLine,
} from '../playthrough/breeding.js';
import {
  getCurrentSpeciesForChoice,
  isStrictPreEvolutionOf,
} from '../playthrough/current-species.js';
import {
  fieldsInMonotype,
  hasMonotype,
  monotypeOf,
} from '../playthrough/monotype.js';
import { buildInputGroups } from './input-groups.js';
import { normalizeName } from './name-utils.js';
import { parseAbilityAnnotations } from './pool-parsing.js';
import { dex } from '../games/dex.js';

/**
 * Whether the pool marks an entry as exactly the species named ("Meowth="):
 * the owner is not evolving it.
 * @param {?Object} input
 * @param {!Object=} progression With the pool's marks stamped in.
 * @return {boolean}
 */
function isExactEntry(input, progression = {}) {
  return Boolean(input?.id && progression?.exactByPokemon?.[input.id]);
}

/**
 * Whether a pool entry describes the Pokémon in hand rather than its line:
 * a caught ability, a move lock, a met level or an exact mark is a fact
 * about one individual, so that entry fields only what it can itself
 * become, never a form the line could only hatch.
 * @param {?Object} input
 * @param {!Object=} progression With the pool's marks stamped in.
 * @param {?Map<string, string>=} abilityAnnotations
 * @return {boolean}
 */
function describesIndividual(
  input,
  progression = {},
  abilityAnnotations = null,
) {
  if (!input?.id) return false;
  if (abilityAnnotations?.get(normalizeName(input.name))) return true;
  if ((progression?.lockedMovesByPokemon?.[input.id] || []).length) return true;
  if (isExactEntry(input, progression)) return true;
  return progression?.metLevelByPokemon?.[input.id] != null;
}

/**
 * Which family forms can this input actually become? Descendants and their
 * Megas always qualify. Strict pre-evolutions and sibling branches require the
 * daycare on a hatchable line, because hatching is the route back down/across,
 * and an entry that describes the individual in hand (describesIndividual)
 * never takes that route: the hatch would be another Pokémon. An exact entry
 * becomes nothing but itself and its own Mega, so its line is judged by the
 * named species' usage record alone and every reader of the choice fields
 * that species (current-species.js keeps a pick on its representative's
 * line). A monotype run keeps only the forms inside its type, so an entry
 * with none comes back empty and is not fielded.
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
  const exact = isExactEntry(input, progression);
  const monotype = monotypeOf(progression);
  return getLineRepresentativeCandidates(input.id, pokemonIndex).filter(
    (candidate) => {
      if (
        monotype && !fieldedInMonotype(input, candidate, progression, monotype)
      ) {
        return false;
      }
      if (daycareReach) return true;
      const candidateBaseId = candidate.isMega
        ? dex().progressionSpecies[candidate.id]?.baseSpeciesId || candidate.id
        : candidate.id;
      if (exact) return candidateBaseId === input.id;
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

// A monotype run fields a line only through forms inside its type: a
// target that is of the type, and the stage the owner holds on the way to
// it. An owned form already past the type (a Vaporeon in a Normal run)
// holds no such stage, whatever its line could hatch.
function fieldedInMonotype(input, candidate, progression, monotype) {
  if (!hasMonotype(candidate.id, monotype)) return false;
  const stage = getCurrentSpeciesForChoice(
    { inputPokemonId: input.id, pokemonId: candidate.id },
    progression,
  );
  return fieldsInMonotype(stage?.id || input.id, monotype);
}

/**
 * The pool entries a monotype run leaves off the team: no form the entry
 * could field is inside the run's type. They stay donors.
 * @param {!Array<!Object>} groups The pool's input groups.
 * @param {!Array<!Object>} pokemonIndex
 * @param {!Object=} progression With the pool's marks stamped in.
 * @param {?Map<string, string>=} abilityAnnotations
 * @return {!Array<string>} Input names in pool order; empty outside a
 *     monotype run.
 */
export function entriesOutsideMonotype(
  groups,
  pokemonIndex,
  progression = {},
  abilityAnnotations = null,
) {
  if (!monotypeOf(progression)) return [];
  return groups
    .filter((group) =>
      !group.unresolved &&
      !getReachableLineCandidates(
        group, pokemonIndex, progression, abilityAnnotations,
      ).length)
    .map((group) => group.input.name);
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
 * working set: the 126-line cap controls score/search cost only. One line
 * per Pokémon owned: the query holds the pool and the donor box, the donor
 * box keeps every pool entry, and a species named in both is one Pokémon.
 */
export function buildFieldablePoolLines({
  query = '',
  pokemonIndex = [],
  progression = {},
} = {}) {
  if (!query || !pokemonIndex?.length) return [];

  const abilityAnnotations = parseAbilityAnnotations(query, pokemonIndex);
  const owned = new Set();
  return buildInputGroups(query, pokemonIndex)
    .filter((group) => {
      if (group.unresolved || owned.has(group.input.id)) return false;
      owned.add(group.input.id);
      return true;
    })
    .map((group) => {
      const candidates = getReachableLineCandidates(
        group,
        pokemonIndex,
        progression,
        abilityAnnotations,
      );
      // A monotype run fields nothing of an entry outside its type.
      if (!candidates.length && monotypeOf(progression)) return null;
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
    })
    .filter(Boolean);
}
