/**
 * @fileoverview Keeps what the reader is looking at where it is while the
 * page changes above it.
 *
 * A render rebuilds the page's DOM. Putting the scroll offset back keeps
 * the top of the page still, which is the wrong thing to hold once the
 * reader has scrolled: a team that lands with taller or shorter cards moves
 * everything under it, and the panel being read slides away. So the page
 * notes a part in view, by a name the rebuilt page will carry too, and
 * scrolls that part back to where it sat in the window.
 *
 * The render is the smaller half of it. The sets fill in after the render
 * that made room for them, a few thousand pixels at a time, and the
 * browser's own scroll anchoring does not hold the view through that here.
 * So the keeper notes the view whenever it is scrolled and puts it back
 * whenever the page changes height, render or not.
 */

// The attributes that name a part of the page across renders. A value may
// belong to more than one element (a TM group is listed twice, once among
// the obtainable ones), so a part is known by its name and its place among
// the elements that share it.
const NAMING_ATTRIBUTES = [
  'id',
  'data-set-card',
  'data-details-id',
  'data-progression-group',
  'data-team-pokemon-id',
];
const NAMED = NAMING_ATTRIBUTES.map((name) => `[${name}]`).join(',');

/**
 * A part of the page and where its top edge sat in the window: its name,
 * how many elements share the name and which of them it is.
 * @typedef {{selector: string, index: number, count: number, top: number}}
 */
export let ViewAnchor;

function nameOf(root, node) {
  const attribute = NAMING_ATTRIBUTES.find((name) => node.hasAttribute(name));
  if (!attribute) return null;
  const selector =
    `[${attribute}="${CSS.escape(node.getAttribute(attribute))}"]`;
  const sharing = [...root.querySelectorAll(selector)];
  return { selector, index: sharing.indexOf(node), count: sharing.length };
}

/**
 * The named part nearest the top of the window: the first whose top edge
 * is in view, else the innermost one the window's top edge cuts through.
 * @param {!Element} root
 * @return {?Element}
 */
function partInView(root) {
  let below = null;
  let belowTop = Infinity;
  let around = null;
  let aroundTop = -Infinity;
  for (const node of root.querySelectorAll(NAMED)) {
    const rect = node.getBoundingClientRect();
    // Nothing is drawn for a part inside a closed panel.
    if (!rect.width && !rect.height) continue;
    if (rect.top >= 0 && rect.top < window.innerHeight) {
      if (rect.top < belowTop) {
        below = node;
        belowTop = rect.top;
      }
    } else if (rect.top < 0 && rect.bottom > 0 && rect.top > aroundTop) {
      around = node;
      aroundTop = rect.top;
    }
  }
  return below || around;
}

/**
 * What to hold still: the part in view, then each named part around it,
 * since a change may not bring the first back (a pick that left the team
 * is not in the new table, but the table is).
 * @param {!Element} root
 * @return {!Array<!ViewAnchor>} Innermost first; empty at the top of the
 *     page, which stays the top of the page.
 */
function captureViewAnchor(root) {
  if (window.scrollY <= 0) return [];
  const anchors = [];
  for (
    let node = partInView(root);
    node && node !== root && root.contains(node);
    node = node.parentElement?.closest(NAMED)
  ) {
    const name = nameOf(root, node);
    if (name) anchors.push({ ...name, top: node.getBoundingClientRect().top });
  }
  return anchors;
}

/**
 * Scrolls the first of the captured parts the page still has back to where
 * it sat. A name now shared by a different number of elements no longer
 * says which one was meant, so that part is passed over. With none of them
 * left the scroll stays as the caller set it.
 *
 * A part that has gone somewhere else in what holds it is not followed:
 * the card of a pick that left the team is now a screen or more away among
 * the bench's, and the reader was at the top of the sets, not on a journey
 * with that card. So a part is used only while it agrees with the part
 * around it to within a window's height.
 * @param {!Element} root
 * @param {!Array<!ViewAnchor>} anchors
 */
function restoreViewAnchor(root, anchors) {
  const shifts = [];
  for (const { selector, index, count, top } of anchors) {
    const sharing = root.querySelectorAll(selector);
    if (sharing.length !== count) continue;
    const rect = sharing[index].getBoundingClientRect();
    if (!rect.width && !rect.height) continue;
    shifts.push(rect.top - top);
  }
  const held = shifts.findIndex((shift, at) =>
    at === shifts.length - 1 ||
    Math.abs(shift - shifts[at + 1]) <= window.innerHeight);
  if (held < 0) return;
  const shift = Math.round(shifts[held]);
  if (shift) window.scrollBy(0, shift);
}

/**
 * @param {!Element} root The page.
 * @return {{note: function(), restore: function(), stop: function()}}
 *     `note` takes the view as it is if the reader has scrolled since it
 *     was last taken, and `restore` puts the noted view back, for a render
 *     to call around its rebuild; between renders the keeper does both by
 *     itself. `stop` retires its listeners.
 */
export function createViewKeeper(root) {
  let anchors = [];
  let frame = 0;
  // The scroll offset the noted view goes with. A scroll event that finds
  // the page still there was the keeper's own, or a render's.
  let notedScrollY = window.scrollY;

  // The noted view is the one last painted, and it stays the truth until
  // the reader scrolls. The page as it stands is not: something may have
  // grown since the last frame (the pool box taking a line as its names
  // are tidied), and reading the view now would take the shifted page for
  // what the reader chose.
  const note = () => {
    if (Math.abs(window.scrollY - notedScrollY) < 1) return;
    anchors = captureViewAnchor(root);
    notedScrollY = window.scrollY;
  };
  const restore = () => {
    restoreViewAnchor(root, anchors);
    notedScrollY = window.scrollY;
  };

  // The reader scrolled: what is in view now is what to hold. Read once
  // per frame however often the page scrolls. The keeper's own scrolls
  // leave the offset where it was noted, so they are not read back: their
  // event arrives a frame later, and by then the page may have changed
  // again under a view that was right.
  const onScroll = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      note();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });

  // The page grew or shrank somewhere: the sets filling in, a panel
  // opened, the window resized.
  const resized = new ResizeObserver(restore);
  resized.observe(root);

  const stop = () => {
    window.removeEventListener('scroll', onScroll);
    resized.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
  };

  return { note, restore, stop };
}
