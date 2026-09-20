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
 *
 * A game's dex bundle (its generated species, move, and item tables) is the
 * bulk of its weight, so only the default game's ships with the app; any
 * other game's loads on demand through its descriptor's `loadDex`, and a
 * game can be activated only once its bundle is loaded.
 */
import { GEN7_DEX } from './dex-gen7.js';
import { REBORN_GAME } from './reborn.js';
import { HGSS_GAME } from './hgss.js';
import { B2W2_GAME } from './b2w2.js';

const GAMES = Object.freeze({
  [REBORN_GAME.id]: REBORN_GAME,
  [HGSS_GAME.id]: HGSS_GAME,
  [B2W2_GAME.id]: B2W2_GAME,
});

// Loaded dex bundles by game id. The default game's is bundled with the app
// so the engine can read it before any await.
const DEX_BY_GAME = new Map([[REBORN_GAME.id, GEN7_DEX]]);
// In-flight loads, so concurrent callers share one import.
const DEX_LOADS = new Map();

let activeGameId = REBORN_GAME.id;

/** @return {!Object} The active game's descriptor. */
export function getActiveGame() {
  return GAMES[activeGameId];
}

/** @return {!Object} The active game's dex bundle (see dex-gen7.js). */
export function getActiveDex() {
  return DEX_BY_GAME.get(activeGameId);
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
 * Loads a game's dex bundle, once.
 * @param {string} id
 * @return {!Promise<!Object>} The game's descriptor.
 * @throws {!Error} For unknown game ids.
 */
export async function loadGame(id) {
  const game = requireGame(id);
  if (!DEX_BY_GAME.has(id)) {
    if (!DEX_LOADS.has(id)) {
      DEX_LOADS.set(
        id,
        game
          .loadDex()
          .then((bundle) => {
            DEX_BY_GAME.set(id, bundle);
          })
          .catch((error) => {
            DEX_LOADS.delete(id);
            throw error;
          }),
      );
    }
    await DEX_LOADS.get(id);
  }
  return game;
}

/**
 * @param {string} id
 * @throws {!Error} For unknown game ids, and for a game whose bundle is not
 *     loaded yet (await loadGame first).
 */
export function setActiveGame(id) {
  requireGame(id);
  if (!DEX_BY_GAME.has(id)) {
    throw new Error(`Game "${id}" is not loaded; await loadGame("${id}") first`);
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
 * Loads and activates the game that claims a family. The app's family tabs
 * come from the usage data, so a family no game claims leaves the active
 * game as is.
 * @param {string} family
 * @return {!Promise<!Object>} The active game after the switch.
 */
export async function activateGameForFamily(family) {
  const game = gameForFamily(family);
  if (game) {
    await loadGame(game.id);
    setActiveGame(game.id);
  }
  return getActiveGame();
}

function requireGame(id) {
  const game = GAMES[id];
  if (!game) {
    throw new Error(`Unknown game "${id}" (known: ${Object.keys(GAMES).join(', ')})`);
  }
  return game;
}
