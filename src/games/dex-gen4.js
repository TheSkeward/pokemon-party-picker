/**
 * @fileoverview The Gen 4 dex bundle, the same shape as dex-gen7.js, built
 * from the generated Gen 4 modules (scripts/build-dex-modules.mjs 4).
 */
import {
  GEN4_BASE_HP,
  GEN4_BASE_STATS,
  GEN4_BASE_STAT_TOTALS,
  GEN4_WEIGHTS_KG,
} from '../generated/gen4BaseStats.generated.js';
import {
  GEN4_HELD_ITEMS,
  GEN4_HELD_ITEMS_BY_ID,
} from '../generated/gen4HeldItems.generated.js';
import { GEN4_ITEM_DAMAGE } from '../generated/gen4ItemDamage.generated.js';
import { LINE_REPRESENTATIVE_CANDIDATES } from '../generated/gen4LineRepresentativeCandidates.generated.js';
import { MOVE_META } from '../generated/gen4MoveMeta.generated.js';
import { GEN4_PROGRESSION_SPECIES } from '../generated/gen4ProgressionSpecies.generated.js';
import {
  GEN4_TYPES,
  GEN4_TYPE_DAMAGE_TAKEN,
} from '../generated/gen4TypeChart.generated.js';
import { GEN4_UNBURDEN_SPECIES } from '../generated/gen4UnburdenSpecies.generated.js';

/** @const {!Object} */
export const GEN4_DEX = Object.freeze({
  gen: 4,
  baseHp: GEN4_BASE_HP,
  baseStats: GEN4_BASE_STATS,
  baseStatTotals: GEN4_BASE_STAT_TOTALS,
  weightsKg: GEN4_WEIGHTS_KG,
  heldItems: GEN4_HELD_ITEMS,
  heldItemsById: GEN4_HELD_ITEMS_BY_ID,
  itemDamage: GEN4_ITEM_DAMAGE,
  lineRepresentativeCandidates: LINE_REPRESENTATIVE_CANDIDATES,
  moveMeta: MOVE_META,
  progressionSpecies: GEN4_PROGRESSION_SPECIES,
  unburdenSpecies: GEN4_UNBURDEN_SPECIES,
  types: GEN4_TYPES,
  typeDamageTaken: GEN4_TYPE_DAMAGE_TAKEN,
});
