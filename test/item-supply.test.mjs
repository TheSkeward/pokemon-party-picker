// An item's supply (games/item-sources.js): the copies of an item a battle
// does not use up count one by one until a source restocks it or there are
// six; a consumable counts only from a restocking source.
import assert from 'node:assert/strict';
import test from 'node:test';

import { Dex } from '@pkmn/dex';

import { isConsumableItem, isSharedItem } from '../src/games/item-use.js';
import {
  describeSupply,
  FULL_SUPPLY,
  itemSupply,
  orderItemSources,
  unauditedItemSources,
} from '../src/games/item-sources.js';
import {
  getItemSources,
  getItemSupply,
  getItemUnlockBadge,
} from '../src/games/items.js';

const single = (badge, count, via = '') =>
  ({ kind: 'single', badge, count, via });
const renewable = (kind, badge, via = '') => ({ kind, badge, via });

// [badge, copies, kind] per step of the supply the sources add up to.
const steps = (sources, consumable = false, shared = false) =>
  itemSupply(orderItemSources(sources), { consumable, shared })
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
  // Copies that turn up at one badge are one step.
  assert.deepEqual(
    steps([single(3, 1, 'npc'), single(3, 1, 'hidden item'), single(5, 1)]),
    [[3, 2, 'single'], [5, 3, 'single']],
  );
  // A wild holder at the single copy's badge restocks from that badge.
  assert.deepEqual(
    steps([single(0, 1), renewable('wild', 0), renewable('shop', 16)]),
    [[0, Infinity, 'wild']],
  );
  assert.deepEqual(steps([]), []);
});

test('six counted copies are a full supply, mined or found', () => {
  const mined = (badge, count) =>
    ({ kind: 'mining', badge, count, via: 'mining rocks, on average' });
  assert.equal(FULL_SUPPLY, 6);
  // One from an NPC, then what the rocks yield: full at the badge the count
  // reaches six, and nothing after it matters.
  assert.deepEqual(
    steps([
      single(2, 1, 'npc'), mined(3, 1), mined(4, 3), mined(7, 1),
      mined(8, 1), renewable('shop', 13),
    ]),
    [
      [2, 1, 'single'], [3, 2, 'mining'], [4, 5, 'mining'],
      [7, Infinity, 'mining'],
    ],
  );
  // A shop that opens first fills the supply before the count does.
  assert.deepEqual(
    steps([mined(4, 1), mined(8, 1), renewable('shop', 5)]),
    [[4, 1, 'mining'], [5, Infinity, 'shop']],
  );
  // Copies at one badge that pass six are one full step.
  assert.deepEqual(
    steps([single(3, 2), mined(3, 3), mined(4, 4)]),
    [[3, 5, 'single'], [4, Infinity, 'mining']],
  );
  // A battle uses a consumable up, however many are mined.
  assert.deepEqual(steps([mined(3, 6)], true), []);
  // A Z-Crystal stays in the Bag when one is given to hold: the first copy
  // equips the whole team.
  assert.ok(isSharedItem('flyiniumz') && !isSharedItem('leftovers'));
  assert.deepEqual(
    steps([single(14, 1, 'poké ball'), single(18, 1)], false, true),
    [[14, Infinity, 'single']],
  );
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
  // One Life Orb from an item ball, then the shop.
  assert.deepEqual(supply('lifeorb'), [
    [16, 1, 'single'], [17, Infinity, 'shop'],
  ]);
  // The hidden Focus Sash at badge 2 is one battle's worth; the shop counts.
  assert.deepEqual(supply('focussash'), [[17, Infinity, 'shop']]);
  assert.equal(getItemUnlockBadge('focussash'), 17);
  // A Pickup holder at level 71 finds Leftovers, two badges before the one
  // an NPC gives.
  assert.deepEqual(supply('leftovers'), [[11, Infinity, 'pickup']]);
  // The Aventurine Woods' Lum tree gives the berry and the plot to regrow
  // it in; a Lansat Berry is first had at badge 14. A wild Audino carries a
  // Sitrus Berry before the plots open.
  assert.deepEqual(supply('lumberry'), [[7, Infinity, 'regrow']]);
  assert.deepEqual(supply('lansatberry'), [[14, Infinity, 'regrow']]);
  assert.deepEqual(supply('sitrusberry'), [[5, Infinity, 'wild']]);
  // An Oran Berry is sold a badge after Pickup first finds one.
  assert.deepEqual(supply('oranberry'), [[0, Infinity, 'pickup']]);
  // One Assault Vest until the post-game point counter.
  assert.deepEqual(
    supply('assaultvest'), [[14, 1, 'single'], [18, Infinity, 'shop']]);
  // Grimer on the Old Rod carries Black Sludge from the start.
  assert.deepEqual(supply('blacksludge'), [[0, Infinity, 'wild']]);
  // Shuckle always holds Berry Juice, which nothing else restocks.
  assert.deepEqual(supply('berryjuice'), [[4, Infinity, 'wild']]);
  // The one Kricketot is an event, not a wild table: a Metronome is first
  // restocked by the shop, and its first wild holder is a Chatot.
  assert.deepEqual(supply('metronome'), [[2, Infinity, 'shop']]);
  const metronomeHolder = getItemSources('metronome')
    .find((source) => source.kind === 'wild');
  assert.equal(metronomeHolder.badge, 5);
  assert.match(metronomeHolder.via, /^Chatot \(5%\), Chrysolia Forest/);
  assert.deepEqual(supply('notanitem'), []);
  assert.equal(getItemUnlockBadge('notanitem'), null);
  // A Dusk Stone: one mined and one placed by badge 3, then the rocks,
  // full at badge 7, six badges before the shop sells one.
  assert.deepEqual(supply('duskstone'), [
    [3, 2, 'mining'], [4, 5, 'mining'], [7, Infinity, 'mining'],
  ]);
  // A Plate averages four copies by the post-game, where the rocks of the
  // Cauldron of the Future come back.
  assert.deepEqual(supply('earthplate'), [
    [4, 1, 'mining'], [8, 2, 'mining'], [14, 3, 'mining'],
    [18, Infinity, 'regrow'],
  ]);
});

test('a supply in words names each kind of source once, and when it fills', () => {
  const words = (sources, use) =>
    describeSupply(itemSupply(orderItemSources(sources), use));
  const mined = (badge, count) =>
    ({ kind: 'mining', badge, count, via: 'mining rocks, on average' });

  // A placed copy, then the holder that restocks: the shop past it is not
  // part of the supply, so it is not part of the sentence.
  assert.equal(
    words([
      single(7, 1, 'item ball'),
      renewable('wild', 8, 'Bronzor (5%), Iolia Valley'),
      renewable('shop', 13),
    ]),
    'a copy at badge 7 (item ball); ' +
      'held by wild Bronzor (5%), Iolia Valley, from badge 8',
  );
  assert.equal(
    words([renewable('shop', 0, 'Department Store 8F')]),
    'sold from the start (Department Store 8F)',
  );
  // Later copies of a kind already named add nothing but the badge they
  // fill the supply by.
  assert.equal(
    words([single(2, 1, 'npc'), mined(3, 1), mined(4, 3), mined(7, 1)]),
    'a copy at badge 2 (npc); mined from badge 3; 6 copies by badge 7',
  );
  assert.equal(
    words([single(3, 1, 'npc'), single(5, 1, 'hidden item, Route 2')]),
    'a copy at badge 3 (npc)',
  );
  // One Z-Crystal is a full supply: no count to reach.
  assert.equal(
    words([single(9, 1, 'npc'), single(14, 1)], { shared: true }),
    'a copy at badge 9 (npc)',
  );
  // A kind with no wording of its own goes by the item data's words.
  assert.equal(
    words([renewable('regrow', 7, 'planted in a berry plot')]),
    'planted in a berry plot, from badge 7',
  );
  assert.equal(words([]), '');
});
