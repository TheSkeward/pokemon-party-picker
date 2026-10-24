import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPoolAvailabilityText } from '../src/teamBuilder/availability-export.js';
import { withDonors } from '../src/teamBuilder/pool-parsing.js';
import { loadShared, runPool } from './helpers/harness.mjs';

const pool = ['Buneary'];
const donorPool = ['Glameow'];
const baseProgression = {
  checkpoint: 'badge-2',
  levelCap: '35',
  moveRelearnerUnlocked: false,
  daycareUnlocked: false,
  availableTmIds: [],
  availableTmxIds: [],
  availableTutorMoveIds: [],
  ownedItems: {},
};

// The export as the widget builds it: the pool joined with the donor box,
// so a donor can father egg moves onto the pool's lines.
async function lopunnyMoves(progression) {
  const { pokemonIndex } = await loadShared();
  const result = await runPool({ pool, donorPool, progression });
  const text = await buildPoolAvailabilityText({
    lines: result.lines,
    progression,
    pokemonIndex,
    poolQuery: withDonors(pool.join('\n'), donorPool.join('\n')),
  });
  const prefix = 'Lopunny - available move pool: ';
  const line = text.split('\n').find((row) => row.startsWith(prefix));
  assert.ok(line, text);
  return line.slice(prefix.length).split(', ');
}

test('the availability list carries egg moves the donors breed in', async () => {
  const moves = await lopunnyMoves({
    ...baseProgression,
    daycareUnlocked: true,
  });
  assert.ok(moves.includes('Fake Out'), moves.join(', '));
  assert.ok(moves.includes('Jump Kick'), moves.join(', '));
});

test('the availability list omits egg moves while the daycare is shut', async () => {
  const moves = await lopunnyMoves(baseProgression);
  assert.ok(!moves.includes('Fake Out'), moves.join(', '));
  assert.ok(moves.includes('Jump Kick'), moves.join(', '));
});
