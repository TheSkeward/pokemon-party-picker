// A pool entry that states a caught ability, a move lock or a met level
// describes one Pokémon, so it fields only what that Pokémon can become.
// The daycare's reach across a hatchable line (an Eevee may field Espeon)
// belongs to the line's plain entries: a hatch is another Pokémon, and the
// entry's ability and locks never described it.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bestChoice,
  lineFor,
  progressionAt,
  runPool,
} from './helpers/harness.mjs';

const daycare = {
  ...progressionAt({ badge: 5, levelCap: 50 }),
  daycareUnlocked: true,
  moveRelearnerUnlocked: true,
};

test('a marked entry fields itself; a plain one fields what its line can hatch', async () => {
  const result = await runPool({
    pool: [
      'Eevee',
      'Umbreon (Synchronize) {Toxic / Protect / Moonlight}',
      'Sylveon {Hyper Voice}',
      'Vaporeon@30',
    ],
    progression: daycare,
  });
  assert.equal(bestChoice(result, 'Umbreon').name, 'Umbreon');
  assert.equal(bestChoice(result, 'Sylveon').name, 'Sylveon');
  assert.equal(bestChoice(result, 'Vaporeon').name, 'Vaporeon');
  // The plain Eevee keeps the whole family on the table.
  const eevee = lineFor(result, 'Eevee');
  assert.ok(
    eevee.candidates.some((row) => row.candidate?.id === 'espeon'),
    eevee.candidates.map((row) => row.candidate?.id).join(', '),
  );
  // The locks ride the entry they were written on: the readiness line
  // prices all three, and every one the cap allows is seated.
  const umbreon = bestChoice(result, 'Umbreon');
  const readiness = umbreon.legalityProfile.setReadiness;
  assert.deepEqual(
    [...readiness.moves, ...readiness.lockedMoves]
      .filter((move) => move.locked)
      .map((move) => move.id)
      .sort(),
    ['moonlight', 'protect', 'toxic'],
  );
  const seated = new Set(
    umbreon.legalityProfile.recommendedMoves.map((move) => move.id),
  );
  for (const move of [...readiness.moves, ...readiness.lockedMoves]) {
    if (move.locked && move.status === 'ready') {
      assert.ok(seated.has(move.id), `${move.id} is ready but not seated`);
    }
  }

  // Unmarked, the same Umbreon may breed back and field any Eeveelution.
  const plain = await runPool({ pool: ['Umbreon'], progression: daycare });
  assert.ok(
    lineFor(plain, 'Umbreon').candidates.some(
      (row) => row.candidate?.id === 'espeon',
    ),
  );
});
