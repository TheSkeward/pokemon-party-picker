/**
 * @fileoverview The active game's evolution rules: how it handles trades,
 * which access gate stands in for a region-locked evolution, which location
 * evolutions it simply lacks, its form-split notes, and the ordered list of
 * access gates its progression exposes. Reads the descriptor's `evolution`;
 * see games/reborn.js for the field shapes.
 */
import { getActiveGame } from './registry.js';
import { badgesHeldOf, getUnlockBadge } from './schedule.js';
import { toId } from '../utils/ids.js';

/** @return {!Object} The active game's evolution rules. */
export function evolutionRules() {
  return getActiveGame().evolution;
}

/**
 * @return {!Array<{key: string, label: string, item: (string|undefined),
 *     defaultFromUnlock: (boolean|undefined)}>} The access gates in the
 *     order the progression UI lists them.
 */
export function accessFields() {
  return evolutionRules().accessFields;
}

// The gate on every evolution item that has no field of its own.
const OTHER_ITEMS_ACCESS_KEY = 'evoAccessOtherEvoItems';

// The access fields that gate evolution items, per game, keyed by its
// access-field list.
const ITEM_FIELDS = new WeakMap();

function itemFields() {
  const fields = accessFields();
  let gates = ITEM_FIELDS.get(fields);
  if (!gates) {
    gates = {
      keyByItemId: new Map(
        fields.filter((field) => field.item)
          .map((field) => [toId(field.item), field.key])),
      catchAll: fields.some((field) => field.key === OTHER_ITEMS_ACCESS_KEY)
        ? OTHER_ITEMS_ACCESS_KEY
        : null,
    };
    ITEM_FIELDS.set(fields, gates);
  }
  return gates;
}

/**
 * @param {?string} itemName
 * @return {?string} The access field that gates an evolution item: its own
 *     (a stone's), else the game's field for the rest. Null where the game
 *     lists neither: the item is then timed by the game's item sources.
 */
export function evolutionItemAccessKey(itemName) {
  const { keyByItemId, catchAll } = itemFields();
  return keyByItemId.get(toId(itemName)) ?? catchAll;
}

/**
 * @return {boolean} Whether the game gates no evolution item by a field of
 *     its progression, each being timed by its sources instead.
 */
export function evolutionItemsFollowSources() {
  const { keyByItemId, catchAll } = itemFields();
  return !catchAll && keyByItemId.size === 0;
}

/** The gate on Mega Evolution itself: the game's Mega ring. */
export const MEGA_RING_ACCESS_KEY = 'evoAccessMegaRing';

/**
 * Whether Mega Evolution is available under a progression: the ring gate is
 * open, or the game has no such gate. A Mega stays the line's usage
 * representative either way; the ring decides only whether the player
 * fields the Mega form or its base.
 * @param {!Object} progression
 * @return {boolean}
 */
export function isMegaRingOpen(progression) {
  const field = accessFields().find(
    (entry) => entry.key === MEGA_RING_ACCESS_KEY,
  );
  return !field || isAccessOpen(progression, field);
}

/**
 * Whether an access gate is open under a progression. A saved false closes
 * any gate. A gate that defaults from its unlock (`defaultFromUnlock`) is
 * closed until the badge count reaches the unlock unless saved true, since
 * its timing is a known fact rather than a guess; every other gate is open
 * when unset, so old saves keep their behavior.
 * @param {!Object} progression
 * @param {{key: string, defaultFromUnlock: (boolean|undefined)}} field
 * @return {boolean}
 */
export function isAccessOpen(progression, field) {
  const saved = progression?.[field.key];
  if (saved === false) return false;
  if (!field.defaultFromUnlock || saved === true) return true;
  const badge = getUnlockBadge(field.key);
  if (badge == null) return true;
  const held = badgesHeldOf(progression);
  return held == null || held >= badge;
}
