import {
  describeDatasetMonths,
  getAggregateRows,
  getDatasetLabel,
  getMovesetEntry,
} from '../data';
import { renderControls } from '../views/controls-view';
import { renderMovesetPanel } from '../views/moveset-view';
import { renderTable } from '../views/table-view';

/**
 * Renders the Usage Data page (controls, usage table, moveset panel) into
 * `pageRoot`, replacing its contents. The table and the panel aggregate
 * every month the format's data holds.
 * @param {!Element} pageRoot
 * @param {{browserMovesetData: ?Object, dataset: !Object,
 *     formatsIndex: !Array<!Object>, state: !Object}} context
 */
export function renderBrowserPage(pageRoot, context) {
  const { browserMovesetData, dataset, formatsIndex, state } = context;

  const rows = getAggregateRows(dataset);
  const browserSelectedRow =
    rows.find((row) => row.pokemonId === state.selectedPokemon) || null;
  const browserMovesetEntry = getMovesetEntry(
    browserMovesetData,
    state.selectedPokemon,
  );
  const span = describeDatasetMonths(dataset);

  pageRoot.innerHTML = `
    <section id="controls-root"></section>
    <main id="content-root"></main>
    <section id="details-root"></section>
  `;

  renderControls(
    document.querySelector('#controls-root'),
    state,
    formatsIndex,
  );

  renderTable(document.querySelector('#content-root'), rows, state, {
    selectionLabel: getDatasetLabel(dataset),
  });

  renderMovesetPanel(document.querySelector('#details-root'), {
    selectedPokemonName:
      browserSelectedRow?.name || browserMovesetEntry?.name || null,
    movesetEntry: browserMovesetEntry,
    lookupLabel: span
      ? `all available months (${span})`
      : 'all available months',
    aggregate: true,
    stitched: false,
    status: null,
  });
}
