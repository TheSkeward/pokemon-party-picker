import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTeamAnalysis } from '../src/teamBuilder/team-analysis.js';
import { progressionAt, runPool } from './helpers/harness.mjs';

const progression = {
  ...progressionAt({ badge: 0, levelCap: 20 }),
  availableTmIds: [],
  availableTmxIds: [],
  availableTutorMoveIds: [],
};
const expectedMoves = ['spark', 'quickattack', 'nuzzle', 'charm'];
const moveIds = (profile) => profile.recommendedMoves.map((move) => move.id);
const analysisOptions = { family: 'singles', selection: 'all' };

test('Pachirisu fills its alternative set without changing its coverage priorities', async () => {
  const result = await runPool({ pool: ['Pachirisu'], progression });
  const selected = result.team[0];

  assert.equal(selected.buildKey, 'coverage');
  assert.deepEqual(moveIds(selected.legalityProfile), expectedMoves);

  const analysis = await buildTeamAnalysis(
    result.team,
    progression,
    analysisOptions,
  );
  assert.deepEqual(moveIds(analysis.profiles[0]), expectedMoves);
});

test('analysis retains fallback ranks when assembling coverage and utility sets', async () => {
  const result = await runPool({ pool: ['Pachirisu'], progression });

  for (const buildKey of ['coverage', 'utility']) {
    const analysis = await buildTeamAnalysis(
      [{ ...result.team[0], buildKey, legalityProfile: null }],
      progression,
      analysisOptions,
    );
    assert.deepEqual(moveIds(analysis.profiles[0]), expectedMoves, buildKey);
  }
});
