import { escapeHtml } from '../utils/html.js';
import { getAvailabilityLabel } from '../data.js';
import { describePrecomputedSetSource } from '../setDetails/precomputed-set-details.js';
import { renderMovesetPanel } from '../views/moveset-view.js';
import { renderResolverControls } from '../views/resolver-controls-view.js';
import { renderResolverResults } from '../views/resolver-results-view.js';

/**
 * Renders the Set Lookup page (controls, results table, set-detail panel)
 * into `pageRoot`, replacing its contents.
 * @param {!Element} pageRoot
 * @param {{availability: ?Object, formatsIndex: !Array<!Object>,
 *     resolverLoadingState: !Object, resolverResults: !Array<!Object>,
 *     setDetails: !Object, state: !Object}} context `setDetails` is a
 *     createPrecomputedSetDetailsLoader instance.
 */
export function renderResolverPage(pageRoot, context) {
  const {
    availability,
    formatsIndex,
    resolverLoadingState,
    resolverResults,
    setDetails,
    state,
    unmatchedNames = [],
  } = context;

  const resolverSelected =
    resolverResults.find(
      (row) => row.pokemonId === state.resolverSelectedPokemon,
    ) || null;
  const resolverMovesetDetail = setDetails.getDetail();

  pageRoot.innerHTML = `
    <section id="resolver-controls-root"></section>
    <section id="resolver-results-root"></section>
    <section id="details-root"></section>
  `;

  renderResolverControls(
    document.querySelector('#resolver-controls-root'),
    state,
  );

  renderResolverResults(
    document.querySelector('#resolver-results-root'),
    resolverResults,
    state,
    formatsIndex,
    getAvailabilityLabel(availability),
    { ...resolverLoadingState, unmatched: unmatchedNames },
  );

  const detailsRoot = document.querySelector('#details-root');

  renderMovesetPanel(detailsRoot, {
    selectedPokemonName: resolverSelected?.name || null,
    movesetEntry: resolverMovesetDetail,
    lookupLabel: resolverMovesetDetail
      ? describePrecomputedSetSource(resolverMovesetDetail)
      : '',
    aggregate: true,
    stitched: Boolean(resolverMovesetDetail?.stitched),
    status: setDetails.getStatus(),
  });

  if (setDetails.getMessage() && resolverSelected) {
    detailsRoot.insertAdjacentHTML(
      'afterbegin',
      `<section class="panel"><p class="muted">${escapeHtml(setDetails.getMessage())}</p></section>`,
    );
  }
}
