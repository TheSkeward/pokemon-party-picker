import './styles/main.css';

import {
  formatBelongsToFamily,
  getDefaultBrowserFormat,
  listFamilies,
  loadAggregateMovesets,
  loadAvailability,
  loadFormatData,
  loadFormatsIndex,
  loadItemUsage,
  loadMoveUsage,
  loadPokemonIndex,
} from './data';
import {
  activateGameForFamily,
  gameForFamily,
  orderFamilies,
} from './games/registry.js';
import { applyGameTheme } from './app/theme.js';
import { loadManifest } from './manifest.js';
import { bindAppEvents } from './app/app-events';
import { renderBrowserPage } from './app/browser-page';
import { captureFocusState, restoreFocusState } from './app/focus-state';
import { renderFatalAppError, renderAppShell } from './app/app-shell-view';
import { renderResolverPage } from './app/resolver-page';
import { readStateFromUrl, writeStateToUrl } from './router';
import {
  DEFAULT_STATE,
  getState,
  replaceState,
  setState,
  setTableState,
} from './state';
import { ITEM_USAGE_TABLE } from './views/item-usage-view';
import { MOVE_USAGE_TABLE } from './views/move-usage-view';
import { POKEMON_USAGE_TABLE } from './views/pokemon-usage-view';
import { nextSort } from './views/table-parts';
import { usageTableById } from './views/usage-tables';
import { mountPoolOptimizer } from './pool-widget';
import { computeResolverRepresentativeResults } from './resolver/representatives';
import { createPrecomputedSetDetailsLoader } from './setDetails/precomputed-set-details';
import { startUpdateNotifier } from './update-notifier';

const app = document.querySelector('#app');
// The usage tables that read one small file per family, and its loader.
const FAMILY_TABLE_LOADERS = {
  [MOVE_USAGE_TABLE.id]: loadMoveUsage,
  [ITEM_USAGE_TABLE.id]: loadItemUsage,
};
const LITERAL_RESOLVE_LIMIT = 25;
const RESOLVER_INPUT_DEBOUNCE_MS = 300;

let dataset = null;
let formatsIndex = [];
let availability = null;
let pokemonIndex = [];
let browserMovesetData = null;
let browserMovesetKey = null;
let familyTable = null;
let resolverResults = [];
let resolverLoadingState = { loading: false, message: '' };
let syncGeneration = 0;
let resolverDebounceTimer = null;

const resolverSetDetails = createPrecomputedSetDetailsLoader({
  getFamily: () => getState().family,
  onUpdate: () => rerenderPreservingFocus(),
});

async function init() {
  replaceState(readStateFromUrl());

  formatsIndex = await loadFormatsIndex();
  availability = await loadAvailability();

  // The family decides the game, and the game decides which species the
  // index keeps, so both precede the index load.
  ensureValidFamilyAndFormat();
  applyGameTheme(await activateGameForFamily(getState().family));
  pokemonIndex = await loadPokemonIndex();

  dataset = await loadFormatData(getState().format);

  // The manifest's data signature versions the data URLs fetched after it
  // (utils/data-url.js).
  await loadManifest();

  await ensureBrowserMovesetData();
  await ensureFamilyTableData();

  resolverResults = await computeResolverResults();

  writeStateToUrl(getState());
  renderApp();
  syncResolverSetDetailsSelection();
}

function ensureValidFamilyAndFormat() {
  if (!availability?.familyConfigs?.[getState().family]) {
    setState({ family: DEFAULT_STATE.family });
  }
  const state = getState();
  const fallbackFormat = getDefaultBrowserFormat(availability, state.family);

  if (
    !formatBelongsToFamily(formatsIndex, state.format, state.family) ||
    !formatsIndex.find((format) => format.id === state.format)
  ) {
    setState({
      format: fallbackFormat,
      selectedPokemon: null,
      resolverSelectedPokemon: null,
    });
  }
}

// The Pokémon table's moveset panel reads the format's aggregate, fetched
// once per format and only while that table shows a selected Pokémon.
async function ensureBrowserMovesetData() {
  const state = getState();

  if (
    state.view !== 'browser' ||
    state.usageTable !== POKEMON_USAGE_TABLE.id ||
    !state.selectedPokemon
  ) {
    browserMovesetData = null;
    browserMovesetKey = null;
    return;
  }

  if (browserMovesetKey === state.format) return;

  browserMovesetData = await loadAggregateMovesets(state.format);
  browserMovesetKey = state.format;
}

// The open usage table's per-family file, null for a table without one.
// data.js caches each file, so asking again on every sync costs nothing.
async function ensureFamilyTableData() {
  const state = getState();
  const load =
    state.view === 'browser' ? FAMILY_TABLE_LOADERS[state.usageTable] : null;
  const table = load ? await load(state.family) : null;

  // A load the state moved on from would hand one table another's file; the
  // sync that moved the state loads its own.
  if (getState() === state) familyTable = table;
}

async function computeResolverResults() {
  const state = getState();

  return computeResolverRepresentativeResults({
    availability,
    family: state.family,
    pokemonIndex,
    query: state.resolverQuery,
    literalResolveLimit: LITERAL_RESOLVE_LIMIT,
  });
}

function renderApp() {
  const state = getState();

  renderAppShell(app, state, orderFamilies(listFamilies(availability)));

  const pageRoot = document.querySelector('#page-root');

  if (state.view === 'resolver') {
    renderResolverPage(pageRoot, {
      availability,
      formatsIndex,
      resolverLoadingState,
      resolverResults,
      setDetails: resolverSetDetails,
      state,
    });
  } else if (state.view === 'pool') {
    renderPoolPage(pageRoot);
  } else {
    // Named as the family's tab names it: the game, then the family.
    const family =
      availability?.familyConfigs?.[state.family]?.label || state.family;
    const game = gameForFamily(state.family);
    renderBrowserPage(pageRoot, {
      browserMovesetData,
      dataset,
      familyLabel: game ? `${game.shortLabel} · ${family}` : family,
      familyTable,
      formatsIndex,
      state,
    });
  }

  bindEvents();
}

function renderPoolPage(pageRoot) {
  pageRoot.innerHTML = `<section id="pool-root" class="page-stack"></section>`;

  mountPoolOptimizer(document.querySelector('#pool-root'), {
    embedded: true,
    family: getState().family,
  });
}

function bindEvents() {
  bindAppEvents({
    onBrowserPokemonClick: handleBrowserPokemonClick,
    onFamilyChange: handleFamilyChange,
    onFormatChange: handleFormatChange,
    onMoveMinLearners: handleMoveMinLearners,
    onResolverPokemonClick: handleResolverPokemonClick,
    onResolverQueryInput: handleResolverQueryInput,
    onSearchInput: handleSearchInput,
    onSort: handleSort,
    onUsageTableChange: handleUsageTableChange,
    onViewChange: handleViewChange,
  });
}

async function handleFamilyChange(nextFamily) {
  if (nextFamily === getState().family) return;

  clearPendingResolverDebounce();
  resolverSetDetails.cancel();

  // A family may belong to another game: its dex narrows the species index
  // and its saved pool and progression load when the pool page remounts.
  applyGameTheme(await activateGameForFamily(nextFamily));
  pokemonIndex = await loadPokemonIndex();

  const nextFormat = getDefaultBrowserFormat(availability, nextFamily);
  dataset = await loadFormatData(nextFormat);

  setState({
    family: nextFamily,
    format: nextFormat,
    selectedPokemon: null,
    resolverSelectedPokemon: null,
  });

  await sync();
}

async function handleViewChange(nextView) {
  if (nextView === getState().view) return;

  setState({ view: nextView });

  await sync({ recomputeResolverResults: false });
}

// The usage table, its format, search text, sort and learner floor (below)
// shape the Usage Data page only. The Set Lookup results read none of them,
// so these handlers skip that recompute and leave one that is still pending
// to run on its timer.
async function handleUsageTableChange(usageTable) {
  if (usageTable === getState().usageTable) return;

  setState({ usageTable });

  await sync({ recomputeResolverResults: false });
}

async function handleFormatChange(format) {
  dataset = await loadFormatData(format);

  setState({ format, selectedPokemon: null });

  await sync({ recomputeResolverResults: false });
}

// The search text and the sort are the open table's.
async function handleSearchInput(search) {
  setTableState(getState().usageTable, { search });

  await sync({ recomputeResolverResults: false });
}

function handleResolverQueryInput(resolverQuery) {
  setState({
    resolverQuery,
    resolverSelectedPokemon: null,
  });

  resolverSetDetails.cancel();
  writeStateToUrl(getState());
  clearPendingResolverDebounce();

  resolverDebounceTimer = setTimeout(() => sync(), RESOLVER_INPUT_DEBOUNCE_MS);
}

async function handleSort(field) {
  const state = getState();
  const table = usageTableById(state.usageTable);

  setTableState(table.id, nextSort(table, state.tables[table.id], field));

  await sync({ recomputeResolverResults: false });
}

async function handleMoveMinLearners(value) {
  setState({ moveMinLearners: Number(value) });

  await sync({ recomputeResolverResults: false });
}

async function handleBrowserPokemonClick(pokemonId) {
  clearPendingResolverDebounce();
  resolverSetDetails.cancel();

  const state = getState();

  setState({
    selectedPokemon: state.selectedPokemon === pokemonId ? null : pokemonId,
    resolverSelectedPokemon: null,
    view: 'browser',
    usageTable: POKEMON_USAGE_TABLE.id,
  });

  await sync({ recomputeResolverResults: false });
}

async function handleResolverPokemonClick(pokemonId) {
  clearPendingResolverDebounce();

  const state = getState();
  const nextSelected =
    state.resolverSelectedPokemon === pokemonId ? null : pokemonId;

  setState({
    resolverSelectedPokemon: nextSelected,
    selectedPokemon: null,
    view: 'resolver',
  });

  if (nextSelected) {
    resolverSetDetails.select(nextSelected);
  } else {
    resolverSetDetails.cancel();
  }

  await sync({ recomputeResolverResults: false });
}

function clearPendingResolverDebounce() {
  if (!resolverDebounceTimer) return;

  clearTimeout(resolverDebounceTimer);
  resolverDebounceTimer = null;
}

function getResolverLoadingMessage() {
  const tokens = (getState().resolverQuery || '')
    .split(/[,\n]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length >= 8) {
    return `Resolving ${tokens.length} inputs across best available data...`;
  }

  if (tokens.length > 1) {
    return `Resolving ${tokens.length} inputs...`;
  }

  return 'Resolving Pokémon...';
}

function renderResolverLoadingNow() {
  const state = getState();

  if (state.view !== 'resolver' || !state.resolverQuery.trim()) return;

  resolverLoadingState = {
    loading: true,
    message: getResolverLoadingMessage(),
  };

  const focusState = captureFocusState();

  writeStateToUrl(getState());
  renderApp();
  restoreFocusState(focusState);
}

async function sync(options = {}) {
  const { recomputeResolverResults = true } = options;
  const focusState = captureFocusState();
  const generation = ++syncGeneration;

  await ensureBrowserMovesetData();
  await ensureFamilyTableData();

  let nextResolverResults = resolverResults;

  if (recomputeResolverResults) {
    renderResolverLoadingNow();
    await waitForPaint();
    nextResolverResults = await computeResolverResults();
  }

  if (generation !== syncGeneration) return;

  if (recomputeResolverResults) {
    resolverLoadingState = { loading: false, message: '' };
    resolverResults = nextResolverResults;
    ensureResolverSelectionStillExists();
  }

  writeStateToUrl(getState());
  renderApp();

  if (generation !== syncGeneration) return;

  restoreFocusState(focusState);
  syncResolverSetDetailsSelection();
}

function ensureResolverSelectionStillExists() {
  const selectedPokemon = getState().resolverSelectedPokemon;
  if (!selectedPokemon) return;

  const validIds = new Set(resolverResults.map((row) => row.pokemonId));

  if (!validIds.has(selectedPokemon)) {
    setState({ resolverSelectedPokemon: null });
    resolverSetDetails.cancel();
  }
}

function syncResolverSetDetailsSelection() {
  const state = getState();

  if (state.view !== 'resolver') return;

  if (!state.resolverSelectedPokemon) {
    resolverSetDetails.cancel();
    return;
  }

  if (
    resolverSetDetails.getSelectedPokemonId() !== state.resolverSelectedPokemon
  ) {
    resolverSetDetails.select(state.resolverSelectedPokemon);
  }
}

function rerenderPreservingFocus() {
  const focusState = captureFocusState();

  renderApp();
  restoreFocusState(focusState);
}

function waitForPaint() {
  return new Promise((resolve) => {
    const fallback = setTimeout(resolve, 100);

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(fallback);
        resolve();
      }),
    );
  });
}

init().catch((error) => {
  console.error(error);
  renderFatalAppError(app, error);
});

startUpdateNotifier();
