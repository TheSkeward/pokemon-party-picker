/**
 * @fileoverview Keeps the text box a player is working in across a render.
 * A render rebuilds the page's DOM and drops the focused control; renders
 * the player did not ask for (the analysis landing, a debounced
 * re-optimize) hand the box back with its selection, so a name dragged
 * over in the pool stays selected.
 */

/**
 * The focused text control's place and selection, by id.
 * @typedef {{id: string, value: string, start: ?number, end: ?number,
 *     direction: ?string, scrollTop: number}}
 */
export let TextFocus;

/**
 * @param {!Element} root
 * @return {?TextFocus} Null when focus is outside the root or not in a
 *     text control with an id.
 */
export function captureTextFocus(root) {
  const active = document.activeElement;
  if (!active || !active.id || !root.contains(active)) return null;
  if (active.tagName !== 'TEXTAREA' && active.tagName !== 'INPUT') return null;
  return {
    id: active.id,
    value: active.value,
    start: active.selectionStart,
    end: active.selectionEnd,
    direction: active.selectionDirection,
    scrollTop: active.scrollTop,
  };
}

/**
 * Where a selection sits once the control's text may have changed. The
 * rebuilt control usually carries the same text; when the render rewrote
 * it (a normalize reorders the pool), the selected words are found where
 * they now sit.
 * @param {!TextFocus} focused
 * @param {string} value The control's text after the render.
 * @return {?{start: number, end: number}} Null when the selection cannot
 *     be placed, which is better than guessing.
 */
export function selectionAfterRender(focused, value) {
  if (focused.start == null) return null;
  if (value === focused.value) {
    return { start: focused.start, end: focused.end };
  }
  const selected = focused.value.slice(focused.start, focused.end);
  const at = selected ? value.indexOf(selected) : -1;
  return at < 0 ? null : { start: at, end: at + selected.length };
}

/**
 * @param {!Element} root
 * @param {?TextFocus} focused As captured before the render.
 */
export function restoreTextFocus(root, focused) {
  if (!focused) return;
  const element = root.querySelector(`#${CSS.escape(focused.id)}`);
  if (!element) return;
  element.focus({ preventScroll: true });
  if (typeof element.setSelectionRange !== 'function') return;
  const selection = selectionAfterRender(focused, element.value);
  if (!selection) return;
  try {
    element.setSelectionRange(
      selection.start, selection.end, focused.direction || 'none');
  } catch {
    // Some input types carry no selection; focus alone is enough there.
  }
  element.scrollTop = focused.scrollTop;
}
