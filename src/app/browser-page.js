import {
  describeDatasetMonths,
  getAggregateRows,
  getDatasetLabel,
  getMovesetEntry,
} from '../data';
import { currentAttr, escapeAttr, escapeHtml } from '../utils/html.js';
import {
  ITEM_USAGE_TABLE,
  renderItemUsageControls,
  renderItemUsageTable,
} from '../views/item-usage-view';
import {
  MOVE_USAGE_TABLE,
  renderMoveUsageControls,
  renderMoveUsageTable,
} from '../views/move-usage-view';
import { renderMovesetPanel } from '../views/moveset-view';
import {
  POKEMON_USAGE_TABLE,
  renderPokemonUsageControls,
  renderPokemonUsageTable,
} from '../views/pokemon-usage-view';
import { USAGE_TABLES } from '../views/usage-tables';

const TABLE_RENDERERS = {
  [POKEMON_USAGE_TABLE.id]: renderPokemonTable,
  [MOVE_USAGE_TABLE.id]: renderMoveTable,
  [ITEM_USAGE_TABLE.id]: renderItemTable,
};

/**
 * Renders the Usage Data page into `pageRoot`, replacing its contents: a
 * tab per usage table, then the open table with its controls.
 * @param {!Element} pageRoot
 * @param {{browserMovesetData: ?Object, dataset: !Object,
 *     familyLabel: string, familyTable: ?Object,
 *     formatsIndex: !Array<!Object>, state: !Object}} context `familyTable`
 *     is the open table's per-family data, null when it has none or the
 *     table reads the format's `dataset` instead.
 */
export function renderBrowserPage(pageRoot, context) {
  const { state } = context;
  const tabs = USAGE_TABLES.map((table) =>
    `<button class="view-tab ${table.id === state.usageTable ? 'active' : ''}"${currentAttr(table.id === state.usageTable)} data-usage-table="${escapeAttr(table.id)}">${escapeHtml(table.label)}</button>`);

  pageRoot.innerHTML = `
    <nav class="view-tabs usage-table-tabs" aria-label="Usage table">
      ${tabs.join('\n      ')}
    </nav>
    <section id="controls-root"></section>
    <section id="content-root"></section>
    <section id="details-root"></section>
  `;

  TABLE_RENDERERS[state.usageTable](
    document.querySelector('#controls-root'),
    document.querySelector('#content-root'),
    context,
  );
}

// The Pokémon table and its moveset panel aggregate every month the
// format's data holds.
function renderPokemonTable(controlsRoot, contentRoot, context) {
  const { browserMovesetData, dataset, formatsIndex, state } = context;

  const rows = getAggregateRows(dataset);
  const browserSelectedRow =
    rows.find((row) => row.pokemonId === state.selectedPokemon) || null;
  const browserMovesetEntry = getMovesetEntry(
    browserMovesetData,
    state.selectedPokemon,
  );
  const span = describeDatasetMonths(dataset);

  renderPokemonUsageControls(controlsRoot, state, formatsIndex);

  renderPokemonUsageTable(contentRoot, rows, state, {
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

function renderMoveTable(controlsRoot, contentRoot, context) {
  const { familyLabel, familyTable, state } = context;

  renderMoveUsageControls(controlsRoot, state);
  renderMoveUsageTable(contentRoot, familyTable, state, { familyLabel });
}

function renderItemTable(controlsRoot, contentRoot, context) {
  const { familyLabel, familyTable, state } = context;

  renderItemUsageControls(controlsRoot, state);
  renderItemUsageTable(contentRoot, familyTable, state, { familyLabel });
}
