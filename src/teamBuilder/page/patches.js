/**
 * @fileoverview Updates to the Team Builder page that stop short of a
 * render. A render rebuilds the whole page, which moves the viewport and
 * drops the control in use; a ticked box, a dragged slider or a status
 * line changes the few nodes it touches instead, and the next full render
 * arrives with the re-optimize those edits schedule.
 *
 * Each takes the page (pool-widget.js) and reads the nodes at call time,
 * since a render replaces them.
 */
import { getCurrentSpeciesForChoice } from '../../playthrough/current-species.js';
import { renderLegalMovesPanel } from '../../playthrough/legal-moves-view';
import { getPoolStats, withDonors } from '../pool-parsing';
import { renderTeamAnalysisPanel } from '../team-analysis-view';
import {
  donorBoxLabel,
  getSortedTeam,
  renderGamestateStrip,
} from '../team-builder-view';
import { lineUsageByInputId } from '../usage-line-ranking.js';

const STALE_NOTE =
  'Progression changed; re-optimize for current scores and legal move notes.';

/** @param {!Object} page @param {?string} message */
export function setPoolStatus(page, message) {
  const node = page.app.querySelector('[data-pool-status]');
  if (node) node.textContent = message || '';
}

/** @param {!Object} page @param {?string} message */
export function setProgressionStatus(page, message) {
  const node = page.app.querySelector('[data-progression-status]');
  if (node) node.textContent = message || '';
}

/**
 * Rebuilds the gamestate strip's chips. Their clicks stay live because the
 * handler is delegated to the page root.
 * @param {!Object} page
 */
export function refreshGamestateStrip(page) {
  const strip = page.app.querySelector('.gamestate-strip');
  if (strip) strip.outerHTML = renderGamestateStrip(page.state.progression);
}

function teamChoiceForRow(page, rowNode) {
  const inputId = rowNode?.dataset.teamInputId;
  const pokemonId = rowNode?.dataset.teamPokemonId;
  if (!inputId || !pokemonId) return null;
  return (page.state.result?.team || []).find(
    (row) => row.inputPokemonId === inputId && row.pokemonId === pokemonId,
  ) || null;
}

/**
 * Shows or lifts the stale warning over the team, the rail's dimming, and
 * the note each row carries in its place.
 * @param {!Object} page
 * @param {boolean} stale
 */
export function showStaleness(page, stale) {
  const { app, state } = page;
  state.resultProgressionStale = stale;
  const warning = app.querySelector('[data-progression-stale-warning]');
  if (warning) warning.hidden = !stale;
  // A stale team is not the team: the rail's picks dim with the warning.
  app.querySelector('.team-rail')?.toggleAttribute('data-stale', stale);
  app.querySelectorAll('[data-team-note]').forEach((noteNode) => {
    const row = teamChoiceForRow(
      page, noteNode.closest('[data-team-pokemon-id]'));
    noteNode.textContent = stale ? STALE_NOTE : row?.note || '';
  });
}

/**
 * Re-renders the legal moves of the row the player has open, which follow
 * the progression.
 * @param {!Object} page
 */
export function refreshLegalMovesPanel(page) {
  const { app, state, data, setDetails } = page;
  const root = app.querySelector('[data-reborn-legal-moves-root]');
  const selectedId = setDetails.getSelectedPokemonId();
  const selected = selectedId
    ? (state.result?.team || []).find((row) => row.pokemonId === selectedId)
    : null;
  if (!root || !selected) return;
  renderLegalMovesPanel(root, {
    currentSpecies: getCurrentSpeciesForChoice(selected, state.progression),
    movesetEntry: setDetails.getDetail(),
    pokemonIndex: data.pokemonIndex,
    poolQuery: withDonors(state.query, state.donorQuery),
    pokemonId: selected.pokemonId,
    pokemonName: selected.name,
    progression: state.progression,
  });
}

/** @param {!Object} page */
export function refreshTeamAnalysisPanel(page) {
  const { app, state, data } = page;
  renderTeamAnalysisPanel(app.querySelector('#reborn-team-analysis-root'), {
    family: state.family,
    itemAssignments: state.itemRecommendations,
    lines: state.result?.lines || [],
    pokemonIndex: data.pokemonIndex,
    poolQuery: withDonors(state.query, state.donorQuery),
    progression: state.progression,
    team: getSortedTeam(
      state.result?.team || [],
      state.teamSort,
      state.teamSortDir,
      state.progression,
      lineUsageByInputId(state.result?.lines),
    ),
  });
}

/**
 * Writes the donor box's text and count into the page, leaving the pool
 * box the player is typing in alone.
 * @param {!Object} page
 */
export function showDonorBox(page) {
  const { app, state, data } = page;
  const box = app.querySelector('#donor-query-input');
  if (!box) return;
  box.value = state.donorQuery;
  const label = box.closest('label')?.querySelector('span');
  if (label) {
    label.textContent = donorBoxLabel(
      getPoolStats(state.donorQuery, data.pokemonIndex).uniqueCount,
    );
  }
}

const optionBoxes = (scope, field) => scope.querySelectorAll(
  `[data-progression-option-list="${CSS.escape(field)}"]`);

/**
 * Ticks or clears every rendering of one option (the obtainable rail
 * repeats rows of the main list) and its "obtainable now" highlight.
 * @param {!Object} page
 * @param {string} field
 * @param {string} value
 * @param {boolean} checked
 */
export function syncOptionCheckboxes(page, field, value, checked) {
  optionBoxes(page.app, field).forEach((box) => {
    if (box.value !== value) return;
    box.checked = checked;
    const label = box.closest('.progression-option');
    if (!label) return;
    label.classList.toggle(
      'option-obtainable',
      Boolean(label.dataset.optionBadgeOk) && !checked,
    );
  });
}

/**
 * Recounts a group's "N/M selected · K obtainable now" from the boxes on
 * the page, each option once however often it is rendered.
 * @param {!Object} page
 * @param {string} field
 */
export function recountOptionGroup(page, field) {
  const group = page.app.querySelector(
    `[data-progression-group="${CSS.escape(field)}"]`,
  );
  const counter = group?.querySelector('[data-progression-group-count]');
  if (!counter) return;
  const seen = new Set();
  const checked = new Set();
  const obtainable = new Set();
  optionBoxes(group, field).forEach((box) => {
    seen.add(box.value);
    if (box.checked) {
      checked.add(box.value);
    } else if (box.closest('.progression-option')?.dataset.optionBadgeOk) {
      obtainable.add(box.value);
    }
  });
  const total = Number.parseInt(counter.dataset.optionTotal, 10) || seen.size;
  counter.textContent = `${checked.size}/${total} selected${
    obtainable.size ? ` · ${obtainable.size} obtainable now` : ''
  }`;
}
