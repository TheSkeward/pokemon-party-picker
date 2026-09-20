import test from 'node:test';
import assert from 'node:assert/strict';

await import('./helpers/harness.mjs');
const {
  getAvailableMoves,
  getPreferredMoveSource,
  loadLegalMoveData,
} = await import('../src/playthrough/legal-moves.js');
const { REBORN_TUTOR_OPTIONS } = await import(
  '../src/reborn/progression-options.js',
);

test('preferred taught route is TM, then tutor, then relearner', () => {
  const source = (kind) => ({ kind, label: kind });
  assert.equal(
    getPreferredMoveSource({
      availableSources: [
        source('relearner'),
        source('tutor'),
        source('tm'),
      ],
    }).kind,
    'tm',
  );
  assert.equal(
    getPreferredMoveSource({
      availableSources: [source('relearner'), source('tutor')],
    }).kind,
    'tutor',
  );
});

test('Scolipede Iron Defense prefers its tutor over the relearner', async () => {
  const legalMoveData = await loadLegalMoveData('scolipede');
  const tutorId = REBORN_TUTOR_OPTIONS.find(
    (option) => option.move === 'Iron Defense',
  )?.id;
  assert.ok(tutorId, 'Iron Defense tutor option exists');

  const move = getAvailableMoves(legalMoveData, {
    levelCap: '50',
    moveRelearnerUnlocked: true,
    availableTutorMoveIds: [tutorId],
  }).find((entry) => entry.id === 'irondefense');

  assert.deepEqual(
    new Set(move.availableSources.map((source) => source.kind)),
    new Set(['relearner', 'tutor']),
  );
  assert.equal(getPreferredMoveSource(move).kind, 'tutor');
});
