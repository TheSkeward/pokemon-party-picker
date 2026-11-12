import { escapeAttr, escapeHtml } from '../utils/html.js';
import { dex } from '../games/dex.js';
import { getItemSource } from '../games/items.js';
import {
  badgePhrase,
  renderHeaderRow,
  renderSearchField,
  sortRows,
} from './table-parts.js';

// The badge an item first turns up after; an item the game does not track
// sorts past every badge.
const obtainedOrder = (row) => row.source?.badge ?? Number.MAX_SAFE_INTEGER;

/**
 * The Usage Data page's item table: a family's held items by the share of
 * sets that hold them. Equal values go by that share, then by name.
 * @const {!UsageTable}
 */
export const ITEM_USAGE_TABLE = {
  id: 'items',
  label: 'Items',
  sorters: {
    name: (a, b) => a.name.localeCompare(b.name),
    obtained: (a, b) => obtainedOrder(a) - obtainedOrder(b),
    carry: (a, b) => a.carry - b.carry,
    top: (a, b) => a.top - b.top,
  },
  descSortFields: new Set(['carry', 'top']),
  defaultSort: { sortBy: 'carry', sortDir: 'desc' },
  blank: { obtained: (row) => !row.source },
  tieBreak: (a, b) => b.carry - a.carry || a.name.localeCompare(b.name),
};

const COLUMNS = [
  ['name', 'Item'],
  ['obtained', 'Obtained'],
  ['carry', 'On all sets'],
  ['top', 'Top item for'],
];

/**
 * `source` is where the active game hands the item out (games/items.js),
 * null when the game tracks none.
 * @typedef {{id: string, name: string, source: ?Object, carry: number,
 *     top: number}}
 */
let ItemUsageRow;

/**
 * @param {?{items: !Object<string, !Object>}} table A family's item usage
 *     table (scripts/build-item-usage.mjs).
 * @return {!Array<!ItemUsageRow>} One row per item, named and given its
 *     source from the active game's data. An item that game's catalog does
 *     not know keeps its id.
 */
export function buildItemUsageRows(table) {
  const names = dex().heldItemsById;
  return Object.entries(table?.items || {}).map(([id, entry]) => ({
    id,
    name: names[id]?.name || id,
    source: getItemSource(id),
    carry: entry.carry || 0,
    top: entry.top || 0,
  }));
}

/**
 * @param {!Array<!ItemUsageRow>} rows
 * @param {{search: (string|undefined), sortBy: (string|undefined),
 *     sortDir: (string|undefined)}=} options The search text matches an
 *     item's name anywhere, or the start of its restocking source ("shop",
 *     "mining").
 * @return {!Array<!ItemUsageRow>} The rows that match the search, sorted.
 */
export function selectItemUsageRows(rows, { search = '', sortBy, sortDir } = {}) {
  const query = search.trim().toLowerCase();
  const matches = rows.filter((row) =>
    !query ||
    row.name.toLowerCase().includes(query) ||
    Boolean(row.source?.renewable?.kind.startsWith(query)));
  return sortRows(matches, ITEM_USAGE_TABLE, { sortBy, sortDir });
}

/**
 * Search toolbar for the item table.
 * @param {!Element} container
 * @param {!Object} state
 */
export function renderItemUsageControls(container, state) {
  container.innerHTML = `
    <section class="panel">
      <div class="toolbar">
        ${renderSearchField(state.tables[ITEM_USAGE_TABLE.id], 'Leftovers, Berry, Shop')}
      </div>
    </section>`;
}

/**
 * Item usage table, filtered and sorted by the table's state.
 * @param {!Element} container
 * @param {?{pokemon: number, items: !Object<string, !Object>}} table Null
 *     when the family has no table.
 * @param {!Object} state
 * @param {{familyLabel: (string|undefined)}=} options
 */
export function renderItemUsageTable(container, table, state, options = {}) {
  if (!table) {
    container.innerHTML = `
      <section class="panel">
        <div class="panel-header"><div><h2>Item Usage</h2><p>No item usage data for ${escapeHtml(options.familyLabel || 'this game')}.</p></div></div>
      </section>`;
    return;
  }
  const tableState = state.tables[ITEM_USAGE_TABLE.id];
  const rows = selectItemUsageRows(buildItemUsageRows(table), tableState);
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header"><div>
        <h2>Item Usage</h2>
        <p>${rows.length} items shown, from the sets of ${table.pokemon} Pokémon in ${escapeHtml(options.familyLabel || 'this game')}.</p>
        <p>On all sets is the share of a Pokémon's sets that hold the item, averaged over every Pokémon, each counted equally. Top item for counts the Pokémon that hold it more than any other item.</p>
        <p>Obtained names the badge the item is first available after in this game, then the shop or mining that restocks it. Blank means the game's item data does not track it.</p>
      </div></div>
      <table class="usage-table item-usage-table static-rows"><thead>${renderHeaderRow(COLUMNS, tableState)}</thead><tbody>
        ${rows.map(renderRow).join('')}
      </tbody></table>
    </section>`;
}

function renderRow(row) {
  return `<tr><td>${escapeHtml(row.name)}</td><td>${renderSource(row.source)}</td><td>${row.carry.toFixed(2)}%</td><td>${row.top}</td></tr>`;
}

// "badge 13 shop from 17": when the item first turns up, then what restocks
// it and, if that opens later, when. How it first turns up is the tooltip:
// the timeline's wording runs from "npc" to a list of routes.
function renderSource(source) {
  if (!source) return '';
  const restock = restockPhrase(source);
  const title = source.via ? `First source: ${source.via}` : '';
  return `<span class="table-source" title="${escapeAttr(title)}">${badgePhrase(source.badge)}${restock ? ` <span class="muted">${escapeHtml(restock)}</span>` : ''}</span>`;
}

function restockPhrase({ badge, renewable }) {
  if (!renewable) return '';
  return renewable.badge > badge
    ? `${renewable.kind} from ${renewable.badge}`
    : renewable.kind;
}
