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
 * @param {string} kind 'progression' or 'pool'.
 * @return {string} The saved text, or '' when none.
 */
export function readSavedState(kind) {
  const { storage } = getActiveGame();
  const raw = readLocalStorage(storage[kind], '');
  if (raw) return raw;
  const legacyKey = storage.legacy?.[kind];
  if (!legacyKey) return '';
  const legacy = readLocalStorage(legacyKey, '');
  if (legacy && writeLocalStorage(storage[kind], legacy)) {
    removeLocalStorage(legacyKey);
  }
  return legacy;
}
