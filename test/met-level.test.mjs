// Met levels: "Munna@14" in the pool says the line arrived as Munna at
// level 14. The game starts a received mon on the last four entries of its
// learnset at that level, so a Munna met at 14 (Lucky Chant 5, Yawn 7,
// Psybeam 11, Imprison 13) never had Psywave or Defense Curl. Candy-down
// reaches every level 2+ entry, so the met level decides nothing else.
import test from 'node:test';
import assert from 'node:assert/strict';

await import('./helpers/harness.mjs'); // fetch → filesystem shim
const { getAvailableMoves, loadLegalMoveData } = await import(
  '../src/playthrough/legal-moves.js',
);
const { computeSetReadiness } = await import(
  '../src/playthrough/set-readiness.js',
);

const musharna = await loadLegalMoveData('musharna');
const munna = await loadLegalMoveData('munna');

const sourcesOf = (data, progression) =>
  new Map(
    getAvailableMoves(data, progression).map((move) => [
      move.id,
      move.availableSources,
    ]),
  );

test('a Munna met at 14 arrived without its level-1 moves', () => {
  const plain = sourcesOf(musharna, { levelCap: '25' });
  assert.equal(plain.get('psywave')?.[0]?.label, 'Level 1');

  const met = sourcesOf(musharna, {
    levelCap: '25', metLevelByPokemon: { munna: 14 },
  });
  assert.ok(!met.has('psywave'), 'Psywave is gone');
  assert.ok(!met.has('defensecurl'), 'Defense Curl is gone');
  // Everything from level 2 up is candy-reachable and unchanged.
  assert.equal(met.get('yawn')?.[0]?.label, plain.get('yawn')?.[0]?.label);
  assert.equal(
    met.get('hypnosis')?.[0]?.label, plain.get('hypnosis')?.[0]?.label,
  );

  // The same individual fielded unevolved.
  const own = sourcesOf(munna, {
    levelCap: '20', metLevelByPokemon: { munna: 14 },
  });
  assert.ok(!own.has('psywave'));
  assert.equal(own.get('yawn')?.[0]?.label, 'Level 7');
});

test('a low met level keeps the starting moves', () => {
  // At level 3 Munna has learned nothing past level 1, so its starting four
  // still reach Psywave.
  const met = sourcesOf(musharna, {
    levelCap: '25', metLevelByPokemon: { munna: 3 },
  });
  assert.equal(met.get('psywave')?.[0]?.label, 'Level 1');
});

test('the relearner restores it to this individual, the daycare to a hatchling', () => {
  const relearner = sourcesOf(musharna, {
    levelCap: '25', metLevelByPokemon: { munna: 14 },
    moveRelearnerUnlocked: true,
  });
  assert.equal(relearner.get('psywave')?.[0]?.kind, 'relearner');

  const hatch = sourcesOf(musharna, {
    levelCap: '25', metLevelByPokemon: { munna: 14 }, daycareUnlocked: true,
  });
  assert.equal(hatch.get('psywave')?.[0]?.kind, 'egg');
  assert.equal(hatch.get('psywave')?.[0]?.label, 'Hatch');
});

test('readiness prices the missing level-1 move at the relearner badge', () => {
  const progression = { levelCap: '25', metLevelByPokemon: { munna: 14 } };
  const readiness = computeSetReadiness({
    legalMoveData: musharna,
    availableMoves: getAvailableMoves(musharna, progression),
    topSet: {
      moveUsage: new Map([
        ['psywave', 90], ['yawn', 80], ['hypnosis', 70], ['moonlight', 60],
      ]),
    },
    progression,
  });
  const psywave = readiness.moves.find((move) => move.id === 'psywave');
  assert.equal(psywave.status, 'later');
  assert.match(psywave.detail, /arrived without .* relearner/);
  // The relearner restores it to this individual: no re-breed is implied.
  assert.equal(readiness.needsRebreed, false);
});

test('the pool annotation reaches the optimizer', async () => {
  const { progressionAt, runPool } = await import('./helpers/harness.mjs');
  const progression = progressionAt({ badge: 1, levelCap: 25 });
  const profileOf = async (pool) =>
    (await runPool({ pool, progression })).team[0].legalityProfile;
  const plain = await profileOf(['Munna']);
  const met = await profileOf(['Munna@14']);
  assert.equal(plain.fieldedName, met.fieldedName);
  // Psywave and Defense Curl, Munna's two level-1 moves, are the whole
  // difference.
  assert.equal(plain.legalMoveCount - met.legalMoveCount, 2);
});
