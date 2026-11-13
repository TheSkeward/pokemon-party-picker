// The Gen 5 item data is asked for only where it exists. Most picks of a
// Gen 7 game have none (a later generation's Pokémon, a Mega), and each
// used to cost a request that came back 404. The builder lists the ids
// that have a file, and the loader reads the list first.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

await import('./helpers/harness.mjs'); // fetch → filesystem shim
const { loadTeamItemUsage } = await import(
  '../src/teamBuilder/item-recommendations.js',
);

const DIR = path.resolve('site-data', 'data', 'gen5-items');

test('the index lists exactly the Pokémon that have a file', () => {
  const index = JSON.parse(fs.readFileSync(path.join(DIR, 'index.json')));
  const files = fs.readdirSync(DIR)
    .filter((file) => file !== 'index.json')
    .map((file) => path.basename(file, '.json'))
    .sort();
  assert.deepEqual(index, files);
  assert.ok(index.includes('gengar'));
  assert.ok(!index.includes('gengarmega'));
});

test('a Pokémon without Gen 5 data is never asked for', async () => {
  const realFetch = globalThis.fetch;
  const asked = [];
  globalThis.fetch = (url) => {
    asked.push(String(url).replace(/\?.*$/, ''));
    return realFetch(url);
  };
  try {
    const usage = await loadTeamItemUsage({
      family: 'singles',
      team: [
        { inputPokemonId: 'gastly', pokemonId: 'gengar' },
        { inputPokemonId: 'gastly', pokemonId: 'gengarmega' },
      ],
    });
    assert.equal(usage.size, 2);
  } finally {
    globalThis.fetch = realFetch;
  }
  const gen5 = asked.filter((url) => url.includes('gen5-items/'));
  assert.ok(gen5.some((url) => url.endsWith('gen5-items/gengar.json')), gen5);
  assert.ok(
    !gen5.some((url) => url.endsWith('gen5-items/gengarmega.json')), gen5);
});
