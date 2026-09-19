import test from 'node:test';
import assert from 'node:assert/strict';
import { runPool, teamInputNames } from './helpers/harness.mjs';

const SMALL_POOL = [
  'Torchic', 'Mareep', 'Nidoran-M', 'Cottonee', 'Numel', 'Kricketune',
  'Ekans', 'Goldeen', 'Woobat', 'Bidoof', 'Drowzee', 'Luvdisc',
];

// 33 lines with one lock: C(32, 5) = 201,376 combinations, above the
// parallel threshold, so the fixed member has to travel to the workers.
const LARGE_POOL = [
  ...SMALL_POOL, 'Pachirisu', 'Espurr', 'Litleo', 'Klink', 'Ralts',
  'Growlithe', 'Meowth', 'Igglybuff', 'Pancham', 'Trubbish', 'Grimer',
  'Stunky', 'Purrloin', 'Blitzle', 'Swablu', 'Cherubi', 'Budew', 'Surskit',
  'Munna', 'Tynamo', 'Finneon',
];

const withLock = (pool, name) =>
  pool.map((entry) => (entry === name ? `${name}!` : entry));

test('a locked entry is seated and the rest of the team is re-optimized', async () => {
  const free = await runPool({ pool: SMALL_POOL });
  assert.ok(!teamInputNames(free).includes('Luvdisc'), 'Luvdisc must lose on merit');

  const locked = await runPool({ pool: withLock(SMALL_POOL, 'Luvdisc') });
  const names = teamInputNames(locked);
  assert.ok(names.includes('Luvdisc'));
  assert.equal(names.length, 6);
  assert.deepEqual(locked.ignoredLocks, []);
  const member = locked.team.find((choice) => choice.inputName === 'Luvdisc');
  assert.equal(member.locked, true);
  assert.match(member.note, /^locked in/);
  assert.ok(locked.team.filter((choice) => choice.locked).length === 1);
  // A constraint can only cost score, never gain it.
  assert.ok(locked.teamScore <= free.teamScore);
  // The bench never proposes swapping the locked member out.
  assert.ok(!locked.benchSwapScores.has(member.inputPokemonId));
});

test('a locked run neither reads nor poisons the unlocked caches', async () => {
  const before = teamInputNames(await runPool({ pool: SMALL_POOL }));
  await runPool({ pool: withLock(SMALL_POOL, 'Luvdisc') });
  const after = teamInputNames(await runPool({ pool: SMALL_POOL }));
  assert.deepEqual(after, before);
  assert.ok(!after.includes('Luvdisc'));
});

test('more locks than slots picks the team among the locks alone', async () => {
  const lockedSeven = SMALL_POOL.slice(0, 7).map((name) => `${name}!`);
  const result = await runPool({
    pool: [...lockedSeven, ...SMALL_POOL.slice(7)],
  });
  const names = teamInputNames(result);
  assert.equal(names.length, 6);
  // Compare normalized: the index spells the input "NidoranM".
  const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const lockedKeys = new Set(SMALL_POOL.slice(0, 7).map(key));
  for (const name of names) assert.ok(lockedKeys.has(key(name)), name);
});

test('the lock survives the parallel worker search', async () => {
  const result = await runPool({ pool: withLock(LARGE_POOL, 'Luvdisc') });
  assert.equal(result.searchExact, true);
  assert.ok(teamInputNames(result).includes('Luvdisc'));
  assert.equal(teamInputNames(result).length, 6);
});
