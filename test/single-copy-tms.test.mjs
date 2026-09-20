// Build realization plans a single-copy TM for one member: the best
// assignment that honors every copy wins, and when none can, the members
// short a copy are told.
import test from 'node:test';
import assert from 'node:assert/strict';

const { chooseBuildAssignment, noteSingleCopyTms } = await import(
  '../src/teamBuilder/team-selection.js',
);

const build = (name, value, singleCopyTms = []) => ({
  name,
  value,
  legalityProfile: { singleCopyTms },
});
const total = (team) => team.reduce((sum, member) => sum + member.value, 0);

test('the copy goes where the team scores best, the other member takes its alternative', () => {
  const options = [
    [build('Gengar', 10, ['tm30']), build('Gengar (no Shadow Ball)', 6)],
    [build('Espeon', 9, ['tm30']), build('Espeon (no Shadow Ball)', 8)],
  ];
  const honored = chooseBuildAssignment(options, total, true);
  assert.deepEqual(honored.team.map((member) => member.name), [
    'Gengar', 'Espeon (no Shadow Ball)',
  ]);
  assert.equal(honored.score, 18);
  // Without the copies the higher-scoring pair is illegal in the game.
  assert.equal(chooseBuildAssignment(options, total, false).score, 19);

  const noted = noteSingleCopyTms(honored.team, options, true);
  assert.equal(noted[0].note, undefined);
  assert.match(noted[1].note, /TM30 Shadow Ball: one copy, planned for Gengar/);
});

test('with no way to honor a copy, the best assignment stands and says who is short', () => {
  const options = [
    [build('Gengar', 10, ['tm30'])],
    [build('Espeon', 9, ['tm30'])],
  ];
  assert.equal(chooseBuildAssignment(options, total, true), null);
  const fallback = chooseBuildAssignment(options, total, false);
  const noted = noteSingleCopyTms(fallback.team, options, false);
  assert.equal(noted[0].note, undefined);
  assert.match(noted[1].note, /needs a second copy \(Gengar plans it too\)/);
});

test('renewable TMs and reusable-TM games carry no copies to plan', () => {
  const options = [[build('A', 5)], [build('B', 4)]];
  const chosen = chooseBuildAssignment(options, total, true);
  assert.equal(chosen.score, 9);
  assert.equal(noteSingleCopyTms(chosen.team, options, true), chosen.team);
});
