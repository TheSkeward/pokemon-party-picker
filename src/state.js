import { getActiveGame } from './games/registry.js';

/** @const {!Object} */
export const DEFAULT_STATE = {
  view: 'pool',
  // The default game's first family; `format` is that family's default
  // browser format (main.js re-validates both against the usage data).
  family: getActiveGame().families[0],
  format: 'gen7anythinggoes',
  month: 'all',
  search: '',
  sortBy: 'rank',
  sortDir: 'asc',
  selectedPokemon: null,
  resolverMonth: 'all',
  resolverQuery: '',
  resolverSelectedPokemon: null,
};

let currentState = { ...DEFAULT_STATE };

/** @return {!Object} */
export function getState() {
  return currentState;
}

/** @param {!Object} nextState */
export function replaceState(nextState) {
  currentState = { ...nextState };
}

/**
 * Shallow-merges patch into the current state.
 * @param {!Object} patch
 */
export function setState(patch) {
  currentState = { ...currentState, ...patch };
}
