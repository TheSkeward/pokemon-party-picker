/**
 * @fileoverview What the last result put on the page stays there while a
 * run is on.
 *
 * A render rebuilds the page from its state, and during a run the state
 * has no result to show: an edit dropped it, or it is about to be
 * replaced. Rebuilt, the team, bench and sets would vanish and come back,
 * moving everything under them twice. So the view marks the parts a result
 * fills (`data-run-held`), and a render made during a run puts the nodes
 * already on screen back in their place instead of fresh ones: the same
 * nodes, with their listeners and whatever loaded into them, dimmed to say
 * they are the team from before.
 */

const HELD = '[data-run-held]';

// The team, bench and sets are not acted on while they are being replaced;
// the rail's picks and the footer stay live.
const INERT_WHILE_HELD = new Set(['results']);

function markUpdating(node, updating) {
  node.toggleAttribute('data-updating', updating);
  if (!INERT_WHILE_HELD.has(node.dataset.runHeld)) return;
  node.inert = updating;
  node.toggleAttribute('aria-busy', updating);
}

/**
 * The held parts now on the page, to be put back after the render that is
 * about to replace them.
 * @param {!Element} app
 * @return {?Map<string, !Element>} By name; null when the page has none.
 */
export function captureHeld(app) {
  const held = new Map();
  for (const node of app.querySelectorAll(HELD)) {
    held.set(node.dataset.runHeld, node);
  }
  return held.size ? held : null;
}

/**
 * Puts the captured parts back where the render left their empty
 * counterparts. Call it once the render's controls are bound, so the nodes
 * coming back are not bound a second time.
 * @param {!Element} app
 * @param {!Map<string, !Element>} held
 */
export function restoreHeld(app, held) {
  for (const fresh of app.querySelectorAll(HELD)) {
    const kept = held.get(fresh.dataset.runHeld);
    if (!kept) continue;
    fresh.replaceWith(kept);
    markUpdating(kept, true);
  }
}

/**
 * Lifts the hold where no render follows: a run an edit disowned leaves
 * the page as it stood before the run.
 * @param {!Element} app
 */
export function releaseHeld(app) {
  for (const node of app.querySelectorAll(HELD)) markUpdating(node, false);
}
