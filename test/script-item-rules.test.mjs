// The script-side item rules map events lean on
// (scripts/essentials/script-item-rules.mjs): what a dig buries, what the
// marts stock, what a berry plot grows and what a pool is drawn from, each
// read from a cut-down script or compiled file of either game's shape.
// The item-events extract carries them verbatim, so a misread row changes
// it without failing anything. test/gate-setters.test.mjs covers the
// conditions the mart rows are gated by.
import assert from 'node:assert/strict';
import test from 'node:test';

import { RubyObject, toPlain } from '../scripts/essentials/game-files.mjs';
import {
  readBerryData,
  readBerryValues,
  readDefaultMart,
  readItemPools,
  readMartData,
  readMiningTable,
  scriptRuleItems,
} from '../scripts/essentials/script-item-rules.mjs';
import {
  rubyObject,
  rubySource,
  rubyString,
  symbol,
} from './helpers/essentials-files.mjs';

// An install of the parsed Data files given, by name.
const installOf = (files) => ({
  parse: (name) => files[name],
  load: (name) => toPlain(files[name]),
});

test('a dig buries each item at the weight of all its rows', () => {
  const file = 'Scripts/MinigameMining.rb';
  const mining = rubySource([
    'class MiningGameScene',
    '  ITEMS = [ # Item, probability, graphic x, graphic y, pattern',
    '    [:HELIXFOSSIL, 2, 5, 3, [0, 1, 1, 0]],',
    '    [:HELIXFOSSIL, 1, 9, 3, [1, 1, 1, 0]],',
    '    # [:OLDAMBER, 9, 0, 0, [1]],',
    '    [:HEARTSCALE, 30, 8, 11, [1]],',
    '  ]',
    '',
    '  def pbDistributeItems',
    '    numitems = 2 + rand(3)',
    '  end',
    '',
    '  def pbDistributeIron',
    '    numitems = 4 + rand(3)',
    '  end',
    'end',
  ], file);
  assert.deepEqual(readMiningTable(mining), {
    source: { file, line: 2, endLine: 7 },
    // 2 + rand(3) is two to four.
    itemsPerGame: { min: 2, max: 4, source: { file, line: 10 } },
    totalWeight: 33,
    items: [
      { item: 'HELIXFOSSIL', weight: 3 }, { item: 'HEARTSCALE', weight: 30 },
    ],
  });
  // A game whose table is replaced by a later script still buries by the
  // first one's count.
  const custom = 'Scripts/Custom.rb';
  const replaced = rubySource([
    'class MiningGameScene',
    '  ITEMS = [',
    '    [:BLKPRISM, 4, 0, 0, [1]],',
    '  ]',
    'end',
  ], custom);
  const rule = readMiningTable(replaced, mining);
  assert.deepEqual(rule.source, { file: custom, line: 2, endLine: 4 });
  assert.deepEqual(rule.itemsPerGame.source, { file, line: 10 });
  assert.deepEqual(rule.items, [{ item: 'BLKPRISM', weight: 4 }]);
});

test('the default mart stocks by badge count, tier by tier', () => {
  const file = 'Scripts/Mart.rb';
  const mart = rubySource([
    'def pbDefaultMart(speech = nil, cantsell = false)',
    '  case $Trainer.numbadges',
    '    when 0',
    '      stock = [:POTION, :POKEBALL]',
    '    when 1..3',
    '      stock = [:SUPERPOTION, :POKEBALL,',
    '               :GREATBALL]',
    '    else',
    '      stock = [:POTION]',
    '  end',
    '  pbPokemonMart(stock, speech, cantsell)',
    'end',
    '',
    'def pbBuyScreen',
    '  if $PokemonBag && quantity >= 10 && pbIsPokeBall?(item)',
    '    @adapter.addItem(:PREMIERBALL)',
    '  end',
    'end',
  ], file);
  const rule = readDefaultMart(mart);
  assert.deepEqual(rule.source, { file, line: 1, endLine: 10 });
  assert.deepEqual(rule.tiers, [
    {
      minBadges: 0, maxBadges: 0, stock: ['POTION', 'POKEBALL'],
      source: { file, line: 3 },
    },
    // A stock list may run over several lines.
    {
      minBadges: 1, maxBadges: 3,
      stock: ['SUPERPOTION', 'POKEBALL', 'GREATBALL'],
      source: { file, line: 5 },
    },
    { otherwise: true, stock: ['POTION'], source: { file, line: 8 } },
  ]);
  assert.equal(rule.premierBall.source.line, 15);
});

// A row of marts.dat: every row has these, whatever it sells.
const stock = (className, sells) => rubyObject(className, {
  price: 100,
  currency: symbol('Money'),
  max_quantity: null,
  conditions: [],
  on_purchase: [],
  ...sells,
});
const mart = (inventory, more = {}) => rubyObject('MartData', {
  Inventory: new Map(Object.entries(inventory).map(
    ([category, rows]) => [rubyString(category), rows])),
  ...more,
});
const currency = (name, type) =>
  rubyObject('CurrencyData', { name: rubyString(name), type: symbol(type) });
const MART_FILES = {
  'marts.dat': new Map([
    [symbol('Stall'), mart({
      Buy: [
        stock('ItemStock', { item: symbol('POTION'), quantity: 1 }),
        stock('ItemStock', {
          item: symbol('BIKEV'),
          quantity: 1,
          price: 250,
          currency: symbol('RedEssence'),
          max_quantity: 1,
          conditions: [rubyString('!$game_switches[self.item]')],
          on_purchase: [rubyString('$game_switches[item.item] = true')],
        }),
        stock('MoveStock', {
          move: symbol('BIND'), price: 2, currency: symbol('REDSHARD'),
        }),
        stock('PokemonStock', {
          species: symbol('SEEL'), price: 1000, currency: symbol('Coins'),
        }),
        stock('CurrencyStock', {
          type: symbol('Coins'), amount: 50, price: 1000,
        }),
        stock('ItemStock', {
          item: symbol('ETHER'), quantity: 1, currency: symbol('BIGMUSHROOM'),
        }),
      ],
      Scents: symbol('ScentShop'),
    }, { allowSell: true })],
    [symbol('ScentShop'), mart({ Buy: [] })],
  ]),
  'currencies.dat': new Map([
    [symbol('Money'), currency('Money', 'Money')],
    [symbol('Coins'), currency('Coin', 'Coins')],
    [symbol('RedEssence'), currency('Red Essence', 'Variable')],
    [symbol('REDSHARD'), currency('Red Shard', 'Item')],
  ]),
};

test('a mart is its categories, each its rows or another mart', () => {
  assert.deepEqual(readMartData(installOf(MART_FILES)), {
    source: { file: 'Data/marts.dat' },
    currencySource: { file: 'Data/currencies.dat' },
    currencies: {
      Money: { name: 'Money', type: 'Money' },
      Coins: { name: 'Coin', type: 'Coins' },
      RedEssence: { name: 'Red Essence', type: 'Variable' },
      REDSHARD: { name: 'Red Shard', type: 'Item' },
    },
    marts: {
      Stall: {
        allowSell: true,
        categories: {
          Buy: [
            { item: 'POTION', quantity: 1, price: 100, currency: 'Money' },
            // A row keeps its limit, its tests and what buying it does
            // only when it has them.
            {
              item: 'BIKEV',
              quantity: 1,
              price: 250,
              currency: 'RedEssence',
              limit: 1,
              conditions: ['!$game_switches[self.item]'],
              onPurchase: ['$game_switches[item.item] = true'],
            },
            { move: 'BIND', price: 2, currency: 'REDSHARD' },
            { species: 'SEEL', price: 1000, currency: 'Coins' },
            {
              currencyGained: 'Coins', amount: 50, price: 1000,
              currency: 'Money',
            },
            { item: 'ETHER', quantity: 1, price: 100, currency: 'BIGMUSHROOM' },
          ],
          Scents: { mart: 'ScentShop' },
        },
      },
      // A mart that does not say buys nothing back.
      ScentShop: { allowSell: false, categories: { Buy: [] } },
    },
  });
});

test('a row of a class the reader does not know is refused', () => {
  const files = {
    ...MART_FILES,
    'marts.dat': new Map([
      [symbol('Stall'), mart({ Buy: [stock('BundleStock', {})] })],
    ]),
  };
  assert.throws(
    () => readMartData(installOf(files)),
    /Unknown mart stock class BundleStock/);
});

test('a planted berry grows by the plant script\'s own table', () => {
  const file = 'Scripts/BerryPlants.rb';
  const berries = rubySource([
    'class BerryPlantData',
    '  BERRYVALUES = [',
    '    [:CHERIBERRY, 3, 2, 5, _INTL("Cheri Berries")],',
    '    [:LUMBERRY, 12, 1, 2, _INTL("Lum Berries")],',
    '  ]',
    'end',
    '',
    'def pbBerryPlant',
    'end',
    '',
    'def pbPickBerry(berry, qty = 1)',
    'end',
  ], file);
  const { stages, ...rule } = readBerryValues(berries);
  assert.match(stages, /^four growth stages/);
  assert.deepEqual(rule, {
    source: { file, line: 2, endLine: 5 },
    // Planting runs up to where picking starts, and picking to the end.
    plantSource: { file, line: 8, endLine: 10 },
    pickSource: { file, line: 11, endLine: 12 },
    values: [
      { berry: 'CHERIBERRY', hoursPerStage: 3, minYield: 2, maxYield: 5 },
      { berry: 'LUMBERRY', hoursPerStage: 12, minYield: 1, maxYield: 2 },
    ],
  });
});

test('or by each berry\'s item data, its hours shared among the stages', () => {
  // A Range's instance variables are written without the @.
  const range = (begin, last, excl = false) => {
    const value = new RubyObject('Range');
    value.ivars.set('excl', excl).set('begin', begin).set('end', last);
    return value;
  };
  const berry = (time, harvest) => rubyObject('ItemData', {
    berry: rubyObject('BerryData', { time, yield: harvest }),
  });
  const files = {
    'items.dat': new Map([
      [symbol('POTION'), rubyObject('ItemData', { price: 300 })],
      [symbol('CHERIBERRY'), berry(12, range(2, 5))],
      // 50 hours over four stages, and a yield that stops short of 3.
      [symbol('LUMBERRY'), berry(50, range(1, 3, true))],
    ]),
  };
  const file = 'Scripts/BerryPlants.rb';
  const berries = rubySource([
    'class BerryPlantData',
    '  NUMBER_OF_GROWTH_STAGES = 4',
    'end',
    '',
    'def pbBerryPlant',
    'end',
    'def pbPickBerry(berry, qty = 1)',
    'end',
  ], file);
  const { stages, ...rule } = readBerryData(installOf(files), berries);
  assert.match(stages, /^4 growth stages/);
  assert.deepEqual(rule, {
    source: { file: 'Data/items.dat' },
    stagesSource: { file, line: 2 },
    plantSource: { file, line: 5, endLine: 6 },
    pickSource: { file, line: 7, endLine: 8 },
    values: [
      { berry: 'CHERIBERRY', hoursPerStage: 3, minYield: 2, maxYield: 5 },
      { berry: 'LUMBERRY', hoursPerStage: 12, minYield: 1, maxYield: 2 },
    ],
  });
});

test('a pool method gives its pools by name', () => {
  const file = 'Scripts/LuckSwap.rb';
  const source = rubySource([
    'def luckItemPool',
    '  return {',
    '    :itemball => [',
    '      :HYPERPOTION, :REVIVE,',
    '      :ETHER',
    '    ],',
    '    :chest => [:LEFTOVERS, :LIFEORB]',
    '  }',
    'end',
    '',
    'def luckItem(quantity = 1, rolls = 1, pool = :itemball)',
    '  bonus = { :vault => [:MASTERBALL] }',
    'end',
  ], file);
  // The method named, not one whose name starts the same or follows it.
  assert.deepEqual(readItemPools(source, 'luckItemPool'), {
    source: { file, line: 1, endLine: 9 },
    pools: {
      itemball: ['HYPERPOTION', 'REVIVE', 'ETHER'],
      chest: ['LEFTOVERS', 'LIFEORB'],
    },
  });
  assert.deepEqual(
    readItemPools(source, 'luckItem').pools, { vault: ['MASTERBALL'] });
});

test('the items the rules name are what they yield and are paid in', () => {
  const rules = {
    mining: { items: [{ item: 'HELIXFOSSIL', weight: 3 }] },
    defaultMart: { tiers: [{ stock: ['POTION'] }, { stock: ['POKEBALL'] }] },
    marts: readMartData(installOf(MART_FILES)),
    itemPools: {
      luckItem: { pools: { itemball: ['REVIVE'], chest: ['LEFTOVERS'] } },
    },
    // A plot regrows what the player plants: it names nothing.
    berryPlants: { values: [{ berry: 'CHERIBERRY' }] },
  };
  // A currency is an item of the Bag unless currencies.dat types it as
  // money, coins or a variable; a move or a Pokémon sold is no item.
  assert.deepEqual([...new Set(scriptRuleItems(rules))].sort(), [
    'BIGMUSHROOM', 'BIKEV', 'ETHER', 'HELIXFOSSIL', 'LEFTOVERS', 'POKEBALL',
    'POTION', 'REDSHARD', 'REVIVE',
  ]);
});
