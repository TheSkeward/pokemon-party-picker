// The result cache key is also the persisted record's IndexedDB key, and
// LevelDB copies record keys into its manifest on every compaction. So the
// key is a digest of the score context (progression, breeding context,
// data signature), never the context's text: with the daycare open the
// breeding context alone ran to hundreds of kilobytes, and a day of such
// keys grew one manifest to 13 GB, which crashed the browser on every open.
import test from 'node:test';
import assert from 'node:assert/strict';
import { progressionAt, runPool } from './helpers/harness.mjs';

const pool = [
  'Pineco', 'Spearow', 'Bidoof', 'Ekans', 'Hoothoot', 'Meowth', 'Patrat',
  'Pidgey',
];
const donorPool = ['Rattata', 'Noibat'];
const daycareOpen = {
  ...progressionAt({ badge: 7, levelCap: 60 }),
  daycareUnlocked: true,
  moveRelearnerUnlocked: true,
};

test('the result cache key is bounded by the pool, not the score context', async () => {
  const result = await runPool({ pool, donorPool, progression: daycareOpen });
  // A digest plus one id per pool line; the text form ran to 200,000+.
  const bound = 100 + pool.length * 20;
  assert.ok(
    result.poolKey.length < bound,
    `pool key is ${result.poolKey.length} characters`,
  );
});

test('the digested key still tells score contexts apart', async () => {
  const open = await runPool({ pool, donorPool, progression: daycareOpen });
  const closed = await runPool({
    pool,
    donorPool,
    progression: { ...daycareOpen, daycareUnlocked: false },
  });
  assert.notEqual(closed.poolKey, open.poolKey);
  const again = await runPool({ pool, donorPool, progression: daycareOpen });
  assert.equal(again.poolKey, open.poolKey);
});
