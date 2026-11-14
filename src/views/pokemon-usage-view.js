import { escapeAttr, escapeHtml } from '../utils/html.js';
import {
  renderHeaderRow,
  renderSearchField,
  sortRows,
} from './table-parts.js';

/**
 * The Usage Data page's Pokémon table: one format's usage rows.
 * @const {!UsageTable}
 */
export const POKEMON_USAGE_TABLE = {
  id: 'pokemon',
  label: 'Pokémon',
  sorters: {
    rank: (a, b) => a.rank - b.rank,
    name: (a, b) => a.name.localeCompare(b.name),
    usage: (a, b) => a.usage - b.usage,
    rawCount: (a, b) => a.rawCount - b.rawCount,
    leadTendency: (a, b) => (a.leadTendency || 0) - (b.leadTendency || 0),
  },
  descSortFields: new Set(['usage', 'rawCount', 'leadTendency']),
  defaultSort: { sortBy: 'rank', sortDir: 'asc' },
};

const COLUMNS = [
  ['rank', 'Rank', 'num'],
  ['name', 'Pokémon'],
  ['usage', 'Usage %', 'num'],
  ['leadTendency', 'Lead %', 'num'],
  ['rawCount', 'Raw Count', 'num'],
];

/**
 * Format and search toolbar for the Pokémon table.
 * @param {!Element} container
 * @param {!Object} state
 * @param {!Array<!Object>} formatsIndex
 */
export function renderPokemonUsageControls(container, state, formatsIndex) {
  const familyFormats = formatsIndex.filter(
    (format) => format.family === state.family,
  );
  container.innerHTML = `
    <section class="panel">
      <div class="toolbar">
        <label><span>Format</span><select id="format-select">
          ${familyFormats.map((format) => `<option value="${escapeAttr(format.id)}" ${format.id === state.format ? 'selected' : ''}>${escapeHtml(format.label)}</option>`).join('')}
        </select></label>
        ${renderSearchField(state.tables[POKEMON_USAGE_TABLE.id], 'Charizard, Butterfree')}
      </div>
    </section>`;
}

/**
 * Pokémon usage table, filtered and sorted by the table's state.
 * @param {!Element} container
 * @param {!Array<!Object>} rows
 * @param {!Object} state
 * @param {{selectionLabel: (string|undefined)}=} options The label of the
 *     months the rows aggregate.
 */
export function renderPokemonUsageTable(container, rows, state, options = {}) {
  const tableState = state.tables[POKEMON_USAGE_TABLE.id];
  const query = tableState.search.trim().toLowerCase();
  const shown = sortRows(
    rows.filter((row) => !query || row.name.toLowerCase().includes(query)),
    POKEMON_USAGE_TABLE,
    tableState,
  );
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header"><div><h2>Pokémon Usage</h2><p>${shown.length} Pokémon shown for ${escapeHtml(options.selectionLabel || 'all available months')}</p></div></div>
      <div class="table-wrap"><table class="usage-table usage-browser-table"><thead>${renderHeaderRow(COLUMNS, tableState)}</thead><tbody>
        ${shown.map((row) => `<tr data-pokemon-id="${escapeAttr(row.pokemonId)}" class="${row.pokemonId === state.selectedPokemon ? 'selected' : ''}"><td class="num rank">${row.rank}</td><td><button type="button" class="row-link" aria-pressed="${row.pokemonId === state.selectedPokemon}">${escapeHtml(row.name)}</button></td><td class="num">${row.usage.toFixed(2)}</td><td class="num">${(row.leadTendency || 0).toFixed(1)}</td><td class="num">${row.rawCount.toLocaleString()}</td></tr>`).join('')}
      </tbody></table></div>
    </section>`;
}
