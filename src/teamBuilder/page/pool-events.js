/**
 * @fileoverview The controls of the pool panel: the pool and donor boxes,
 * Optimize, and the buttons that copy, export, import and clear.
 */
import {
  loadSavedProgression,
  saveProgression,
} from '../../playthrough/progression';
import { buildPoolAvailabilityText } from '../availability-export';
import {
  buildGamestateExport,
  parseGamestateImport,
} from '../gamestate-backup.js';
import { withPoolAnnotations } from '../input-groups';
import { withDonors } from '../pool-parsing';
import { setPoolStatus } from './patches.js';
import { clearSavedPool, saveDonors, savePool } from './saved-inputs.js';

// The pool or the donor box changed under the result: it, and the list
// generated from it, answer for text that is gone. Returns whether a run
// was interrupted.
function dropResult(page, saved) {
  const { state, run, setDetails } = page;
  const interrupted = run.discardResult();
  state.availabilityText = '';
  setDetails.cancel();
  state.statusMessage = saved
    ? 'Saved locally'
    : 'Not saved locally; browser storage is full.';
  return interrupted;
}

async function copyText(page, text, copied) {
  try {
    await navigator.clipboard.writeText(text);
    setPoolStatus(page, copied);
  } catch {
    setPoolStatus(page, 'Clipboard copy failed');
  }
}

async function copyPool(page) {
  const { state } = page;
  const text = state.query.trim();
  if (!text) {
    state.statusMessage = 'Nothing to copy';
  } else {
    try {
      await navigator.clipboard.writeText(text);
      state.statusMessage = 'Copied pool to clipboard';
    } catch {
      state.statusMessage = 'Clipboard copy failed';
    }
  }
  page.render();
}

async function generateAvailabilityList(page) {
  const { state, data } = page;
  if (!state.result?.lines?.length) {
    state.statusMessage =
      'Optimize the team first so your pool is resolved, then generate the list.';
    page.render();
    return;
  }
  setPoolStatus(page, 'Generating availability list…');
  try {
    const poolQuery = withDonors(state.query, state.donorQuery);
    const text = await buildPoolAvailabilityText({
      lines: state.result.lines,
      pokemonIndex: data.pokemonIndex,
      poolQuery,
      progression: withPoolAnnotations(
        state.progression, poolQuery, data.pokemonIndex),
    });
    state.availabilityText = text;
    let copied = true;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      copied = false;
    }
    state.statusMessage = copied
      ? 'Availability list copied to clipboard'
      : 'Availability list ready below';
    page.render();
  } catch (error) {
    setPoolStatus(page, `Could not generate list: ${error?.message || error}`);
  }
}

async function importGamestate(page, file) {
  const { state, run } = page;
  let imported;
  try {
    imported = parseGamestateImport(await file.text());
  } catch (error) {
    setPoolStatus(page, `Import failed: ${error.message}`);
    return;
  }
  if (
    state.query.trim() &&
    !window.confirm(
      'Replace the current pool and progression with the imported gamestate?',
    )
  ) {
    return;
  }
  state.query = imported.pool;
  savePool(state.query);
  state.donorQuery = imported.donors || '';
  saveDonors(state.donorQuery);
  page.absorbPool();
  // Through the normal save and load, so the imported progression gets the
  // same normalization (migrations, count clamps, unknown fields dropped)
  // as any other stored one.
  saveProgression(imported.progression);
  state.progression = loadSavedProgression();
  run.discardResult();
  page.render();
  setPoolStatus(page, 'Gamestate imported. Optimizing…');
  void run.optimize({ exhaustive: false, background: true });
}

/**
 * Binds the pool panel's controls as rendered. Call after each render.
 * @param {!Object} page The page (pool-widget.js).
 */
export function bindPoolControls(page) {
  const { app, state, run } = page;
  const on = (selector, type, handler) =>
    app.querySelector(selector)?.addEventListener(type, handler);

  // Standalone page only: another family may be another game, with its own
  // saved pool and progression, so the page starts over from the address.
  on('#family-input', 'change', (event) => {
    state.family = event.target.value;
    page.writeUrl();
    window.location.reload();
  });

  on('#pool-query-input', 'input', (event) => {
    state.query = event.target.value;
    const interrupted = dropResult(page, savePool(state.query));
    page.writeUrl();
    // An interrupted run's progress panel comes down; the box keeps its
    // focus and selection through the render.
    if (interrupted) page.render();
    setPoolStatus(page, state.statusMessage);
  });

  // The pool's entries join the donor box when the edit is committed
  // (blur), not on every keystroke, so a half-typed name never lands.
  on('#pool-query-input', 'change', page.absorbPool);

  // Donors change what the pool can breed or Sketch.
  on('#donor-query-input', 'input', (event) => {
    state.donorQuery = event.target.value;
    const interrupted = dropResult(page, saveDonors(state.donorQuery));
    if (interrupted) page.render();
    setPoolStatus(page, state.statusMessage);
  });

  on('#optimize-button', 'click', () => run.optimize());
  on('#copy-pool-button', 'click', () => copyPool(page));

  // To the clipboard like the pool and availability copies: the player
  // pastes it wherever the backup lives.
  on('#export-gamestate-button', 'click', () => copyText(
    page,
    buildGamestateExport({
      query: state.query,
      donorQuery: state.donorQuery,
      progression: state.progression,
    }),
    'Gamestate copied to clipboard',
  ));
  on('#import-gamestate-button', 'click', () => {
    app.querySelector('#import-gamestate-input')?.click();
  });
  on('#import-gamestate-input', 'change', (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void importGamestate(page, file);
  });

  on('#generate-availability-button', 'click', () => {
    void generateAvailabilityList(page);
  });
  on('#copy-availability-button', 'click', () => copyText(
    page, state.availabilityText || '',
    'Availability list copied to clipboard'));
  on('#close-availability-button', 'click', () => {
    state.availabilityText = '';
    page.render();
  });

  on('#clear-pool-button', 'click', () => {
    if (!window.confirm(
      'Clear the saved owned Pokémon pool from this browser?')) {
      return;
    }
    // The donor box is the whole box and outlives the pool: clearing the
    // pool empties the fieldable subset only.
    state.query = '';
    run.discardResult();
    state.statusMessage = 'Saved pool cleared';
    page.setDetails.cancel();
    clearSavedPool();
    page.writeUrl();
    page.render();
  });
}
