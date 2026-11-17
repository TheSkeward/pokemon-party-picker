import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPoolStatus,
  noticeMs,
} from '../src/teamBuilder/page/pool-status.js';

// A page with the two nodes the status line is painted on. `render`
// replaces them, as the page's render does.
function fakePage() {
  const page = {
    state: { statusMessage: '', statusNotice: false },
    app: {
      querySelector(selector) {
        return selector === '.pool-status' ? page.line : page.text;
      },
    },
    render() {
      page.text = { textContent: page.state.statusMessage };
      page.line = {
        notice: page.state.statusNotice,
        toggleAttribute(name, on) {
          assert.equal(name, 'data-notice');
          this.notice = on;
        },
      };
    },
  };
  page.render();
  return page;
}

function setup(t) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const page = fakePage();
  return { page, status: createPoolStatus(page) };
}

const SHORT = 'Copied pool to clipboard';

test('an answer has the line for the time it takes to read', () => {
  assert.equal(noticeMs(SHORT), 4000);
  assert.equal(noticeMs('x'.repeat(100)), 6000);
  assert.equal(noticeMs('x'.repeat(500)), 8000);
});

test('an answer is marked as one until it has been read, and stays', (t) => {
  const { page, status } = setup(t);
  status.say(SHORT);
  assert.equal(page.text.textContent, SHORT);
  assert.equal(page.line.notice, true);
  assert.equal(page.state.statusNotice, true);

  t.mock.timers.tick(noticeMs(SHORT) - 1);
  assert.equal(page.line.notice, true);
  t.mock.timers.tick(1);
  assert.equal(page.line.notice, false);
  assert.equal(page.state.statusNotice, false);
  assert.equal(page.text.textContent, SHORT);
});

test('a second answer starts its own time', (t) => {
  const { page, status } = setup(t);
  status.say(SHORT);
  t.mock.timers.tick(3000);
  status.say('Clipboard copy failed');
  t.mock.timers.tick(3000);
  assert.equal(page.line.notice, true);
  t.mock.timers.tick(1000);
  assert.equal(page.line.notice, false);
});

test('a note takes an idle line without being an answer', (t) => {
  const { page, status } = setup(t);
  status.note('Optimized 6 picks from 12 resolved inputs.');
  assert.equal(
    page.text.textContent, 'Optimized 6 picks from 12 resolved inputs.');
  assert.equal(page.line.notice, false);
});

test('a note waits for an answer still being read', (t) => {
  const { page, status } = setup(t);
  status.say(SHORT);
  status.note('Optimized 6 picks from 12 resolved inputs.');
  assert.equal(page.text.textContent, SHORT);
  assert.equal(page.line.notice, true);

  t.mock.timers.tick(noticeMs(SHORT));
  assert.equal(
    page.text.textContent, 'Optimized 6 picks from 12 resolved inputs.');
  assert.equal(page.line.notice, false);
});

test('the last thing said outlives a note that was waiting', (t) => {
  const { page, status } = setup(t);
  status.say(SHORT);
  status.note('Optimized 6 picks from 12 resolved inputs.');
  status.say('Saved pool cleared');
  t.mock.timers.tick(noticeMs('Saved pool cleared'));
  assert.equal(page.text.textContent, 'Saved pool cleared');
  assert.equal(page.state.statusMessage, 'Saved pool cleared');
});

test('a later note takes the place of one that was waiting', (t) => {
  const { page, status } = setup(t);
  status.say(SHORT);
  // A run's summary, then an edit that drops the result it describes.
  status.note('Optimized 6 picks from 12 resolved inputs.');
  status.note('Saved locally');
  t.mock.timers.tick(noticeMs(SHORT));
  assert.equal(page.text.textContent, 'Saved locally');
});

test('a saved edit is a note, and one that was not saved is said', (t) => {
  const { page, status } = setup(t);
  status.reportSave(true, 'Not saved locally; browser storage is full.');
  assert.equal(page.text.textContent, 'Saved locally');
  assert.equal(page.line.notice, false);

  status.reportSave(false, 'Not saved locally; browser storage is full.');
  assert.equal(
    page.text.textContent, 'Not saved locally; browser storage is full.');
  assert.equal(page.line.notice, true);
});

test('a render in the middle keeps the answer and its mark', (t) => {
  const { page, status } = setup(t);
  status.say(SHORT);
  page.render();
  assert.equal(page.text.textContent, SHORT);
  assert.equal(page.line.notice, true);

  // The time runs out on the nodes the render made.
  t.mock.timers.tick(noticeMs(SHORT));
  assert.equal(page.line.notice, false);
});

test('saying nothing clears the line and marks nothing', (t) => {
  const { page, status } = setup(t);
  status.say(SHORT);
  status.say('');
  assert.equal(page.text.textContent, '');
  assert.equal(page.line.notice, false);
});

test('a retired status line leaves the page alone', (t) => {
  const { page, status } = setup(t);
  status.say(SHORT);
  status.dispose();
  t.mock.timers.tick(noticeMs(SHORT));
  assert.equal(page.state.statusNotice, true);
});
