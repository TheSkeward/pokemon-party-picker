// How the parallel team search treats its workers
// (src/teamBuilder/parallel-search.js), on workers faked in-process: a
// pool of one is still used, and a failed job costs the pool one rebuild
// before it is given up on. Both were found by review: a two-core device
// spawned one worker and then searched on the page's own thread, and one
// timeout (a laptop asleep mid-search) ended parallel search for the tab.
import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.__ENV__ ??= { BASE_URL: '/' };
const {
  PARALLEL_THRESHOLD,
  parallelFullSearch,
  setSearchWorkerPoolFactory,
} = await import('../src/teamBuilder/parallel-search.js');

// A Web-Worker-shaped object that answers each job on the next tick: with
// the winner given, or with an error when there is none.
function fakeWorker(winner, received = []) {
  const listeners = new Set();
  return {
    received,
    terminated: false,
    addEventListener(type, fn) {
      if (type === 'message') listeners.add(fn);
    },
    removeEventListener(type, fn) {
      listeners.delete(fn);
    },
    postMessage(job) {
      received.push(job);
      setTimeout(() => {
        const data = winner
          ? { id: job.id, ok: true, result: { top: [winner] } }
          : { id: job.id, ok: false, error: 'fake failure' };
        for (const fn of [...listeners]) fn({ data });
      }, 0);
    },
    terminate() {
      this.terminated = true;
    },
  };
}

const search = () => parallelFullSearch([], 6, {}, PARALLEL_THRESHOLD, 1);
const WINNER = { score: 7, identityKey: 'a|b' };

test('a pool of one worker takes the whole search', async () => {
  const received = [];
  setSearchWorkerPoolFactory(() => [fakeWorker(WINNER, received)]);
  const result = await search();
  assert.deepEqual(result, { top: [WINNER] });
  assert.equal(received.length, 1);
  assert.equal(received[0].start, 0);
  assert.equal(received[0].end, PARALLEL_THRESHOLD);
});

test('a search under the threshold never reaches a worker', async () => {
  const received = [];
  setSearchWorkerPoolFactory(() => [fakeWorker(WINNER, received)]);
  await parallelFullSearch([], 6, {}, PARALLEL_THRESHOLD - 1, 1);
  assert.equal(received.length, 0);
});

test('a failed job rebuilds the pool once; a second in a row retires it', async () => {
  const pools = [];
  let healthy = false;
  setSearchWorkerPoolFactory(() => {
    const pool = [fakeWorker(healthy ? WINNER : null)];
    pools.push(pool);
    return pool;
  });

  // The job fails: its result comes from the fallback, the workers are
  // ended, and the next job gets a new pool.
  await search();
  assert.equal(pools.length, 1);
  assert.equal(pools[0][0].terminated, true);
  await search();
  assert.equal(pools.length, 2, 'the pool was rebuilt for the second job');

  // Two failures in a row: no third pool.
  await search();
  assert.equal(pools.length, 2, 'the pool is retired for the session');

  // A success in between clears the count.
  pools.length = 0;
  setSearchWorkerPoolFactory(() => {
    const pool = [fakeWorker(healthy ? WINNER : null)];
    pools.push(pool);
    return pool;
  });
  await search();
  healthy = true;
  assert.deepEqual(await search(), { top: [WINNER] });
  healthy = false;
  // The healthy pool is still up; its worker now fails once.
  pools[1][0].postMessage = () => {
    throw new Error('worker gone');
  };
  await search();
  await search();
  assert.equal(pools.length, 3, 'one failure after a success still rebuilds');
});
