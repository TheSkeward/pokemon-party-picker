/**
 * The Pokémon Reborn game descriptor. A descriptor names everything about a
 * game the ENGINE must not hardcode: where its extracted data lives, which
 * localStorage keys hold its per-playthrough state, and which dex generation
 * its species/move data is built from.
 *
 * Reborn predates the registry, so its data paths and storage keys keep their
 * original un-namespaced literal values: renaming the paths would orphan every
 * deployed data manifest, and renaming the keys would silently discard every
 * existing player's saved pool and progression. New games namespace both by
 * game id.
 */
import { GEN7_DEX } from './dex-gen7.js';
import {
  REBORN_ITEM_UNLOCK_BADGES,
  REBORN_MINING_ITEM_BADGES,
  REBORN_SHOP_ITEM_BADGES,
} from '../generated/rebornItemTimeline.generated.js';
import { REBORN_PROGRESSION_CHECKPOINTS } from '../reborn/badge-timeline.js';
import {
  REBORN_TM_OPTIONS,
  REBORN_TMX_OPTIONS,
  REBORN_TUTOR_GROUPS,
  REBORN_TUTOR_OPTIONS,
} from '../reborn/progression-options.js';
import { REBORN_EVOLUTION_ITEM_AVAILABILITY } from '../reborn/item-availability.js';
import { EVOLUTION_ACCESS_FIELDS } from '../reborn/evolution-access.js';
import { REBORN_EXTRA_INVENTORY_ITEMS } from '../reborn/extra-inventory-items.js';
import {
  GEN7_TERRAIN_SEEDS,
  HIDDEN_INVENTORY_ITEM_IDS,
  REBORN_SEEDS,
  REBORN_SEED_STAT_VECTORS,
  TERRAIN_SEED_MIGRATION,
} from '../reborn/reborn-seeds.js';
import { TYPE_GEMS } from '../reborn/type-gems.js';
import {
  REBORN_MOVE_LEGALITY_BASE,
  REBORN_PROGRESSION_NOTES,
  REBORN_PROMOTED_TM_MOVES,
  REBORN_TMX_MOVES,
} from '../reborn/rules.js';

export const REBORN_GAME = Object.freeze({
  id: 'reborn',
  label: 'Pokémon Reborn',
  // For prose ("not learnable in Reborn"); the label is for headings.
  shortLabel: 'Reborn',
  // The generated mainline data the engine reads through dex() (games/dex.js).
  dexGen: 7,
  dex: GEN7_DEX,
  // The progression timeline (games/schedule.js reads it): checkpoints in
  // play order plus the generated first-obtainable badge per held item.
  schedule: Object.freeze({
    checkpoints: REBORN_PROGRESSION_CHECKPOINTS,
    itemUnlockBadges: REBORN_ITEM_UNLOCK_BADGES,
  }),
  // Machine and tutor tables with pickup timing (games/legality.js).
  moveSources: Object.freeze({
    tmOptions: REBORN_TM_OPTIONS,
    tmxOptions: REBORN_TMX_OPTIONS,
    tutorGroups: REBORN_TUTOR_GROUPS,
    tutorOptions: REBORN_TUTOR_OPTIONS,
  }),
  // Item content (games/items.js): renewable sources by first badge, the
  // game-only inventory items, the held items the game replaces (hidden from
  // the picker; saved counts migrate), curated evolution-item availability,
  // and the proxies that price game-original items (SCORING.md, "Borrowed
  // priors"): field seeds from Gen 7 terrain-seed usage, gems from Z-Crystals.
  items: Object.freeze({
    shopItemBadges: REBORN_SHOP_ITEM_BADGES,
    miningItemBadges: REBORN_MINING_ITEM_BADGES,
    extraInventoryItems: REBORN_EXTRA_INVENTORY_ITEMS,
    hiddenInventoryItemIds: HIDDEN_INVENTORY_ITEM_IDS,
    inventoryMigration: TERRAIN_SEED_MIGRATION,
    evolutionItemAvailability: REBORN_EVOLUTION_ITEM_AVAILABILITY,
    fieldSeeds: Object.freeze({
      names: REBORN_SEEDS,
      proxyItems: GEN7_TERRAIN_SEEDS,
      statVectors: REBORN_SEED_STAT_VECTORS,
    }),
    typeGems: TYPE_GEMS,
  }),
  // Evolution rules (games/evolution.js). Reborn replaces trades with the
  // Link Stone, stands in for Alola with the Apophyll area (Cubone excepted:
  // it picks Marowak's form by time of day), and has every location
  // evolution, opening over the midgame.
  evolution: Object.freeze({
    tradeItem: 'Link Stone',
    tradeAccessKey: 'evoAccessLinkStone',
    regionAccess: Object.freeze({
      Alola: Object.freeze({
        accessKey: 'evoAccessApophyll',
        label: 'in Apophyll',
        except: ['marowakalola'],
      }),
    }),
    unavailableAccessKeys: new Set(),
    formNotes: Object.freeze({ marowak: 'during the day' }),
    accessFields: EVOLUTION_ACCESS_FIELDS,
  }),
  rules: Object.freeze({
    legalityBase: REBORN_MOVE_LEGALITY_BASE,
    tmxMoves: REBORN_TMX_MOVES,
    promotedTmMoves: REBORN_PROMOTED_TM_MOVES,
    notes: REBORN_PROGRESSION_NOTES,
  }),
  data: Object.freeze({
    legalMovesDir: 'reborn-legal-moves',
    itemAvailability: 'reborn-item-availability.extracted.json',
  }),
  storage: Object.freeze({
    progression: 'pokemon-usage-viewer:reborn-progression:v1',
    pool: 'pokemon-usage-viewer:owned-pool:v1',
  }),
});
