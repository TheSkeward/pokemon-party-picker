// Partner-only moves (Helping Hand, Ally Switch, Follow Me, ...) do nothing
// with no ally on the field. A singles family never recommends or scores
// them; a doubles family keeps them. The dex has no flag for this, and their
// priority values would otherwise rank them among the best status fillers.
import test from 'node:test';
import assert from 'node:assert/strict';

const { isInertInFamily } = await import('../src/move-meta.js');
const { progressionAt, runPool } = await import('./helpers/harness.mjs');

test('the partner-only set is keyed by family, not by game', () => {
  for (const family of ['singles', 'gen4singles', 'gen9natdexsingles']) {
    assert.ok(isInertInFamily('helpinghand', family), family);
    assert.ok(isInertInFamily('allyswitch', family), family);
  }
  for (const family of ['doubles', 'gen5doubles']) {
    assert.ok(!isInertInFamily('helpinghand', family), family);
  }
  assert.ok(!isInertInFamily('magiccoat', 'singles'));
});

test('a singles set never seats a tutor Helping Hand, even into a dead slot', async () => {
  const progression = {
    ...progressionAt({ badge: 1, levelCap: 25 }),
    availableTutorMoveIds: ['helpinghand', 'allyswitch', 'afteryou', 'magiccoat'],
  };
  const result = await runPool({ pool: ['Zigzagoon', 'Munna@'], progression });
  for (const row of result.team) {
    const ids = row.legalityProfile.recommendedMoves.map((move) => move.id);
    for (const id of ['helpinghand', 'allyswitch', 'afteryou']) {
      assert.ok(!ids.includes(id), `${row.inputName}: ${ids}`);
    }
  }
});
