/**
 * @fileoverview The controls on and around the recommended team: the
 * gamestate chips, the table's sort, rows and locks, the bench chips, and
 * the buttons under the analysis.
 */
import { setPoolEntryLock } from '../pool-parsing.js';
import { buildPerformanceReport } from '../telemetry.js';
import { setPoolStatus } from './patches.js';
import { saveTeamSort } from './saved-inputs.js';

// How long a set card stays marked after "moves" jumps to it.
const JUMP_MARK_MS = 1800;

/**
 * A gamestate chip opens, and scrolls to, the control that changes what it
 * shows: one beside Optimize, the collapsed progression panel, or one of
 * its groups. Bound once to the page root, because light progression edits
 * replace the strip in place without a render.
 * @param {!Element} app
 */
export function bindGamestateChips(app) {
  app.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-open-progression]');
    if (!chip || !app.contains(chip)) return;
    const targetId = chip.dataset.openProgression;
    const control = targetId
      ? app.querySelector(`[data-chip-target="${targetId}"]`)
      : null;
    if (control) {
      control.scrollIntoView({ behavior: 'smooth', block: 'center' });
      control.focus({ preventScroll: true });
      return;
    }
    const wrapper = app.querySelector(
      'details[data-details-id="progression-panel"]',
    );
    const target = targetId
      ? app.querySelector(`details[data-details-id="${targetId}"]`)
      : null;
    if (wrapper && (!target || wrapper.contains(target))) wrapper.open = true;
    if (target) target.open = true;
    (target || wrapper)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/**
 * Binds the team's controls as rendered. Call after each render.
 * @param {!Object} page The page (pool-widget.js).
 */
export function bindTeamControls(page) {
  const { app, state, data, setDetails, run } = page;

  // "moves ↓" on a row or a rail pick jumps to that pick's set card; the
  // row's own click keeps opening its usage set.
  app.querySelectorAll('[data-jump-set-card]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const card =
        app.querySelector(`[data-set-card="${button.dataset.jumpSetCard}"]`) ||
        app.querySelector('#reborn-team-analysis-root');
      if (!card) return;
      // Three cards share a row, so the scroll alone does not say which.
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
      card.classList.add('is-jump-target');
      setTimeout(() => card.classList.remove('is-jump-target'), JUMP_MARK_MS);
    });
  });

  app.querySelectorAll('[data-team-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      const sort = button.dataset.teamSort;
      if (state.teamSort === sort) {
        state.teamSortDir = state.teamSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        state.teamSort = sort;
        // Names read A to Z first; figures, best first.
        state.teamSortDir = sort === 'current' ? 'asc' : 'desc';
      }
      saveTeamSort(state.teamSort, state.teamSortDir);
      page.writeUrl();
      page.render();
    });
  });

  // A lock lives in the pool text, so it survives saves, exports and the
  // address like any other entry: locking rewrites the text in canonical
  // form, as Optimize does, and optimizes again.
  const setLock = (name, locked) => {
    state.query = setPoolEntryLock(
      state.query, name, locked, data.pokemonIndex);
    void run.optimize();
  };
  app.querySelectorAll('[data-lock-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      setLock(
        button.dataset.lockToggle, button.dataset.lockState !== 'locked');
    });
  });
  app.querySelectorAll('[data-lock-input]').forEach((chip) => {
    chip.addEventListener('click', () => setLock(chip.dataset.lockInput, true));
  });

  app.querySelectorAll('[data-pool-set-id]').forEach((row) => {
    row.addEventListener('click', () => setDetails.select(row.dataset.poolSetId));
  });

  app
    .querySelector('#compute-post-analysis-button')
    ?.addEventListener('click', run.analyzeDeferred);

  app
    .querySelector('#copy-perf-report-button')
    ?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(
          JSON.stringify(buildPerformanceReport(), null, 2));
        setPoolStatus(page, 'Performance report copied to clipboard');
      } catch {
        setPoolStatus(page, 'Clipboard copy failed');
      }
    });
}
