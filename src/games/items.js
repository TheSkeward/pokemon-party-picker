/**
 * @fileoverview The active game's item content: each held item's sources
 * and the supply they add up to, game-only inventory items outside the
 * dex's held-item catalog, held-item ids the game replaces (hidden from the
 * picker, with the migration of saved counts), the curated evolution-item
 * availability, and the proxies the recommender prices game-original items
 * with. Reads the descriptor's `items`; see games/reborn.js for the field
 * shapes.
 */
import { getActiveGame } from './registry.js';
import { isConsumableItem } from './consumables.js';
import { dex } from './dex.js';
import {
  itemSupply,
  orderItemSources,
  RENEWABLE_SOURCE_KINDS,
} from './item-sources.js';
import { toId } from '../utils/ids.js';

// Per game, keyed by its source lists: each item's supply, and the first
// renewable source of every item that has one.
const SUPPLIES = new WeakMap();
const RENEWABLE_SOURCES = new WeakMap();

/** @return {!Object} The active game's item content. */
export function gameItems() {
  return getActiveGame().items;
}

/**
 * Every item id that participates in evolution requirements — owning one of
 * THESE changes optimization results (friction/access), unlike ordinary held
 * items, so progression-staleness checks must watch them.
 * @return {Array<string>}
 */
export function getEvolutionItemIds() {
  return Object.keys(gameItems().evolutionItemAvailability);
}

/**
 * @param {?string} itemName Item name or id (normalized internally).
 * @return {{status: string, source: string}} status is "farmable",
 *     "farmable-tedious", or "unknown"; source states the basis for belief.
 */
export function getItemAvailability(itemName) {
  const id = toId(itemName);
  if (!id) return { status: 'unknown', source: 'no item recorded' };
  return (
    gameItems().evolutionItemAvailability[id] || {
      status: 'unknown',
      source: `no availability data for ${itemName}`,
    }
  );
}

/**
 * @param {string} itemId Normalized item id.
 * @return {!Array<!Object>} Every source the active game's data lists for
 *     the item, in games/item-sources.js order.
 */
export function getItemSources(itemId) {
  return orderItemSources(gameItems().sources[itemId] || []);
}

/**
 * @param {string} itemId Normalized item id.
 * @return {!Array<!Object>} The active game's supply of the item
 *     (itemSupply in games/item-sources.js); empty when its data has no
 *     source that counts, which leaves the timing unknown rather than the
 *     item unobtainable.
 */
export function getItemSupply(itemId) {
  const { sources } = gameItems();
  let supplies = SUPPLIES.get(sources);
  if (!supplies) {
    supplies = new Map();
    SUPPLIES.set(sources, supplies);
  }
  if (!supplies.has(itemId)) {
    supplies.set(
      itemId,
      itemSupply(getItemSources(itemId), isConsumableItem(itemId)),
    );
  }
  return supplies.get(itemId);
}

/**
 * @param {string} itemId Normalized item id.
 * @return {?number} The badge count at which the item's supply starts
 *     (getItemSupply); null when nothing that counts is tracked.
 */
export function getItemUnlockBadge(itemId) {
  return getItemSupply(itemId)[0]?.badge ?? null;
}

/**
 * @return {!Map<string, !Object>} Item id -> the earliest source that
 *     restocks the item in the active game (games/item-sources.js), for
 *     every item that has one.
 */
export function renewableSources() {
  const { sources } = gameItems();
  let renewable = RENEWABLE_SOURCES.get(sources);
  if (renewable) return renewable;
  renewable = new Map();
  for (const id of Object.keys(sources)) {
    const first = getItemSources(id).find((source) =>
      RENEWABLE_SOURCE_KINDS.has(source.kind));
    if (first) renewable.set(id, first);
  }
  RENEWABLE_SOURCES.set(sources, renewable);
  return renewable;
}

/**
 * The renewable held items the player could stock RIGHT NOW but isn't
 * tracking yet: reachable at their badge count, in the held-item catalog,
 * not a hidden/replaced id, and absent from (or under-stocked in) the owned
 * list. Reads renewableSources, so an item with several restocking sources
 * appears once, at the earliest. Drives the inventory panel's one-click
 * sync — the data already knows what restocks, so discovering it shouldn't
 * mean transcribing it. Sorted by name for a stable display list.
 * `badges` and `ownedItems` arrive as plain values (not the progression
 * object) to keep this module import-cycle-free.
 * @param {number} badges
 * @param {Object<string, number>=} ownedItems id -> owned count.
 * @param {number=} minCount Owned count at which an item stops qualifying.
 * @return {Array<{id: string, name: string, badge: number}>}
 */
export function getRenewablyObtainableItems(
  badges,
  ownedItems = {},
  minCount = 1,
) {
  if (!Number.isFinite(badges)) return [];
  const items = gameItems();
  const extrasById = Object.fromEntries(
    items.extraInventoryItems.map((item) => [item.id, item]),
  );
  const results = [];
  for (const [id, { badge }] of renewableSources()) {
    if (badge > badges) continue;
    if (items.hiddenInventoryItemIds.has(id)) continue;
    const item = dex().heldItemsById[id] || extrasById[id];
    if (!item) continue;
    if ((ownedItems[id] || 0) >= minCount) continue;
    results.push({ id, name: item.name, badge });
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
