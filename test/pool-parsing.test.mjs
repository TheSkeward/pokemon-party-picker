import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { normalizePoolText, parseAbilityAnnotations } = await import(
  '../src/teamBuilder/pool-parsing.js',
);
const pokemonIndex = JSON.parse(
  await readFile(new URL('../site-data/data/pokemon-index.json', import.meta.url), 'utf8'),
);

test('normalizePoolText keeps ability annotations', () => {
  const query = 'Froakie (Torrent), bidoof\nGothitelle [Shadow Tag]';
  const normalized = normalizePoolText(query, pokemonIndex);
  assert.equal(normalized, 'Bidoof\nFroakie (Torrent)\nGothitelle (Shadow Tag)');
  assert.deepEqual(
    [...parseAbilityAnnotations(normalized, pokemonIndex)],
    [...parseAbilityAnnotations(query, pokemonIndex)],
  );
});

test('normalizePoolText attaches an annotation to a deduplicated name', () => {
  assert.equal(
    normalizePoolText('Froakie, Froakie (Torrent)', pokemonIndex),
    'Froakie (Torrent)',
  );
});

test('the pool joins the donor box as plain names, and the box only grows', async () => {
  const { absorbPoolIntoDonors } = await import(
    '../src/teamBuilder/pool-parsing.js',
  );
  const donors = absorbPoolIntoDonors(
    'Ditto',
    'Gengar!, Eevee (Adaptability)',
    pokemonIndex,
  );
  assert.equal(donors, 'Ditto, Eevee, Gengar');
  // Gengar leaves the pool; the box keeps it.
  assert.equal(absorbPoolIntoDonors(donors, 'Eevee', pokemonIndex), donors);
  // An empty pool changes nothing, not even the box's formatting.
  assert.equal(absorbPoolIntoDonors('Smeargle, Ditto', '', pokemonIndex), 'Smeargle, Ditto');
});

test('a keep marker survives normalization beside a lock and an annotation', async () => {
  const { parseKeptNames, parseLockedNames } = await import(
    '../src/teamBuilder/pool-parsing.js',
  );
  const query = 'Larvesta*, *Rockruff, Gengar!* (Cursed Body), Eevee';
  const normalized = normalizePoolText(query, pokemonIndex);
  assert.equal(
    normalized,
    'Eevee\nGengar!* (Cursed Body)\nLarvesta*, Rockruff*',
  );
  assert.deepEqual(
    [...parseKeptNames(normalized, pokemonIndex)].sort(),
    ['gengar', 'larvesta', 'rockruff'],
  );
  assert.deepEqual([...parseLockedNames(normalized, pokemonIndex)], ['gengar']);
  // A pasted bullet is not a keep: the prefix form must touch the name.
  assert.equal(normalizePoolText('* Larvesta', pokemonIndex), 'Larvesta');
  // The donor box keeps plain names only.
  const { absorbPoolIntoDonors } = await import(
    '../src/teamBuilder/pool-parsing.js',
  );
  assert.equal(absorbPoolIntoDonors('', 'Larvesta*', pokemonIndex), 'Larvesta');
});

test('a met level rides the entry and never fuses with the name', async () => {
  const { parseMetLevels } = await import(
    '../src/teamBuilder/pool-parsing.js',
  );
  const normalized = normalizePoolText(
    'Munna@14!* (Synchronize), porygon@2, *Rockruff @ 7',
    pokemonIndex,
  );
  assert.equal(
    normalized,
    'Munna@14!* (Synchronize)\nPorygon@2, Rockruff@7*',
  );
  assert.deepEqual(
    [...parseMetLevels(normalized, pokemonIndex)].sort(),
    [['munna', 14], ['porygon', 2], ['rockruff', 7]],
  );
});

test('a bare @ marks a late arrival; a pasted Showdown item line does not', async () => {
  const { parseMetLevels } = await import(
    '../src/teamBuilder/pool-parsing.js',
  );
  const normalized = normalizePoolText(
    'Munna@ (Synchronize), Gengar @ Life Orb, Eevee @, *Rockruff@!',
    pokemonIndex,
  );
  assert.equal(
    normalized,
    'Eevee@, Gengar\nMunna@ (Synchronize)\nRockruff@!*',
  );
  assert.deepEqual(
    [...parseMetLevels(normalized, pokemonIndex)].sort(),
    [['eevee', true], ['munna', true], ['rockruff', true]],
  );
});

test('a move lock rides the entry beside every other mark', async () => {
  const { parseLockedMoves, parseLockedNames, parseMetLevels } = await import(
    '../src/teamBuilder/pool-parsing.js',
  );
  const meowstic =
    'Meowstic@14!* (Prankster) {Psychic / Reflect / Light Screen / Thunder Wave}';
  const query =
    `${meowstic}, Mew {Natural Gift}, Eevee {Bite} (Adaptability), ` +
    'Eevee {Bite / Quick Attack}';
  const normalized = normalizePoolText(query, pokemonIndex);
  assert.equal(
    normalized,
    `Eevee (Adaptability) {Bite / Quick Attack}\n${meowstic}\nMew {Natural Gift}`,
  );
  assert.deepEqual(
    [...parseLockedMoves(normalized, pokemonIndex)].sort(),
    [
      ['eevee', ['Bite', 'Quick Attack']],
      ['meowstic', ['Psychic', 'Reflect', 'Light Screen', 'Thunder Wave']],
      // Natural Gift is no Natu: a move name never reads as a Pokémon.
      ['mew', ['Natural Gift']],
    ],
  );
  // The lock hides none of the other marks.
  assert.deepEqual(
    [...parseAbilityAnnotations(normalized, pokemonIndex)].sort(),
    [['eevee', 'Adaptability'], ['meowstic', 'Prankster']],
  );
  assert.deepEqual([...parseLockedNames(normalized, pokemonIndex)], ['meowstic']);
  assert.deepEqual([...parseMetLevels(normalized, pokemonIndex)], [['meowstic', 14]]);
});

test('an annotated entry takes its own line; plain runs share one', () => {
  // A pool of bare names and markers stays one line.
  assert.equal(
    normalizePoolText('Wooper, Aron!, Larvesta*, Munna@14', pokemonIndex),
    'Aron!, Larvesta*, Munna@14, Wooper',
  );
  // Alphabetical order holds across the lines; a plain run between two
  // annotated entries is one line, however long.
  const normalized = normalizePoolText(
    'Wooper, Mawile* (Intimidate) {Iron Head / Sucker Punch}, Onix, ' +
      'Aron, Amoonguss* (Regenerator) {Toxic / Spore}, Beedrill, Meditite',
    pokemonIndex,
  );
  assert.equal(
    normalized,
    [
      'Amoonguss* (Regenerator) {Toxic / Spore}',
      'Aron, Beedrill',
      'Mawile* (Intimidate) {Iron Head / Sucker Punch}',
      'Meditite, Onix, Wooper',
    ].join('\n'),
  );
  // The layout is a fixed point: normalizing it again changes nothing.
  assert.equal(normalizePoolText(normalized, pokemonIndex), normalized);
});
