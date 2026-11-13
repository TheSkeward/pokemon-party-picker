// The breeding and Sketch contexts are the slowest thing a run builds, and
// every step of one run asks for the same pair. They are shared by input, so
// a change that cannot alter them (a roster lock, a held item in the bag)
// must reuse them, and a change that can (the progression, the owned
// species, kept routes, an evolution item) must not.
import assert from 'node:assert/strict';
import test from 'node:test';

import { loadShared, progressionAt } from './helpers/harness.mjs';

const { buildMoveTransferContexts } = await import(
  '../src/playthrough/sketch.js',
);
const { normalizePoolText, setPoolEntryLock, withDonors } = await import(
  '../src/teamBuilder/pool-parsing.js',
);

const { pokemonIndex } = await loadShared();
// Canonical form, as the widget puts the pool before every run: a lock
// rewrites the text in that form, and the order of the species is an input.
const pool = normalizePoolText('Eevee\nVenipede\nFroakie', pokemonIndex);
const donors = 'Munna@14\nSmeargle@20';
const progression = {
  ...progressionAt({ badge: 5, levelCap: 50 }),
  daycareUnlocked: true,
  moveRelearnerUnlocked: true,
};

test('a roster lock reuses the move-transfer contexts', async () => {
  const build = (poolText) => buildMoveTransferContexts({
    pokemonIndex,
    progression,
    query: withDonors(poolText, donors),
  });

  const contexts = await build(pool);
  assert.ok(
    Object.keys(contexts.breedingContext.byPokemonId).length > 0,
    'the pool must have egg moves to route, or the test proves nothing',
  );
  const locked = setPoolEntryLock(pool, 'Eevee', true, pokemonIndex);
  assert.notEqual(locked, pool);
  assert.equal(await build(locked), contexts);
  assert.equal(await build(pool), contexts);
});

test('a held item in the bag reuses the contexts; an evolution item does not', async () => {
  const build = (ownedItems) => buildMoveTransferContexts({
    pokemonIndex,
    progression: { ...progression, ownedItems },
    query: withDonors(pool, donors),
  });

  const contexts = await build({ aspearberry: 6, leftovers: 1 });
  // No evolution spends a Berry or Leftovers: neither can change what the
  // pool becomes or passes on.
  assert.equal(await build({ leftovers: 1 }), contexts);
  assert.equal(await build({}), contexts);
  // A Water Stone evolves the pool's Eevee, and a second one a second
  // candidate.
  const withStone = await build({ waterstone: 1 });
  assert.notEqual(withStone, contexts);
  assert.notEqual(await build({ waterstone: 2 }), withStone);
  assert.equal(await build({ waterstone: 1, aspearberry: 6 }), withStone);
});

test('whatever the move-transfer contexts read gets its own pair', async () => {
  const base = { pokemonIndex, progression, query: withDonors(pool, donors) };
  const contexts = await buildMoveTransferContexts(base);

  const withoutDaycare = await buildMoveTransferContexts({
    ...base,
    progression: { ...progression, daycareUnlocked: false },
  });
  assert.notEqual(withoutDaycare, contexts);
  assert.deepEqual(withoutDaycare.breedingContext.byPokemonId, {});

  const anotherDonor = await buildMoveTransferContexts({
    ...base,
    query: withDonors(pool, `${donors}\nQwilfish@25`),
  });
  assert.notEqual(anotherDonor, contexts);

  const withRoutes = await buildMoveTransferContexts({
    ...base,
    retainRoutes: true,
  });
  assert.notEqual(withRoutes, contexts);
});
