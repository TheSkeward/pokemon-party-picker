// Move locks: "Meowstic {Thunder Wave}" in the pool makes Thunder Wave the
// line's own canonical move. It seats first in every build the optimizer
// offers, no fill takes its seat, and the readiness line prices it beside
// the competitive set without counting it there, so a lock changes the
// score only through the set it builds.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestChoice,
  loadShared,
  progressionAt,
  runPool,
} from './helpers/harness.mjs';

const { canonicalMoveIds, computeSetReadiness } = await import(
  '../src/playthrough/set-readiness.js',
);
const { loadLegalMoveData, lockedMoveIdsFor } = await import(
  '../src/playthrough/legal-moves.js',
);
const { lockedMovesByPokemonId, unknownMoveLocks, withPoolAnnotations } =
  await import('../src/teamBuilder/input-groups.js');

const at = (badge, levelCap) => ({
  ...progressionAt({ badge, levelCap }),
  moveRelearnerUnlocked: true,
  daycareUnlocked: true,
});
const ids = (choice) =>
  choice.legalityProfile.recommendedMoves.map((move) => move.id);
const lockedIds = (choice) =>
  choice.legalityProfile.recommendedMoves
    .filter((move) => move.locked)
    .map((move) => move.id);
const builds = (choice) => [choice, ...(choice.buildAlternatives || [])];

test('locked moves lead the canonical set, then usage fills it to four', () => {
  const usage = new Map([
    ['psychic', 90], ['reflect', 80], ['lightscreen', 70], ['calmmind', 60],
    ['thunderwave', 5],
  ]);
  assert.deepEqual(canonicalMoveIds(usage), [
    'psychic', 'reflect', 'lightscreen', 'calmmind',
  ]);
  assert.deepEqual(canonicalMoveIds(usage, 4, ['thunderwave']), [
    'thunderwave', 'psychic', 'reflect', 'lightscreen',
  ]);
  // A lock already in the record keeps one seat, in the pool's order.
  assert.deepEqual(canonicalMoveIds(usage, 4, ['reflect', 'thunderwave']), [
    'reflect', 'thunderwave', 'psychic', 'lightscreen',
  ]);
  assert.deepEqual(canonicalMoveIds(null, 4, ['thunderwave']), ['thunderwave']);
});

test('the pool resolves move names and reports the unknown ones', async () => {
  const { pokemonIndex } = await loadShared();
  const query = 'Meowstic {Thunder Wave / Psychic / Thunderwav}, Eevee';
  assert.deepEqual(lockedMovesByPokemonId(query, pokemonIndex), {
    meowstic: ['thunderwave', 'psychic'],
  });
  assert.deepEqual(unknownMoveLocks(query, pokemonIndex), [
    { name: 'Meowstic', move: 'Thunderwav' },
  ]);
  const progression = { levelCap: '45' };
  assert.deepEqual(
    withPoolAnnotations(progression, query, pokemonIndex).lockedMovesByPokemon,
    { meowstic: ['thunderwave', 'psychic'] },
  );
  // A pool without marks leaves the progression object itself.
  assert.equal(withPoolAnnotations(progression, 'Eevee', pokemonIndex), progression);
});

test('a lock on the caught form reaches the evolved one', () => {
  const progression = { lockedMovesByPokemon: { espurr: ['thunderwave'] } };
  assert.deepEqual(lockedMoveIdsFor(progression, 'meowstic'), ['thunderwave']);
  assert.deepEqual(lockedMoveIdsFor(progression, 'espurr'), ['thunderwave']);
  assert.deepEqual(lockedMoveIdsFor(progression, 'eevee'), []);
  assert.deepEqual(lockedMoveIdsFor({}, 'meowstic'), []);
});

test('the readiness line prices a lock beside the competitive set', async () => {
  const meowstic = await loadLegalMoveData('meowstic');
  const topSet = {
    moveUsage: new Map([
      ['psychic', 90], ['reflect', 80], ['lightscreen', 70], ['calmmind', 60],
    ]),
  };
  const progression = {
    ...at(5, 45),
    lockedMovesByPokemon: { meowstic: ['thunderwave', 'reflect'] },
  };
  const { getAvailableMoves } = await import(
    '../src/playthrough/legal-moves.js',
  );
  const readiness = computeSetReadiness({
    legalMoveData: meowstic,
    availableMoves: getAvailableMoves(meowstic, progression),
    topSet,
    progression,
  });
  // The competitive set is unchanged by the lock: the same four moves,
  // the same ready count, the same completion cap.
  assert.deepEqual(readiness.moves.map((move) => move.id), [
    'psychic', 'reflect', 'lightscreen', 'calmmind',
  ]);
  assert.deepEqual(
    readiness.moves.map((move) => move.locked),
    [false, true, false, false],
  );
  // Thunder Wave is TM73, after badge 16: priced, not counted.
  assert.deepEqual(
    readiness.lockedMoves.map((move) => [move.id, move.status, move.locked]),
    [['thunderwave', 'later', true]],
  );
  assert.match(readiness.lockedMoves[0].detail, /TM73/);
  // Reflect is both locked and the record's; Calm Mind's seat went to
  // Thunder Wave.
  assert.deepEqual(
    readiness.moves.map((move) => move.displaced),
    [false, false, false, true],
  );
  const plain = computeSetReadiness({
    legalMoveData: meowstic,
    availableMoves: getAvailableMoves(meowstic, at(5, 45)),
    topSet,
    progression: at(5, 45),
  });
  assert.equal(readiness.readyMoveCount, plain.readyMoveCount);
  assert.equal(readiness.fullAtCap, plain.fullAtCap);
  assert.deepEqual(plain.lockedMoves, []);
  assert.ok(plain.moves.every((move) => !move.displaced));
});

test("the team analysis reads the pool's locks as the optimizer does", async () => {
  const { pokemonIndex } = await loadShared();
  const query = 'Meowstic {Fake Out / Psyshock}';
  const progression = at(5, 45);
  const result = await runPool({ pool: [query], progression });
  const { buildTeamAnalysis } = await import(
    '../src/teamBuilder/team-analysis.js',
  );
  const analysis = await buildTeamAnalysis(result.team, progression, {
    family: 'singles', selection: 'all', query, pokemonIndex,
  });
  const readiness = analysis.profiles[0].setReadiness;
  const shown = [...readiness.moves, ...readiness.lockedMoves]
    .filter((move) => move.locked)
    .map((move) => move.id)
    .sort();
  assert.deepEqual(shown, ['fakeout', 'psyshock']);
});

test('a legal lock seats first in every build and a blocked one waits', async () => {
  const plain = bestChoice(
    await runPool({ pool: ['Meowstic'], progression: at(5, 45) }),
    'Meowstic',
  );
  assert.ok(!ids(plain).includes('fakeout'), ids(plain));

  const locked = bestChoice(
    await runPool({
      pool: ['Meowstic {Fake Out / Psyshock}'], progression: at(5, 45),
    }),
    'Meowstic',
  );
  for (const build of builds(locked)) {
    assert.deepEqual(
      ids(build).slice(0, 2), ['fakeout', 'psyshock'], build.buildKey,
    );
    assert.deepEqual(lockedIds(build), ['fakeout', 'psyshock'], build.buildKey);
  }

  // Thunder Wave is not learnable until badge 16: the set and the score
  // are the plain ones, and the readiness line says what it waits for.
  const result = await runPool({
    pool: ['Meowstic {Thunder Wave}'], progression: at(5, 45),
  });
  const waiting = bestChoice(result, 'Meowstic');
  assert.deepEqual(ids(waiting), ids(plain));
  assert.deepEqual(lockedIds(waiting), []);
  assert.ok(Math.abs(waiting.score - plain.score) < 1e-6);
  const lock = waiting.legalityProfile.setReadiness.lockedMoves[0];
  assert.equal(lock.id, 'thunderwave');
  assert.equal(lock.status, 'later');
  assert.deepEqual(result.ignoredMoveLocks, []);

  // A move the line never learns is blocked, not seated; a name no move
  // answers to is reported.
  const blocked = bestChoice(
    await runPool({
      pool: ['Meowstic {Earthquake / Thunderwav}'], progression: at(5, 45),
    }),
    'Meowstic',
  );
  assert.deepEqual(ids(blocked), ids(plain));
  assert.equal(
    blocked.legalityProfile.setReadiness.lockedMoves[0].status, 'blocked',
  );
  const reported = await runPool({
    pool: ['Meowstic {Earthquake / Thunderwav}'], progression: at(5, 45),
  });
  assert.deepEqual(reported.ignoredMoveLocks, [
    { name: 'Meowstic', move: 'Thunderwav' },
  ]);
});

test('a locked self-KO move seats, since the lock is the record', async () => {
  const forretress = bestChoice(
    await runPool({
      pool: ['Forretress {Explosion}'], progression: at(4, 45),
    }),
    'Forretress',
  );
  for (const build of builds(forretress)) {
    assert.equal(ids(build)[0], 'explosion', build.buildKey);
    assert.deepEqual(lockedIds(build), ['explosion'], build.buildKey);
  }
});
