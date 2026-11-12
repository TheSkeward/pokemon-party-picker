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
import { getItemUnlock } from './schedule.js';
import { toId } from '../utils/ids.js';

/**
 * Where the active game hands out a held item: the badge it is first
 * obtainable after, the item timeline's words for how, and the earliest
 * source that restocks it.
 * @typedef {{badge: number, via: string,
 *     renewable: ?{kind: string, badge: number}}}
 */
let ItemSource;

// Renewable-source index per game, keyed by its item content.
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
 * @return {!Map<string, {kind: string, badge: number}>} Item id -> the
 *     earliest source that restocks the item in the active game: a shop
 *     ("shop") or the mining rocks ("mining"), with the badge it opens
 *     after. A shop wins a tie.
 */
export function renewableSources() {
  const items = gameItems();
  let sources = RENEWABLE_SOURCES.get(items);
  if (sources) return sources;
  sources = new Map();
  const add = (kind, badges) => {
    for (const [id, badge] of Object.entries(badges)) {
      if (!sources.has(id) || badge < sources.get(id).badge) {
        sources.set(id, { kind, badge });
      }
    }
  };
  add('shop', items.shopItemBadges);
  add('mining', items.miningItemBadges);
  RENEWABLE_SOURCES.set(items, sources);
  return sources;
}

/**
 * @param {string} itemId Normalized item id.
 * @return {?ItemSource} Null when the game tracks no source for the item:
 *     its timing is unknown, which is not the same as unobtainable.
 */
export function getItemSource(itemId) {
  const unlock = getItemUnlock(itemId);
  const renewable = renewableSources().get(itemId) || null;
  if (!unlock && !renewable) return null;
  // A shop the timeline misses, or dates later, is still the first source.
  const first = unlock && (!renewable || unlock.badge <= renewable.badge)
    ? unlock
    : { badge: renewable.badge, via: renewable.kind };
  return { badge: first.badge, via: first.via, renewable };
}

/**
 * The renewable held items the player could stock RIGHT NOW but isn't
 * tracking yet: reachable at their badge count, in the held-item catalog,
 * not a hidden/replaced id, and absent from (or under-stocked in) the owned
 * list. Reads renewableSources, so an item with both a shop and a mining
 * source appears once, at the earlier. Drives the inventory panel's
 * one-click sync — the data already knows what the shops and rocks yield,
 * so discovering them shouldn't mean transcribing them. Sorted by name for
 * a stable display list.
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
