// What the real-team index takes for a team
// (scripts/build-team-index.mjs). The archives it is built from also hold
// forum posts that list several sets of one Pokémon and pastes read past
// their end, and a short list of sets is the easiest "team" for a pool to
// match: left in, it is what the closest-team panel shows.
import assert from 'node:assert/strict';
import test from 'node:test';

import { buildTeamIndex } from '../scripts/build-team-index.mjs';

const set = (speciesId) => ({
  species: speciesId, speciesId, moves: ['Tackle'], moveIds: ['tackle'],
});
const record = (format, speciesIds, source = 'rmt') =>
  ({ format, source, sets: speciesIds.map(set) });
const SIX = ['tauros', 'lapras', 'pinsir', 'heracross', 'skarmory', 'gengar'];

function teamsOf(records, family, formatId) {
  return buildTeamIndex(records).get(family)?.get(formatId)?.teams || [];
}

test('a team is six Pokémon, neither more nor fewer', () => {
  const teams = teamsOf([
    record('gen7ou', SIX),
    record('gen7ou', SIX.slice(0, 5)),
    record('gen7ou', [...SIX, 'dragonite']),
  ], 'singles', 'gen7ou');
  assert.equal(teams.length, 1);
  assert.deepEqual(teams[0].members.map((member) => member.speciesId), SIX);
});

test('a set with no moves is not a member', () => {
  const short = record('gen7ou', SIX);
  short.sets[5].moveIds = [];
  assert.equal(teamsOf([short], 'singles', 'gen7ou').length, 0);
});

test('a species twice is a team only where the format allows it', () => {
  const sets = ['magnezone', 'magnezone', ...SIX.slice(0, 4)];
  assert.equal(
    teamsOf([record('gen7ou', sets)], 'singles', 'gen7ou').length, 0);
  // Anything Goes has no Species Clause: six of one Pokémon is a team.
  const six = new Array(6).fill('bulbasaur');
  const [team] = teamsOf(
    [record('gen7anythinggoes', six)], 'singles', 'gen7anythinggoes');
  assert.deepEqual(team.members.map((member) => member.speciesId), six);
});

test('the same team seen again is one entry, counted twice', () => {
  const [team, ...rest] = teamsOf([
    record('gen7ou', SIX), record('gen7ou', [...SIX].reverse(), 'sample'),
  ], 'singles', 'gen7ou');
  assert.equal(rest.length, 0);
  assert.equal(team.count, 2);
  assert.deepEqual(team.sources, { rmt: 1, sample: 1 });
});
