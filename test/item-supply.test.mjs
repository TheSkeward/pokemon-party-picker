// An item's supply (games/item-sources.js): single copies of an item a
// battle does not use up count one by one until a source restocks it; a
// consumable counts only from a restocking source.
import assert from 'node:assert/strict';
import test from 'node:test';

import { Dex } from '@pkmn/dex';

import { isConsumableItem } from '../src/games/consumables.js';
import {
  itemSupply,
  orderItemSources,
  RENEWABLE_SOURCE_KINDS,
  unauditedItemSources,
} from '../src/games/item-sources.js';
import {
  getItemSupply,
  getItemUnlockBadge,
  renewableSources,
} from '../src/games/items.js';

const single = (badge, count, via = '') =>
  ({ kind: 'single', badge, count, via });
const renewable = (kind, badge, via = '') => ({ kind, badge, via });

// [badge, copies, kind] per step of the supply the sources add up to.
const steps = (sources, consumable = false) =>
  itemSupply(orderItemSources(sources), consumable)
    .map(({ badge, copies, source }) => [badge, copies, source.kind]);

test('single copies count up until a source restocks the item', () => {
  assert.deepEqual(
    steps([
      renewable('shop', 17),
      single(15, 2, 'hidden'),
      single(13, 1, 'npc'),
      // Past the shop a copy changes nothing.
      single(18, 1, 'poké ball'),
    ]),
    [[13, 1, 'single'], [15, 3, 'single'], [17, Infinity, 'shop']],
  );
  assert.deepEqual(steps([single(14, 1)]), [[14, 1, 'single']]);
  // A wild holder at the single copy's badge restocks from that badge.
  assert.deepEqual(
    steps([single(0, 1), renewable('wild', 0), renewable('shop', 16)]),
    [[0, Infinity, 'wild']],
  );
  assert.deepEqual(steps([]), []);
});

test('a consumable counts only from a source that restocks it', () => {
  assert.deepEqual(
    steps([single(2, 1, 'hidden'), renewable('shop', 17)], true),
    [[17, Infinity, 'shop']],
  );
  assert.deepEqual(
    steps(
      [single(1, 3), renewable('regrow', 9), renewable('shop', 17)], true),
    [[9, Infinity, 'regrow']],
  );
  // Single copies alone never supply a consumable.
  assert.deepEqual(steps([single(5, 1, 'npc')], true), []);
});

test('an unaudited first source counts whatever the item', () => {
  const sources = unauditedItemSources(
    {
      oranberry: { badge: 0, via: 'Route 36' },
      leftovers: { badge: 11, via: 'the Route 11 Snorlax' },
      choicescarf: { badge: 8, via: 'Battle Frontier (48 BP)' },
    },
    { choicescarf: 8, leftovers: 16, metalcoat: 2 },
  );
  assert.deepEqual(sources, {
    oranberry: [{ kind: 'unaudited', badge: 0, via: 'Route 36' }],
    leftovers: [
      { kind: 'unaudited', badge: 11, via: 'the Route 11 Snorlax' },
      { kind: 'shop', badge: 16, via: '' },
    ],
    // A first source at the shop's badge is the shop.
    choicescarf: [{ kind: 'shop', badge: 8, via: 'Battle Frontier (48 BP)' }],
    metalcoat: [{ kind: 'shop', badge: 2, via: '' }],
  });
  // Its copies are unknown, so it carries no count, consumable or not.
  assert.deepEqual(steps(sources.oranberry, true), [[0, null, 'unaudited']]);
  assert.deepEqual(
    steps(sources.leftovers),
    [[11, null, 'unaudited'], [16, Infinity, 'shop']],
  );
});

test('every Berry and Gem is a consumable, and the boosters are not', () => {
  for (const item of Dex.forGen(9).items.all()) {
    if (item.isBerry || item.isGem) {
      assert.ok(isConsumableItem(item.id), `${item.name} is used up`);
    }
  }
  for (const id of ['focussash', 'weaknesspolicy', 'whiteherb', 'airballoon',
    'elementalseed', 'berryjuice']) {
    assert.ok(isConsumableItem(id), id);
  }
  for (const id of ['leftovers', 'choicescarf', 'miracleseed', 'lifeorb',
    'eviolite', 'flyiniumz', 'firestone', 'pixieplate']) {
    assert.ok(!isConsumableItem(id), id);
  }
});

test("Reborn's supply follows its sources", () => {
  const supply = (id) => getItemSupply(id).map(({ badge, copies, source }) =>
    [badge, copies, source.kind]);
  // One Leftovers from an NPC, then the shop.
  assert.deepEqual(supply('leftovers'), [
    [13, 1, 'single'], [17, Infinity, 'shop'],
  ]);
  // The hidden Focus Sash at badge 2 is one battle's worth; the shop counts.
  assert.deepEqual(supply('focussash'), [[17, Infinity, 'shop']]);
  assert.equal(getItemUnlockBadge('focussash'), 17);
  // No shop sells an Assault Vest: the one copy is all there is.
  assert.deepEqual(supply('assaultvest'), [[14, 1, 'single']]);
  assert.deepEqual(supply('notanitem'), []);
  assert.equal(getItemUnlockBadge('notanitem'), null);
  for (const [id, source] of renewableSources()) {
    assert.ok(RENEWABLE_SOURCE_KINDS.has(source.kind), id);
    assert.equal(getItemSupply(id).at(-1).source, source, id);
  }
});
