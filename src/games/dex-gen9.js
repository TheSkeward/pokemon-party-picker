/**
 * @fileoverview The Gen 9 dex bundle, the same shape as dex-gen7.js, built
 * from the generated Gen 9 modules (scripts/build-dex-modules.mjs 9).
 */
import {
  GEN9_ABILITY_SLOTS,
  GEN9_BASE_HP,
  GEN9_BASE_STATS,
  GEN9_BASE_STAT_TOTALS,
  GEN9_WEIGHTS_KG,
} from '../generated/gen9BaseStats.generated.js';
import {
  GEN9_HELD_ITEMS,
  GEN9_HELD_ITEMS_BY_ID,
} from '../generated/gen9HeldItems.generated.js';
import { GEN9_ITEM_DAMAGE } from '../generated/gen9ItemDamage.generated.js';
import { LINE_REPRESENTATIVE_CANDIDATES } from '../generated/gen9LineRepresentativeCandidates.generated.js';
import { MOVE_META } from '../generated/gen9MoveMeta.generated.js';
import { GEN9_PROGRESSION_SPECIES } from '../generated/gen9ProgressionSpecies.generated.js';
import {
  GEN9_TYPES,
  GEN9_TYPE_DAMAGE_TAKEN,
} from '../generated/gen9TypeChart.generated.js';
import { GEN9_UNBURDEN_SPECIES } from '../generated/gen9UnburdenSpecies.generated.js';

/** @const {!Object} */
export const GEN9_DEX = Object.freeze({
  gen: 9,
  abilitySlots: GEN9_ABILITY_SLOTS,
  baseHp: GEN9_BASE_HP,
  baseStats: GEN9_BASE_STATS,
  baseStatTotals: GEN9_BASE_STAT_TOTALS,
  weightsKg: GEN9_WEIGHTS_KG,
  heldItems: GEN9_HELD_ITEMS,
  heldItemsById: GEN9_HELD_ITEMS_BY_ID,
  itemDamage: GEN9_ITEM_DAMAGE,
  lineRepresentativeCandidates: LINE_REPRESENTATIVE_CANDIDATES,
  moveMeta: MOVE_META,
  progressionSpecies: GEN9_PROGRESSION_SPECIES,
  unburdenSpecies: GEN9_UNBURDEN_SPECIES,
  types: GEN9_TYPES,
  typeDamageTaken: GEN9_TYPE_DAMAGE_TAKEN,
});
