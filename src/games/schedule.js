/**
 * @fileoverview The active game's progression schedule: its checkpoints
 * (badge count, level cap, what first becomes obtainable there) and the
 * badge at which an item or access key first arrives. Reads the descriptor's
 * `schedule`, so every game supplies its own timeline in one shape (see
 * reborn/badge-timeline.js for the Reborn data and its conventions).
 */
import { getActiveGame } from './registry.js';

// Checkpoint index per schedule, keyed by the checkpoints array itself.
const INDEXES = new WeakMap();

function indexOf() {
  const { checkpoints } = getActiveGame().schedule;
  let byId = INDEXES.get(checkpoints);
  if (!byId) {
    byId = new Map(
      checkpoints.map((checkpoint, index) => [
        checkpoint.id,
        { checkpoint, index },
      ]),
    );
    INDEXES.set(checkpoints, byId);
  }
  return byId;
}

/** @return {!Array<!Object>} The checkpoints in play order. */
export function getCheckpoints() {
  return getActiveGame().schedule.checkpoints;
}

/**
 * @param {?string} id
 * @return {?Object} Null for unknown ids.
 */
export function getCheckpoint(id) {
  return indexOf().get(String(id || ''))?.checkpoint || null;
}

/**
 * @param {?string} id
 * @return {number} Position in timeline order; -1 for unknown ids.
 */
export function getCheckpointOrdinal(id) {
  const entry = indexOf().get(String(id || ''));
  return entry ? entry.index : -1;
}

/**
 * Everything the schedule expects to be obtainable once the given checkpoint
 * is reached (cumulative through that checkpoint).
 * @param {?string} id Checkpoint id; unknown ids yield empty sets.
 * @return {{accessKeys: Set<string>, flags: Set<string>, itemIds: Set<string>}}
 */
export function getExpectedUnlocks(id) {
  const ordinal = getCheckpointOrdinal(id);
  const expected =
    { accessKeys: new Set(), flags: new Set(), itemIds: new Set() };
  if (ordinal < 0) return expected;
  for (const checkpoint of getCheckpoints().slice(0, ordinal + 1)) {
    for (const key of checkpoint.unlocks.access || []) expected.accessKeys.add(
      key);
    for (const key of checkpoint.unlocks.flags || []) expected.flags.add(key);
    for (const item of checkpoint.unlocks.items || []) expected.itemIds.add(
      item);
  }
  return expected;
}

/**
 * The badge count at which the schedule first expects an unlock (access key or
 * boolean flag); null when it is never scheduled (available from the start).
 * @param {string} key
 * @return {?number}
 */
export function getUnlockBadge(key) {
  for (const checkpoint of getCheckpoints()) {
    if (
      (checkpoint.unlocks.access || []).includes(key) ||
      (checkpoint.unlocks.flags || []).includes(key)
    ) {
      return checkpoint.badges;
    }
  }
  return null;
}

/**
 * The badge count at which a held item first becomes obtainable; null when
 * nothing tracks it (treat as timing-unknown, not unobtainable). Curated
 * checkpoint entries win; the schedule's generated item table covers the
 * rest.
 * @param {string} itemId Normalized item id.
 * @return {?number}
 */
export function getItemUnlockBadge(itemId) {
  for (const checkpoint of getCheckpoints()) {
    if ((checkpoint.unlocks.items || []).includes(itemId)) {
      return checkpoint.badges;
    }
  }
  return getActiveGame().schedule.itemUnlockBadges[itemId]?.badge ?? null;
}

/**
 * @param {?Object} checkpoint
 * @return {string} The checkpoint's own short name when it has one, "Post N"
 *     for post-game tiers, "N badges" otherwise; "" for null.
 */
export function checkpointShortLabel(checkpoint) {
  if (!checkpoint) return '';
  if (checkpoint.short) return checkpoint.short;
  if (checkpoint.postgame) return `Post ${checkpoint.postgame}`;
  return `${checkpoint.badges} badge${checkpoint.badges === 1 ? '' : 's'}`;
}
