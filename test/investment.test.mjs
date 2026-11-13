// The level caps the investment plan projects to
// (src/teamBuilder/investment.js). A progression with no cap has none
// ahead of it: read as zero, it sent the plan to re-optimize at the two
// lowest caps in the game and report who would "seat" there.
import assert from 'node:assert/strict';
import test from 'node:test';

await import('./helpers/harness.mjs'); // fetch → filesystem shim
const { nextLevelCaps } = await import('../src/teamBuilder/investment.js');
const { getCheckpoints } = await import('../src/games/schedule.js');

test('the next caps are the distinct caps above the current one', () => {
  const caps = [...new Set(getCheckpoints().map((c) => c.levelCap))];
  assert.deepEqual(nextLevelCaps(String(caps[2])), caps.slice(3, 5));
  // Past the last cap, and with no cap set, nothing lies ahead.
  assert.deepEqual(nextLevelCaps(String(caps.at(-1))), []);
  assert.deepEqual(nextLevelCaps(''), []);
  assert.deepEqual(nextLevelCaps(undefined), []);
});
