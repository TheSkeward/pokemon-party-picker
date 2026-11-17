/**
 * @fileoverview The monotype rule: which forms a run restricted to one type
 * may field. A form is in the run when it has the type or evolves into a
 * form that has it, so a Charmander belongs to a Flying run for the
 * Charizard it becomes. Mega Evolution is not evolution: a Mega is in the
 * run only when it and the species that becomes it both have the type, so
 * Mega Charizard X stays out of a Flying run and brings no Charizard into
 * a Dragon one.
 */
import { dex } from '../games/dex.js';
import { toId } from '../utils/ids.js';

/**
 * @param {?Object} progression
 * @return {string} The type the run is restricted to; '' when it is not.
 */
export function monotypeOf(progression) {
  return progression?.monotype || '';
}

/**
 * Whether a form is of a monotype run's type itself: what a line may aim
 * for. A pre-evolution that only evolves into the type is fielded on the
 * way there (fieldsInMonotype) and is never the line's target, so an Eevee
 * in a Fire run is a Flareon in waiting, not an Eevee for good.
 * @param {?string} speciesId
 * @param {string} type The run's type; '' admits every form.
 * @return {boolean}
 */
export function hasMonotype(speciesId, type) {
  if (!type) return true;
  const species = dex().progressionSpecies[toId(speciesId)];
  if (!species) return false;
  return species.isMega
    ? hasType(species, type) &&
      hasType(dex().progressionSpecies[species.baseSpeciesId], type)
    : hasType(species, type);
}

/**
 * Whether a monotype run may field a form: it is of the type, or evolves
 * into a form that is.
 * @param {?string} speciesId
 * @param {string} type The run's type; '' admits every form.
 * @return {boolean}
 */
export function fieldsInMonotype(speciesId, type) {
  if (!type) return true;
  const species = dex().progressionSpecies[toId(speciesId)];
  if (!species) return false;
  return species.isMega
    ? hasMonotype(species.id, type)
    : reachesType(species, type, new Set());
}

function hasType(species, type) {
  return Boolean(species?.types?.includes(type));
}

// Whether the form or any evolution of it has the type. Cycle-safe against
// malformed evolution data.
function reachesType(species, type, seen) {
  if (!species || species.isMega || seen.has(species.id)) return false;
  seen.add(species.id);
  if (hasType(species, type)) return true;
  return (species.evos || []).some((evoId) =>
    reachesType(dex().progressionSpecies[evoId], type, seen));
}
