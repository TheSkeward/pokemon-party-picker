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
  assert.equal(normalized, 'Bidoof, Froakie (Torrent), Gothitelle (Shadow Tag)');
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
