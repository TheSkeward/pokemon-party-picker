import test from 'node:test';
import assert from 'node:assert/strict';

// A monotype run in Singles reads the type's family extension: what its
// type's Monotype teams ran, in usage bands, ahead of the Singles ladder
// (src/usage-family.js).

const { loadShared, progressionAt, runPool } =
  await import('./helpers/harness.mjs');
const { usageFamilyFor, usageLadder } =
  await import('../src/usage-family.js');
const { resolveBestAvailableLightBundle } = await import('../src/data.js');
const { fetchSetDetail } = await import('../src/setDetails/set-index.js');

const lineOf = (result, inputName) => {
  const line = result.lines.find(
    (entry) => (entry.best || entry.bestNonMega)?.inputName === inputName);
  return line ? line.best || line.bestNonMega : null;
};

const fire = {
  ...progressionAt({ badge: 16, levelCap: 90 }), monotype: 'Fire',
};
// Six bands of four cutoff tiers, ahead of the forty Singles tiers.
const BANDED_TIERS = 24;

test('the usage data holds an extension for every type, on Singles', async () => {
  const { availability } = await loadShared();
  for (const type of ['Fire', 'Water', 'Normal', 'Fairy']) {
    const family = usageFamilyFor(availability, 'singles', type);
    assert.equal(family, `singles-mono${type.toLowerCase()}`);
    const ladder = usageLadder(availability, family);
    assert.equal(
      ladder.formatOrder[0], `gen7monotype-mono${type.toLowerCase()}`);
    assert.equal(ladder.formatOrder[1], 'gen7anythinggoes');
    // The tier count every usage rank of the run is scaled by.
    assert.equal(ladder.tierCount, BANDED_TIERS + 40);
  }
  assert.equal(usageFamilyFor(availability, 'doubles', 'Fire'), 'doubles');
});

test('a monotype run ranks its type by how often its teams ran each', async () => {
  const { availability } = await loadShared();
  const family = usageFamilyFor(availability, 'singles', 'Fire');
  const bundle = (pokemonId) =>
    resolveBestAvailableLightBundle({ family, pokemonId });
  const singles = (pokemonId) =>
    resolveBestAvailableLightBundle({ family: 'singles', pokemonId });

  // On most Fire teams: the first band, whatever Singles makes of it.
  for (const id of ['torkoal', 'infernape', 'heatran']) {
    const ranking = (await bundle(id)).ranking;
    assert.equal(ranking.formatId, 'gen7monotype-monofire', id);
    assert.equal(ranking.tierRank, 0, id);
  }
  // On fewer: a later band, each band a format's worth of tiers down.
  const volcarona = (await bundle('volcarona')).ranking.tierRank;
  const arcanine = (await bundle('arcanine')).ranking.tierRank;
  assert.ok(volcarona >= 4 && volcarona < 8, `Volcarona ${volcarona}`);
  assert.ok(arcanine >= 16 && arcanine < BANDED_TIERS, `Arcanine ${arcanine}`);

  // Listed by Fire teams and passed over: its Singles tier, below every
  // band.
  const passed = (await bundle('rapidash')).ranking;
  const before = (await singles('rapidash')).ranking;
  assert.equal(passed.formatId, before.formatId);
  assert.equal(passed.tierRank, before.tierRank + BANDED_TIERS);

  // Under the bar on Fire teams: a trace, in no band above the last.
  const magcargo = await bundle('magcargo');
  assert.equal(magcargo.ranking, null);
  assert.ok(magcargo.trace.tierRank >= BANDED_TIERS - 4);

  // Banned from the Monotype ladder: the Singles standing, untouched.
  for (const id of ['blaziken', 'hooh']) {
    assert.deepEqual(
      (await bundle(id)).ranking, (await singles(id)).ranking, id);
  }
});

test('a monotype run builds from its type teams and fields what they ran', async () => {
  const { availability } = await loadShared();
  const family = usageFamilyFor(availability, 'singles', 'Fire');
  const pool = [
    'Infernape', 'Torkoal', 'Heatran', 'Charmander', 'Volcanion', 'Victini',
    'Arcanine', 'Chandelure', 'Darmanitan', 'Incineroar', 'Talonflame',
    'Rapidash', 'Magmortar', 'Flareon',
  ];
  const run = await runPool({
    pool, progression: fire, family, scoreAllLines: true,
  });

  // The six a Fire team ran most, of the fourteen owned.
  assert.deepEqual(
    run.team.map((choice) => choice.inputName).sort(),
    ['Charmander', 'Heatran', 'Infernape', 'Torkoal', 'Victini', 'Volcanion']);
  assert.equal(
    lineOf(run, 'Infernape').bundle.ranking.formatId, 'gen7monotype-monofire');

  // A Pokémon ranked on the type's format takes its set from it; one that
  // is not reads Singles' own detail.
  const ranked = await fetchSetDetail({ family, pokemonId: 'infernape' });
  assert.equal(ranked.family, family);
  assert.equal(ranked.formatId, 'gen7monotype-monofire');
  assert.equal(
    (await fetchSetDetail({ family, pokemonId: 'rapidash' })).family,
    'singles');
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
      pool: ['Ninetales', 'Houndoom', 'Numel', 'Cyndaquil', 'Blaziken'],
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
