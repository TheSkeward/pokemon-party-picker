// Reborn's item sources derived from its map events
// (scripts/reborn/event-sources.mjs): the copies placed on the maps, when a
// map and a gated event can be reached, and the mart stock the guide's shop
// table lacks.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  badgeSwitchBadge,
  conditionBadge,
  mapReachBadges,
  missedShopStock,
  placedCopies,
} from '../scripts/reborn/event-sources.mjs';
import { getItemSources, getItemSupply } from '../src/games/items.js';

test('an event is dated by its badge switches and episode variables', () => {
  const badge = (conditions) => conditionBadge(conditions, badgeSwitchBadge);
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
  // The game's mining table has the Heat Rock the guide's list leaves out.
  assert.ok(getItemSources('heatrock')
    .some((source) => source.kind === 'mining' && source.badge === 3));
  // Hidden Link Stones add copies before the shop sells them.
  const linkStones = supply('linkstone');
  assert.deepEqual(linkStones[0], [3, 2, 'single']);
  assert.deepEqual(linkStones.at(-1), [13, Infinity, 'shop']);
  assert.ok(linkStones.length > 3);
});
