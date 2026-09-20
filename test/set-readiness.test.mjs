import test from 'node:test';
import assert from 'node:assert/strict';

const { computeSetReadiness } = await import('../src/playthrough/set-readiness.js');
const { moveSources } = await import('../src/games/legality.js');
const { toId } = await import('../src/utils/ids.js');

test('machine timing is priced from the active game\'s option tables', () => {
  // TM57 is a badge-1 pickup in Reborn. The readiness price must read that
  // timing from the descriptor's tables and turn it into the badge-1 cap.
  const tm = moveSources().tmOptions.find((option) => option.id === 'tm57');
  assert.match(tm.available, /Badge 01/);
  const moveId = toId(tm.move);
  const readiness = computeSetReadiness({
    legalMoveData: {
      pokemonId: 'mareep',
      moves: [{ id: moveId, sources: { tm: true } }],
    },
    availableMoves: [],
    topSet: { moveUsage: new Map([[moveId, 50]]) },
    progression: {},
  });
  const entry = readiness.moves.find((move) => move.id === moveId);
  assert.notEqual(entry.status, 'blocked');
  assert.match(entry.detail, /TM\/tutor @1 badge/);
  assert.equal(readiness.fullAtCap, 25);
});
