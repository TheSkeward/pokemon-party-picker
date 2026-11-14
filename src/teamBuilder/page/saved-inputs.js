/**
 * @fileoverview What the Team Builder page keeps in localStorage besides
 * the progression: the active game's pool and donor box, and the team
 * table's sort.
 */
import { readSavedState, savedStateKey } from '../../games/saved-state.js';
import {
  readLocalStorage,
  removeLocalStorage,
  writeLocalStorage,
} from '../../storage/safe-local-storage';

// Frozen at the project's original name so saved preferences survive.
const TEAM_SORT_STORAGE_KEY = 'pokemon-usage-viewer:pool-team-sort:v1';
const TEAM_SORT_DIR_STORAGE_KEY = 'pokemon-usage-viewer:pool-team-sort-dir:v1';

/**
 * @param {string} value
 * @return {boolean} Whether the pool text was persisted.
 */
export function savePool(value) {
  return writeLocalStorage(savedStateKey('pool'), value);
}

/** @return {string} The saved pool text, or '' when none. */
export function loadSavedPool() {
  return readSavedState('pool');
}

/** Forgets the saved pool; the donor box is kept. */
export function clearSavedPool() {
  removeLocalStorage(savedStateKey('pool'));
}

/**
 * @param {string} value
 * @return {boolean} Whether the donor box text was persisted.
 */
export function saveDonors(value) {
  return writeLocalStorage(savedStateKey('donors'), value);
}

/** @return {string} The saved donor box text, or '' when none. */
export function loadSavedDonors() {
  return readSavedState('donors');
}

/**
 * @param {string} sort
 * @param {string} direction 'asc' or 'desc'.
 */
export function saveTeamSort(sort, direction) {
  writeLocalStorage(TEAM_SORT_STORAGE_KEY, sort);
  writeLocalStorage(TEAM_SORT_DIR_STORAGE_KEY, direction);
}

/** @return {{sort: string, direction: string}} Each '' when never saved. */
export function loadSavedTeamSort() {
  return {
    sort: readLocalStorage(TEAM_SORT_STORAGE_KEY, ''),
    direction: readLocalStorage(TEAM_SORT_DIR_STORAGE_KEY, ''),
  };
}
