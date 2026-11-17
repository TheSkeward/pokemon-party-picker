/**
 * @fileoverview The controls of the pool panel: the pool and donor boxes,
 * Optimize, and the buttons that copy, export, import and clear.
 */
import {
  loadSavedProgression,
  saveProgression,
} from '../../playthrough/progression.js';
import { buildPoolAvailabilityText } from '../availability-export.js';
import {
  buildGamestateExport,
  parseGamestateImport,
} from '../gamestate-backup.js';
import { withPoolAnnotations } from '../input-groups.js';
import { withDonors } from '../pool-parsing.js';
import { showRunInterrupted } from './patches.js';
import { clearSavedPool, saveDonors, savePool } from './saved-inputs.js';

// The pool or the donor box changed under the result: it, and the list
// generated from it, answer for text that is gone. Reports whether the
// edit was saved, and returns whether a run was interrupted.
function dropResult(page, saved) {
  const { state, run, setDetails } = page;
  const interrupted = run.discardResult();
  state.availabilityText = '';
  setDetails.cancel();
  page.status.reportSave(
    saved, 'Not saved locally; browser storage is full.');
  return interrupted;
}

async function copyText(page, text, copied) {
  try {
    await navigator.clipboard.writeText(text);
    page.status.say(copied);
  } catch {
    page.status.say('Clipboard copy failed');
  }
}

function copyPool(page) {
  const text = page.state.query.trim();
  if (!text) {
    page.status.say('Nothing to copy');
    return;
  }
  void copyText(page, text, 'Copied pool to clipboard');
}

async function generateAvailabilityList(page) {
  const { state, data } = page;
  if (!state.result?.lines?.length) {
    page.status.say(
      'Optimize the team first so your pool is resolved, then generate the list.');
    return;
  }
  page.status.say('Generating availability list…');
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
    page.status.say(copied
      ? 'Availability list copied to clipboard'
      : 'Availability list ready below');
    page.render();
  } catch (error) {
    page.status.say(`Could not generate list: ${error?.message || error}`);
  }
}

async function importGamestate(page) {
  const { state, run } = page;
  // Read before anything else is asked: the browser allows the read on the
  // strength of the click, and a dialog in between can spend that.
  let text;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    // The clipboard is the only way in, so the status says how to open it.
    page.status.say(
      'Import failed: the browser did not let this page read the ' +
      'clipboard. Allow clipboard access for this site, then import again.');
    return;
  }
  if (!text.trim()) {
    page.status.say(
      'Import failed: the clipboard holds no text. Copy a gamestate ' +
      'export, then import again.');
    return;
  }
  let imported;
  try {
    imported = parseGamestateImport(text);
  } catch (error) {
    page.status.say(`Import from the clipboard failed: ${error.message}`);
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
  page.status.say('Gamestate imported. Optimizing…');
  page.render();
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
    // An interrupted run's progress clears in place: no render, so the box
    // keeps its focus and nothing on the page moves.
    if (interrupted) showRunInterrupted(page);
  });

  // The pool's entries join the donor box when the edit is committed
  // (blur), not on every keystroke, so a half-typed name never lands.
  on('#pool-query-input', 'change', page.absorbPool);

  // Donors change what the pool can breed or Sketch.
  on('#donor-query-input', 'input', (event) => {
    state.donorQuery = event.target.value;
    const interrupted = dropResult(page, saveDonors(state.donorQuery));
    if (interrupted) showRunInterrupted(page);
  });

  on('#optimize-button', 'click', () => run.optimize());
  on('#copy-pool-button', 'click', () => copyPool(page));

  // To the clipboard like the pool and availability copies, and back from
  // it: the player pastes the backup wherever it lives and copies it from
  // there to restore it.
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
    void importGamestate(page);
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
    page.status.say('Saved pool cleared');
    page.setDetails.cancel();
    clearSavedPool();
    page.writeUrl();
    page.render();
  });
}
