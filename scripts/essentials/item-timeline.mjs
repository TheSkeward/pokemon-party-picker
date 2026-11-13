/**
 * @fileoverview Builds a game's held-item sources: for every item, each way
 * the game hands it out, with its kind and the badge count it opens at
 * (src/games/item-sources.js). The game supplies its extracts and what
 * dates them (ItemTimelineGame); the steps and their order are the same
 * for every game.
 *
 * What the files say a source yields comes from the game-file extracts.
 * When it opens comes from the badge each encounter table can first be met
 * at, which also says when a map is reached, and from the game's rules for
 * dating an event's conditions. A game with a guide's listing takes each
 * item's first copy and its shop stock from the listing, checked against
 * the files. A game without one takes both from the files: what its marts
 * sell, and the copies placed on its maps or handed over, each as far as
 * its map and conditions can be dated.
 *
 * A mined item counts the copies the rocks reached by each badge yield on
 * average: a rock is dug once, so mining does not restock, except where
 * the rocks return when their map reloads.
 */

import { isConsumableItem } from '../../src/games/item-use.js';
import { FULL_SUPPLY } from '../../src/games/item-sources.js';
import {
  conditionBadge,
  datedSales,
  expectedCopySteps,
  GIVEN_COPY_KINDS,
  mapReachBadges,
  mapsVisitedOnce,
  martSales,
  martStock,
  miningDigs,
  missedShopStock,
  PLACED_COPY_KINDS,
  placedCopies,
} from './event-sources.mjs';
import { itemId } from './item-id.mjs';
import {
  pickupSources,
  plantedBerries,
  pointCounterStock,
  wildHeldSources,
} from './renewable-sources.mjs';
import { setterDating } from './setter-dating.mjs';

/**
 * A guide's listing of a game's items, as extracted from it. `items` maps
 * an item's name to its earliest row, a single copy unless the row's
 * `source` is `shopLabel` or `miningLabel`; `shopItems` maps a name to the
 * badge a shop sells it from. `placedKinds` maps the listing's label for a
 * copy placed on a map to what the game-file extract calls that kind, which
 * is also how the copy is worded. `verifiedShopStock` is shop stock checked
 * in the game, item id -> badge, as a cross-check on `shopItems`.
 * @typedef {{
 *   items: !Object<string, {badges: number, source: string}>,
 *   shopItems: !Object<string, {badge: number, until: (number|undefined)}>,
 *   shopLabel: string,
 *   miningLabel: string,
 *   placedKinds: !Object<string, string>,
 *   verifiedShopStock: !Object<string, number>,
 * }}
 */
let ItemListing;

/**
 * What a game supplies. `knownIds` is its held-item catalog. `extracts`
 * are its game-file extracts; `encounterBadges` the badge each encounter
 * table can first be met at; `checkpoints` its progression, in play order.
 * `dating` dates an event's conditions and `mapSwitchBadges` a map that
 * exists only under a switch. `gateSetters` is the gate-setters extract of
 * a game that has one: a switch or variable `dating` does not date is then
 * dated from the events that set it (setter-dating.mjs). The three badges
 * say when the Mining Kit is had, when a Pokémon with Pickup can first be
 * caught and when the first berry plots open; `pointCounters` are the maps
 * whose counters trade points without limit, each with the badge it is
 * reached at. `currencies`
 * gives, for each currency a mart takes, the badge count from which it can
 * be earned again and again; a currency left out is one that cannot, or
 * that nothing dates, and what it buys is left out. `unusedMapName` is the
 * name a game leaves on the maps it no longer uses, whose copies are left
 * out; null for a game whose dated-map records say which maps are never
 * entered. `listing` is null for a game without one.
 * @typedef {{
 *   knownIds: !Set<string>,
 *   extracts: {itemEvents: !Object, wildItems: !Object,
 *       encounters: !Object, pickup: !Object},
 *   encounterBadges: !Object<string, !Object>,
 *   checkpoints: !Array<{badges: number, levelCap: number}>,
 *   dating: !EventDating,
 *   gateSetters: ?GateSetters,
 *   mapSwitchBadges: !Object<string, number>,
 *   miningKitBadge: number,
 *   pickupHolderBadge: number,
 *   berryPlotBadge: number,
 *   pointCounters: !Array<{mapId: number, badge: number}>,
 *   currencies: !Object<string, number>,
 *   unusedMapName: ?string,
 *   listing: ?ItemListing,
 * }}
 */
let ItemTimelineGame;

// The badge a shop sells each item from, by the listing: its shop table,
// for the items some mart in the game files sells (a listing files a
// one-time offer under its shops now and then), with the stock verified in
// the game laid over it. A stock window that closes would need a closing
// badge, which a source has none of, so one is reported loudly.
function listedShopBadges(listing, sold, knownIds, warn) {
  const shopBadges = new Map();
  for (const [name, entry] of Object.entries(listing.shopItems)) {
    const id = itemId(name);
    if (!knownIds.has(id)) continue;
    if (!sold.has(id)) {
      warn(`listed shop row for ${name} left out: no mart in the game files sells it`);
      continue;
    }
    if (entry.until != null) {
      warn(`WARNING: shop window for ${name} closes at badge ${entry.until}; expiry is unmodeled — item will read as purchasable forever`);
    }
    const current = shopBadges.get(id);
    if (current == null || entry.badge < current) {
      shopBadges.set(id, entry.badge);
    }
  }
  for (const [id, badge] of Object.entries(listing.verifiedShopStock)) {
    if (!knownIds.has(id)) continue;
    const current = shopBadges.get(id);
    if (current == null) {
      warn(`verified shop stock ${id} missing from the listing's shop table`);
    } else if (current !== badge) {
      warn(`verified shop stock ${id} badge ${badge} disagrees with the listing's ${current}`);
    }
    if (current == null || badge < current) shopBadges.set(id, badge);
  }
  return shopBadges;
}

/**
 * @param {!ItemTimelineGame} game
 * @param {function(string)=} warn Told of each thing left out or in doubt.
 * @return {{sources: !Map<string, !Array<!Object>>, missedShopItems: number,
 *     undatedSales: number, undatedCopies: number, undatedRocks: number}}
 *     Each known item's sources, unordered, and what could not be dated.
 */
export function buildItemSources(game, warn = () => {}) {
  const { knownIds, listing } = game;
  const { itemEvents, wildItems, encounters, pickup } = game.extracts;
  const reachBadge = mapReachBadges(
    itemEvents.maps, game.encounterBadges, game.mapSwitchBadges);
  const dating = game.gateSetters
    ? setterDating(game.gateSetters, reachBadge, game.dating) : game.dating;

  const sources = new Map();
  const add = (id, source) => {
    if (!knownIds.has(id)) return;
    sources.set(id, [...(sources.get(id) || []), source]);
  };

  const shopBadges = listing
    ? listedShopBadges(listing, martStock(itemEvents), knownIds, warn)
    : new Map();
  if (listing) {
    // A shop row the shop stock does not carry is a one-time purchase.
    for (const [name, entry] of Object.entries(listing.items)) {
      const id = itemId(name);
      if (entry.source === listing.miningLabel) continue;
      if (
        entry.source === listing.shopLabel &&
        shopBadges.get(id) <= entry.badges
      ) {
        continue;
      }
      add(id, {
        kind: 'single',
        badge: entry.badges,
        count: 1,
        via: listing.placedKinds[entry.source] || entry.source.toLowerCase(),
      });
    }
  }
  for (const [id, badge] of shopBadges) {
    add(id, { kind: 'shop', badge, via: '' });
  }
  // Stock in the game's marts that the listing's shop table lacks.
  const missedStock = missedShopStock(
    itemEvents, (id) => shopBadges.get(id) ?? null, reachBadge);
  for (const [id, { badge, via }] of missedStock) {
    add(id, { kind: 'shop', badge, via });
  }
  // Without a listing the marts' stock is dated from the files: what
  // restocks, and the rows a mart sells a fixed number of times.
  let undatedSales = 0;
  if (!listing) {
    const sales = datedSales(
      martSales(itemEvents).filter((sale) => knownIds.has(sale.id)),
      reachBadge, dating,
      (currency) => game.currencies[currency] ?? null);
    for (const [id, { badge, via }] of sales.stock) {
      add(id, { kind: 'shop', badge, via });
    }
    for (const [id, { badge, via }] of sales.once) {
      add(id, { kind: 'single', badge, count: 1, via: `sold once, ${via}` });
    }
    undatedSales = sales.undated;
  }

  // Mined copies: a dig buries a few items drawn by weight, so an item
  // averages its share of the weights per item buried. The rocks that
  // return restock everything in the table.
  const miningRules = itemEvents.scriptRules.mining;
  const itemsPerDig =
    (miningRules.itemsPerGame.min + miningRules.itemsPerGame.max) / 2;
  const miningWeight =
    miningRules.items.reduce((sum, entry) => sum + entry.weight, 0);
  const rocks = miningDigs(
    itemEvents, reachBadge, game.miningKitBadge,
    mapsVisitedOnce(itemEvents.maps, game.encounterBadges));
  for (const { item, weight } of miningRules.items) {
    const id = itemId(itemEvents.itemNames[item] || item);
    const perDig = (itemsPerDig * weight) / miningWeight;
    for (const step of expectedCopySteps(perDig, rocks.digs, FULL_SUPPLY)) {
      add(id, {
        kind: 'mining',
        badge: step.badge,
        count: step.count,
        via: 'mining rocks, on average',
      });
    }
    for (const { badge, mapName } of rocks.comesBack) {
      add(id, {
        kind: 'regrow',
        badge,
        via: `mining rocks that come back, ${mapName}`,
      });
    }
  }

  // Further copies of an item a battle does not use up: the item balls and
  // hidden items the game files place, each from the later of its map being
  // reached and its event's own gate. A copy on a map or behind a gate that
  // nothing dates is left out. So is one on a map reached before the
  // listing's first copy of the item: a listing gives every location, so
  // that copy is behind something the files do not show. And so is the
  // listing's own first copy, when it is of the same kind. Without a
  // listing the copies handed over count too.
  const listedItems = listing?.items || {};
  const copyKinds = listing
    ? PLACED_COPY_KINDS : { ...PLACED_COPY_KINDS, ...GIVEN_COPY_KINDS };
  let undatedCopies = 0;
  for (const [id, copies] of placedCopies(itemEvents, copyKinds)) {
    if (!knownIds.has(id) || isConsumableItem(id)) continue;
    const first = listedItems[
      Object.keys(listedItems).find((name) => itemId(name) === id)];
    const dated = [];
    for (const copy of copies) {
      if (copy.mapName === game.unusedMapName) continue;
      const reached = reachBadge(copy.mapId);
      const gate = conditionBadge(copy.conditions, dating);
      if (reached == null || gate == null || reached < (first?.badges ?? 0)) {
        undatedCopies++;
        continue;
      }
      dated.push({
        kind: copy.kind,
        badge: Math.max(reached, gate),
        via: `${copy.kind}, ${copy.mapName}`,
      });
    }
    dated.sort((a, b) => a.badge - b.badge);
    const listedCopy = dated.findIndex((copy) =>
      copy.kind === listing?.placedKinds[first?.source]);
    for (const [index, { badge, via }] of dated.entries()) {
      if (index !== listedCopy) {
        add(id, { kind: 'single', badge, count: 1, via });
      }
    }
  }

  // A table counts from the badge it can first be met; one on a map the
  // player visits once is no place to restock.
  const tableBadge = (map, type) => {
    const dated = game.encounterBadges[map.mapId];
    return dated && !dated.oneTime ? dated.types[type] ?? null : null;
  };
  for (const [id, { badge, via }] of
    wildHeldSources(wildItems, encounters, tableBadge)) {
    add(id, { kind: 'wild', badge, via });
  }
  for (const [id, { badge, via }] of
    pickupSources(pickup, game.checkpoints, game.pickupHolderBadge)) {
    add(id, { kind: 'pickup', badge, via });
  }
  // A counter is a shop that takes points.
  for (const { mapId, badge } of game.pointCounters) {
    for (const [id, via] of pointCounterStock(itemEvents, mapId)) {
      add(id, { kind: 'shop', badge, via });
    }
  }
  // Last, since a berry is planted from one the sources above supply.
  const firstBadgeOf = (id) => {
    const list = sources.get(id);
    return list ? Math.min(...list.map((source) => source.badge)) : null;
  };
  for (const [id, badge] of
    plantedBerries(itemEvents, firstBadgeOf, game.berryPlotBadge)) {
    add(id, { kind: 'regrow', badge, via: 'planted in a berry plot' });
  }

  return {
    sources,
    missedShopItems:
      [...missedStock.keys()].filter((id) => knownIds.has(id)).length,
    undatedSales,
    undatedCopies,
    undatedRocks: rocks.undated,
  };
}

/**
 * @param {string} exportName The generated module's export.
 * @param {!Array<string>} header The comment lines under the generated-file
 *     notice, without their slashes.
 * @param {!Map<string, !Array<!Object>>} sources Item id -> its sources.
 * @param {string} generator The script the notice names.
 * @return {string} The generated module: items by id, each item's sources
 *     by badge then kind.
 */
export function renderItemSources(exportName, header, sources, generator) {
  const byBadge = (a, b) => a.badge - b.badge || a.kind.localeCompare(b.kind);
  const lines = [...sources.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, list]) => {
      const entries = [...list].sort(byBadge).map((source) =>
        `    ${JSON.stringify(source)},`);
      return `  ${id}: [\n${entries.join('\n')}\n  ],`;
    });
  return [
    `// AUTO-GENERATED by ${generator} — do not edit by hand.`,
    ...header.map((line) => `// ${line}`),
    `export const ${exportName} = {`,
    ...lines,
    '};',
    '',
  ].join('\n');
}
