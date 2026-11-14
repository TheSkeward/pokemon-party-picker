import { DEFAULT_STATE } from './state.js';
import {
  MIN_LEARNER_CHOICES,
  MOVE_USAGE_TABLE,
} from './views/move-usage-view.js';
import { POKEMON_USAGE_TABLE } from './views/pokemon-usage-view.js';
import { USAGE_TABLES, usageTableById } from './views/usage-tables.js';

const VALID_SORT_DIRS = new Set(['asc', 'desc']);
const VALID_VIEWS = new Set(['resolver', 'pool', 'browser']);

// The params past the search and sort that one usage table alone reads.
const TABLE_PARAM_WRITERS = {
  [POKEMON_USAGE_TABLE.id]: (params, state) => {
    params.set('format', state.format);
    if (state.selectedPokemon) params.set('pokemon', state.selectedPokemon);
  },
  [MOVE_USAGE_TABLE.id]: (params, state) => {
    if (state.moveMinLearners !== DEFAULT_STATE.moveMinLearners) {
      params.set('minLearners', String(state.moveMinLearners));
    }
  },
};

/**
 * @return {!Object} App state from the URL query params; missing or invalid
 *     values fall back to DEFAULT_STATE. The family is validated later
 *     against the usage data's family list, which is not known here.
 */
export function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  // The search and sort params are the open usage table's.
  const table = usageTableById(params.get('table')) || USAGE_TABLES[0];
  const minLearners = Number(params.get('minLearners'));

  return {
    ...DEFAULT_STATE,
    view: VALID_VIEWS.has(params.get('view')) ? params.get('view') : DEFAULT_STATE.view,
    family: params.get('family') || DEFAULT_STATE.family,
    format: params.get('format') || DEFAULT_STATE.format,
    usageTable: table.id,
    tables: {
      ...DEFAULT_STATE.tables,
      [table.id]: readTableState(params, table),
    },
    selectedPokemon: params.get('pokemon') || DEFAULT_STATE.selectedPokemon,
    resolverQuery: params.get('resolverQuery') || DEFAULT_STATE.resolverQuery,
    resolverSelectedPokemon: params.get('resolverPokemon') || DEFAULT_STATE.resolverSelectedPokemon,
    moveMinLearners: MIN_LEARNER_CHOICES.includes(minLearners)
      ? minLearners
      : DEFAULT_STATE.moveMinLearners,
  };
}

function readTableState(params, table) {
  const defaults = DEFAULT_STATE.tables[table.id];
  const sortBy = params.get('sortBy');
  const sortDir = params.get('sortDir');
  return {
    search: params.get('search') || defaults.search,
    sortBy: Object.hasOwn(table.sorters, sortBy) ? sortBy : defaults.sortBy,
    sortDir: VALID_SORT_DIRS.has(sortDir) ? sortDir : defaults.sortDir,
  };
}

/** Serializes state into the URL query string via history.replaceState. */
export function writeStateToUrl(state) {
  const params = new URLSearchParams();

  params.set('view', state.view);
  params.set('family', state.family);

  // Only a view's own params belong in its URL, and on Usage Data only the
  // open table's: writing the rest would fossilize whatever the other views
  // and tables last showed into every shared link.
  if (state.view === 'browser') {
    writeUsageTableParams(params, state);
  } else if (state.view === 'resolver') {
    if (state.resolverQuery) params.set('resolverQuery', state.resolverQuery);
    if (state.resolverSelectedPokemon) params.set('resolverPokemon', state.resolverSelectedPokemon);
  }

  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', nextUrl);
}

function writeUsageTableParams(params, state) {
  const tableId = state.usageTable;
  const tableState = state.tables[tableId];
  const defaults = DEFAULT_STATE.tables[tableId];

  if (tableId !== DEFAULT_STATE.usageTable) params.set('table', tableId);
  if (tableState.search) params.set('search', tableState.search);
  if (tableState.sortBy !== defaults.sortBy) params.set('sortBy', tableState.sortBy);
  if (tableState.sortDir !== defaults.sortDir) params.set('sortDir', tableState.sortDir);
  TABLE_PARAM_WRITERS[tableId]?.(params, state);
}
