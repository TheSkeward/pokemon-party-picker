// Team slots: how many of the six the optimizer may fill. An egg in the party
// takes one, so the owner sets five and the search seats five, locks
// included. Six is the default and is stored as nothing at all, so saved
// progressions and cache signatures from before the setting are unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import { progressionAt, runPool, teamInputNames } from './helpers/harness.mjs';

const { normalizeProgression, teamSlotsOf } = await import(
  '../src/playthrough/progression.js',
);

const POOL = [
  'Torchic', 'Mareep', 'Nidoran-M', 'Cottonee', 'Numel', 'Kricketune',
  'Ekans', 'Goldeen', 'Woobat', 'Bidoof', 'Drowzee', 'Luvdisc',
];

test('six slots is the default and leaves no trace on the progression', () => {
  assert.equal(teamSlotsOf(undefined), 6);
  assert.equal(teamSlotsOf('5'), 5);
  assert.equal(teamSlotsOf(0), 1);
  assert.equal(teamSlotsOf(9), 6);
  assert.ok(!('teamSlots' in normalizeProgression({})));
  assert.ok(!('teamSlots' in normalizeProgression({ teamSlots: 6 })));
  assert.equal(normalizeProgression({ teamSlots: '4' }).teamSlots, 4);
});

test('a five-slot search seats five, and a lock still rides along', async () => {
  const progression = {
    ...progressionAt({ badge: 1, levelCap: 25 }),
    teamSlots: 5,
  };
  const five = await runPool({ pool: POOL, progression });
  assert.equal(five.team.length, 5);

  const locked = await runPool({
    pool: POOL.map((entry) => (entry === 'Luvdisc' ? 'Luvdisc!' : entry)),
    progression,
  });
  const names = teamInputNames(locked);
  assert.equal(names.length, 5);
  assert.ok(names.includes('Luvdisc'));
  assert.deepEqual(locked.ignoredLocks, []);
});
