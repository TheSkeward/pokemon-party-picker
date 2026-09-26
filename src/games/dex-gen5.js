/**
 * @fileoverview The Gen 5 dex bundle, the same shape as dex-gen7.js, built
 * from the generated Gen 5 modules (scripts/build-dex-modules.mjs 4).
 */
import {
  GEN5_ABILITY_SLOTS,
  GEN5_BASE_HP,
  GEN5_BASE_STATS,
  GEN5_BASE_STAT_TOTALS,
  GEN5_WEIGHTS_KG,
} from '../generated/gen5BaseStats.generated.js';
import {
  GEN5_HELD_ITEMS,
  GEN5_HELD_ITEMS_BY_ID,
} from '../generated/gen5HeldItems.generated.js';
import { GEN5_ITEM_DAMAGE } from '../generated/gen5ItemDamage.generated.js';
import { LINE_REPRESENTATIVE_CANDIDATES } from '../generated/gen5LineRepresentativeCandidates.generated.js';
import { MOVE_META } from '../generated/gen5MoveMeta.generated.js';
import { GEN5_PROGRESSION_SPECIES } from '../generated/gen5ProgressionSpecies.generated.js';
import {
  GEN5_TYPES,
  GEN5_TYPE_DAMAGE_TAKEN,
} from '../generated/gen5TypeChart.generated.js';
import { GEN5_UNBURDEN_SPECIES } from '../generated/gen5UnburdenSpecies.generated.js';

/** @const {!Object} */
export const GEN5_DEX = Object.freeze({
  gen: 5,
  abilitySlots: GEN5_ABILITY_SLOTS,
  baseHp: GEN5_BASE_HP,
  baseStats: GEN5_BASE_STATS,
  baseStatTotals: GEN5_BASE_STAT_TOTALS,
  weightsKg: GEN5_WEIGHTS_KG,
  heldItems: GEN5_HELD_ITEMS,
  heldItemsById: GEN5_HELD_ITEMS_BY_ID,
  itemDamage: GEN5_ITEM_DAMAGE,
  lineRepresentativeCandidates: LINE_REPRESENTATIVE_CANDIDATES,
  moveMeta: MOVE_META,
  progressionSpecies: GEN5_PROGRESSION_SPECIES,
  unburdenSpecies: GEN5_UNBURDEN_SPECIES,
  types: GEN5_TYPES,
  typeDamageTaken: GEN5_TYPE_DAMAGE_TAKEN,
});
