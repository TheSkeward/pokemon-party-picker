import { dex } from '../games/dex.js';
import { mechanics } from '../games/legality.js';
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

// The set's best-used ability that is not the hidden one, by slot.
function normalSlotByUsage(source, slots) {
  for (const entry of source?.abilities || []) {
    const slot = slotOf(slots, entry.name);
    if (slot != null && slot !== 'H') return slot;
  }
  return null;
}

/**
 * Keep the canonical target's ability slot, but use the ability that slot
 * supplies on the current form. Usage order is NOT ability-slot order.
 * An explicit annotation describes the input species, before any evolution.
 * A game that hands out no hidden abilities (`mechanics.hiddenAbilities`
 * false) never assumes one: the set's best normal ability stands in, and
 * only a pin can name the hidden slot. Megas keep their split: a base
 * ability before Mega Evolution, and the fixed Mega ability in battle.
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
  const hiddenObtainable = mechanics().hiddenAbilities !== false;
  // With no usage at all, or an ability outside the slot table, the first
  // slot stands in (SCORING.md, abilities).
  let slot = slotOf(sourceSlots, source?.ability) || '0';
  if (!hiddenObtainable && slot === 'H') {
    slot = normalSlotByUsage(source, sourceSlots) || '0';
  }

  // A pin names the caught form's ability. Older pins, and the app's own
  // earlier advice, named the target's instead; the slot is unambiguous
  // either way, so the target's and the current form's slots are read too
  // rather than dropping the pin (which could flip it to the other ability).
  const inputOverrideSlot = slotOf(inputSlots, abilityOverride);
  const overrideSlot =
    inputOverrideSlot ??
    slotOf(sourceSlots, abilityOverride) ??
    slotOf(currentSlots, abilityOverride);
  const abilityKnown = overrideSlot != null;
  if (inputOverrideSlot == null && abilityKnown) {
    slot = overrideSlot;
  } else if (
    abilityKnown && toId(abilityAt(inputSlots, slot)) !== toId(abilityOverride)
  ) {
    slot = overrideSlot;
  }
  // A pin decides the target only when every slot the caught form could be
  // in evolves to the same ability: Shed Skin on a Metapod says nothing
  // about Compound Eyes versus Tinted Lens.
  const slotKeys = new Set([
    ...Object.keys(inputSlots),
    ...Object.keys(sourceSlots),
    ...Object.keys(currentSlots),
  ]);
  const targetKnown = !abilityKnown
    ? false
    : inputOverrideSlot == null ||
      new Set(
        [...slotKeys]
          .filter(
            (key) => toId(abilityAt(inputSlots, key)) === toId(abilityOverride),
          )
          .map((key) => toId(abilityAt(sourceSlots, key))),
      ).size <= 1;
  const currentAbility = abilityAt(currentSlots, slot);
  const targetAbility = isMega
    ? abilityAt(slotsFor(representativeId), '0')
    : abilityAt(sourceSlots, slot);
  const assumedAbility = megaReady ? targetAbility : currentAbility;

  const abilityOptions = [];
  const seen = new Set();
  const addOption = (name, usage) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    abilityOptions.push({ name, usage });
  };
  for (const entry of source?.abilities || []) {
    const optionSlot = slotOf(sourceSlots, entry.name);
    if (optionSlot == null) continue;
    // An unobtainable hidden ability is neither assumed nor probed for
    // sensitivity; a pin to it keeps it.
    if (optionSlot === 'H' && !hiddenObtainable && slot !== 'H') continue;
    addOption(abilityAt(currentSlots, optionSlot), entry.usage);
    // Every current slot that reaches this target ability is a way the
    // player may have caught it (Eevee's Run Away and Adaptability both
    // become Vaporeon's Water Absorb), so each is probed for sensitivity.
    for (const key of slotKeys) {
      if (key === 'H' && !hiddenObtainable) continue;
      if (toId(abilityAt(sourceSlots, key)) === toId(entry.name)) {
        addOption(abilityAt(currentSlots, key), entry.usage);
      }
    }
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
    targetKnown,
    abilityOptions,
    secondaryAbility,
  };
}

/**
 * The ability path as the set card and the export show it ("Simple / Solid
 * Rock": the caught form's ability, then the target's). Calculation fields
 * always stay single-valued.
 */
export function formatAbilityPath(ability, targetAbility) {
  if (!ability) return '';
  return targetAbility && toId(targetAbility) !== toId(ability)
    ? `${ability} / ${targetAbility}`
    : ability;
}
