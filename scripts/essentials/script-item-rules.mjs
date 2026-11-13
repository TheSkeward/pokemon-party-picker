/**
 * @fileoverview The script-side item rules that map events lean on: what a
 * dig buries, what a mart stocks, what a berry plot grows, what a pool of
 * items is drawn from. The engine family keeps some of these in a script
 * table and some in a compiled Data file; a game's adapter picks the reader
 * for where its own rule lives.
 */
import {
  RubyObject,
  RubySymbol,
  symbolsIn,
  toPlain,
} from './game-files.mjs';

/**
 * The mining minigame's buried-item weights.
 * @param {!RubySource} table The file whose `ITEMS` the game ends up
 *     with: the last one loaded, where a later script reopens the class.
 * @param {!RubySource=} minigame The file that buries the items, when it
 *     is not the table's.
 * @return {!Object}
 */
export function readMiningTable(table, minigame = table) {
  const start = table.find(/^\s*ITEMS = \[/).line;
  const end = table.find(/^\s*\]\s*$/, start).line;
  const count = minigame.find(/numitems = (\d+) \+ rand\((\d+)\)/);
  const weights = new Map();
  for (const line of table.lines.slice(start, end - 1)) {
    const match = line.match(/^\s*\[:([A-Z0-9_]+),\s*(\d+),/);
    if (!match) continue;
    weights.set(match[1], (weights.get(match[1]) ?? 0) + Number(match[2]));
  }
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  return {
    source: table.cite(start, end),
    itemsPerGame: {
      min: Number(count.match[1]),
      max: Number(count.match[1]) + Number(count.match[2]) - 1,
      source: minigame.cite(count.line),
    },
    totalWeight: total,
    items: [...weights].map(([item, weight]) => ({ item, weight })),
  };
}

/**
 * The stock pbDefaultMart sells at each badge count.
 * @param {!RubySource} mart The file that defines pbDefaultMart.
 * @return {!Object}
 */
export function readDefaultMart(mart) {
  const start = mart.find(/^def pbDefaultMart/).line;
  const end = mart.find(/^\s*end\s*$/, mart.find(/^\s*else\s*$/, start).line).line;
  const tiers = [];
  let tier = null;
  for (let line = start; line <= end; line++) {
    const text = mart.lines[line - 1];
    const when = text.match(/^\s*when (\d+)(?:\.\.(\d+))?/);
    if (when || /^\s*else\s*$/.test(text)) {
      tier = when
        ? { minBadges: Number(when[1]), maxBadges: Number(when[2] ?? when[1]) }
        : { otherwise: true };
      tier.stock = [];
      tier.source = mart.cite(line);
      tiers.push(tier);
    } else if (tier) {
      tier.stock.push(...symbolsIn(text));
    }
  }
  const bonus = mart.find(/quantity >= 10 && pbIsPokeBall\?\(item\)/);
  return {
    source: mart.cite(start, end),
    tiers,
    premierBall: {
      rule: 'buying 10 or more of one Poké Ball adds one Premier Ball per ' +
        'ten bought',
      source: mart.cite(bonus.line, bonus.line + 7),
    },
  };
}

// What a row of mart stock sells, by its Ruby class.
const STOCK_GOODS = {
  ItemStock: (stock) => ({ item: stock.item, quantity: stock.quantity }),
  MoveStock: (stock) => ({ move: stock.move }),
  PokemonStock: (stock) => ({ species: stock.species }),
  CurrencyStock: (stock) => ({
    currencyGained: stock.type,
    amount: stock.amount,
  }),
};

function stockRow(stock) {
  const goods = STOCK_GOODS[stock.className];
  if (!goods) throw new Error(`Unknown mart stock class ${stock.className}`);
  const plain = toPlain(stock);
  const row = { ...goods(plain), price: plain.price, currency: plain.currency };
  if (plain.max_quantity != null) row.limit = plain.max_quantity;
  if (plain.conditions.length) row.conditions = plain.conditions;
  if (plain.on_purchase.length) row.onPurchase = plain.on_purchase;
  return row;
}

// The currency types the mart pays from something other than the Bag
// (PokemonMartAdapter#getMoney): the trainer's money, the Coin Case, and a
// game variable named as the currency is.
const NON_ITEM_CURRENCY_TYPES = ['Money', 'Coins', 'Variable'];

/**
 * The marts pbComplexMart opens by name, from marts.dat, and the
 * currencies their rows are priced in, from currencies.dat. A mart's
 * categories are its menu; one holds stock rows or stands for another
 * mart's whole inventory. A row keeps what it sells, its price and
 * currency, and when present the most one purchase may take (`limit`),
 * the Ruby tests that must all hold for the row to show (`conditions`)
 * and the Ruby run on purchase (`onPurchase`). A currency is the Bag item
 * of that symbol unless `currencies` types it otherwise.
 * @param {!GameInstall} install
 * @return {!Object}
 */
export function readMartData(install) {
  const marts = {};
  for (const [symbol, mart] of install.parse('marts.dat')) {
    const categories = {};
    for (const [category, stock] of mart.ivars.get('@Inventory')) {
      categories[toPlain(category)] = stock instanceof RubySymbol
        ? { mart: stock.name }
        : stock.map(stockRow);
    }
    marts[symbol.name] = {
      allowSell: mart.ivars.get('@allowSell') ?? false,
      categories,
    };
  }
  const currencies = {};
  for (const [symbol, currency] of install.load('currencies.dat')) {
    currencies[symbol] = { name: currency.name, type: currency.type };
  }
  return {
    source: { file: 'Data/marts.dat' },
    currencySource: { file: 'Data/currencies.dat' },
    currencies,
    marts,
  };
}

/**
 * Growth time and yield per berry for planted berries, where the plant
 * script holds them in its own table.
 * @param {!RubySource} berries The file that defines the berry plant.
 * @return {!Object}
 */
export function readBerryValues(berries) {
  const start = berries.find(/^\s*BERRYVALUES = \[/).line;
  const end = berries.find(/^\s*\]\s*$/, start).line;
  const values = [];
  for (const line of berries.lines.slice(start, end - 1)) {
    const match = line.match(/^\s*\[:([A-Z0-9_]+),\s*(\d+),\s*(\d+),\s*(\d+),/);
    if (!match) continue;
    values.push({
      berry: match[1],
      hoursPerStage: Number(match[2]),
      minYield: Number(match[3]),
      maxYield: Number(match[4]),
    });
  }
  return {
    source: berries.cite(start, end),
    stages: 'four growth stages after planting; yield scales with how ' +
      'many stages were watered',
    ...plantAndPickSources(berries),
    values,
  };
}

/**
 * Growth time and yield per berry for planted berries, where each berry's
 * item data in items.dat holds them.
 * @param {!GameInstall} install
 * @param {!RubySource} berries The file that defines the berry plant.
 * @return {!Object}
 */
export function readBerryData(install, berries) {
  const stages = berries.find(/NUMBER_OF_GROWTH_STAGES\s*=\s*(\d+)/);
  const stageCount = Number(stages.match[1]);
  const values = [];
  for (const [symbol, item] of install.parse('items.dat')) {
    const berry = item.ivars.get('@berry');
    if (!(berry instanceof RubyObject)) continue;
    const { time, yield: harvest } = toPlain(berry);
    values.push({
      berry: symbol.name,
      // BerryPlantData#update divides the berry's hours among the stages.
      hoursPerStage: Math.floor(time / stageCount),
      minYield: harvest.begin,
      maxYield: harvest.excl ? harvest.end - 1 : harvest.end,
    });
  }
  return {
    source: { file: 'Data/items.dat' },
    stages: `${stageCount} growth stages after planting; yield scales ` +
      'with how many stages were watered',
    stagesSource: berries.cite(stages.line),
    ...plantAndPickSources(berries),
    values,
  };
}

function plantAndPickSources(berries) {
  const plant = berries.find(/^def pbBerryPlant/);
  const pick = berries.find(/^def pbPickBerry/);
  return {
    plantSource: berries.cite(plant.line, pick.line - 1),
    pickSource: berries.cite(pick.line, berries.lines.length),
  };
}

/**
 * The named pools of items a script draws from: a method that returns a
 * hash of pool name to item list.
 * @param {!RubySource} source
 * @param {string} method The method that returns the pools.
 * @return {{source: !Object, pools: !Object<string, !Array<string>>}}
 */
export function readItemPools(source, method) {
  const start = source.find(new RegExp(`^def ${method}\\b`)).line;
  const end = source.find(/^end\s*$/, start).line;
  const pools = {};
  const listed = /:(\w+)\s*=>\s*\[([^\]]*)\]/g;
  for (const [, name, items] of source.text(start, end).matchAll(listed)) {
    pools[name] = symbolsIn(items);
  }
  return { source: source.cite(start, end), pools };
}

// The items the marts sell and the items they take as payment.
function martItems({ marts, currencies }) {
  const items = [];
  for (const mart of Object.values(marts)) {
    for (const stock of Object.values(mart.categories)) {
      if (!Array.isArray(stock)) continue;
      for (const row of stock) {
        if (row.item) items.push(row.item);
        const type = currencies[row.currency]?.type;
        if (!NON_ITEM_CURRENCY_TYPES.includes(type)) items.push(row.currency);
      }
    }
  }
  return items;
}

// The item symbols a rule names, by the rule's key in the extract. A berry
// plot names none: it regrows what the player plants.
const RULE_ITEMS = {
  mining: (rule) => rule.items.map((entry) => entry.item),
  defaultMart: (rule) => rule.tiers.flatMap((tier) => tier.stock),
  marts: martItems,
  itemPools: (rule) => Object.values(rule)
    .flatMap(({ pools }) => Object.values(pools).flat()),
  berryPlants: () => [],
};

/**
 * @param {!Object<string, !Object>} rules A game's script rules, by key.
 * @return {!Array<string>} Every item symbol they name, for the extract's
 *     table of item names.
 */
export function scriptRuleItems(rules) {
  return Object.entries(rules).flatMap(([key, rule]) => RULE_ITEMS[key](rule));
}
