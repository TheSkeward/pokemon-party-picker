/**
 * @fileoverview The active game's item content: each held item's sources
 * and the supply they add up to, game-only inventory items outside the
 * dex's held-item catalog, held-item ids the game replaces (hidden from the
 * picker, with the migration of saved counts), the evolution-item
 * availability, and the proxies the recommender prices game-original items
 * with. Reads the descriptor's `items`; see games/reborn.js for the field
 * shapes.
 */
import { getActiveGame } from './registry.js';
import { isConsumableItem, isSharedItem } from './item-use.js';
import { dex } from './dex.js';
import {
  describeSupply,
  FULL_SUPPLY,
  itemSupply,
  orderItemSources,
} from './item-sources.js';
import { toId } from '../utils/ids.js';

// Each item's supply per game, keyed by its source lists.
const SUPPLIES = new WeakMap();

/** @return {!Object} The active game's item content. */
export function gameItems() {
  return getActiveGame().items;
}

/**
 * @param {?string} itemName Item name or id (normalized internally).
 * @return {{status: string, source: string}} Whether the game hands the
 *     item out, and how. It does when its item data has a source for the
 *     item or its evolution-item table lists it; otherwise status is
 *     "unknown". The table judges the grind, "farmable" or
 *     "farmable-tedious", and an item it does not judge is "farmable".
 *     source says where the item comes from: the table's words where it
 *     gives them, else the item's supply in words, so that a game whose
 *     sources are read from its files states no source by hand.
 */
export function getItemAvailability(itemName) {
  const id = toId(itemName);
  if (!id) return { status: 'unknown', source: 'no item recorded' };
  const entry = gameItems().evolutionItemAvailability[id];
  const supplied = describeSupply(getItemSupply(id));
  if (!entry && !supplied) {
    return {
      status: 'unknown',
      source: `no availability data for ${itemName}`,
    };
  }
  return {
    status: entry?.status ?? 'farmable',
    source: entry?.source ?? supplied,
  };
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
      itemSupply(getItemSources(itemId), {
        consumable: isConsumableItem(itemId),
        shared: isSharedItem(itemId),
      }),
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
 * @param {string} itemId Normalized item id.
 * @param {number} badges The badge count held.
 * @return {number} The copies of the item the active game has handed out by
 *     that badge count, FULL_SUPPLY once its supply is full. 0 before the
 *     supply starts, and where its count is unknown.
 */
export function expectedItemCount(itemId, badges) {
  let count = 0;
  for (const step of getItemSupply(itemId)) {
    if (step.badge > badges) break;
    if (step.copies != null) count = Math.min(FULL_SUPPLY, step.copies);
  }
  return count;
}

/**
 * The held items whose tracked count differs from what the active game has
 * handed out by the player's badge: in the held-item catalog, not a
 * hidden/replaced id, and expected at least once. An item the game's data
 * does not expect yet is left alone, since the player may hold one the data
 * misses. Drives the inventory panel's one-click sync — the data already
 * knows what is out there, so tracking it shouldn't mean transcribing it.
 * Sorted by name for a stable display list. `badges` and `ownedItems`
 * arrive as plain values (not the progression object) to keep this module
 * import-cycle-free.
 * @param {?number} badges The badge count held; null yields nothing.
 * @param {Object<string, number>=} ownedItems id -> owned count.
 * @return {!Array<{id: string, name: string, count: number,
 *     owned: number}>} `count` is the expected count, `owned` the tracked
 *     one.
 */
export function getExpectedItemChanges(badges, ownedItems = {}) {
  if (!Number.isFinite(badges)) return [];
  const items = gameItems();
  const extrasById = Object.fromEntries(
    items.extraInventoryItems.map((item) => [item.id, item]),
  );
  const changes = [];
  for (const id of Object.keys(items.sources)) {
    if (items.hiddenInventoryItemIds.has(id)) continue;
    const item = dex().heldItemsById[id] || extrasById[id];
    if (!item) continue;
    const count = expectedItemCount(id, badges);
    const owned = ownedItems[id] || 0;
    if (count > 0 && count !== owned) {
      changes.push({ id, name: item.name, count, owned });
    }
  }
  return changes.sort((a, b) => a.name.localeCompare(b.name));
}
