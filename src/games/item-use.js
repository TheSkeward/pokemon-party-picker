/**
 * @fileoverview How holding an item spends it, which decides what a copy is
 * worth in an item's supply (games/item-sources.js). A battle uses a
 * consumable up: in these games an item that triggers and is consumed is
 * gone for good, so one copy is one battle's worth and only a source that
 * restocks it counts. A Z-Crystal is the other way about: it stays in the
 * Bag when a Pokémon is given one to hold, so one copy equips the whole
 * team.
 */

// The used-up items that are neither Berries nor Gems. The Seeds are the
// terrain Seeds and the Essentials games' field Seeds; Miracle Seed is a
// type booster and stays.
const USED_UP_ITEM_IDS = new Set([
  'absorbbulb',
  'adrenalineorb',
  'airballoon',
  'berryjuice',
  'blunderpolicy',
  'boosterenergy',
  'cellbattery',
  'ejectbutton',
  'ejectpack',
  'electricseed',
  'elementalseed',
  'focussash',
  'grassyseed',
  'luminousmoss',
  'magicalseed',
  'mentalherb',
  'mirrorherb',
  'mistyseed',
  'powerherb',
  'psychicseed',
  'redcard',
  'roomservice',
  'snowball',
  'syntheticseed',
  'telluricseed',
  'throatspray',
  'weaknesspolicy',
  'whiteherb',
]);

/**
 * @param {string} itemId Normalized item id.
 * @return {boolean} Whether a battle uses the held item up.
 */
export function isConsumableItem(itemId) {
  return itemId.endsWith('berry') || itemId.endsWith('gem') ||
    USED_UP_ITEM_IDS.has(itemId);
}

/**
 * @param {string} itemId Normalized item id.
 * @return {boolean} Whether one copy equips every Pokémon: a Z-Crystal.
 */
export function isSharedItem(itemId) {
  return itemId.endsWith('iumz');
}
