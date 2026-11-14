// Which rows Set Lookup answers a query with
// (src/resolver/representatives.js): a name stands for its evolution line
// and gets the line's most-used form, a form typed in full gets that form,
// and a fragment that reaches across lines gets every match as typed.
// Usage figures move with each data refresh, so these read the rows' shape
// and order, never a number.
import assert from 'node:assert/strict';
import test from 'node:test';

const { loadShared } = await import('./helpers/harness.mjs');
const { computeResolverRepresentativeResults } = await import(
  '../src/resolver/representatives.js',
);

const { availability, pokemonIndex } = await loadShared();
const lookUp = (query, extra = {}) => computeResolverRepresentativeResults({
  availability, family: 'singles', pokemonIndex, query, ...extra,
});
const ids = (rows) => rows.map((row) => row.pokemonId);

const GENGAR_LINE = ['gastly', 'haunter', 'gengar', 'gengarmega'];

test('a name is answered by the most-used form of its line', async () => {
  const [row, ...rest] = await lookUp('Gastly');
  assert.deepEqual(rest, []);
  // The row keeps the name as typed and carries the form it stands for.
  assert.equal(row.inputPokemonId, 'gastly');
  assert.equal(row.inputName, 'Gastly');
  assert.ok(GENGAR_LINE.includes(row.pokemonId), row.pokemonId);
  assert.notEqual(row.pokemonId, 'gastly');
  assert.equal(row.candidateCount, GENGAR_LINE.length);
  assert.ok(Number.isFinite(row.representativeScore));
  assert.ok(row.bundle.usage.value > 0);
  assert.equal(row.representativeIsMega, row.pokemonId.includes('mega'));
  // A Mega never hides the form the player can field without the stone.
  assert.ok(GENGAR_LINE.includes(row.bestNonMegaPokemonId));
  assert.ok(!row.bestNonMegaPokemonId.includes('mega'));
  assert.ok(!row.broadMatch);
});

test('names of one line share a row, under the first typed', async () => {
  const [alone] = await lookUp('Gastly');
  const together = await lookUp('gastly, Haunter\nGengar');
  assert.equal(together.length, 1);
  assert.equal(together[0].pokemonId, alone.pokemonId);
  assert.equal(together[0].inputName, 'Gastly');
});

test('a form typed in full is answered with that form', async () => {
  const [line] = await lookUp('Charmander');
  const [megaX] = await lookUp('Charizard-Mega-X');
  const [megaY] = await lookUp('Charizard-Mega-Y');
  assert.equal(megaX.pokemonId, 'charizardmegax');
  assert.equal(megaY.pokemonId, 'charizardmegay');
  // Whichever Mega the line itself favours, the other was still honoured.
  assert.ok(
    [megaX, megaY].some((row) => row.pokemonId !== line.pokemonId));
  // A regional form is a line of its own, and so is the original.
  assert.deepEqual(ids(await lookUp('Ninetales-Alola')), ['ninetalesalola']);
  assert.deepEqual(ids(await lookUp('Ninetales')), ['ninetales']);
});

test('a fragment reaching across lines lists every match as itself', async () => {
  const rows = await lookUp('char');
  assert.deepEqual(
    ids(rows).sort(),
    ['charizard', 'charizardmegax', 'charizardmegay', 'charjabug',
      'charmander', 'charmeleon']);
  for (const row of rows) {
    assert.equal(row.broadMatch, true);
    assert.equal(row.inputPokemonId, row.pokemonId);
    assert.equal(row.representativeScore, -Infinity);
    assert.equal(row.literalSearchOnly, false);
  }
  // Most used first.
  const usage = rows.map((row) => row.bundle.usage?.value ?? -Infinity);
  assert.deepEqual(usage, [...usage].sort((a, b) => b - a));
  // The start of a form's name lists the forms it could mean.
  assert.deepEqual(
    ids(await lookUp('Charizard-Mega')).sort(),
    ['charizardmegax', 'charizardmegay']);
});

test('a list of matches too long to price comes back as names only', async () => {
  const rows = await lookUp('char', { literalResolveLimit: 5 });
  assert.equal(rows.length, 6);
  for (const row of rows) {
    assert.equal(row.literalSearchOnly, true);
    assert.deepEqual(row.bundle, { usage: null, leads: null });
  }
  // By name, with nothing else to order them on.
  assert.deepEqual(
    rows.map((row) => row.name),
    rows.map((row) => row.name).sort((a, b) => a.localeCompare(b)));
});

test('one or two letters match anywhere in a name', async () => {
  const rows = await lookUp('zz');
  assert.ok(rows.length > 1);
  for (const row of rows) {
    assert.match(row.name.toLowerCase(), /zz/);
    assert.equal(row.broadMatch, true);
  }
});

test('named Pokémon come by lead rate, with fragments\' matches after them', async () => {
  const rows = await lookUp('Togekiss, zz, Garchomp, Magikarp, Gengar');
  const named = rows.filter((row) => !row.broadMatch);
  assert.deepEqual(
    named.map((row) => row.inputName).sort(),
    ['Garchomp', 'Gengar', 'Magikarp', 'Togekiss']);
  const leads = named.map((row) => row.bundle.leads?.value ?? -Infinity);
  assert.deepEqual(leads, [...leads].sort((a, b) => b - a));
  assert.ok(new Set(leads).size > 1, 'the lead rates do differ');
  // Every named row stands ahead of every fragment match.
  assert.deepEqual(
    rows.map((row) => Boolean(row.broadMatch)),
    [...named.map(() => false),
      ...rows.slice(named.length).map(() => true)]);
});

test('a query that names nothing has no rows', async () => {
  assert.deepEqual(await lookUp(''), []);
  assert.deepEqual(await lookUp(' , \n'), []);
  assert.deepEqual(await lookUp('Notapokemon'), []);
});
