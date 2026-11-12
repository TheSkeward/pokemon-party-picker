import { escapeAttr, escapeHtml } from '../utils/html.js';
import { teachingRoutesByMove } from '../games/legality.js';
import {
  badgeStyle,
  getCategoryColor,
  getMoveMetaById,
  getTypeColor,
} from '../move-meta';

/**
 * The learner floors the page offers. A move few Pokémon learn reports a few
 * Pokémon's habit: a signature move shows nothing but its one owner's sets.
 * @const {!Array<number>}
 */
export const MIN_LEARNER_CHOICES = [1, 5, 10, 20, 50];

// The badge a move's first route opens after; a route with no badge sorts
// past every badge.
const taughtOrder = (row) =>
  row.taught[0]?.badge ?? Number.MAX_SAFE_INTEGER;

const SORTERS = {
  name: (a, b) => a.name.localeCompare(b.name),
  type: (a, b) => a.type.localeCompare(b.type),
  category: (a, b) => a.category.localeCompare(b.category),
  taught: (a, b) => taughtOrder(a) - taughtOrder(b),
  prior: (a, b) => a.prior - b.prior,
  learners: (a, b) => a.learners - b.learners,
  carry: (a, b) => a.carry - b.carry,
};

// Columns a row may leave empty. An empty row goes last in either
// direction, so reversing the sort never leads with the blanks.
const IS_BLANK = {
  taught: (row) => !row.taught.length,
};

/** @const {!Array<string>} The columns the table sorts by. */
export const MOVE_SORT_FIELDS = Object.keys(SORTERS);

/**
 * `taught` holds the machines and tutors that teach the move in the active
 * game (games/legality.js), earliest first, one of each kind.
 * @typedef {{id: string, name: string, type: string, category: string,
 *     taught: !Array<!Object>, prior: number, learners: number,
 *     carry: number}}
 */
let MoveUsageRow;

// The earliest route of each kind, so a move two tutors teach names the
// first. The routes arrive earliest first.
function firstOfEachKind(routes) {
  return routes.filter((route, index) =>
    routes.findIndex((other) => other.kind === route.kind) === index);
}

/**
 * @param {?{moves: !Object<string, !Object>}} table A family's move usage
 *     table (scripts/build-move-prior.mjs).
 * @return {!Array<!MoveUsageRow>} One row per move, named, typed and given
 *     its teaching routes from the active game's data. A move that game
 *     does not know keeps its id.
 */
export function buildMoveUsageRows(table) {
  const routes = teachingRoutesByMove();
  return Object.entries(table?.moves || {}).map(([id, entry]) => {
    const meta = getMoveMetaById(id);
    return {
      id,
      name: meta?.name || id,
      type: meta?.type || '',
      category: meta?.category || '',
      taught: firstOfEachKind(routes.get(id) || []),
      prior: entry.prior || 0,
      learners: entry.learners || 0,
      carry: entry.carry || 0,
    };
  });
}

/**
 * @param {!Array<!MoveUsageRow>} rows
 * @param {{search: (string|undefined), sortBy: (string|undefined),
 *     sortDir: (string|undefined), minLearners: (number|undefined)}=} options
 *     The search text matches a move's name anywhere, or the start of its
 *     type, its category or a route's label ("tm", "tutor").
 * @return {!Array<!MoveUsageRow>} The rows at or above the learner floor
 *     that match the search, sorted. Equal values put the move more Pokémon
 *     learn first, then go by name.
 */
export function selectMoveUsageRows(rows, {
  search = '',
  sortBy = 'prior',
  sortDir = 'desc',
  minLearners = 1,
} = {}) {
  const query = search.trim().toLowerCase();
  const sorter = SORTERS[sortBy] || SORTERS.prior;
  const direction = sortDir === 'asc' ? 1 : -1;
  const isBlank = IS_BLANK[sortBy] || (() => false);
  return rows
    .filter((row) => row.learners >= minLearners)
    .filter((row) =>
      !query ||
      row.name.toLowerCase().includes(query) ||
      row.type.toLowerCase().startsWith(query) ||
      row.category.toLowerCase().startsWith(query) ||
      row.taught.some((route) => route.label.toLowerCase().startsWith(query)))
    .sort((a, b) =>
      isBlank(a) - isBlank(b) ||
      sorter(a, b) * direction ||
      b.learners - a.learners ||
      a.name.localeCompare(b.name));
}

/**
 * Search and learner-floor toolbar for the Move Usage page.
 * @param {!Element} container
 * @param {!Object} state
 */
export function renderMoveUsageControls(container, state) {
  container.innerHTML = `
    <section class="panel">
      <div class="toolbar">
        <label><span>Search</span><input id="move-search-input" type="search" value="${escapeHtml(state.moveSearch)}" placeholder="Rapid Spin, Fairy, Status, TM" /></label>
        <label><span>Learners at least</span><select id="move-min-learners-select">
          ${MIN_LEARNER_CHOICES.map((count) => `<option value="${count}" ${count === state.moveMinLearners ? 'selected' : ''}>${count}</option>`).join('')}
        </select></label>
      </div>
    </section>`;
}

/**
 * Move usage table, filtered and sorted by the state's move fields.
 * @param {!Element} container
 * @param {?{pokemon: number, moves: !Object<string, !Object>}} table Null
 *     when the family has no table.
 * @param {!Object} state
 * @param {{familyLabel: (string|undefined)}=} options
 */
export function renderMoveUsageTable(container, table, state, options = {}) {
  if (!table) {
    container.innerHTML = `
      <section class="panel">
        <div class="panel-header"><div><h2>Move Usage</h2><p>No move usage data for ${escapeHtml(options.familyLabel || 'this game')}.</p></div></div>
      </section>`;
    return;
  }
  const rows = selectMoveUsageRows(buildMoveUsageRows(table), {
    search: state.moveSearch,
    sortBy: state.moveSortBy,
    sortDir: state.moveSortDir,
    minLearners: state.moveMinLearners,
  });
  container.innerHTML = `
    <section class="panel">
      <div class="panel-header"><div>
        <h2>Move Usage</h2>
        <p>${rows.length} moves shown, from the sets of ${table.pokemon} Pokémon in ${escapeHtml(options.familyLabel || 'this game')}.</p>
        <p>Run by learners is the share of a learner's sets that run the move, averaged over every Pokémon that can learn it, each counted equally. On all sets averages over every Pokémon, learner or not.</p>
        <p>Taught by names the machine or tutor that teaches the move in this game, and the badge it opens after.</p>
      </div></div>
      <table class="usage-table move-usage-table"><thead><tr>${renderHeaderCell('name', 'Move', state)}${renderHeaderCell('type', 'Type', state)}${renderHeaderCell('category', 'Category', state)}${renderHeaderCell('taught', 'Taught by', state)}${renderHeaderCell('prior', 'Run by learners', state)}${renderHeaderCell('learners', 'Learners', state)}${renderHeaderCell('carry', 'On all sets', state)}</tr></thead><tbody>
        ${rows.map(renderRow).join('')}
      </tbody></table>
    </section>`;
}

function renderRow(row) {
  return `<tr><td>${escapeHtml(row.name)}</td><td>${renderBadge(row.type, getTypeColor(row.type))}</td><td>${renderBadge(row.category, getCategoryColor(row.category))}</td><td>${row.taught.map(renderRoute).join(', ')}</td><td>${row.prior.toFixed(1)}%</td><td>${row.learners}</td><td>${row.carry.toFixed(2)}%</td></tr>`;
}

// "TM34 badge 5": the label, then when the route opens. The game's own
// wording and the place are the tooltip, since a sidequest rider or a shop
// does not fit the cell.
function renderRoute(route) {
  const when = badgePhrase(route.badge);
  const title = [route.available, route.location].filter(Boolean).join(' · ');
  return `<span class="move-route" title="${escapeAttr(title)}">${escapeHtml(route.label)}${when ? ` <span class="muted">${when}</span>` : ''}</span>`;
}

function badgePhrase(badge) {
  if (badge == null) return '';
  return badge === 0 ? 'start' : `badge ${badge}`;
}

function renderBadge(text, color) {
  if (!text) return '';
  return `<span class="move-badge" style="${badgeStyle(color)}">${escapeHtml(text)}</span>`;
}

function renderHeaderCell(field, label, state) {
  const isActive = state.moveSortBy === field;
  const arrow = !isActive ? '' : state.moveSortDir === 'asc' ? ' ↑' : ' ↓';
  return `<th><button class="sort-button ${isActive ? 'active' : ''}" data-move-sort-by="${field}">${label}${arrow}</button></th>`;
}
