/**
 * @fileoverview What Pokémon Reborn supplies to the item-timeline builder
 * (essentials/item-timeline.mjs): its extracts, the guide's listing, and
 * the badge each thing the files do not date opens at, with its evidence.
 *
 * The listing is site-data/data/reborn-item-availability.extracted.json,
 * extracted from the community "Pokemon Reborn Ep19 Items & Services Guide"
 * spreadsheet (All Items Locations + Shops + Arcade Lottery tabs), with the
 * sheet's fight order mapped to badge counts (Corey/Kiki/Saphira award no
 * badge; post-game tiers collapse to badge 18).
 *
 * The extracts under scripts/reborn are built by
 * extract-reborn-item-sources.mjs from an install. reborn-encounter-badges.json
 * dates each encounter table from the walkthrough's area order.
 */

import { readFileSync } from 'node:fs';

import { GEN7_HELD_ITEMS_BY_ID } from '../../src/generated/gen7HeldItems.generated.js';
import { REBORN_PROGRESSION_CHECKPOINTS } from '../../src/reborn/badge-timeline.js';
import { REBORN_EXTRA_INVENTORY_ITEMS } from '../../src/reborn/extra-inventory-items.js';
import {
  REBORN_EVENT_DATING,
  REBORN_MAP_SWITCH_BADGES,
} from './event-dating.mjs';

// The Mining Kit comes from the Grand Stairway hiker, right after Shelly.
const MINING_KIT_BADGE = 3;

// A Pickup holder is catchable from the start: Meowth, in the grass of the
// Opal Ward the game opens in (reborn-encounters, map 29).
const PICKUP_HOLDER_BADGE = 0;

// The first berry plots are the soil under the Aventurine Woods' berry
// trees (maps 282, 283, 289), which the guide dates by those trees' Custap,
// Sitrus and Lum Berries: badge 7. The other plots are in the restored
// city.
const BERRY_PLOT_BADGE = 7;

// The Nightclub's Battle Floor counter (map 827) trades its points without
// limit. The Nightclub is post-game: the guide dates its Beast Ball gift at
// badge 18.
const POINT_COUNTER = { mapId: 827, badge: 18 };

// item id -> badge: shop stock verified in the game, a cross-check on the
// sheet's shop table. Badge 1: the Obsidia Department Store berry floor.
const VERIFIED_SHOP_STOCK = {
  oranberry: 1,
  cheriberry: 1,
  pechaberry: 1,
  rawstberry: 1,
  chestoberry: 1,
  aspearberry: 1,
};

const readJson = (file) =>
  JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));

/**
 * @return {{game: !ItemTimelineGame, exportName: string, outFile: !URL,
 *     header: !Array<string>}} Reborn's input to the builder, and where and
 *     under what words its sources are written.
 */
export function rebornItemTimeline() {
  const sheet = readJson(
    '../../site-data/data/reborn-item-availability.extracted.json');
  return {
    game: {
      knownIds: new Set([
        ...Object.keys(GEN7_HELD_ITEMS_BY_ID),
        ...REBORN_EXTRA_INVENTORY_ITEMS.map((item) => item.id),
      ]),
      extracts: {
        itemEvents: readJson('./reborn-item-events.generated.json').data,
        wildItems: readJson('./reborn-wild-items.generated.json').data,
        encounters: readJson('./reborn-encounters.generated.json').data,
        pickup: readJson('./reborn-pickup.generated.json').data,
      },
      encounterBadges: readJson('./reborn-encounter-badges.json').maps,
      checkpoints: REBORN_PROGRESSION_CHECKPOINTS,
      dating: REBORN_EVENT_DATING,
      mapSwitchBadges: REBORN_MAP_SWITCH_BADGES,
      miningKitBadge: MINING_KIT_BADGE,
      pickupHolderBadge: PICKUP_HOLDER_BADGE,
      berryPlotBadge: BERRY_PLOT_BADGE,
      pointCounters: [POINT_COUNTER],
      // The listing's shop table dates the shops.
      currencies: {},
      unusedMapName: 'REMOVED',
      listing: {
        items: sheet.items,
        shopItems: sheet.shopItems,
        shopLabel: 'Shop',
        miningLabel: 'Mining Rock',
        placedKinds: { 'Poké Ball': 'item ball', Hidden: 'hidden item' },
        verifiedShopStock: VERIFIED_SHOP_STOCK,
      },
    },
    exportName: 'REBORN_ITEM_SOURCES',
    outFile: new URL(
      '../../src/generated/rebornItemTimeline.generated.js', import.meta.url),
    header: [
      'Every held item\'s sources in Pokemon Reborn, each with its kind and the',
      `badge count it opens at (src/games/item-sources.js). ${sheet.provenance}`,
      'A mined item counts the copies the rocks reached by each badge yield on',
      `average, from the Mining Kit (badge ${MINING_KIT_BADGE}) on. Wild holders, Pickup, the Battle`,
      'Floor point counter and planted berries come from the game-file extracts',
      'under scripts/reborn; a wild-held item restocks from the badge its',
      'holder\'s encounter table can first be met.',
    ],
  };
}
