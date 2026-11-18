import test from 'node:test';
import assert from 'node:assert/strict';

// A monotype run in Singles reads the type's family extension: the sets its
// type's Monotype teams ran, for the Pokémon they favoured, over the
// Singles data (src/usage-family.js). Ranks stay the Singles ladder's.

const { loadShared, progressionAt, runPool } =
  await import('./helpers/harness.mjs');
const { rankLadder, usageFamilyFor } =
  await import('../src/usage-family.js');
const { fetchSetDetail } = await import('../src/setDetails/set-index.js');

const lineOf = (result, inputName) => {
  const line = result.lines.find(
    (entry) => (entry.best || entry.bestNonMega)?.inputName === inputName);
  return line ? line.best || line.bestNonMega : null;
};
const moveNames = (choice) =>
  (choice.legalityProfile?.recommendedMoves || []).map((move) => move.name);

const fire = {
  ...progressionAt({ badge: 16, levelCap: 90 }), monotype: 'Fire',
};

test('the usage data holds an extension for every type, on Singles', async () => {
  const { availability } = await loadShared();
  for (const type of ['Fire', 'Water', 'Normal', 'Fairy']) {
    const family = usageFamilyFor(availability, 'singles', type);
    assert.equal(family, `singles-mono${type.toLowerCase()}`);
    // Its Pokémon are ranked on the Singles ladder, tier for tier.
    assert.equal(
      rankLadder(availability, family), availability.familyConfigs.singles);
  }
  assert.equal(usageFamilyFor(availability, 'doubles', 'Fire'), 'doubles');
});

test('a monotype run builds from its type teams and ranks as Singles', async () => {
  const { availability } = await loadShared();
  const family = usageFamilyFor(availability, 'singles', 'Fire');
  // Infernape and Torkoal are on most Fire teams; the Monotype ladder bans
  // Blaziken and lists Rapidash without favouring it.
  const pool = ['Infernape', 'Torkoal', 'Blaziken', 'Rapidash', 'Charmander'];
  const base = await runPool({ pool, progression: fire, scoreAllLines: true });
  const run = await runPool({
    pool, progression: fire, family, scoreAllLines: true,
  });

  // Favoured by Fire teams: its set is theirs.
  const favoured = await fetchSetDetail({ family, pokemonId: 'infernape' });
  assert.equal(favoured.family, family);
  assert.equal(favoured.formatId, 'gen7monotype-monofire');
  assert.equal(
    (await fetchSetDetail({ family: 'singles', pokemonId: 'infernape' }))
      .formatId,
    lineOf(base, 'Infernape').bundle.ranking.formatId);

  // Every Pokémon is ranked exactly as Singles ranks it.
  for (const name of pool) {
    assert.deepEqual(
      lineOf(run, name).bundle.ranking, lineOf(base, name).bundle.ranking,
      name);
  }

  // A Pokémon those teams do not favour reads Singles' own detail, so its
  // line is the Singles line: the same form, moves and score.
  for (const name of ['Blaziken', 'Rapidash']) {
    const id = name.toLowerCase();
    assert.equal(
      (await fetchSetDetail({ family, pokemonId: id })).family, 'singles');
    const kept = lineOf(run, name);
    const before = lineOf(base, name);
    assert.equal(kept.pokemonId, before.pokemonId, name);
    assert.deepEqual(moveNames(kept), moveNames(before), name);
    assert.equal(kept.score, before.score, name);
  }
});

test('a monotype run asks for no file under its extension that is not there', async () => {
  const { availability } = await loadShared();
  const family = usageFamilyFor(availability, 'singles', 'Fire');
  const misses = new Set();
  const inner = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const response = await inner(url);
    if (response.status === 404) misses.add(String(url).replace(/\?.*$/, ''));
    return response;
  };
  try {
    // A pool of its own, so no result or file is already cached.
    await runPool({
      pool: ['Arcanine', 'Chandelure', 'Houndoom', 'Numel', 'Cyndaquil'],
      progression: fire,
      family,
      scoreAllLines: true,
    });
  } finally {
    globalThis.fetch = inner;
  }
  // Every loader reads the extension's own file or the base family's:
  // nothing is looked for under a family that does not hold it.
  assert.deepEqual(
    [...misses].filter((url) => url.includes('singles-mono')), []);
});
