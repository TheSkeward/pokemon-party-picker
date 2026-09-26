/**
 * @fileoverview The active game's saved playthrough state in localStorage:
 * its owned pool and its progression, each under the key the descriptor
 * pins. A game that has been renamed keeps its players' saves by naming the
 * old keys as `storage.legacy`; the first read under the new key moves a
 * save over.
 */
import { getActiveGame } from './registry.js';
import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from '../storage/safe-local-storage';

/**
 * The active game's localStorage key for a kind of saved state. The donor
 * box (Pokémon owned but never fielded, kept for egg moves and Sketch) hangs
 * off the pool key so no descriptor has to name it.
 * @param {string} kind 'progression', 'pool' or 'donors'.
 * @return {string}
 */
export function savedStateKey(kind) {
  const { storage } = getActiveGame();
  return kind === 'donors' ? `${storage.pool}:donors` : storage[kind];
}

/**
 * @param {string} kind 'progression', 'pool' or 'donors'.
 * @return {string} The saved text, or '' when none.
 */
export function readSavedState(kind) {
  const { storage } = getActiveGame();
  const key = savedStateKey(kind);
  const raw = readLocalStorage(key, '');
  if (raw) return raw;
  const legacyKey = storage.legacy?.[kind];
  if (!legacyKey) return '';
  const legacy = readLocalStorage(legacyKey, '');
  if (legacy && writeLocalStorage(key, legacy)) {
    removeLocalStorage(legacyKey);
  }
  return legacy;
}
