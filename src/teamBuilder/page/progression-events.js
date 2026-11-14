/**
 * @fileoverview The controls of the progression panel and the badge
 * picker: unlocks, TM and tutor boxes, held items and opponent bias.
 *
 * Every edit is saved at once. Whether it then renders or patches is each
 * control's own: a render rebuilds the page, which moves the viewport and
 * drops focus, so the controls a player works through in bursts (boxes,
 * sliders) patch the page in place and leave the render to the re-optimize
 * their edits schedule.
 */
import { dex } from '../../games/dex.js';
import { gameItems, getExpectedItemChanges } from '../../games/items.js';
import { getActiveGame } from '../../games/registry.js';
import { getCheckpoint } from '../../games/schedule.js';
import {
  MAX_TRACKED_ITEM_COUNT,
  applyCheckpoint,
  clearOwnedItems,
  clearSavedProgression,
  loadSavedProgression,
  saveProgression,
  setOpponentTypeBias,
  setOwnedItemCount,
  setOwnedItemCounts,
  setProgressionOptions,
  updateProgressionField,
  updateProgressionOption,
} from '../../playthrough/progression';
import { toId } from '../../utils/ids.js';
import {
  recountOptionGroup,
  refreshGamestateStrip,
  refreshLegalMovesPanel,
  refreshTeamAnalysisPanel,
  setProgressionStatus,
  showStaleness,
  syncOptionCheckboxes,
} from './patches.js';
import { BATCH_EDIT_REOPTIMIZE_DELAY_MS } from './run.js';

const optionIds = (button) =>
  String(button.dataset.progressionOptionIds || '').split(',').filter(Boolean);

// Stores an edited progression and says so under the panel. Returns
// whether the edit left the team stale.
function commit(page, progression) {
  page.state.progression = progression;
  const saved = saveProgression(progression);
  const stale = page.run.isResultStale();
  setProgressionStatus(
    page,
    !saved
      ? 'Progression could not be saved locally; browser storage is full.'
      : stale
        ? 'Progression saved locally. Re-optimizing after edits settle…'
        : 'Progression saved locally',
  );
  return stale;
}

// The tail of every held-item edit, one change or a sync of many: save,
// render, and re-optimize on the long debounce, since a shop haul is a
// burst of edits that should cost one recompute.
function finishItemsEdit(page, message, { refocusAdd, flashItemId } = {}) {
  const { app, state, run } = page;
  const saved = saveProgression(state.progression);
  state.statusMessage = saved
    ? 'Saved locally'
    : 'Held items could not be saved locally; browser storage is full.';
  page.recomputeItemRecommendations();
  const stale = run.isResultStale();
  page.render();
  if (message || stale) {
    setProgressionStatus(
      page,
      [message, stale ? 'Re-optimizing after edits settle…' : null]
        .filter(Boolean)
        .join(' '),
    );
  }
  // The render replaced the page: the search box gets its focus back so
  // adds can chain, and the touched row is flashed and scrolled to, so it
  // can be found in the alphabetical list.
  if (refocusAdd) app.querySelector('[data-item-add-input]')?.focus();
  if (flashItemId) {
    const row = app
      .querySelector(`[data-owned-item-count][data-item-id="${flashItemId}"]`)
      ?.closest('.item-inventory-row');
    if (row) {
      row.classList.add('item-row-flash');
      row.scrollIntoView({ block: 'nearest' });
    }
  }
  run.scheduleReoptimize(stale, BATCH_EDIT_REOPTIMIZE_DELAY_MS);
}

function setItemCount(page, itemId, count, options) {
  page.state.progression =
    setOwnedItemCount(page.state.progression, itemId, count);
  finishItemsEdit(page, null, options);
}

// The add button and Enter in the search box: the item is added at the
// picker's count (six by default, since most tracked items are shop
// stock), on top of what is held, and focus returns to the search box so a
// shop haul chains type, Enter, type, Enter.
function addItemFromSearch(page) {
  const { app, state } = page;
  const itemId = toId(app.querySelector('[data-item-add-input]')?.value || '');
  const known = dex().heldItemsById[itemId] ||
    gameItems().extraInventoryItems.some((item) => item.id === itemId);
  if (!itemId || !known) {
    setProgressionStatus(
      page, 'Item not recognized; pick one from the suggestions.');
    return;
  }
  if (gameItems().hiddenInventoryItemIds.has(itemId)) {
    setProgressionStatus(
      page, 'That item is replaced in this game; use its replacement instead.');
    return;
  }
  const picked = Number.parseInt(
    app.querySelector('[data-item-add-count]')?.value, 10,
  ) || MAX_TRACKED_ITEM_COUNT;
  const held = state.progression.ownedItems?.[itemId] || 0;
  setItemCount(
    page, itemId, Math.min(MAX_TRACKED_ITEM_COUNT, held + picked),
    { refocusAdd: true, flashItemId: itemId });
}

function bindItemControls(page) {
  const { app, state } = page;
  const on = (selector, type, handler) =>
    app.querySelector(selector)?.addEventListener(type, handler);

  on('[data-item-add-button]', 'click', () => addItemFromSearch(page));
  on('[data-item-add-input]', 'keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addItemFromSearch(page);
  });

  on('[data-expected-sync-button]', 'click', () => {
    const badges = getCheckpoint(state.progression.checkpoint)?.badges ?? null;
    const changes =
      getExpectedItemChanges(badges, state.progression.ownedItems || {});
    if (!changes.length) return;
    state.progression = setOwnedItemCounts(
      state.progression,
      Object.fromEntries(changes.map((item) => [item.id, item.count])),
    );
    finishItemsEdit(
      page,
      `Set ${changes.length} item${changes.length === 1 ? '' : 's'} to the expected count.`,
    );
  });

  on('[data-owned-items-clear-button]', 'click', () => {
    const tracked = Object.keys(state.progression.ownedItems || {}).length;
    if (
      !tracked ||
      !window.confirm(`Remove all ${tracked} held items from the list?`)
    ) {
      return;
    }
    state.progression = clearOwnedItems(state.progression);
    finishItemsEdit(page, `Removed ${tracked} held items.`);
  });

  app.querySelectorAll('[data-owned-item-count]').forEach((control) => {
    control.addEventListener('change', () => {
      setItemCount(page, control.dataset.itemId, control.value);
    });
  });
  app.querySelectorAll('[data-owned-item-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      setItemCount(page, button.dataset.itemId, 0);
    });
  });
}

function bindOptionControls(page) {
  const { app, state, run } = page;

  app.querySelectorAll('[data-progression-option-list]').forEach((control) => {
    control.addEventListener('change', () => {
      const field = control.dataset.progressionOptionList;
      const stale = commit(page, updateProgressionOption(
        state.progression, field, control.value, control.checked));
      // No render: the clicked box is already right, and a rebuild both
      // moves the viewport and makes a burst of ticks feel slow. The other
      // renderings of the option and the group's count are patched.
      syncOptionCheckboxes(page, field, control.value, control.checked);
      recountOptionGroup(page, field);
      // With no result there is no re-optimize to bring the next render
      // (and no team table above for it to move).
      if (!state.result) page.render();
      run.scheduleReoptimize(stale, BATCH_EDIT_REOPTIMIZE_DELAY_MS);
    });
  });

  app.querySelectorAll('[data-progression-subgroup-all]').forEach((button) => {
    button.addEventListener('click', () => {
      const field = button.dataset.progressionSubgroupAll;
      const ids = optionIds(button);
      if (!ids.length) return;
      // Added to the selection, where the group's "Select all" replaces
      // it: finding one tutor must not unteach every other.
      const stale = commit(page, setProgressionOptions(
        state.progression, field,
        [...new Set([...(state.progression[field] || []), ...ids])]));
      page.render();
      run.scheduleReoptimize(stale, BATCH_EDIT_REOPTIMIZE_DELAY_MS);
    });
  });

  app.querySelectorAll('[data-progression-option-bulk]').forEach((button) => {
    button.addEventListener('click', () => {
      const selecting = button.dataset.progressionOptionAction === 'select';
      const stale = commit(page, setProgressionOptions(
        state.progression,
        button.dataset.progressionOptionBulk,
        selecting ? optionIds(button) : []));
      page.render();
      run.scheduleReoptimize(stale);
    });
  });
}

/**
 * Binds the progression controls as rendered. Call after each render.
 * @param {!Object} page The page (pool-widget.js).
 */
export function bindProgressionControls(page) {
  const { app, state, run } = page;

  app.querySelectorAll('[data-progression-field]').forEach((control) => {
    const isBox = control.type === 'checkbox';
    control.addEventListener(isBox ? 'change' : 'input', () => {
      const stale = commit(page, updateProgressionField(
        state.progression,
        control.dataset.progressionField,
        isBox ? control.checked : control.value));
      refreshLegalMovesPanel(page);
      refreshTeamAnalysisPanel(page);
      showStaleness(page, stale);
      refreshGamestateStrip(page);
      run.scheduleReoptimize(stale);
    });
  });

  app.querySelector('[data-progression-checkpoint]')?.addEventListener(
    'change',
    (event) => {
      const stale =
        commit(page, applyCheckpoint(state.progression, event.target.value));
      // A render: the cap note, the "obtainable now" marks and the
      // gamestate strip all follow the badge count.
      page.render();
      run.scheduleReoptimize(stale);
    },
  );

  bindOptionControls(page);
  bindItemControls(page);

  app.querySelectorAll('[data-bias-type]').forEach((control) => {
    // The readout follows the drag without a render, which would drop the
    // slider; the value is committed on release.
    control.addEventListener('input', () => {
      const readout = app.querySelector(
        `[data-bias-value="${control.dataset.biasType}"]`);
      if (readout) readout.textContent = control.value;
    });
    control.addEventListener('change', () => {
      const stale = commit(page, setOpponentTypeBias(
        state.progression, control.dataset.biasType, control.value));
      // Bias only moves the optimization, so the team is flagged stale and
      // nothing else changes.
      showStaleness(page, stale);
      refreshGamestateStrip(page);
      run.scheduleReoptimize(stale);
    });
  });

  app
    .querySelector('#clear-progression-button')
    ?.addEventListener('click', () => {
      if (!window.confirm(
        `Clear saved ${getActiveGame().shortLabel} progression from this browser?`,
      )) {
        return;
      }
      clearSavedProgression();
      state.progression = loadSavedProgression();
      page.render();
    });
}
