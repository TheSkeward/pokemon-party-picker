/**
 * @fileoverview The active game's dex bundle. Engine modules read species,
 * stats, moves, and items through this accessor instead of importing a
 * generation's generated modules, so the same code serves every game.
 */
import { getActiveGame } from './registry.js';

/** @return {!Object} The active game's dex bundle (see dex-gen7.js). */
export function dex() {
  return getActiveGame().dex;
}
