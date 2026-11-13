// Item sources derived from map events (scripts/essentials/event-sources.mjs),
// on Reborn's rules and data: the copies placed on the maps, when a map and
// a gated event can be reached, and the mart stock the guide's shop table
// lacks.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  conditionBadge,
  datedSales,
  expectedCopySteps,
  GIVEN_COPY_KINDS,
  mapReachBadges,
  mapsVisitedOnce,
  martSales,
  martStock,
  miningDigs,
  missedShopStock,
  PLACED_COPY_KINDS,
  placedCopies,
} from '../scripts/essentials/event-sources.mjs';
import { itemId } from '../scripts/essentials/item-id.mjs';
import {
  REBORN_EVENT_DATING,
  rebornBadgeSwitchBadge,
} from '../scripts/reborn/event-dating.mjs';
import { getItemSources, getItemSupply } from '../src/games/items.js';

test('an event is dated by its badge switches and episode variables', () => {
  // Badge switches only, so a map's own switch does not date these.
  const dating = {
    ...REBORN_EVENT_DATING,
    switchBadge: rebornBadgeSwitchBadge,
  };
  const badge = (conditions) => conditionBadge(conditions, dating);
  assert.equal(badge([]), 0);
  assert.equal(badge([{ switch: 139, name: 'Fifth Badge' }]), 5);
  // The latest of several, and an episode variable counts from its
  // episode's first badge.
  assert.equal(
    badge([
      { switch: 64, name: 'Second Badge' },
      { variable: 173, name: 'E12 Story', atLeast: 4 },
    ]),
    9,
  );
  assert.equal(
    badge([{ variable: 118, name: 'E7 Story', op: '>=', value: 15 }]), 4);
  // A confirmation, a price, a facing test, a negation and a switch that
  // must be off gate nothing in time.
  assert.equal(
    badge([
      { choice: 'Yes' },
      { money: '>=', value: 10000 },
      { conditionType: 6, parameters: [-1, 8] },
      { not: { switch: 165, name: 'Abra Bond', is: true } },
      { switch: 170, name: 'Bust Cage', is: false },
      { variable: 108, name: 'Cage1', atLeast: 0 },
    ]),
    0,
  );
  // Nor does a battle the branch runs, or a badge count asked outright
  // beyond the count itself.
  assert.equal(
    badge([{ script: 'pbTrainerBattle(:CAMPER,"Billy","",false,0)' }]), 0);
  assert.equal(
    badge([{ badges: 5 }, { script: 'pbDoubleTrainerBattle(:A,"B",0)' }]), 5);
  // A quest switch, an item check or a counter is no badge: undated.
  assert.equal(badge([{ switch: 2012, name: 'Blacksteam Case' }]), null);
  assert.equal(
    badge([{ script: '$PokemonBag.pbQuantity(:SHOALSALT)>0' }]), null);
  assert.equal(
    badge([{ variable: 66, name: 'Daycare Event', op: '>=', value: 10 }]),
    null,
  );
  assert.equal(
    badge([
      { switch: 139, name: 'Fifth Badge' },
      { switch: 2012, name: 'Blacksteam Case' },
    ]),
    null,
  );
});

test('a map is reached with its own tables, or the area it sits in', () => {
  const maps = {
    1: { name: 'Reborn', parentId: 0 },
    2: { name: 'Obsidia Ward', parentId: 1 },
    3: { name: 'Department Store', parentId: 2 },
    4: { name: 'Department Store 8F', parentId: 3 },
    5: {
      name: 'Obsidia Ward',
      parentId: 1,
      mapSwitches: [{ name: 'City Restore', is: true }],
    },
    6: {
      name: 'Coral Ward',
      parentId: 1,
      mapSwitches: [{ name: 'City Restore', is: false }],
    },
    7: { name: 'Spinel Town', parentId: 1 },
  };
  const tables = {
    2: { types: { LandDay: 1, Water: 13 } },
    5: { types: { LandDay: 2 } },
    6: { types: { OldRod: 1, GoodRod: 5 } },
  };
  const reach = mapReachBadges(maps, tables, { 'City Restore': 13 });
  assert.equal(reach(2), 1);
  // A building two levels inside the ward.
  assert.equal(reach(4), 1);
  // A map that exists only once the city is restored, and one that needs
  // it not to be.
  assert.equal(reach(5), 13);
  assert.equal(reach(6), 1);
  // No table at or above it.
  assert.equal(reach(7), null);
  assert.equal(reach(99), null);
  // A record that states when the map is entered goes by that: a town
  // with no table, a shore whose only table waits for Surf.
  const stated = mapReachBadges(
    maps, { 7: { types: {}, reach: 4 }, 2: { types: { Water: 13 }, reach: 1 } },
    {});
  assert.equal(stated(7), 4);
  assert.equal(stated(4), 1);
  // A map passed through once, and what sits inside it.
  const once = mapsVisitedOnce(
    maps, { 2: { types: { LandDay: 1 }, oneTime: true }, 5: { types: {} } });
  assert.equal(once(2), true);
  assert.equal(once(4), true);
  // A record that dates nothing is passed over for the one above it.
  assert.equal(once(5), false);
  assert.equal(once(7), false);
});

test('a placed copy is an item ball or hidden item, once per map name', () => {
  const ball = (item, extra = {}) =>
    ({ page: 1, kind: 'itemBall', item, repeat: 'once', ...extra });
  const event = (mapId, mapName, gives, pages = [{ page: 1 }]) =>
    ({ mapId, mapName, pages, gives });
  const copies = placedCopies({
    itemNames: { KINGSROCK: "King's Rock", FOCUSSASH: 'Focus Sash' },
    events: [
      event(522, 'Peridot Ward', [ball('KINGSROCK')]),
      event(610, 'Coral Lighthouse', [
        { ...ball('KINGSROCK'), kind: 'hiddenItem' },
      ]),
      // Four water levels of one room repeat one ball.
      event(474, 'Peridot Water Grid', [ball('KINGSROCK')]),
      event(489, 'Peridot Water Grid', [ball('KINGSROCK')]),
      // A gift, a shop and a ball the page hides behind a quest are not
      // placed copies, though the quest ball is kept with its gate.
      event(29, 'Opal Ward', [
        { page: 1, kind: 'gift', item: 'KINGSROCK', repeat: 'once' },
        { page: 1, kind: 'mart', stock: ['KINGSROCK'] },
      ]),
      event(
        619, 'Tanzan Depths',
        [ball('FOCUSSASH', { page: 2, repeat: 'resetByEvent' })],
        [
          { page: 1 },
          {
            page: 2,
            conditions: [
              { selfSwitch: 'B' }, { switch: 737, name: 'LarvitarPuzzle2' },
            ],
          },
        ],
      ),
    ],
  });
  assert.deepEqual(
    copies.get('kingsrock').map((copy) => [copy.mapName, copy.kind]),
    [
      ['Peridot Ward', 'item ball'],
      ['Coral Lighthouse', 'hidden item'],
      ['Peridot Water Grid', 'item ball'],
    ],
  );
  assert.deepEqual(copies.get('focussash'), [{
    mapId: 619,
    mapName: 'Tanzan Depths',
    kind: 'item ball',
    conditions: [{ switch: 737, name: 'LarvitarPuzzle2' }],
  }]);

  // A game with no listing counts what is handed over as well: a gift, a
  // battle reward a variable closes; not one that repeats, nor a shop.
  const handed = placedCopies(
    {
      itemNames: { KINGSROCK: "King's Rock" },
      events: [
        event(29, 'Opal Ward', [
          { page: 1, kind: 'gift', item: 'KINGSROCK', repeat: 'once' },
          { page: 1, kind: 'mart', stock: ['KINGSROCK'] },
        ]),
        event(30, 'Route 1', [{
          page: 1, kind: 'trainerReward', item: 'KINGSROCK',
          repeat: 'onceByVariable',
        }]),
        event(31, 'Route 2', [{
          page: 1, kind: 'repeatableGift', item: 'KINGSROCK',
          repeat: 'unlimited',
        }]),
        event(32, 'Route 3', [ball('KINGSROCK')]),
      ],
    },
    { ...PLACED_COPY_KINDS, ...GIVEN_COPY_KINDS },
  );
  assert.deepEqual(
    handed.get('kingsrock').map((copy) => [copy.mapName, copy.kind]),
    [
      ['Opal Ward', 'gift'],
      ['Route 1', 'battle reward'],
      ['Route 3', 'item ball'],
    ],
  );
});

test('stock the shop table lacks opens with what it is sold beside', () => {
  const mart = (mapId, mapName, stock) =>
    ({ mapId, mapName, gives: [{ kind: 'mart', stock }] });
  const itemEvents = {
    itemNames: {
      PROTECTIVEPADS: 'Protective Pads', BIGROOT: 'Big Root',
      SCOPELENS: 'Scope Lens', LUCKYPUNCH: 'Lucky Punch',
    },
    events: [
      mart(4, 'Department Store 8F', ['BIGROOT', 'SCOPELENS', 'PROTECTIVEPADS']),
      // Sold elsewhere too, later: the earlier mart is the one named.
      mart(9, 'Agate Shop', ['SCOPELENS', 'PROTECTIVEPADS', 'LUCKYPUNCH']),
      // Nothing beside it that the table knows: undated.
      mart(12, 'Nowhere', ['LUCKYPUNCH']),
    ],
  };
  const table = { bigroot: 7, scopelens: 7 };
  const missed = missedShopStock(
    itemEvents,
    (id) => table[id] ?? null,
    (mapId) => (mapId === 9 ? 16 : 1),
  );
  assert.deepEqual(Object.fromEntries(missed), {
    protectivepads: { badge: 7, via: 'Department Store 8F' },
    luckypunch: { badge: 16, via: 'Agate Shop' },
  });
});

test('mined copies rise with the digs the rocks reached allow', () => {
  const dig = (repeat = 'once') => ({ kind: 'mining', repeat });
  const rock = (mapId, mapName, gives) => ({ mapId, mapName, gives });
  const itemEvents = {
    events: [
      // Reached before the Mining Kit: dug from the badge the kit comes.
      rock(1, 'Opal Ward', [dig(), dig()]),
      rock(2, 'Grand Stairway', [dig(), dig()]),
      // One dig only, and a rock a puzzle re-arms counts like any other.
      rock(3, 'Route 2', [dig()]),
      rock(3, 'Route 2', [dig('resetByEvent'), dig()]),
      // Rocks that return with the map restock; an undated map's are left
      // out; an item ball is no rock.
      rock(4, 'Cauldron', [dig('mapReload')]),
      rock(4, 'Cauldron', [dig('mapReload')]),
      rock(5, 'Nowhere', [dig(), dig()]),
      rock(1, 'Opal Ward', [{ kind: 'itemBall', repeat: 'once' }]),
    ],
  };
  const reach = { 1: 0, 2: 3, 3: 9, 4: 18 };
  const rocks = miningDigs(itemEvents, (mapId) => reach[mapId] ?? null, 3);
  assert.deepEqual([...rocks.digs], [[3, 4], [9, 3]]);
  assert.deepEqual(rocks.comesBack, [{ badge: 18, mapName: 'Cauldron' }]);
  assert.equal(rocks.undated, 1);
  // A rock that returns after a wait restocks too, unless its map is one
  // the player passes through once: then it is dug while there and gone.
  const timed = {
    events: [
      rock(6, 'Desert', [dig('timed'), dig()]),
      rock(7, 'Prison Mines', [dig('timed')]),
    ],
  };
  const waited = miningDigs(timed, () => 5, 4, (mapId) => mapId === 7);
  assert.deepEqual(waited.comesBack, [{ badge: 5, mapName: 'Desert' }]);
  assert.deepEqual([...waited.digs], [[5, 1]]);

  // A quarter of a copy per dig: one whole copy from the first four digs,
  // none more until the next whole one.
  const digs = new Map([[3, 4], [4, 2], [9, 3], [12, 20]]);
  assert.deepEqual(expectedCopySteps(0.25, digs, 6), [
    { badge: 3, count: 1 }, { badge: 9, count: 1 }, { badge: 12, count: 4 },
  ]);
  // Nothing is counted past the cap, and a rare item may never reach one.
  assert.deepEqual(expectedCopySteps(1, digs, 6), [
    { badge: 3, count: 4 }, { badge: 4, count: 2 },
  ]);
  assert.deepEqual(expectedCopySteps(0.01, digs, 6), []);
});

test('a mart sells what the game files stock, under the catalog id', () => {
  // The game writes "Poké Ball"; the catalog id has no accent to drop.
  assert.equal(itemId('Poké Ball'), 'pokeball');
  assert.equal(itemId("King's Rock"), 'kingsrock');
  const sold = martStock({
    itemNames: { POKEBALL: 'Poké Ball', BIGROOT: 'Big Root' },
    scriptRules: { defaultMart: { tiers: [{ stock: ['POKEBALL'] }] } },
    events: [
      {
        gives: [
          { kind: 'mart', stock: ['BIGROOT', 'SCOPELENS'] },
          { kind: 'gift', item: 'PIXIEPLATE' },
        ],
      },
    ],
  });
  assert.deepEqual([...sold].sort(), ['bigroot', 'pokeball', 'scopelens']);
});

test('a mart of the script rules sells its rows on their own terms', () => {
  const itemEvents = {
    itemNames: {
      POKEBALL: 'Poké Ball', SITRUSBERRY: 'Sitrus Berry', BIGROOT: 'Big Root',
      FAIRIUMZ: 'Fairium Z', CHOICEBAND: 'Choice Band',
    },
    storyMarkers: {
      switches: { 2183: { name: 'ScentSold' } },
      variables: { 912: { name: 'Post12thBadge' } },
    },
    scriptRules: {
      marts: {
        marts: {
          Emporium: {
            categories: {
              Buy: [
                { item: 'POKEBALL', currency: 'Money' },
                {
                  item: 'SITRUSBERRY', currency: 'Money',
                  conditions: ['$Trainer.numbadges >= 5'],
                },
                // A row that sells no item: a move, a Pokémon, a currency.
                { move: 'BIND', price: 2, currency: 'REDSHARD' },
              ],
              // Another mart's whole inventory.
              Counter: { mart: 'Prizes' },
            },
          },
          Prizes: {
            categories: {
              Buy: [
                { item: 'CHOICEBAND', price: 30, currency: 'AP' },
                {
                  item: 'FAIRIUMZ', currency: 'Money', limit: 1,
                  conditions: ['!searchItem(self.item)'],
                },
                {
                  item: 'BIGROOT', currency: 'RedEssence',
                  conditions: [
                    '$game_switches[2183] == false && ' +
                      '$game_variables[912] >= 91',
                    'pbHasSpecies?(:GOOMY)',
                  ],
                },
              ],
            },
          },
        },
      },
    },
    events: [
      {
        mapId: 61,
        mapName: 'East Gearen City',
        pages: [{ page: 2, conditions: [{ switch: 4, name: 'Defeated Gym 1' }] }],
        gives: [
          { page: 2, kind: 'mart', mart: 'Emporium' },
          { page: 1, kind: 'mart', stock: ['POKEBALL'], within: [{ choice: 'A' }] },
        ],
      },
    ],
  };
  const gym = { switch: 4, name: 'Defeated Gym 1' };
  const here = { mapId: 61, mapName: 'East Gearen City' };
  const sales = martSales(itemEvents);
  assert.deepEqual(sales, [
    { ...here, conditions: [gym], id: 'pokeball', currency: 'Money', once: false },
    {
      ...here, conditions: [gym, { badges: 5 }], id: 'sitrusberry',
      currency: 'Money', once: false,
    },
    { ...here, conditions: [gym], id: 'choiceband', currency: 'AP', once: false },
    // Withdrawn once bought: the condition that says so gates nothing.
    { ...here, conditions: [gym], id: 'fairiumz', currency: 'Money', once: true },
    {
      ...here,
      conditions: [
        gym,
        { switch: 2183, name: 'ScentSold', is: false },
        { variable: 912, name: 'Post12thBadge', atLeast: 91 },
        { script: 'pbHasSpecies?(:GOOMY)' },
      ],
      id: 'bigroot',
      currency: 'RedEssence',
      once: false,
    },
    {
      ...here, conditions: [{ choice: 'A' }], id: 'pokeball',
      currency: 'Money', once: false,
    },
  ]);
  assert.deepEqual(
    [...martStock(itemEvents)].sort(),
    ['bigroot', 'choiceband', 'fairiumz', 'pokeball', 'sitrusberry']);

  // A sale opens with the latest of its map, its conditions and its
  // currency; one that any of the three leaves undated is left out.
  const dating = {
    switchBadge: (name) => (name === 'Defeated Gym 1' ? 1 : null),
    variableBadge: () => null,
  };
  const currencies = { Money: 0, AP: 3 };
  const dated = datedSales(
    sales, (mapId) => (mapId === 61 ? 0 : null), dating,
    (currency) => currencies[currency] ?? null);
  assert.deepEqual(Object.fromEntries(dated.stock), {
    // The stock the event lists itself needs no gym.
    pokeball: { badge: 0, via: 'East Gearen City' },
    sitrusberry: { badge: 5, via: 'East Gearen City' },
    choiceband: { badge: 3, via: 'East Gearen City' },
  });
  assert.deepEqual(Object.fromEntries(dated.once), {
    fairiumz: { badge: 1, via: 'East Gearen City' },
  });
  // The Big Root: a currency nothing dates, and a condition this cannot
  // read.
  assert.equal(dated.undated, 1);
  assert.equal(
    datedSales(sales, () => null, dating, () => 0).undated, sales.length);
});

test("Reborn's marts and maps supply what the guide's tables lack", () => {
  const supply = (id) => getItemSupply(id).map(({ badge, copies, source }) =>
    [badge, copies, source.kind]);
  const shop = (id) =>
    getItemSources(id).find((source) => source.kind === 'shop');
  // Sold on the Department Store's eighth floor, beside six items the shop
  // table dates at badge 7.
  assert.deepEqual(shop('protectivepads'), {
    kind: 'shop', badge: 7, via: 'Department Store 8F',
  });
  assert.deepEqual(supply('luckypunch'), [[8, Infinity, 'shop']]);
  assert.deepEqual(supply('timerball'), [[1, Infinity, 'shop']]);
  // The guide files a Pixie Plate under its shops, but no mart in the game
  // sells one: an NPC gives it, once.
  assert.ok(!shop('pixieplate'));
  // The game's mining table has the Heat Rock the guide's list leaves out.
  assert.ok(getItemSources('heatrock')
    .some((source) => source.kind === 'mining' && source.badge === 3));
  // Hidden Link Stones add up to a full supply a badge before the shop
  // sells them.
  assert.deepEqual(supply('linkstone'), [
    [3, 2, 'single'], [5, 3, 'single'], [7, 4, 'single'], [9, 5, 'single'],
    [12, Infinity, 'single'],
  ]);
});
