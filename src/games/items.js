/**
 * @fileoverview The active game's item content: renewable sources by badge
 * (shops, mining), game-only inventory items outside the dex's held-item
 * catalog, held-item ids the game replaces (hidden from the picker, with the
 * migration of saved counts), the curated evolution-item availability, and
 * the proxies the recommender prices game-original items with. Reads the
 * descriptor's `items`; see games/reborn.js for the field shapes.
 */
import { getActiveGame } from './registry.js';
import { dex } from './dex.js';
import { toId } from '../utils/ids.js';

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
 * The renewable held items the player could stock RIGHT NOW but isn't
 * tracking yet: reachable at their badge count, in the held-item catalog,
 * not a hidden/replaced id, and absent from (or under-stocked in) the owned
 * list. Merges shop stock with mining-rock rewards; when an item has both
 * sources, the earlier renewable source wins and the item appears only
 * once. Drives the inventory panel's one-click sync — the data already
 * knows what the shops and rocks yield, so discovering them shouldn't mean
 * transcribing them. Sorted by name for a stable display list.
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
  const items = gameItems();
  const renewableBadges = { ...items.shopItemBadges };
  for (const [id, badge] of Object.entries(items.miningItemBadges)) {
    renewableBadges[id] = Math.min(renewableBadges[id] ?? Infinity, badge);
  }
  return getAvailableInventoryItems(
    renewableBadges,
    badges,
    ownedItems,
    minCount,
  );
}

function getAvailableInventoryItems(
  itemBadges,
  badges,
  ownedItems,
  minCount,
) {
  if (!Number.isFinite(badges)) return [];
  const items = gameItems();
  const extrasById = Object.fromEntries(
    items.extraInventoryItems.map((item) => [item.id, item]),
  );
  const results = [];
  for (const [id, badge] of Object.entries(itemBadges)) {
    if (badge > badges) continue;
    if (items.hiddenInventoryItemIds.has(id)) continue;
    const item = dex().heldItemsById[id] || extrasById[id];
    if (!item) continue;
    if ((ownedItems[id] || 0) >= minCount) continue;
    results.push({ id, name: item.name, badge });
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}
