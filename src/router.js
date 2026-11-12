import { DEFAULT_STATE } from './state';
import {
  MIN_LEARNER_CHOICES,
  MOVE_SORT_FIELDS,
} from './views/move-usage-view';

const VALID_SORT_FIELDS = new Set(['rank', 'name', 'usage', 'rawCount', 'leadTendency']);
const VALID_SORT_DIRS = new Set(['asc', 'desc']);
const VALID_VIEWS = new Set(['resolver', 'pool', 'browser', 'moves']);

/**
 * @return {!Object} App state from the URL query params; missing or invalid
 *     values fall back to DEFAULT_STATE. The family is validated later
 *     against the usage data's family list, which is not known here.
 */
export function readStateFromUrl() {
  const params = new URLSearchParams(window.location.search);

  return {
    ...DEFAULT_STATE,
    view: VALID_VIEWS.has(params.get('view')) ? params.get('view') : DEFAULT_STATE.view,
    family: params.get('family') || DEFAULT_STATE.family,
    format: params.get('format') || DEFAULT_STATE.format,
    search: params.get('search') || DEFAULT_STATE.search,
    sortBy: VALID_SORT_FIELDS.has(params.get('sortBy')) ? params.get('sortBy') : DEFAULT_STATE.sortBy,
    sortDir: VALID_SORT_DIRS.has(params.get('sortDir')) ? params.get('sortDir') : DEFAULT_STATE.sortDir,
    selectedPokemon: params.get('pokemon') || DEFAULT_STATE.selectedPokemon,
    resolverQuery: params.get('resolverQuery') || DEFAULT_STATE.resolverQuery,
    resolverSelectedPokemon: params.get('resolverPokemon') || DEFAULT_STATE.resolverSelectedPokemon,
    moveSearch: params.get('moveSearch') || DEFAULT_STATE.moveSearch,
    moveSortBy: MOVE_SORT_FIELDS.includes(params.get('moveSortBy')) ? params.get('moveSortBy') : DEFAULT_STATE.moveSortBy,
    moveSortDir: VALID_SORT_DIRS.has(params.get('moveSortDir')) ? params.get('moveSortDir') : DEFAULT_STATE.moveSortDir,
    moveMinLearners: MIN_LEARNER_CHOICES.includes(Number(params.get('minLearners'))) ? Number(params.get('minLearners')) : DEFAULT_STATE.moveMinLearners,
  };
}

/** Serializes state into the URL query string via history.replaceState. */
export function writeStateToUrl(state) {
  const params = new URLSearchParams();

  params.set('view', state.view);
  params.set('family', state.family);

  // Only a view's own params belong in its URL. format drives the usage
  // browser and resolverQuery/... the resolver — writing them from the pool
  // or the move table would just fossilize whatever the other views last
  // showed into every shared link.
  if (state.view === 'moves') {
    if (state.moveSearch) params.set('moveSearch', state.moveSearch);
    if (state.moveSortBy !== DEFAULT_STATE.moveSortBy) params.set('moveSortBy', state.moveSortBy);
    if (state.moveSortDir !== DEFAULT_STATE.moveSortDir) params.set('moveSortDir', state.moveSortDir);
    if (state.moveMinLearners !== DEFAULT_STATE.moveMinLearners) params.set('minLearners', String(state.moveMinLearners));
  } else if (state.view !== 'pool') {
    params.set('format', state.format);

    if (state.search) params.set('search', state.search);
    if (state.sortBy !== DEFAULT_STATE.sortBy) params.set('sortBy', state.sortBy);
    if (state.sortDir !== DEFAULT_STATE.sortDir) params.set('sortDir', state.sortDir);
    if (state.selectedPokemon) params.set('pokemon', state.selectedPokemon);
    if (state.resolverQuery) params.set('resolverQuery', state.resolverQuery);
    if (state.resolverSelectedPokemon) params.set('resolverPokemon', state.resolverSelectedPokemon);
  }

  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState(null, '', nextUrl);
}
