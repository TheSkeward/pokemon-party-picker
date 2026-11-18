import test from 'node:test';
import assert from 'node:assert/strict';

// Usage families: a family of the usage data, or an extension that reads
// one with further formats supplying sets (src/usage-family.js).

const {
  baseFamilyOf, isFamilyExtension, monotypeFamilyId, rankLadder, setLadder,
  usageFamilyFor,
} = await import('../src/usage-family.js');
const { FAMILY_CONFIGS, FAMILY_EXTENSIONS, EXTENSION_FORMATS, REAL_FORMATS } =
  await import('../scripts/config.mjs');

const availability = {
  familyConfigs: {
    singles: {
      label: 'Singles',
      formatOrder: ['gen7ubers', 'gen7ou'],
      cutoffPriority: [1760, 0],
    },
    doubles: {
      label: 'Doubles',
      formatOrder: ['gen7doublesou'],
      cutoffPriority: [1760, 0],
    },
  },
  familyExtensions: {
    'singles-monofire': {
      label: 'Fire Monotype',
      base: 'singles',
      monotype: 'Fire',
      formatOrder: ['gen7monotype-monofire'],
    },
  },
};

test('an extension id names its base family', () => {
  assert.equal(monotypeFamilyId('singles', 'Fire'), 'singles-monofire');
  assert.equal(baseFamilyOf('singles-monofire'), 'singles');
  assert.equal(baseFamilyOf('singles'), 'singles');
  assert.ok(isFamilyExtension('singles-monofire'));
  assert.ok(!isFamilyExtension('gen9natdexsingles'));
});

test('no family id could be read as an extension', () => {
  for (const family of Object.keys(FAMILY_CONFIGS)) {
    assert.ok(!isFamilyExtension(family), family);
  }
  for (const [id, extension] of Object.entries(FAMILY_EXTENSIONS)) {
    assert.equal(baseFamilyOf(id), extension.base);
    assert.equal(id, monotypeFamilyId(extension.base, extension.monotype));
    assert.ok(extension.base in FAMILY_CONFIGS);
  }
});

test('an extension ranks on its base ladder and reads sets ahead of it', () => {
  const singles = availability.familyConfigs.singles;
  // Its formats supply sets and do not rank.
  assert.equal(rankLadder(availability, 'singles-monofire'), singles);
  assert.equal(rankLadder(availability, 'singles'), singles);
  assert.deepEqual(
    setLadder(availability, 'singles-monofire').formatOrder,
    ['gen7monotype-monofire', 'gen7ubers', 'gen7ou']);
  assert.deepEqual(
    setLadder(availability, 'singles-monofire').cutoffPriority, [1760, 0]);
  assert.equal(setLadder(availability, 'singles'), singles);
  // An extension the index does not hold has no set ladder.
  assert.equal(setLadder(availability, 'singles-monoice'), null);
});

test('a run reads the monotype extension only where the data has one', () => {
  assert.equal(usageFamilyFor(availability, 'singles', ''), 'singles');
  assert.equal(
    usageFamilyFor(availability, 'singles', 'Fire'), 'singles-monofire');
  // No Ice extension in this index, and no Monotype doubles anywhere.
  assert.equal(usageFamilyFor(availability, 'singles', 'Ice'), 'singles');
  assert.equal(usageFamilyFor(availability, 'doubles', 'Fire'), 'doubles');
});

test('an extension is built only from formats the pipeline fetches', () => {
  const fetched = new Set(EXTENSION_FORMATS.map((format) => format.id));
  const browsable = new Set(REAL_FORMATS.map((format) => format.id));
  for (const extension of Object.values(FAMILY_EXTENSIONS)) {
    for (const formatId of extension.formatOrder) {
      assert.ok(fetched.has(formatId), formatId);
    }
  }
  // An extension's format is no tab's: nothing scrapes teams for it or
  // lists it in the usage browser.
  for (const formatId of fetched) assert.ok(!browsable.has(formatId));
});

test('a detail is stitched beside every Pokémon it borrows from', async () => {
  const { buildSpeciesContext, relatedClosure } =
    await import('../scripts/set-index/species-context.mjs');
  const index = [
    'Charmander', 'Charmeleon', 'Charizard', 'Charizard-Mega-X',
    'Charizard-Mega-Y', 'Squirtle',
  ].map((name) => ({ id: name.toLowerCase().replace(/[^a-z]/g, ''), name }));
  const context = buildSpeciesContext(index);
  // A Mega borrows from its other Mega and its base, and the base from
  // its pre-evolutions: all of them, and nothing unrelated.
  assert.deepEqual(
    [...relatedClosure(['charizardmegay'], index, context)].sort(),
    ['charizard', 'charizardmegax', 'charizardmegay', 'charmander',
      'charmeleon']);
  assert.deepEqual(
    [...relatedClosure(['charmander'], index, context)], ['charmander']);
});
