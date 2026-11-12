import { getActiveGame } from './games/registry.js';
import { defaultTableState } from './views/table-parts.js';
import { USAGE_TABLES } from './views/usage-tables.js';

/** @const {!Object} */
export const DEFAULT_STATE = {
  view: 'pool',
  // The default game's first family; `format` is that family's default
  // browser format (main.js re-validates both against the usage data).
  family: getActiveGame().families[0],
  format: 'gen7anythinggoes',
  // The Usage Data page's open table, and each table's own search and sort
  // (views/usage-tables.js), kept while another table shows.
  usageTable: USAGE_TABLES[0].id,
  tables: Object.fromEntries(
    USAGE_TABLES.map((table) => [table.id, defaultTableState(table)]),
  ),
  selectedPokemon: null,
  resolverQuery: '',
  resolverSelectedPokemon: null,
  // Below ten learners a move's share is a few Pokémon's habit, not a
  // pattern, and the signature moves crowd the top of the table.
  moveMinLearners: 10,
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

/**
 * Shallow-merges patch into one Usage Data table's search and sort.
 * @param {string} tableId
 * @param {!Object} patch
 */
export function setTableState(tableId, patch) {
  const { tables } = currentState;
  setState({
    tables: { ...tables, [tableId]: { ...tables[tableId], ...patch } },
  });
}
