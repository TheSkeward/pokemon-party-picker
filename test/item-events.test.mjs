// Which map events hand the player an item, and what each give is
// (scripts/essentials/item-events.mjs), on small hand-built events: its
// kind, its item and quantity, and what it costs. The item timeline reads
// all three, so a give that changes kind moves an item's supply without
// failing anything. How often a give can happen is covered by
// test/item-events-repeat.test.mjs, and what gates it by
// test/gate-setters.test.mjs. Command lists are written a branch to the
// line.
import assert from 'node:assert/strict';
import test from 'node:test';

import { summarise } from '../scripts/essentials/item-events.mjs';
import {
  command,
  end,
  endChoices,
  ifScript,
  ifSwitch,
  ifVariable,
  otherwise,
  page,
  script,
  setSelfSwitch,
  setSwitch,
  setVariable,
  showChoices,
  whenChoice,
  whenSelfSwitch,
  whenSwitch,
} from './helpers/event-commands.mjs';
import {
  ballPages,
  extract,
  giveOf,
  givesOf,
  labels,
  POINTS,
  receive,
  TALLY,
} from './helpers/item-events.mjs';

test('an item ball is recorded with its event, its pages and its give', () => {
  const { events } = extract({
    10: [
      { name: 'Item', x: 4, y: 7, pages: ballPages('POTION') },
      // An event that gives nothing is left out.
      { name: 'Sign', pages: [page([command(101, 0, 'Route 1')])] },
    ],
    // A map the map list does not name.
    12: [{ name: 'HiddenItem', pages: ballPages('ETHER') }],
  });
  assert.deepEqual(events[0], {
    mapId: 10,
    mapName: 'Route 1',
    eventId: 1,
    eventName: 'Item',
    x: 4,
    y: 7,
    kinds: ['itemBall'],
    pages: [{ page: 1 }, { page: 2, conditions: [{ selfSwitch: 'A' }] }],
    gives: [{
      page: 1,
      kind: 'itemBall',
      call: 'Kernel.pbItemBall(:POTION)',
      item: 'POTION',
      quantity: 1,
      sets: [{ selfSwitch: 'A', to: true }],
      repeat: 'once',
    }],
  });
  // A ball is hidden when its event is named so.
  assert.equal(events.length, 2);
  assert.equal(events[1].mapName, null);
  assert.deepEqual(events[1].kinds, ['hiddenItem']);
});

test('a handed-over item is a gift only if the event then changes', () => {
  assert.deepEqual(giveOf([receive(0, 'FRESHWATER')]), {
    page: 1,
    kind: 'repeatableGift',
    call: 'Kernel.pbReceiveItem(:FRESHWATER)',
    item: 'FRESHWATER',
    quantity: 1,
    repeat: 'unlimited',
  });
  const rod = giveOf([receive(0, 'OLDROD'), setSelfSwitch(0, 'A')]);
  assert.deepEqual(labels(rod), ['gift', 'once']);
});

test('a give names its item and how many, or what works them out', () => {
  const give = (...lines) => giveOf([script(0, ...lines)]);
  const candies = give("Kernel.pbReceiveItem(:RARECANDY,3,'Rare Candies')");
  assert.deepEqual([candies.item, candies.quantity], ['RARECANDY', 3]);
  // Stored without a word, by the call only one of the games has.
  assert.equal(give('addItemSilent(:GATHERCUBE,1)').item, 'GATHERCUBE');
  const counted = give('$PokemonBag.pbStoreItem(:POTION, pbGet(2))');
  assert.equal(counted.quantityExpression, 'pbGet(2)');
  assert.ok(!('quantity' in counted));
  // An item only the script knows is left for a reader to resolve.
  const prize = give('Kernel.pbReceiveItem(prize)');
  assert.deepEqual([prize.kind, prize.itemExpression], ['dynamic', 'prize']);
  assert.ok(!('item' in prize));
  const held = give('$PokemonBag.pbStoreItem($Trainer.party[index].item)');
  assert.equal(held.kind, 'returnedHeldItem');
  // A hash of items stored pair by pair is a give for each pair.
  const pack = givesOf([page([script(
    0,
    'items_to_give = { :POWERWEIGHT => 1,',
    '  :POWERBAND => 2 }',
    'items_to_give.each_pair {|item,quantity|',
    '  $PokemonBag.pbStoreItem(item,quantity) }')])]);
  assert.deepEqual(
    pack.map(({ item, quantity }) => [item, quantity]),
    [['POWERWEIGHT', 1], ['POWERBAND', 2]]);
});

test('what is taken along with a give is its cost: an exchange', () => {
  const milk = giveOf([
    ifScript(0, '$PokemonBag.pbQuantity(:ORANBERRY)>0'),
    script(1, '$PokemonBag.pbDeleteItem(:ORANBERRY)'), receive(1, 'MOOMOOMILK'),
    end(0),
  ]);
  assert.deepEqual(milk.costs, [{ item: 'ORANBERRY', quantity: 1 }]);
  assert.deepEqual(labels(milk), ['exchange', 'unlimited']);
  // Several at once, and paid in the command that gives.
  const shards = giveOf([script(
    0, '$PokemonBag.pbDeleteItem(:REDSHARD, 5)', 'Kernel.pbReceiveItem(:TM35)',
  )]);
  assert.deepEqual(shards.costs, [{ item: 'REDSHARD', quantity: 5 }]);
  const coins = giveOf([
    script(0, '$PokemonGlobal.coins -= 1000'), receive(0, 'TM45'),
  ]);
  assert.deepEqual(coins.costs, [{ coins: 1000 }]);
  // Money, by the Change Gold command, where the player has enough.
  const water = [
    command(111, 0, 7, 200, 0),
    command(125, 1, 1, 0, 200), script(1, 'addItemSilent(:FRESHWATER)'),
    end(0),
  ];
  const bought = giveOf(water);
  assert.deepEqual(bought.within, [{ money: '>=', value: 200 }]);
  assert.deepEqual(bought.costs, [{ money: 200 }]);
  assert.equal(bought.kind, 'exchange');
  // The same from an event named as a vending machine.
  assert.equal(giveOf(water, 'Vending machine 2').kind, 'vending');
  // Money handed to the player is no cost.
  const paid = giveOf([command(125, 0, 0, 0, 200), receive(0, 'POTION')]);
  assert.ok(!('costs' in paid));
});

test('a variable is a cost only where the give checks there is enough', () => {
  const price = { variable: 5, name: 'Price' };
  // The price sits in a second variable, set just before.
  const band = giveOf([
    setVariable(0, 5, 'set', 24),
    command(111, 0, 1, 4, 1, 5, 1),
    command(122, 1, 4, 4, 2, 1, 5), receive(1, 'CHOICEBAND'),
    end(0),
  ]);
  assert.deepEqual(band.within, [{ ...POINTS, op: '>=', value: price }]);
  assert.deepEqual(
    band.costs, [{ ...POINTS, amountVariable: price, amount: 24 }]);
  // A price worked out and read back is no progress of the event's.
  assert.deepEqual(labels(band), ['exchange', 'unlimited']);
  // A constant price.
  const bike = giveOf([
    ifVariable(0, 4, '>=', 500),
    setVariable(1, 4, 'sub', 500), receive(1, 'BIKEV'),
    end(0),
  ]);
  assert.deepEqual(bike.costs, [{ ...POINTS, amount: 500 }]);
  // Without the check a subtraction is arithmetic.
  const counted = giveOf([setVariable(0, 4, 'sub', 1), receive(0, 'POTION')]);
  assert.ok(!('costs' in counted));
  assert.equal(counted.kind, 'repeatableGift');
});

test('an item handed over after a trainer battle is its reward', () => {
  const battle = 'pbTrainerBattle(:CAMPER,"Billy",_I("..."))';
  const reward = giveOf([
    ifScript(0, battle), receive(1, 'TM94'), setSelfSwitch(1, 'A'), end(0),
  ]);
  assert.deepEqual(labels(reward), ['trainerReward', 'once']);
  assert.equal(reward.afterTrainerBattle, true);
  assert.deepEqual(reward.within, [{ script: battle }]);
  // A battle in the other arm is not on the give's path.
  const refused = giveOf([
    ifSwitch(0, 4), script(1, 'pbDoubleTrainerBattle(:A,"B",0)'),
    otherwise(0), receive(1, 'POTION'),
    end(0),
  ]);
  assert.equal(refused.kind, 'repeatableGift');
  assert.ok(!('afterTrainerBattle' in refused));
});

test('a mart is its stock, the default mart, or a mart by name', () => {
  const stocked = giveOf([
    script(0, 'setPrice(:RARECANDY, 30000, 1000)'),
    script(0, 'setSellPrice(:SACHET, 5)'),
    script(0, 'pbPokemonMart([', '  :SACHET, :RARECANDY', '])'),
  ]);
  assert.deepEqual(stocked, {
    page: 1,
    kind: 'mart',
    stock: ['SACHET', 'RARECANDY'],
    call: 'pbPokemonMart([ :SACHET, :RARECANDY ])',
    prices: [
      { item: 'RARECANDY', buy: 30000, sell: 1000 },
      { item: 'SACHET', sell: 5 },
    ],
  });
  // A mart is open for good, whatever the event changes around it.
  const usual = giveOf([script(0, 'pbDefaultMart'), setSelfSwitch(0, 'A')]);
  assert.equal(usual.defaultMart, true);
  assert.ok(!('repeat' in usual));
  const named = giveOf([script(0, 'pbComplexMart(:WispyShop)')]);
  assert.deepEqual([named.kind, named.mart], ['mart', 'WispyShop']);
});

test('a dig, a berry tree and its plot, a conversion are told apart', () => {
  const dig = giveOf([
    ifScript(0, '$PokemonBag.pbQuantity(:MININGKIT)>0'),
    script(1, 'pbMiningGame'), setSelfSwitch(1, 'A'),
    end(0),
  ]);
  assert.deepEqual(labels(dig), ['mining', 'once']);
  // Picking turns the tree into an empty plot without a command for it.
  const [tree, plot] = givesOf([
    page([script(0, 'pbPickBerry(:CUSTAPBERRY,2)')]),
    page([script(0, 'pbBerryPlant')], whenSelfSwitch('A')),
  ]);
  assert.deepEqual(tree, {
    page: 1,
    kind: 'berryTree',
    call: 'pbPickBerry(:CUSTAPBERRY,2)',
    item: 'CUSTAPBERRY',
    quantity: 2,
    sets: [{ selfSwitch: 'A', to: true }],
    repeat: 'once',
  });
  assert.deepEqual(plot, { page: 2, kind: 'berryPlot', call: 'pbBerryPlant' });
  const swap = giveOf([
    script(0, '$PokemonBag.pbChangeItem(:EXPALLOFF, :EXPALL)'),
  ]);
  assert.deepEqual([swap.kind, swap.item], ['conversion', 'EXPALL']);
  assert.deepEqual(swap.costs, [{ item: 'EXPALLOFF', quantity: 'all held' }]);
});

test('an item on a gift or a wild Pokémon is a held-item give', () => {
  const held = (...lines) => {
    const { kind, item, species } = giveOf([script(0, ...lines)]);
    return [kind, item, species];
  };
  assert.deepEqual(
    held(
      'poke=PokeBattle_Pokemon.new(',
      '  :KLEFKI,60)',
      'poke.setItem(:SANCTUMKEY)',
      'pbAddPokemon(poke)'),
    ['giftPokemonHeldItem', 'SANCTUMKEY', 'KLEFKI']);
  assert.deepEqual(
    held(
      'pokemon = pbGenerateWildPokemon(:GROUDON, 120)',
      'pokemon.item = :REDORB',
      'pbWildBattleObject(pokemon)'),
    ['wildEventHeldItem', 'REDORB', 'GROUDON']);
});

test('a draw from a pool is a ball of any item of the pool', () => {
  assert.deepEqual(giveOf([script(0, 'luckItem(1, 2)')]), {
    page: 1,
    kind: 'itemBall',
    call: 'luckItem(1, 2)',
    pool: 'itemball',
    itemCandidates: ['ETHER', 'REVIVE'],
    repeat: 'unlimited',
  });
  const chest = giveOf([script(0, 'luckItem(1, 1, :chest)')]);
  assert.deepEqual(chest.itemCandidates, ['LEFTOVERS']);
  const tower = giveOf([script(0, 'generateWonderTowerItem(:castleTM1)')]);
  assert.deepEqual(tower.itemCandidates, ['TM55', 'TM81']);
  // A pool no rule was read for fails rather than giving nothing.
  assert.throws(
    () => giveOf([script(0, 'luckItem(1, 1, :vault)')]),
    /no item pool "vault" was read/);
});

test('a give in a common event is found where the event is called', () => {
  const reward = [
    ifVariable(0, 3, '>=', 5),
    script(1, 'Kernel.pbItemBall(:NUGGET)'), setSwitch(1, 3),
    end(0),
  ].flat();
  const daily = receive(0, 'HONEY');
  const fanfare = [command(101, 0, 'Ta-da!')];
  const caller = page([
    showChoices(0, 'Yes', 'No'),
    whenChoice(0, 0, 'Yes'), command(117, 1, 1), command(117, 1, 3),
    whenChoice(0, 1, 'No'),
    endChoices(0),
    setSelfSwitch(0, 'A'),
  ]);
  const { events, commonEvents } = extract({ 10: [{ pages: [caller] }] }, [
    { id: 1, name: 'Reward', trigger: 0, switch_id: 0, list: reward },
    { id: 2, name: 'Daily', trigger: 2, switch_id: 4, list: daily },
    { id: 3, name: 'Fanfare', trigger: 0, switch_id: 0, list: fanfare },
  ]);
  const tally = { ...TALLY, op: '>=', value: 5 };
  const lever = { switch: 3, name: 'Lever', to: true };
  // Under the caller's conditions and then its own, with the changes of
  // both: once here, though the common event alone only moves state.
  const [give] = events[0].gives;
  assert.equal(give.viaCommonEvent, 1);
  assert.deepEqual(give.within, [{ choice: 'Yes' }, tally]);
  assert.deepEqual(give.sets, [lever, { selfSwitch: 'A', to: true }]);
  assert.deepEqual(labels(give), ['itemBall', 'once']);
  // A common event that gives nothing is left out.
  const [called, alone] = commonEvents;
  assert.equal(commonEvents.length, 2);
  assert.deepEqual(
    [called.commonEventId, called.name, called.trigger, called.calledFrom],
    [1, 'Reward', 'call', ['10/1/1']]);
  assert.equal(called.triggerSwitch, undefined);
  assert.deepEqual(called.gives[0].within, [tally]);
  assert.deepEqual(
    [called.gives[0].page, ...labels(called.gives[0])],
    [null, 'itemBall', 'stateOnly']);
  // One that runs by itself runs under its switch, and may have no caller.
  assert.deepEqual(
    [alone.trigger, alone.triggerSwitch, alone.calledFrom],
    ['parallel', { switch: 4, name: 'Rematch' }, []]);
});

test('coins won and badges awarded are listed with their event', () => {
  const here = { mapId: 10, mapName: 'Route 1', eventId: 1, eventName: 'EV' };
  const { events, coinSources, badgeAwards } = extract({
    11: [{
      name: 'Leader',
      pages: [page([script(0, '$Trainer.badges[0] = true')], whenSwitch(4))],
    }],
    10: [{
      pages: [
        page([
          script(0, '$PokemonGlobal.coins+=50'),
          ifScript(0, 'pbSlotMachine(1)'), end(0),
        ]),
        page([script(0, '$Trainer.badges[1]=true')]),
      ],
    }],
  });
  assert.deepEqual(events, []);
  assert.deepEqual(coinSources, [
    { ...here, page: 1, coins: 50, call: '$PokemonGlobal.coins+=50' },
    { ...here, page: 1, game: 'pbSlotMachine', call: 'pbSlotMachine(1)' },
  ]);
  // Badges count from 1, in badge order.
  assert.deepEqual(badgeAwards, [
    {
      badge: 1, mapId: 11, mapName: 'Cave', eventId: 1, eventName: 'Leader',
      page: 1, conditions: [{ switch: 4, name: 'Rematch' }],
    },
    { badge: 2, ...here, page: 2, conditions: [] },
  ]);
});

test('the summary counts events and gives by kind and by repeat', () => {
  const clerk = page([
    script(0, 'pbPokemonMart([:POTION, :ETHER])'),
    receive(0, 'FRESHWATER'),
    script(0, 'Kernel.pbReceiveItem(prize)'),
  ]);
  const { events } = extract({
    10: [
      { name: 'Item', pages: ballPages('POTION') },
      { name: 'Item', pages: ballPages('POTION') },
      { name: 'Clerk', pages: [clerk] },
      { name: 'Chest', pages: [page([script(0, 'luckItem(1, 2)')])] },
    ],
  });
  const { items, ...summary } = summarise(events);
  assert.deepEqual(summary, {
    events: 4,
    eventsByKind: { dynamic: 1, itemBall: 3, mart: 1, repeatableGift: 1 },
    givesByKind: { dynamic: 1, itemBall: 3, mart: 1, repeatableGift: 1 },
    repeatByKind: {
      dynamic: { unlimited: 1 },
      itemBall: { once: 2, unlimited: 1 },
      repeatableGift: { unlimited: 1 },
    },
    // Given, sold or drawn from a pool, each once: the chest's pool holds
    // an Ether, which the clerk sells too, and a Revive.
    distinctItems: 4,
    unresolved: [{
      mapId: 10, eventId: 3, page: 1, call: 'Kernel.pbReceiveItem(prize)',
    }],
  });
  assert.deepEqual(
    [...items].sort(), ['ETHER', 'FRESHWATER', 'POTION', 'REVIVE']);
});
