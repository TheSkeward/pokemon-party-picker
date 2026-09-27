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
// The canonical Nuzzle leads: every build anchors on usage, and the card
// lists canonical moves before the damage-ordered rest.
const expectedMoves = ['nuzzle', 'spark', 'quickattack', 'charm'];
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
  // The utility set seats its utility moves by usage and, for Pachirisu,
  // coincides with the standard set; Endure comes from the fallback rank.
  const expectedByBuild = {
    coverage: expectedMoves,
    utility: ['nuzzle', 'quickattack', 'charm', 'endure'],
  };

  for (const [buildKey, expected] of Object.entries(expectedByBuild)) {
    const analysis = await buildTeamAnalysis(
      [{ ...result.team[0], buildKey, legalityProfile: null }],
      progression,
      analysisOptions,
    );
    assert.deepEqual(moveIds(analysis.profiles[0]), expected, buildKey);
  }
});
