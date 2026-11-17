import test from 'node:test';
import assert from 'node:assert/strict';

// A monotype run: the gamestate names one type, and the team is fielded
// from forms that have it or evolve into it.

const { loadShared, progressionAt, runPool } =
  await import('./helpers/harness.mjs');
const { normalizeProgression } =
  await import('../src/playthrough/progression.js');
const { fieldsInMonotype, hasMonotype } =
  await import('../src/playthrough/monotype.js');
const { buildInputGroups } =
  await import('../src/teamBuilder/input-groups.js');
const { getReachableLineCandidates } =
  await import('../src/teamBuilder/line-reachability.js');
const { getReachableSpecies } =
  await import('../src/playthrough/current-species.js');

const lineOf = (result, inputName) => {
  const line = result.lines.find(
    (entry) => (entry.best || entry.bestNonMega)?.inputName === inputName);
  return line ? line.best || line.bestNonMega : null;
};

test('the monotype is saved only when it names a type', () => {
  assert.ok(!('monotype' in normalizeProgression({})));
  assert.ok(!('monotype' in normalizeProgression({ monotype: '' })));
  assert.ok(!('monotype' in normalizeProgression({ monotype: 'Sound' })));
  assert.equal(normalizeProgression({ monotype: 'Fire' }).monotype, 'Fire');
});

test('a form counts by its type, its evolutions and never by a Mega', () => {
  // Of the type itself.
  assert.ok(hasMonotype('charizard', 'Flying'));
  assert.ok(!hasMonotype('charmander', 'Flying'));
  // Fielded on the way to it.
  assert.ok(fieldsInMonotype('charmander', 'Flying'));
  assert.ok(fieldsInMonotype('eevee', 'Water'));
  assert.ok(!fieldsInMonotype('vaporeon', 'Normal'));
  // A Mega needs the type on both sides of the Mega Evolution.
  assert.ok(hasMonotype('charizardmegay', 'Flying'));
  assert.ok(hasMonotype('charizardmegay', 'Fire'));
  assert.ok(hasMonotype('charizardmegax', 'Fire'));
  assert.ok(!hasMonotype('charizardmegax', 'Flying'));
  assert.ok(!hasMonotype('charizardmegax', 'Dragon'));
  // So a Mega's type brings no line into the run.
  assert.ok(!fieldsInMonotype('charmander', 'Dragon'));
  assert.ok(!fieldsInMonotype('charizard', 'Dragon'));
  // No type named: every form counts.
  assert.ok(fieldsInMonotype('vaporeon', ''));
});

test('a line aims only at forms of the type', async () => {
  const { pokemonIndex } = await loadShared();
  const targets = (name, monotype) => {
    const [group] = buildInputGroups(name, pokemonIndex);
    return getReachableLineCandidates(
      group,
      pokemonIndex,
      { ...progressionAt({ badge: 16, levelCap: 90 }), monotype },
    ).map((candidate) => candidate.id).sort();
  };

  assert.deepEqual(
    targets('Charmander', 'Fire'),
    ['charizard', 'charizardmegax', 'charizardmegay', 'charmander',
      'charmeleon']);
  assert.deepEqual(
    targets('Charmander', 'Flying'), ['charizard', 'charizardmegay']);
  assert.deepEqual(targets('Charmander', 'Dragon'), []);
  assert.deepEqual(targets('Eevee', 'Normal'), ['eevee']);
  // An Eevee in a Fire run is a Flareon in waiting, never an Eevee for
  // good.
  assert.deepEqual(targets('Eevee', 'Fire'), ['flareon']);
  // An owned form already past the type is not fielded.
  assert.deepEqual(targets('Vaporeon', 'Normal'), []);
  assert.deepEqual(targets('Vaporeon', 'Water'), ['vaporeon']);
});

test('a monotype run holds a line inside its type', async () => {
  const pool = ['Charmander', 'Eevee', 'Azurill', 'Scyther', 'Vaporeon'];
  const late = progressionAt({ badge: 16, levelCap: 90 });

  const open = await runPool({ pool, progression: late, scoreAllLines: true });
  assert.deepEqual(open.outsideMonotype, []);
  assert.match(lineOf(open, 'Scyther').legalityProfile.currentId, /^scizor/);

  const flying = await runPool({
    pool, progression: { ...late, monotype: 'Flying' }, scoreAllLines: true,
  });
  assert.deepEqual(flying.outsideMonotype, ['Eevee', 'Azurill', 'Vaporeon']);
  assert.equal(lineOf(flying, 'Eevee'), null);
  assert.ok(flying.team.every((choice) => choice.inputName !== 'Eevee'));
  // Scizor is Bug/Steel: the Scyther is kept, and the card says why.
  const scyther = lineOf(flying, 'Scyther').legalityProfile;
  assert.equal(scyther.currentId, 'scyther');
  assert.deepEqual(
    scyther.legalityProof.blockedEvolutions.map((entry) => entry.to),
    ['scizor']);
  assert.match(
    scyther.legalityProof.blockedEvolutions[0].reason,
    /outside the Flying monotype/);
  assert.match(lineOf(flying, 'Charmander').pokemonId, /^charizard(megay)?$/);

  const normal = await runPool({
    pool, progression: { ...late, monotype: 'Normal' }, scoreAllLines: true,
  });
  assert.deepEqual(
    normal.outsideMonotype, ['Charmander', 'Scyther', 'Vaporeon']);
  assert.equal(lineOf(normal, 'Eevee').legalityProfile.currentId, 'eevee');
  assert.equal(lineOf(normal, 'Azurill').legalityProfile.currentId, 'azurill');
});

test('a pre-evolution is fielded before it has the type', async () => {
  const early = {
    ...progressionAt({ badge: 0, levelCap: 20 }), monotype: 'Flying',
  };
  const result = await runPool({
    pool: ['Charmander', 'Pikachu'], progression: early, scoreAllLines: true,
  });
  // Charmeleon at the cap of 20: Fire alone, and a Charizard in waiting.
  assert.equal(
    lineOf(result, 'Charmander').legalityProfile.currentId, 'charmeleon');
  assert.deepEqual(result.outsideMonotype, ['Pikachu']);
});

test('a line outside the type still evolves as a donor', () => {
  const water = {
    ...progressionAt({ badge: 16, levelCap: 90 }), monotype: 'Water',
  };
  // Pikachu is no part of a Water team, so nothing holds it back.
  assert.ok(
    getReachableSpecies('pikachu', water).some(
      (species) => species.id === 'raichu'));
  // An Eevee is: the run keeps it for Vaporeon.
  assert.deepEqual(
    getReachableSpecies('eevee', water).map((species) => species.id).sort(),
    ['eevee', 'vaporeon']);
});
