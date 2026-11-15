import test from 'node:test';
import assert from 'node:assert/strict';

// "Meowth=" in the pool: the entry is fielded as exactly that species.

const { loadShared, progressionAt, runPool } =
  await import('./helpers/harness.mjs');
const { withPoolAnnotations } =
  await import('../src/teamBuilder/input-groups.js');
const { getCurrentSpeciesForChoice, getReachableSpecies } =
  await import('../src/playthrough/current-species.js');
const { buildMoveTransferContexts } =
  await import('../src/playthrough/sketch.js');

const lineOf = (result, inputName) => {
  const line = result.lines.find(
    (entry) => (entry.best || entry.bestNonMega)?.inputName === inputName);
  return line.best || line.bestNonMega;
};

test('an exact entry is fielded and scored as the species named', async () => {
  const progression = progressionAt({ badge: 7, levelCap: 60 });
  const plain = await runPool({
    pool: ['Meowth', 'Zigzagoon', 'Phanpy'],
    progression,
    scoreAllLines: true,
  });
  assert.equal(lineOf(plain, 'Meowth').legalityProfile.currentId, 'persian');
  assert.equal(lineOf(plain, 'Phanpy').legalityProfile.currentId, 'donphan');

  const marked = await runPool({
    pool: ['Meowth= (Pickup)', 'Zigzagoon', 'Phanpy='],
    progression,
    scoreAllLines: true,
  });
  const meowth = lineOf(marked, 'Meowth');
  assert.equal(meowth.pokemonId, 'meowth');
  assert.equal(meowth.legalityProfile.currentId, 'meowth');
  // Persian has no Pickup; the pin is read on the species that is fielded.
  assert.equal(meowth.legalityProfile.assumedAbility, 'Pickup');
  assert.deepEqual(
    meowth.legalityProfile.legalityProof.blockedEvolutions.map(
      (entry) => entry.to),
    ['persian'],
  );
  assert.match(
    meowth.legalityProfile.legalityProof.blockedEvolutions[0].reason,
    /Meowth is marked = in the pool/,
  );
  assert.equal(lineOf(marked, 'Phanpy').legalityProfile.currentId, 'phanpy');
  // An unmarked neighbour evolves as before.
  assert.equal(
    lineOf(marked, 'Zigzagoon').legalityProfile.currentId, 'linoone');

  // A reader that holds only the choice and the saved progression, as the
  // page's panels do, fields the same species.
  assert.equal(
    getCurrentSpeciesForChoice(meowth, progression).id, 'meowth');
});

test('an exact entry evolves for no other reader of the pool', async () => {
  const { pokemonIndex } = await loadShared();
  const progression = progressionAt({ badge: 5, levelCap: 50 });
  const marked = withPoolAnnotations(
    progression, 'Smeargle\nVenipede=', pokemonIndex);
  assert.deepEqual(marked.exactByPokemon, { venipede: true });
  // A pool without the mark leaves the progression, and its cache keys,
  // alone.
  assert.equal(
    withPoolAnnotations(progression, 'Smeargle\nVenipede', pokemonIndex),
    progression,
  );

  assert.deepEqual(
    getReachableSpecies('venipede', marked).map((species) => species.id),
    ['venipede'],
  );
  // Scolipede learns Baton Pass on evolving; a Venipede kept as it is
  // cannot show it to Smeargle.
  const open = await buildMoveTransferContexts({
    pokemonIndex, progression, query: 'Smeargle\nVenipede',
  });
  assert.equal(
    open.sketchContext.byPokemonId.smeargle.sources.batonpass?.partnerId,
    'scolipede',
  );
  const held = await buildMoveTransferContexts({
    pokemonIndex, progression: marked, query: 'Smeargle\nVenipede=',
  });
  assert.equal(
    held.sketchContext.byPokemonId.smeargle.sources.batonpass, undefined);
});
