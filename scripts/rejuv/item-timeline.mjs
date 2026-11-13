/**
 * @fileoverview What Pokémon Rejuvenation supplies to the item-timeline
 * builder (essentials/item-timeline.mjs): its extracts, and the badge each
 * thing the files do not date opens at, with its evidence. The game has no
 * guide's listing, so every source comes from the files.
 *
 * The extracts under scripts/rejuv are built by
 * extract-rejuv-item-sources.mjs from an install.
 * rejuv-encounter-badges.json dates each encounter table, and each map
 * that holds a shop or a copy, from the walkthrough's area order.
 */

import { readFileSync } from 'node:fs';

import { GEN9_HELD_ITEMS_BY_ID } from '../../src/generated/gen9HeldItems.generated.js';
import { REJUV_PROGRESSION_CHECKPOINTS } from '../../src/rejuv/badge-timeline.js';
import { REJUV_EXTRA_INVENTORY_ITEMS } from '../../src/rejuv/items.js';
import { mapReachBadges } from '../essentials/event-sources.mjs';
import {
  REJUV_EVENT_DATING,
  REJUV_MAP_SWITCH_BADGES,
} from './event-dating.mjs';

// The Mining Kit is a battle reward of the Blacksteeple stay (maps 435 and
// 436), which the player is taken to with four badges.
const MINING_KIT_BADGE = 4;

// A Pickup holder is catchable from the start: Meowth, in the grass of the
// Chrisola Hotel Rooftop in East Gearen (rejuv-map-encounters, map 228).
const PICKUP_HOLDER_BADGE = 0;

// The first berry plots are in the Mirage Woods (map 149), reached with
// three badges.
const BERRY_PLOT_BADGE = 3;

// Coins are sold for money at the Chrisola Hotel's counter (the CoinShop
// mart, map 230), so they can be had again and again once it is reached.
const COIN_SHOP_MAP = 230;

const readJson = (file) =>
  JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));

/**
 * @return {{game: !ItemTimelineGame, exportName: string, outFile: !URL,
 *     header: !Array<string>}} Rejuvenation's input to the builder, and
 *     where and under what words its sources are written.
 */
export function rejuvItemTimeline() {
  const itemEvents = readJson('./rejuv-item-events.generated.json').data;
  const encounterBadges = readJson('./rejuv-encounter-badges.json').maps;
  const coins = mapReachBadges(
    itemEvents.maps, encounterBadges, REJUV_MAP_SWITCH_BADGES)(COIN_SHOP_MAP);
  return {
    game: {
      knownIds: new Set([
        ...Object.keys(GEN9_HELD_ITEMS_BY_ID),
        ...REJUV_EXTRA_INVENTORY_ITEMS.map((item) => item.id),
      ]),
      extracts: {
        itemEvents,
        wildItems: readJson('./rejuv-wild-items.generated.json').data,
        encounters: readJson('./rejuv-map-encounters.generated.json').data,
        pickup: readJson('./rejuv-pickup.generated.json').data,
      },
      encounterBadges,
      checkpoints: REJUV_PROGRESSION_CHECKPOINTS,
      dating: REJUV_EVENT_DATING,
      mapSwitchBadges: REJUV_MAP_SWITCH_BADGES,
      miningKitBadge: MINING_KIT_BADGE,
      pickupHolderBadge: PICKUP_HOLDER_BADGE,
      berryPlotBadge: BERRY_PLOT_BADGE,
      // The game's prize counters are marts that take a currency.
      pointCounters: [],
      // Achievement Points, Battle Points, Puppet Coins and Red Essence
      // are left out: nothing in the files shows one earned without limit.
      // So is a row paid in an item.
      currencies: { Money: 0, ...(coins == null ? {} : { Coins: coins }) },
      // Some maps the game calls REMOVED are still entered; the dated-map
      // records say which are not.
      unusedMapName: null,
      listing: null,
    },
    exportName: 'REJUV_ITEM_SOURCES',
    outFile: new URL(
      '../../src/generated/rejuvItemTimeline.generated.js', import.meta.url),
    header: [
      'Every held item\'s sources in Pokemon Rejuvenation, each with its kind',
      'and the badge count it opens at (src/games/item-sources.js), from the',
      'game-file extracts under scripts/rejuv: what the marts sell for money',
      'or coins, the copies placed on the maps or handed over, wild holders,',
      'Pickup, mining and planted berries. A source opens at the latest of its',
      'map being reached (rejuv-encounter-badges.json) and what gates it',
      '(rejuv/event-dating.mjs); one that neither dates is left out. A mined',
      'item counts the copies the rocks reached by each badge yield on',
      `average, from the Mining Kit (badge ${MINING_KIT_BADGE}) on.`,
    ],
  };
}
