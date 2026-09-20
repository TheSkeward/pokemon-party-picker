// End to end under HGSS: with one Shadow Ball TM and several Ghosts that
// have no other route to the move at cap 30, the realized team plans the
// copy for one member and the others carry a set assembled without it.
import test from 'node:test';
import assert from 'node:assert/strict';

await import('./helpers/harness.mjs'); // fetch → filesystem shim, worker pool
const { loadGame, setActiveGame } = await import('../src/games/registry.js');
const { loadAvailability, loadPokemonIndex } = await import('../src/data.js');
const { optimizeTeamFromPool } = await import(
  '../src/teamBuilder/team-optimizer.js',
);

await loadGame('hgss');
setActiveGame('hgss');
const [availability, pokemonIndex] = await Promise.all([
  loadAvailability(),
  loadPokemonIndex(),
]);

test('a one-copy TM is planned for one member and the rest do without it', async () => {
  const result = await optimizeTeamFromPool({
    availability,
    family: 'gen4singles',
    pokemonIndex,
    progression: {
      checkpoint: 'badge-3',
      levelCap: '30',
      availableTmIds: ['tm30'],
      availableTmxIds: [],
      availableTutorMoveIds: [],
      ownedItems: {},
      opponentTypeBias: {},
    },
    query: 'Gastly\nMisdreavus\nDuskull\nCyndaquil\nMareep\nTotodile',
    selection: 'all',
  });
  const planners = result.team.filter((member) =>
    (member.legalityProfile?.singleCopyTms || []).includes('tm30'),
  );
  assert.ok(planners.length <= 1, 'one copy of TM30 planned at most once');
  // Every member has a set without the copy to fall back on, so no one is
  // left short.
  for (const member of result.team) {
    assert.doesNotMatch(member.note || '', /needs a second copy/);
  }
  const fallbacks = result.team.filter((member) =>
    String(member.buildKey).startsWith('without:'),
  );
  for (const member of fallbacks) {
    assert.match(member.note, /TM30 Shadow Ball: one copy, planned for/);
    assert.ok(
      !(member.legalityProfile.recommendedMoves || []).some(
        (move) => move.id === 'shadowball',
      ),
      `${member.name} still carries Shadow Ball`,
    );
  }
});
