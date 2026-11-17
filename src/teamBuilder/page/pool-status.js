/**
 * @fileoverview The pool's status line: the one place the page says what
 * it has just done. While a run is on, the run's caption has the line
 * (progress-bar.js), with one exception: an answer to a button the player
 * pressed takes it for long enough to be read. A copy that worked or an
 * import that was refused would otherwise pass unseen under the caption
 * and be replaced by the run's closing word.
 *
 * What the page reports unasked is a note, not an answer: that an edit was
 * saved, or how a run ended. A note never takes the line from a caption,
 * so a run started straight after an edit shows its progress at once.
 *
 * `statusMessage` and `statusNotice` in the page's state belong to this
 * module. The view draws the line from them (team-builder-view.js
 * renderPoolStatus), so a render made while an answer has the line keeps
 * it there; between renders the line is updated in place.
 */

// How long an answer has the line: the time to read it, by its length,
// between a floor that lets a short one be noticed and a ceiling that
// gives the run its caption back.
const READ_MS_PER_CHARACTER = 60;
const MIN_NOTICE_MS = 4000;
const MAX_NOTICE_MS = 8000;

/**
 * @param {string} message
 * @return {number} Milliseconds an answer reading `message` has the line.
 */
export function noticeMs(message) {
  return Math.min(
    MAX_NOTICE_MS,
    Math.max(MIN_NOTICE_MS, message.length * READ_MS_PER_CHARACTER),
  );
}

/**
 * @param {!Object} page The page (pool-widget.js).
 * @return {{say: function(?string), note: function(?string),
 *     dispose: function()}} `say` puts an answer to the player on the
 *     line, where it stays until something else is said and is seen even
 *     over a run's caption while it is new. `note` leaves a note, which
 *     waits for an answer still being read.
 */
export function createPoolStatus(page) {
  const { app, state } = page;
  let timer = null;
  // The latest note left while an answer had the line.
  let waiting = null;

  // The nodes are found at each paint, since a render replaces them.
  function paint() {
    const text = app.querySelector('[data-pool-status]');
    if (text) text.textContent = state.statusMessage;
    app.querySelector('.pool-status')
      ?.toggleAttribute('data-notice', state.statusNotice);
  }

  function lapse() {
    timer = null;
    state.statusNotice = false;
    if (waiting !== null) state.statusMessage = waiting;
    waiting = null;
    paint();
  }

  function say(message) {
    const text = message || '';
    clearTimeout(timer);
    // The last thing said has the line: a note that was waiting may be
    // about a result the player has since moved on from.
    waiting = null;
    state.statusMessage = text;
    state.statusNotice = Boolean(text);
    timer = text ? setTimeout(lapse, noticeMs(text)) : null;
    paint();
  }

  function note(message) {
    if (state.statusNotice) {
      waiting = message || '';
      return;
    }
    state.statusMessage = message || '';
    paint();
  }

  function dispose() {
    clearTimeout(timer);
    timer = null;
  }

  return { say, note, dispose };
}
