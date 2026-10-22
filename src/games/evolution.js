/**
 * @fileoverview The active game's evolution rules: how it handles trades,
 * which access gate stands in for a region-locked evolution, which location
 * evolutions it simply lacks, its form-split notes, and the ordered list of
 * access gates its progression exposes. Reads the descriptor's `evolution`;
 * see games/reborn.js for the field shapes.
 */
import { getActiveGame } from './registry.js';
import { badgesHeldOf, getUnlockBadge } from './schedule.js';

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
