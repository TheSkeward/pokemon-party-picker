/**
 * @fileoverview The game registry: which games this app can build teams
 * for, and which one is active. Everything per-game (data paths, saved-state
 * keys, dex generation, progression schedule, usage families) hangs off the
 * active game's descriptor so the scoring engine and UI never hardcode a
 * game.
 *
 * The active game is process-global for the same reason scoring overrides
 * are: the optimizer, its caches, and the UI must all agree on it within one
 * run, and tests swap it around a run the same way they swap overrides.
 * Optimizer cache keys fold the game id in, so switching games can never
 * serve one game's cached results to another.
 */
import { REBORN_GAME } from './reborn.js';
import { SOULSILVER_GAME } from './soulsilver.js';

const GAMES = Object.freeze({
  [REBORN_GAME.id]: REBORN_GAME,
  [SOULSILVER_GAME.id]: SOULSILVER_GAME,
});

let activeGameId = REBORN_GAME.id;

/** @return {!Object} The active game's descriptor. */
export function getActiveGame() {
  return GAMES[activeGameId];
}

/** @return {?Object} The descriptor for id, or null when unknown. */
export function getGame(id) {
  return GAMES[id] || null;
}

/** @return {!Array<!Object>} */
export function listGames() {
  return Object.values(GAMES);
}

/**
 * @param {string} id
 * @throws {!Error} For unknown game ids.
 */
export function setActiveGame(id) {
  if (!GAMES[id]) {
    throw new Error(`Unknown game "${id}" (known: ${Object.keys(GAMES).join(', ')})`);
  }
  activeGameId = id;
}

/**
 * @param {string} family A usage-data family id.
 * @return {?Object} The descriptor of the game whose prior that family is,
 *     or null when no registered game claims it.
 */
export function gameForFamily(family) {
  return listGames().find((game) => game.families.includes(family)) || null;
}

/**
 * Activates the game that claims a family. The app's family tabs come from
 * the usage data, so a family no game claims leaves the active game as is.
 * @param {string} family
 * @return {!Object} The active game after the switch.
 */
export function setActiveGameForFamily(family) {
  const game = gameForFamily(family);
  if (game) setActiveGame(game.id);
  return getActiveGame();
}
