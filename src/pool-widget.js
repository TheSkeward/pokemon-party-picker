/**
 * @fileoverview The Team Builder page. This module holds the page's state
 * and its one full render, and composes the parts under teamBuilder/page:
 * the optimize run, the event bindings of each panel, and the updates that
 * patch the page without a render.
 */
import { escapeHtml } from './utils/html.js';
import {
  listFamilies,
  loadAvailability,
  loadFormatsIndex,
  loadPokemonIndex,
} from './data.js';
import { applyGameTheme } from './app/theme.js';
import { activateGameForFamily, getActiveGame } from './games/registry.js';
import { loadManifest } from './manifest.js';
import { loadSavedProgression } from './playthrough/progression.js';
import { assignTeamItems } from './teamBuilder/item-recommendations.js';
import { OptimizePhase } from './teamBuilder/optimize-phase.js';
import { bindPoolControls } from './teamBuilder/page/pool-events.js';
import {
  bindProgressionControls,
} from './teamBuilder/page/progression-events.js';
import { showDonorBox } from './teamBuilder/page/patches.js';
import { createRailSpy } from './teamBuilder/page/rail-spy.js';
import { createOptimizeRun } from './teamBuilder/page/run.js';
import {
  loadSavedDonors,
  loadSavedPool,
  loadSavedTeamSort,
  saveDonors,
  savePool,
} from './teamBuilder/page/saved-inputs.js';
import {
  bindGamestateChips,
  bindTeamControls,
} from './teamBuilder/page/team-events.js';
import {
  captureTextFocus,
  restoreTextFocus,
} from './teamBuilder/page/text-focus.js';
import {
  absorbPoolIntoDonors,
  getPoolStats,
} from './teamBuilder/pool-parsing.js';
import { createTeamBuilderSetDetailsLoader } from './teamBuilder/set-details-loader.js';
import {
  renderTeamBuilderPage,
  teamSortOf,
} from './teamBuilder/team-builder-view.js';
import { bindPersistentDetails } from './utils/details-state.js';

/**
 * The page as its parts see it: the root element, the state the view
 * renders from, the loaded data, and the operations that belong to no one
 * panel. `run` is the optimize run (teamBuilder/page/run.js).
 * @typedef {{
 *   app: !Element,
 *   state: !Object,
 *   data: {availability: ?Object, formatsIndex: !Array<!Object>,
 *       pokemonIndex: !Array<!Object>},
 *   setDetails: !Object,
 *   run: !Object,
 *   render: function(): ?Object,
 *   writeUrl: function(),
 *   absorbPool: function(),
 *   recomputeItemRecommendations: function(),
 * }}
 */
export let TeamBuilderPage;

/**
 * @param {!Element} container
 * @param {{embedded: (boolean|undefined), family: (string|undefined)}=}
 *     options `embedded` suppresses the widget's own URL query-param writes.
 * @return {{destroy: function()}} `destroy` retires the page: call it
 *     before the container is emptied or replaced. The page owns a run,
 *     timers and a scroll listener, which otherwise outlive its DOM.
 */
export function mountPoolOptimizer(container, options = {}) {
  const app = container;
  const embedded = Boolean(options.embedded);
  // The family decides the game, and the game decides whose saved pool and
  // progression load: init() waits for it before reading either (embedded,
  // main.js has already activated it; standalone, the widget does).
  const initialFamily =
    options.family || getParam('family') || getActiveGame().families[0];
  const gameReady = activateGameForFamily(initialFamily);

  const data = { availability: null, formatsIndex: [], pokemonIndex: [] };
  const savedSort = loadSavedTeamSort();

  const state = {
    family: initialFamily,
    // Filled by init() once the family's game is active.
    query: '',
    // The donor box: owned, never fielded, kept for move transfers.
    donorQuery: '',
    progression: loadSavedProgression(),
    // Default sort is the score the seats were actually chosen by — Lead % is
    // a ladder stat, informative but not the seating order.
    teamSort: teamSortOf(getParam('teamSort') || savedSort.sort),
    teamSortDir: getParam('teamSortDir') || savedSort.direction || 'desc',
    result: null,
    resultProgressionKey: '',
    // The evolution items the result's lines can spend
    // (evolutionItemsAbove): the owned items the result depends on.
    resultEvolutionItemIds: new Set(),
    // Where the current run is (optimize-phase.js). The view switches on it.
    phase: OptimizePhase.IDLE,
    statusMessage: '',
    availabilityText: '',
    teamItemUsage: null,
    teamItemContext: null,
    itemRecommendations: {},
    confidence: null,
    investment: null,
    // Why the analysis step was skipped, set with the analysis-skipped phase.
    postAnalysisSkipReason: null,
  };

  const setDetails = createTeamBuilderSetDetailsLoader({
    getFamily: () => state.family,
    onUpdate: () => render(),
  });

  /** @type {!TeamBuilderPage} */
  const page = {
    app,
    state,
    data,
    setDetails,
    run: null,
    render,
    writeUrl,
    absorbPool,
    recomputeItemRecommendations,
  };
  page.run = createOptimizeRun(page);
  const railSpy = createRailSpy(app);
  bindGamestateChips(app);
  let destroyed = false;

  init().catch((error) => {
    console.error(error);
    app.innerHTML = `
      <section class="panel">
        <h2>Team Builder</h2>
        <p>Something broke while loading the team builder.</p>
        <pre>${escapeHtml(error.message)}</pre>
      </section>
    `;
  });

  async function init() {
    applyGameTheme(await gameReady);
    state.query = loadSavedPool();
    state.donorQuery = loadSavedDonors();
    state.progression = loadSavedProgression();
    // Manifest FIRST: loading it sets the data-version tag, so every fetch
    // below carries ?v=<dataSignature> and can't be served from a previous
    // deploy's CDN cache. Also the debug footer's provenance.
    state.manifest = await loadManifest();
    [data.formatsIndex, data.availability, data.pokemonIndex] =
      await Promise.all([
        loadFormatsIndex(),
        loadAvailability(),
        loadPokemonIndex(),
      ]);
    // A family the usage data does not have (a stale link) falls back to
    // the active game's default; the game itself did not change above.
    if (!data.availability?.familyConfigs?.[state.family]) {
      state.family = getActiveGame().families[0];
    }
    if (destroyed) return;

    if (state.query.trim()) {
      savePool(state.query);
      absorbPool();
      render();
      void page.run.optimize({ exhaustive: false, background: true });
    } else {
      render();
    }
  }

  // The one full render. It rebuilds the page's DOM, which resets the
  // viewport to wherever the new layout lands and drops the focused
  // control, so the scroll and the text box in use are put back: most
  // renders are ones the player did not ask for (the analysis landing, a
  // debounced re-optimize).
  function render() {
    if (destroyed) return null;
    state.resultProgressionStale = page.run.isResultStale();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const focused = captureTextFocus(app);

    const handle = renderTeamBuilderPage({
      app,
      baseUrl: import.meta.env.BASE_URL || '/',
      embedded,
      families: listFamilies(data.availability),
      familyLabel:
        data.availability?.familyConfigs?.[state.family]?.label ||
        state.family,
      formatsIndex: data.formatsIndex,
      pokemonIndex: data.pokemonIndex,
      poolStats: getPoolStats(state.query, data.pokemonIndex),
      donorStats: getPoolStats(state.donorQuery, data.pokemonIndex),
      setDetails,
      state,
    });

    bindPersistentDetails(app);
    bindTeamControls(page);
    bindPoolControls(page);
    bindProgressionControls(page);
    railSpy.wire();
    restoreTextFocus(app, focused);
    window.scrollTo(scrollX, scrollY);
    return handle;
  }

  // Every Pokémon in the pool joins the donor box, which only ever grows:
  // the box is everything the player has listed, the pool its fieldable
  // subset. The box is updated in place, so the pool box the player is
  // editing keeps its focus.
  function absorbPool() {
    const absorbed = absorbPoolIntoDonors(
      state.donorQuery, state.query, data.pokemonIndex);
    if (absorbed === state.donorQuery) return;
    state.donorQuery = absorbed;
    saveDonors(absorbed);
    showDonorBox(page);
  }

  function recomputeItemRecommendations() {
    if (!state.teamItemUsage || !state.result?.team?.length) {
      state.itemRecommendations = {};
      return;
    }
    state.itemRecommendations = assignTeamItems({
      team: state.result.team,
      usageByMember: state.teamItemUsage,
      ownedItems: state.progression.ownedItems,
      itemContext: state.teamItemContext,
      progression: state.progression,
    });
  }

  function writeUrl() {
    if (embedded) return;
    const params = new URLSearchParams();
    params.set('family', state.family);
    params.set('teamSort', state.teamSort);
    params.set('teamSortDir', state.teamSortDir);
    window.history.replaceState(
      null,
      '',
      `${window.location.pathname}?${params.toString()}`,
    );
  }

  function destroy() {
    destroyed = true;
    page.run.dispose();
    setDetails.cancel();
    railSpy.stop();
  }

  return { destroy };
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
