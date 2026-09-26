import { dex } from '../games/dex.js';
import { toId } from '../utils/ids.js';

function slotsFor(pokemonId) {
  return dex().abilitySlots?.[toId(pokemonId)] || {};
}

function abilityAt(slots, slot) {
  // Single-ability intermediate forms still preserve the evolutionary slot.
  // For example, either normal slot becomes Shed Skin on a cocoon.
  return slots[slot] || slots[0] || Object.values(slots)[0] || null;
}

function slotOf(slots, ability) {
  if (!ability) return null;
  return Object.keys(slots).find(
    (slot) => toId(slots[slot]) === toId(ability),
  ) ?? null;
}

/**
 * Keep the canonical target's ability slot, but use the ability that slot
 * supplies on the current form. Usage order is NOT ability-slot order.
 * An explicit annotation describes the input species, before any evolution.
 * Megas retain their existing split: a base ability before Mega Evolution,
 * and the fixed Mega ability in battle.
 */
export function resolveBuildAbilities({
  inputId,
  currentId,
  representativeId,
  topSet,
  baseTopSet = topSet,
  abilityOverride = null,
  megaReady = false,
}) {
  const representative = dex().progressionSpecies[toId(representativeId)];
  const isMega = Boolean(representative?.isMega);
  const sourceId = isMega ? representative.baseSpeciesId : representativeId;
  const source = isMega ? baseTopSet : topSet;
  const sourceSlots = slotsFor(sourceId);
  const currentSlots = slotsFor(currentId);
  const inputSlots = slotsFor(inputId || currentId);
  let slot = slotOf(sourceSlots, source?.ability) || '0';

  const overrideSlot = slotOf(inputSlots, abilityOverride);
  const abilityKnown = overrideSlot != null;
  if (
    abilityKnown && toId(abilityAt(inputSlots, slot)) !== toId(abilityOverride)
  ) {
    slot = overrideSlot;
  }
  const currentAbility = abilityAt(currentSlots, slot);
  const targetAbility = isMega
    ? abilityAt(slotsFor(representativeId), '0')
    : abilityAt(sourceSlots, slot);
  const assumedAbility = megaReady ? targetAbility : currentAbility;

  const abilityOptions = [];
  const seen = new Set();
  for (const entry of source?.abilities || []) {
    const optionSlot = slotOf(sourceSlots, entry.name);
    if (optionSlot == null) continue;
    const name = abilityAt(currentSlots, optionSlot);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    abilityOptions.push({ name, usage: entry.usage });
  }
  if (currentAbility && !seen.has(currentAbility)) {
    abilityOptions.unshift({ name: currentAbility, usage: 0 });
  }
  const secondaryAbility = abilityKnown ? null : abilityOptions.find(
    (entry) => entry.name !== currentAbility,
  )?.name || null;

  return {
    assumedAbility,
    targetAbility,
    inputAbility: abilityAt(inputSlots, slot),
    preMegaAbility: megaReady ? currentAbility : null,
    abilityKnown,
    abilityOptions,
    secondaryAbility,
  };
}

/** Display-only ability path; calculation fields always stay single-valued. */
export function formatAbilityPath(ability, targetAbility) {
  if (!ability) return '';
  return targetAbility && toId(targetAbility) !== toId(ability)
    ? `${ability} / ${targetAbility}`
    : ability;
}
