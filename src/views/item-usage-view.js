import { escapeAttr, escapeHtml } from '../utils/html.js';
import { dex } from '../games/dex.js';
import { FULL_SUPPLY } from '../games/item-sources.js';
import { getItemSources, getItemSupply } from '../games/items.js';
import {
  badgePhrase,
  renderHeaderRow,
  renderSearchField,
  sortRows,
} from './table-parts.js';

// The badge an item's supply starts at; an item with none sorts past every
// badge.
const obtainedOrder = (row) =>
  row.supply[0]?.badge ?? Number.MAX_SAFE_INTEGER;

// How each kind of restocking source (games/item-sources.js) reads in a
// cell, and what a search for it matches.
const RESTOCK_WORDS = {
  shop: 'shop',
  wild: 'wild',
  pickup: 'Pickup',
  regrow: 'regrows',
  gift: 'gift',
};

// The word for the source that restocks an item, '' if its supply reaches
// none: a supply can also fill by count.
const restockWordOf = (row) => {
  const last = row.supply.at(-1);
  return (last?.copies === Infinity && RESTOCK_WORDS[last.source.kind]) || '';
};

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
  blank: { obtained: (row) => !row.supply.length },
  tieBreak: (a, b) => b.carry - a.carry || a.name.localeCompare(b.name),
};

const COLUMNS = [
  ['name', 'Item'],
  ['obtained', 'Obtained'],
  ['carry', 'On all sets'],
  ['top', 'Top item for'],
];

/**
 * `supply` is how the active game's stock of the item grows
 * (games/items.js), empty when nothing counts; `uncounted` says the game
 * does list sources, all of them single copies of a consumable.
 * @typedef {{id: string, name: string, supply: !Array<!Object>,
 *     uncounted: boolean, carry: number, top: number}}
 */
let ItemUsageRow;

/**
 * @param {?{items: !Object<string, !Object>}} table A family's item usage
 *     table (scripts/build-item-usage.mjs).
 * @return {!Array<!ItemUsageRow>} One row per item, named and given its
 *     supply from the active game's data. An item that game's catalog does
 *     not know keeps its id.
 */
export function buildItemUsageRows(table) {
  const names = dex().heldItemsById;
  return Object.entries(table?.items || {}).map(([id, entry]) => {
    const supply = getItemSupply(id);
    return {
      id,
      name: names[id]?.name || id,
      supply,
      uncounted: !supply.length && getItemSources(id).length > 0,
      carry: entry.carry || 0,
      top: entry.top || 0,
    };
  });
}

/**
 * @param {!Array<!ItemUsageRow>} rows
 * @param {{search: (string|undefined), sortBy: (string|undefined),
 *     sortDir: (string|undefined)}=} options The search text matches an
 *     item's name anywhere, or the start of the word for the source that
 *     restocks it ("shop", "wild", "pickup").
 * @return {!Array<!ItemUsageRow>} The rows that match the search, sorted.
 */
export function selectItemUsageRows(rows, { search = '', sortBy, sortDir } = {}) {
  const query = search.trim().toLowerCase();
  const matches = rows.filter((row) =>
    !query ||
    row.name.toLowerCase().includes(query) ||
    (query && restockWordOf(row).toLowerCase().startsWith(query)));
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
        ${renderSearchField(state.tables[ITEM_USAGE_TABLE.id], 'Leftovers, Berry, Shop, Wild')}
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
        <p>Obtained counts the copies this game hands out, by the badge each turns up after, until there are six or a source restocks the item: a shop or prize counter, a wild holder, Pickup, a berry plot or a gift that repeats. A mined item counts what the rocks reached so far yield on average. An item a battle uses up is listed only from a source that restocks it. Blank means the game's item data tracks no source.</p>
      </div></div>
      <div class="table-wrap"><table class="usage-table item-usage-table static-rows"><thead>${renderHeaderRow(COLUMNS, tableState)}</thead><tbody>
        ${rows.map(renderRow).join('')}
      </tbody></table></div>
    </section>`;
}

function renderRow(row) {
  return `<tr><td>${escapeHtml(row.name)}</td><td>${renderSupply(row)}</td><td>${row.carry.toFixed(2)}%</td><td>${row.top}</td></tr>`;
}

function renderSupply(row) {
  if (row.uncounted) return '<span class="muted">single copies only</span>';
  return row.supply.map(renderStep).join(', ');
}

// "badge 13 ×1" for a copy, "badge 17 shop" for the source that restocks,
// "badge 8 ×6+" for a supply that fills by count, a bare "badge 11" where
// the copies are not audited. The item data's words
// for the source are the tooltip: they run from "npc" to a list of routes.
function renderStep(step) {
  const note = stepNote(step);
  return `<span class="table-source" title="${escapeAttr(step.source.via)}">${badgePhrase(step.badge)}${note ? ` <span class="muted">${escapeHtml(note)}</span>` : ''}</span>`;
}

function stepNote({ copies, source }) {
  if (copies == null) return '';
  if (copies !== Infinity) return `×${copies}`;
  return RESTOCK_WORDS[source.kind] || `×${FULL_SUPPLY}+`;
}
