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
  assert.match(entry.detail, /TM57 @1 badge/);
  assert.equal(readiness.fullAtCap, 25);
});

test("a canonical move names every route: the pre-evolution's level and the TM", async () => {
  // Musharna's Calm Mind and Psychic are Munna level-ups the Moon Stone
  // closes, and TMs much later. The owner holding one stone needs both.
  await import('./helpers/harness.mjs');
  const { loadLegalMoveData } = await import(
    '../src/playthrough/legal-moves.js',
  );
  const musharna = await loadLegalMoveData('musharna');
  const readiness = computeSetReadiness({
    legalMoveData: musharna,
    availableMoves: [],
    topSet: { moveUsage: new Map([['calmmind', 90], ['psychic', 80]]) },
    progression: { levelCap: '25' },
  });
  const detail = (id) =>
    readiness.moves.find((move) => move.id === id).detail;
  assert.equal(
    detail('calmmind'), 'level-up @35 as Munna · or TM04 @14 badges',
  );
  assert.equal(
    detail('psychic'), 'level-up @37 as Munna · or TM29 @16 badges',
  );
});
