// SoulSilver's curated item tables: every Gen 4 evolution item is priced,
// every id is a real item, and the schedule's headline items agree with the
// timeline.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveGame,
  loadGame,
  setActiveGame,
} from '../src/games/registry.js';

await loadGame('soulsilver');
import {
  SOULSILVER_EVOLUTION_ITEM_AVAILABILITY,
  SOULSILVER_EXTRA_INVENTORY_ITEMS,
  SOULSILVER_ITEM_UNLOCK_BADGES,
  SOULSILVER_SHOP_ITEM_BADGES,
} from '../src/soulsilver/items.js';
import { SOULSILVER_PROGRESSION_CHECKPOINTS } from '../src/soulsilver/schedule.js';
import { GEN4_PROGRESSION_SPECIES } from '../src/generated/gen4ProgressionSpecies.generated.js';
import { GEN4_HELD_ITEMS_BY_ID } from '../src/generated/gen4HeldItems.generated.js';
import { GEN7_HELD_ITEMS_BY_ID } from '../src/generated/gen7HeldItems.generated.js';

const { getItemUnlockBadge } = await import('../src/games/schedule.js');
const { getRenewablyObtainableItems } = await import('../src/games/items.js');
const { toId } = await import('../src/utils/ids.js');

function withSoulSilver(fn) {
  const previous = getActiveGame().id;
  setActiveGame('soulsilver');
  try {
    return fn();
  } finally {
    setActiveGame(previous);
  }
}

test('every Gen 4 evolution item has a sourced availability entry', () => {
  // Item-shaped methods only: the dex also names a stone on the location
  // evolutions (Leafeon, Glaceon, Milotic), which SoulSilver blocks outright.
  const evolutionItems = new Set(
    Object.values(GEN4_PROGRESSION_SPECIES)
      .filter((species) =>
        ['useItem', 'levelHold', 'trade'].includes(species.evoType) &&
        species.evoItem)
      .map((species) => toId(species.evoItem)),
  );
  assert.equal(evolutionItems.size, 23);
  for (const id of evolutionItems) {
    const entry = SOULSILVER_EVOLUTION_ITEM_AVAILABILITY[id];
    assert.ok(entry, `${id} has no availability entry`);
    assert.ok(['farmable', 'farmable-tedious'].includes(entry.status), id);
    assert.ok(entry.source.length > 0, id);
    assert.ok(id in SOULSILVER_ITEM_UNLOCK_BADGES, `${id} has no badge`);
  }
});

test('every timeline and shop id is a real item', () => {
  // The Gen 7 catalog is the widest item universe the app knows.
  const extras = new Set(
    SOULSILVER_EXTRA_INVENTORY_ITEMS.map((item) => item.id),
  );
  const known = (id) =>
    id in GEN4_HELD_ITEMS_BY_ID ||
    id in GEN7_HELD_ITEMS_BY_ID ||
    extras.has(id);
  for (const id of Object.keys(SOULSILVER_ITEM_UNLOCK_BADGES)) {
    assert.ok(known(id), `unknown timeline item ${id}`);
  }
  for (const id of Object.keys(SOULSILVER_SHOP_ITEM_BADGES)) {
    assert.ok(known(id), `unknown shop item ${id}`);
    // A shop may open after a fixed pickup, never before the first source.
    const first = SOULSILVER_ITEM_UNLOCK_BADGES[id]?.badge;
    assert.ok(
      SOULSILVER_SHOP_ITEM_BADGES[id] >= first,
      `${id}: shop badge precedes the timeline`,
    );
  }
  for (const item of SOULSILVER_EXTRA_INVENTORY_ITEMS) {
    assert.ok(!(item.id in GEN4_HELD_ITEMS_BY_ID), `${item.id} is already in the catalog`);
  }
});

test('checkpoint headline items agree with the timeline', () => {
  for (const checkpoint of SOULSILVER_PROGRESSION_CHECKPOINTS) {
    for (const id of checkpoint.unlocks.items || []) {
      assert.equal(
        SOULSILVER_ITEM_UNLOCK_BADGES[id]?.badge,
        checkpoint.badges,
        `${id} on ${checkpoint.id}`,
      );
    }
  }
  withSoulSilver(() => {
    assert.equal(getItemUnlockBadge('lifeorb'), 1);
    assert.equal(getItemUnlockBadge('choicespecs'), 6);
    assert.equal(getItemUnlockBadge('leftovers'), 11);
    assert.equal(getItemUnlockBadge('damprock'), null); // trade only
  });
});

test('the inventory sync offers the Athlete Shop and Game Corner at two badges', () => {
  withSoulSilver(() => {
    const ids = getRenewablyObtainableItems(2).map((item) => item.id);
    assert.ok(ids.includes('metalcoat') && ids.includes('widelens'));
    assert.ok(!ids.includes('choicescarf'));
    assert.ok(getRenewablyObtainableItems(8).some((item) => item.id === 'choicescarf'));
  });
});
