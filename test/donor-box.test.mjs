// The donor box: Pokémon the player owns but will not field. They supply egg
// moves, Sketch partners and move transfers to the pool, and never become
// lines, candidates or team members.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withDonors } from '../src/teamBuilder/pool-parsing.js';
import { progressionAt, runPool, teamInputNames } from './helpers/harness.mjs';

test('the donor text joins the pool for move-transfer readers only', () => {
  assert.equal(withDonors('Dodrio', 'Staraptor'), 'Dodrio\nStaraptor');
  assert.equal(withDonors('Dodrio', '  '), 'Dodrio');
  assert.equal(withDonors('Dodrio'), 'Dodrio');
  assert.equal(withDonors('', 'Ditto'), '\nDitto');
});

test('a donor breeds a move onto the team without joining it', async () => {
  const progression = {
    ...progressionAt({ badge: 5, levelCap: 45 }),
    daycareUnlocked: true,
  };
  const moves = (result) =>
    (result.team[0].legalityProfile?.recommendedMoves || [])
      .map((move) => move.id);

  // Dodrio cannot learn Brave Bird on its own at this cap.
  const alone = await runPool({ pool: ['Dodrio'], progression });
  assert.ok(!moves(alone).includes('bravebird'), moves(alone).join(','));

  // With a Staraptor in the donor box, Doduo's egg move is bred in, and
  // Staraptor itself is neither a line nor a team member.
  const donated = await runPool({
    pool: ['Dodrio'],
    donorPool: ['Staraptor'],
    progression,
  });
  assert.ok(moves(donated).includes('bravebird'), moves(donated).join(','));
  assert.deepEqual(teamInputNames(donated), ['Dodrio']);
  assert.ok(
    !donated.lines.some((line) =>
      (line.best || line.bestNonMega)?.inputName === 'Staraptor'),
    'the donor is not a pool line',
  );
});
