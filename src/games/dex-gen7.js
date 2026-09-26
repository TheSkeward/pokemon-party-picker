/**
 * @fileoverview The Gen 7 dex bundle: the generated mainline data modules a
 * game built on the Gen 7 dex reads through its descriptor. Reborn uses this
 * bundle unchanged; a game on another generation supplies its own with the
 * same shape, so the engine never imports a generation-specific module.
 */
import {
  GEN7_ABILITY_SLOTS,
  GEN7_BASE_HP,
  GEN7_BASE_STATS,
  GEN7_BASE_STAT_TOTALS,
  GEN7_WEIGHTS_KG,
} from '../generated/gen7BaseStats.generated.js';
import {
  GEN7_HELD_ITEMS,
  GEN7_HELD_ITEMS_BY_ID,
} from '../generated/gen7HeldItems.generated.js';
import { GEN7_ITEM_DAMAGE } from '../generated/gen7ItemDamage.generated.js';
import { LINE_REPRESENTATIVE_CANDIDATES } from '../generated/gen7LineRepresentativeCandidates.generated.js';
import { MOVE_META } from '../generated/gen7MoveMeta.generated.js';
import { GEN7_PROGRESSION_SPECIES } from '../generated/gen7ProgressionSpecies.generated.js';
import {
  GEN7_TYPES,
  GEN7_TYPE_DAMAGE_TAKEN,
} from '../generated/gen7TypeChart.generated.js';
import { GEN7_UNBURDEN_SPECIES } from '../generated/gen7UnburdenSpecies.generated.js';

/** @const {!Object} */
export const GEN7_DEX = Object.freeze({
  gen: 7,
  abilitySlots: GEN7_ABILITY_SLOTS,
  baseHp: GEN7_BASE_HP,
  baseStats: GEN7_BASE_STATS,
  baseStatTotals: GEN7_BASE_STAT_TOTALS,
  weightsKg: GEN7_WEIGHTS_KG,
  heldItems: GEN7_HELD_ITEMS,
  heldItemsById: GEN7_HELD_ITEMS_BY_ID,
  itemDamage: GEN7_ITEM_DAMAGE,
  lineRepresentativeCandidates: LINE_REPRESENTATIVE_CANDIDATES,
  moveMeta: MOVE_META,
  progressionSpecies: GEN7_PROGRESSION_SPECIES,
  unburdenSpecies: GEN7_UNBURDEN_SPECIES,
  types: GEN7_TYPES,
  typeDamageTaken: GEN7_TYPE_DAMAGE_TAKEN,
});
