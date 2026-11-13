/**
 * @fileoverview The active game's progression schedule: its checkpoints
 * (badge count, level cap, what first becomes obtainable there) and the
 * badge at which an access key or flag first arrives. Reads the descriptor's
 * `schedule`, so every game supplies its own timeline in one shape (see
 * reborn/badge-timeline.js for the Reborn data and its conventions). Held
 * items are timed by their sources (games/items.js).
 *
 * A timeline need not have a checkpoint for every badge count (a game may
 * hand two badges over together), so a badge count is looked up by the
 * first checkpoint that reaches it, never by building an id. When a
 * timeline drops a checkpoint, the descriptor's `schedule.retired` maps the
 * old id to the one that stands for it now, so a save made on it carries
 * over.
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
 * The badge count a progression stands at: its checkpoint's when one is
 * saved, else the first checkpoint whose level cap reaches the saved cap
 * (saves from before the badge picker, and the test harness, carry only a
 * cap). Null when neither is known.
 * @param {?Object} progression
 * @return {?number}
 */
export function badgesHeldOf(progression) {
  const checkpoint = getCheckpoint(progression?.checkpoint);
  if (checkpoint) return checkpoint.badges;
  const cap = Number.parseInt(progression?.levelCap, 10);
  if (!Number.isFinite(cap)) return null;
  const reached = getCheckpoints().find((entry) => entry.levelCap >= cap);
  return reached ? reached.badges : null;
}

/**
 * @param {?string} id
 * @return {?Object} Null for unknown ids.
 */
export function getCheckpoint(id) {
  return indexOf().get(String(id || ''))?.checkpoint || null;
}

/**
 * The checkpoint a saved id stands for: the timeline's own, or the
 * replacement of one the timeline has retired.
 * @param {?string} id
 * @return {?Object} Null for ids the timeline never had.
 */
export function getSavedCheckpoint(id) {
  const key = String(id || '');
  const { retired } = getActiveGame().schedule;
  return getCheckpoint(key) ||
    (retired && Object.hasOwn(retired, key)
      ? getCheckpoint(retired[key])
      : null);
}

/**
 * The level cap in force once a badge count is held: that of the first
 * checkpoint with at least that many badges.
 * @param {number} badges
 * @return {?number} Null past the timeline's last badge.
 */
export function levelCapAtBadges(badges) {
  const reached = getCheckpoints().find((entry) => entry.badges >= badges);
  return reached ? reached.levelCap : null;
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
 * @return {{accessKeys: Set<string>, flags: Set<string>}}
 */
export function getExpectedUnlocks(id) {
  const ordinal = getCheckpointOrdinal(id);
  const expected = { accessKeys: new Set(), flags: new Set() };
  if (ordinal < 0) return expected;
  for (const checkpoint of getCheckpoints().slice(0, ordinal + 1)) {
    for (const key of checkpoint.unlocks.access || []) expected.accessKeys.add(
      key);
    for (const key of checkpoint.unlocks.flags || []) expected.flags.add(key);
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
