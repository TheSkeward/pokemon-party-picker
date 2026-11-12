/**
 * @fileoverview Which held items a battle uses up. In these games an item
 * that triggers and is consumed is gone for good, so one copy is one
 * battle's worth: an item's supply (games/items.js) counts a consumable
 * only from a source that restocks it.
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
