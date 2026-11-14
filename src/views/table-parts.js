/**
 * @fileoverview What the Usage Data tables share: the definition the page,
 * the state and the URL work from, so none of them names a table, and the
 * search box, sortable header and row sort each table renders with.
 */
import { escapeAttr, escapeHtml, sortAttr } from '../utils/html.js';

/**
 * One Usage Data table. `sorters` holds a low-first comparator per sortable
 * column, keyed by the column's field. `descSortFields` are the columns a
 * first click sorts high-first. `blank` says, per column, which rows have
 * nothing in it; those sort last in either direction, so reversing a sort
 * never leads with the empty rows. `tieBreak` orders rows a column leaves
 * equal.
 * @typedef {{
 *   id: string,
 *   label: string,
 *   sorters: !Object<string, function(!Object, !Object): number>,
 *   descSortFields: !Set<string>,
 *   defaultSort: {sortBy: string, sortDir: string},
 *   blank: (!Object<string, function(!Object): boolean>|undefined),
 *   tieBreak: (function(!Object, !Object): number|undefined),
 * }}
 */
let UsageTable;

/**
 * A table's search text and sort, as the app state holds them per table.
 * @typedef {{search: string, sortBy: string, sortDir: string}}
 */
let TableState;

/**
 * @param {!UsageTable} table
 * @return {!TableState} No search, the table's own sort.
 */
export function defaultTableState(table) {
  return { search: '', ...table.defaultSort };
}

/**
 * @param {!UsageTable} table
 * @param {!TableState} tableState
 * @param {string} field The column whose header was clicked.
 * @return {{sortBy: string, sortDir: string}} The sorted column reversed,
 *     or another column in its first direction.
 */
export function nextSort(table, tableState, field) {
  if (tableState.sortBy === field) {
    return {
      sortBy: field,
      sortDir: tableState.sortDir === 'asc' ? 'desc' : 'asc',
    };
  }
  return {
    sortBy: field,
    sortDir: table.descSortFields.has(field) ? 'desc' : 'asc',
  };
}

/**
 * @param {!Array<!Object>} rows
 * @param {!UsageTable} table
 * @param {{sortBy: (string|undefined), sortDir: (string|undefined)}=} sort
 *     A missing or unknown column or direction is the table's default.
 * @return {!Array<!Object>} A sorted copy.
 */
export function sortRows(rows, table, sort = {}) {
  const sortBy = Object.hasOwn(table.sorters, sort.sortBy)
    ? sort.sortBy
    : table.defaultSort.sortBy;
  const sortDir = sort.sortDir || table.defaultSort.sortDir;
  const sorter = table.sorters[sortBy];
  const direction = sortDir === 'desc' ? -1 : 1;
  const isBlank = table.blank?.[sortBy] || (() => false);
  const tieBreak = table.tieBreak || (() => 0);
  return [...rows].sort((a, b) =>
    isBlank(a) - isBlank(b) || sorter(a, b) * direction || tieBreak(a, b));
}

/**
 * @param {!TableState} tableState
 * @param {string} placeholder Example searches.
 * @return {string} The search box, as a toolbar label.
 */
export function renderSearchField(tableState, placeholder) {
  return `<label><span>Search</span><input id="search-input" type="search" value="${escapeAttr(tableState.search)}" placeholder="${escapeAttr(placeholder)}" /></label>`;
}

/**
 * @param {!Array<!Array<string>>} columns One [field, label] pair per
 *     column, in order, with the cells' class as a third entry where the
 *     column has one ("num" for a column of figures). A table's rows
 *     give the same class to the same cell.
 * @param {!TableState} tableState
 * @return {string} The header row, each cell a sort button with the sorted
 *     column's arrow.
 */
export function renderHeaderRow(columns, tableState) {
  const cells = columns.map(([field, label, cellClass]) => {
    const isActive = tableState.sortBy === field;
    const arrow = !isActive ? '' : tableState.sortDir === 'asc' ? ' ↑' : ' ↓';
    const classAttr = cellClass ? ` class="${cellClass}"` : '';
    return `<th${classAttr}${sortAttr(isActive, tableState.sortDir)}><button class="sort-button ${isActive ? 'active' : ''}" data-sort-by="${escapeAttr(field)}">${escapeHtml(label)}${arrow}</button></th>`;
  });
  return `<tr>${cells.join('')}</tr>`;
}

/**
 * @param {?number} badge A badge count; 0 is the start of the game.
 * @return {string} "start", "badge 5", or '' for null.
 */
export function badgePhrase(badge) {
  if (badge == null) return '';
  return badge === 0 ? 'start' : `badge ${badge}`;
}
