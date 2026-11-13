/**
 * @fileoverview Derives item sources from a game's map events (its
 * item-events extract): the copies of an item placed on the maps and what
 * the marts sell, each dated by its map and what gates it, and the shop
 * stock a guide's shop table lacks. Pure: the timeline builder feeds it
 * the extracts, the tests feed it fixtures.
 */

/**
 * How a game's event conditions are dated. `switchBadge` takes a switch
 * name and `variableBadge` a variable name and the least value asked of
 * it; each returns the badge count the condition implies, or null for one
 * that is no measure of progress (a quest switch, a counter).
 * @typedef {{switchBadge: function(string): ?number,
 *     variableBadge: function(string, number): ?number}}
 */
let EventDating;

import { itemId } from './item-id.mjs';

/**
 * The kinds of give that place a copy on a map, and what each is called.
 * @const {!Object<string, string>}
 */
export const PLACED_COPY_KINDS = Object.freeze({
  itemBall: 'item ball',
  hiddenItem: 'hidden item',
});

/**
 * The kinds of give by which someone hands a copy over, and what each is
 * called. A game with a guide's listing leaves these to the listing: an
 * NPC often hands over a copy the player could have had another way (a
 * missed item returned, a story branch), so only a placed copy is certain
 * to be one more. A game without one has nothing else to learn them from.
 * @const {!Object<string, string>}
 */
export const GIVEN_COPY_KINDS = Object.freeze({
  gift: 'gift',
  trainerReward: 'battle reward',
  exchange: 'trade',
  giftPokemonHeldItem: 'held by a gift Pokémon',
});

// The `repeat` labels of a copy had once. One the map re-arms
// (resetByEvent) counts once: nothing shows it can be reached again while
// the reset is live. One a variable closes (onceByVariable) is had once
// too.
const ONCE = new Set(['once', 'resetByEvent', 'onceByVariable']);

// The branch type that tests which way a character faces: no gate.
const FACING_CONDITION = 6;

// A branch that runs a battle, with a trainer or a wild Pokémon, is passed
// by winning it: no gate in time beyond reaching it.
const BATTLE_CALL = /^pb(Double)?(Trainer|Wild)Battle\(/;

// A script that asks for a badge count outright.
const BADGE_COUNT = /^\$Trainer\.numbadges\s*>=\s*(\d+)$/;

// A switch the engine works out from the clock each time it is read: the
// time of day or the day of the week, which every badge count sees.
const CLOCK_SWITCH = /^s:!?(PBDayNight\.|pbIsWeekday\()/;

// The badge one condition implies: its own for a badge count asked
// outright, 0 for one that gates nothing in time (a confirmation, a price,
// a negation, a facing test, a counter at zero or still under a value, a
// battle to win, the time of day), null for one this cannot date.
function badgeOfCondition(condition, dating) {
  if (condition.badges != null) return condition.badges;
  if (condition.script != null) {
    if (BATTLE_CALL.test(condition.script)) return 0;
    const count = BADGE_COUNT.exec(condition.script.trim());
    return count ? Number(count[1]) : null;
  }
  if (
    condition.choice != null || condition.money != null ||
    condition.not != null || condition.selfSwitch != null ||
    condition.is === false || condition.conditionType === FACING_CONDITION
  ) {
    return 0;
  }
  if (condition.switch != null) {
    return CLOCK_SWITCH.test(condition.name || '')
      ? 0 : dating.switchBadge(condition.name);
  }
  if (condition.variable != null) {
    const floor = condition.atLeast ?? condition.value;
    if (typeof floor !== 'number') return null;
    // A variable starts at nothing, so one asked to be under a value, or
    // other than it, is so from the start; other than nothing means it
    // has been raised.
    if (condition.op === '<') return floor > 0 ? 0 : null;
    if (condition.op === '<=') return floor >= 0 ? 0 : null;
    if (condition.op === '!=') {
      return floor === 0 ? dating.variableBadge(condition.name || '', 1) : 0;
    }
    const lowerBound = condition.atLeast != null ||
      ['>=', '>', '=='].includes(condition.op);
    if (!lowerBound) return null;
    if (floor <= 0 && condition.atLeast != null) return 0;
    return dating.variableBadge(condition.name || '', floor);
  }
  return null;
}

/**
 * @param {!Array<!Object>} conditions Page conditions and enclosing
 *     branches of a give, as the extract records them.
 * @param {!EventDating} dating The game's rules for dating a switch or
 *     a variable.
 * @return {?number} The least badge count at which every condition can
 *     hold: the latest among them. Null when a condition gates the give by
 *     something the game's rules do not date (a quest switch, an item
 *     check), since nothing then dates it.
 */
export function conditionBadge(conditions, dating) {
  let badge = 0;
  for (const condition of conditions) {
    const implied = badgeOfCondition(condition, dating);
    if (implied == null) return null;
    badge = Math.max(badge, implied);
  }
  return badge;
}

/**
 * The copies of each item had once: those placed on the maps (item balls
 * and hidden items) and, when asked for, those handed over.
 * @param {{itemNames: !Object<string, string>, events: !Array<!Object>}}
 *     itemEvents The item-events extract.
 * @param {!Object<string, string>=} kinds The kinds of give that count,
 *     with what each is called.
 * @return {!Map<string, !Array<{mapId: number, mapName: string,
 *     kind: string, conditions: !Array<!Object>}>>} Item id -> its
 *     copies. An item counts once per map name, as the first listed: a map
 *     often exists in several versions (a room's water levels, a puzzle's
 *     states, a ward before and after its restoration) that repeat one
 *     copy, and a version cannot be told from a second copy.
 */
export function placedCopies(itemEvents, kinds = PLACED_COPY_KINDS) {
  const copies = new Map();
  const spots = new Set();
  for (const event of itemEvents.events) {
    const byItem = new Map();
    for (const give of event.gives) {
      const kind = kinds[give.kind];
      if (!kind || !give.item || !ONCE.has(give.repeat)) continue;
      const page = event.pages.find((entry) => entry.page === give.page);
      const conditions = [
        ...(page?.conditions || []),
        ...(give.within || []),
      ].filter((condition) => condition.selfSwitch == null);
      const id = itemId(itemEvents.itemNames[give.item] || give.item);
      const current = byItem.get(id);
      if (!current || conditions.length < current.conditions.length) {
        byItem.set(id, {
          mapId: event.mapId, mapName: event.mapName, kind, conditions,
        });
      }
    }
    for (const [id, copy] of byItem) {
      const spot = `${id}|${event.mapName}`;
      if (spots.has(spot)) continue;
      spots.add(spot);
      copies.set(id, [...(copies.get(id) || []), copy]);
    }
  }
  return copies;
}

/**
 * Shop stock the guide's shop table lacks. A mart call sells its items
 * together, so an item the table misses opens with the latest of the items
 * sold beside it.
 * @param {{itemNames: !Object<string, string>, events: !Array<!Object>}}
 *     itemEvents The item-events extract.
 * @param {function(string): ?number} shopBadgeOf Item id -> the badge the
 *     guide's shop table sells it from; null when the table lacks it.
 * @param {function(number): ?number} reachBadgeOf Map id -> the badge
 *     count the mart's map is reachable at.
 * @return {!Map<string, {badge: number, via: string}>} Item id -> the
 *     earliest mart that sells it and can be dated, for items the table
 *     lacks.
 */
export function missedShopStock(itemEvents, shopBadgeOf, reachBadgeOf) {
  const missed = new Map();
  for (const event of itemEvents.events) {
    for (const give of event.gives) {
      if (give.kind !== 'mart') continue;
      const ids = (give.stock || []).map((symbol) =>
        itemId(itemEvents.itemNames[symbol] || symbol));
      const known = ids.map(shopBadgeOf).filter((badge) => badge != null);
      if (!known.length) continue;
      const badge = Math.max(...known, reachBadgeOf(event.mapId) ?? 0);
      for (const id of ids) {
        if (shopBadgeOf(id) != null) continue;
        if (missed.has(id) && missed.get(id).badge <= badge) continue;
        missed.set(id, { badge, via: event.mapName });
      }
    }
  }
  return missed;
}

/**
 * The badge count at which each map is first reachable, for dating what
 * sits on it.
 * @param {!Object<string, {name: string, parentId: number,
 *     mapSwitches: (!Array<{name: string, is: boolean}>|undefined)}>} maps
 *     The map tree, and the switches a map exists under.
 * @param {!Object<string, {types: !Object<string, ?number>,
 *     reach: (?number|undefined)}>} encounterBadges The game's dated maps:
 *     each one's encounter tables, and `reach` where the record states the
 *     badge count the map is first entered at.
 * @param {!Object<string, number>} mapSwitchBadges Map switch name -> the
 *     badge count from which it can be on.
 * @return {function(number): ?number} Map id -> its badge count: its
 *     record's `reach`, else the earliest of its own encounter tables,
 *     else the nearest ancestor's in the map tree (a building inside a
 *     ward, a floor of a cave); never before a switch the map exists
 *     under. Null for a map with nothing dated at or above it.
 */
export function mapReachBadges(maps, encounterBadges, mapSwitchBadges) {
  return (mapId) => {
    const record = nearestRecord(maps, encounterBadges, mapId);
    if (!record) return null;
    let badge = recordBadge(record);
    for (const { name, is } of maps[mapId].mapSwitches || []) {
      if (is && mapSwitchBadges[name] != null) {
        badge = Math.max(badge, mapSwitchBadges[name]);
      }
    }
    return badge;
  };
}

/**
 * @param {!Object<string, {name: string, parentId: number}>} maps The map
 *     tree.
 * @param {!Object<string, {oneTime: (boolean|undefined)}>} encounterBadges
 *     The game's dated maps.
 * @return {function(number): boolean} Map id -> whether the dated map it
 *     is reached with is one the player passes through once and cannot
 *     return to.
 */
export function mapsVisitedOnce(maps, encounterBadges) {
  return (mapId) =>
    Boolean(nearestRecord(maps, encounterBadges, mapId)?.oneTime);
}

// The badge a dated map's record stands for: its `reach`, else the earliest
// of its encounter tables; null for a record that dates neither.
function recordBadge(record) {
  if (record.reach != null) return record.reach;
  const badges = Object.values(record.types || {})
    .filter((badge) => badge != null);
  return badges.length ? Math.min(...badges) : null;
}

// The record a map is dated by: its own, else the nearest ancestor's in the
// map tree, passing over records that date nothing. A record whose `reach`
// is stated as null says the map is never entered, so neither it nor what
// sits inside it is dated by anything above.
function nearestRecord(maps, encounterBadges, mapId) {
  for (let id = mapId; maps[id]; id = maps[id].parentId) {
    const record = encounterBadges[id];
    if (record?.reach === null) return null;
    if (record && recordBadge(record) != null) return record;
  }
  return null;
}

/**
 * The digs the mining rocks allow, by the badge each rock is reached.
 * @param {{events: !Array<!Object>}} itemEvents The item-events extract. A
 *     rock is an event with mining gives: one dig each, the second needing
 *     Blast Powder.
 * @param {function(number): ?number} reachBadgeOf Map id -> the badge count
 *     the map is reached at; null when nothing dates it.
 * @param {number} kitBadge The badge count the Mining Kit is had from.
 * @param {function(number): boolean=} visitedOnce Map id -> whether the
 *     player passes through the map once and cannot return.
 * @return {{digs: !Map<number, number>, comesBack: !Array<{badge: number,
 *     mapName: string}>, undated: number}} `digs` counts the digs of the
 *     rocks that are dug once and gone, by badge; `comesBack` lists the
 *     maps whose rocks return, each time the map reloads or after a wait;
 *     `undated` counts the rocks on maps nothing dates, which are left
 *     out. A rock that returns on a map visited once is dug while there
 *     and gone.
 */
export function miningDigs(
  itemEvents, reachBadgeOf, kitBadge, visitedOnce = () => false,
) {
  const digs = new Map();
  const comesBack = new Map();
  let undated = 0;
  for (const event of itemEvents.events) {
    const gives = event.gives.filter((give) => give.kind === 'mining');
    if (!gives.length) continue;
    const reached = reachBadgeOf(event.mapId);
    if (reached == null) {
      undated++;
      continue;
    }
    const badge = Math.max(reached, kitBadge);
    const returns = gives.some((give) =>
      give.repeat === 'mapReload' || give.repeat === 'timed');
    if (returns && !visitedOnce(event.mapId)) {
      comesBack.set(event.mapName, { badge, mapName: event.mapName });
    } else {
      digs.set(badge, (digs.get(badge) || 0) + gives.length);
    }
  }
  return { digs, comesBack: [...comesBack.values()], undated };
}

/**
 * The steps by which the copies of a mined item rise, on average.
 * @param {number} perDig The copies of the item one dig yields on average.
 * @param {!Map<number, number>} digsByBadge The digs that open at each
 *     badge.
 * @param {number} cap The count past which copies stop mattering.
 * @return {!Array<{badge: number, count: number}>} In badge order, each
 *     badge at which the whole copies expected from the digs so far rise,
 *     with how many they rise by; nothing past `cap` copies in all.
 */
export function expectedCopySteps(perDig, digsByBadge, cap) {
  const steps = [];
  let digs = 0;
  let copies = 0;
  const badges = [...digsByBadge.keys()].sort((a, b) => a - b);
  for (const badge of badges) {
    if (copies >= cap) break;
    digs += digsByBadge.get(badge);
    // A sum of dig counts times a weight ratio can land a hair under a
    // whole number.
    const whole = Math.min(cap, Math.floor(digs * perDig + 1e-9));
    if (whole > copies) {
      steps.push({ badge, count: whole - copies });
      copies = whole;
    }
  }
  return steps;
}

/**
 * One thing a mart sells. `conditions` gate the sale: those of the event
 * that opens the mart and the row's own. `currency` is 'Money' or a key of
 * the script rules' currencies. `once` marks a row the mart stops selling:
 * one with a purchase limit, or one withdrawn once the item is had.
 * @typedef {{id: string, mapId: number, mapName: string,
 *     conditions: !Array<!Object>, currency: string, once: boolean}}
 */
let Sale;

// The row conditions that withdraw a row once its item has been bought.
const SOLD_ONCE = /^!(\$game_switches\[self\.item\]|searchItem\(self\.item\))$/;

/**
 * @param {string} text One clause of a mart row's condition, a Ruby
 *     expression.
 * @param {{switches: !Object, variables: !Object}} markers The names of
 *     the game's switches and variables, by id.
 * @return {!Object} The clause as the condition an event page would carry;
 *     `script` for one this does not read, which nothing then dates.
 */
export function rowCondition(text, markers) {
  const badges = BADGE_COUNT.exec(text);
  if (badges) return { badges: Number(badges[1]) };
  const off = /^\$game_switches\[(\d+)\]\s*==\s*false$/.exec(text);
  if (off) {
    return {
      switch: Number(off[1]), name: markers.switches[off[1]]?.name, is: false,
    };
  }
  const atLeast = /^\$game_variables\[(\d+)\]\s*>=\s*(\d+)$/.exec(text);
  if (atLeast) {
    return {
      variable: Number(atLeast[1]),
      name: markers.variables[atLeast[1]]?.name,
      atLeast: Number(atLeast[2]),
    };
  }
  return { script: text };
}

// The item rows of a mart of the script rules. A category may be another
// mart's whole inventory; a row may sell a move, a Pokémon or a currency
// instead of an item.
function martRows(marts, key, seen = new Set()) {
  if (seen.has(key) || !marts[key]) return [];
  seen.add(key);
  return Object.values(marts[key].categories).flatMap((category) =>
    (Array.isArray(category)
      ? category.filter((row) => row.item)
      : martRows(marts, category.mart, seen)));
}

/**
 * Every sale the marts on the maps make. An event lists a mart's stock
 * itself, sold for money without limit, or names a mart of the script
 * rules, whose rows carry their own price, currency, conditions and limit.
 * @param {{itemNames: !Object<string, string>, events: !Array<!Object>,
 *     scriptRules: !Object, storyMarkers: !Object}} itemEvents The
 *     item-events extract.
 * @return {!Array<!Sale>} In event order.
 */
export function martSales(itemEvents) {
  const marts = itemEvents.scriptRules.marts?.marts || {};
  const idOf = (symbol) => itemId(itemEvents.itemNames[symbol] || symbol);
  const sales = [];
  for (const event of itemEvents.events) {
    for (const give of event.gives) {
      if (give.kind !== 'mart') continue;
      const page = event.pages?.find((entry) => entry.page === give.page);
      const opened = {
        mapId: event.mapId,
        mapName: event.mapName,
        conditions: [...(page?.conditions || []), ...(give.within || [])],
      };
      for (const symbol of give.stock || []) {
        sales.push({
          ...opened, id: idOf(symbol), currency: 'Money', once: false,
        });
      }
      for (const row of give.mart ? martRows(marts, give.mart) : []) {
        const clauses = (row.conditions || [])
          .flatMap((text) => text.split('&&'))
          .map((text) => text.trim());
        sales.push({
          ...opened,
          id: idOf(row.item),
          conditions: [
            ...opened.conditions,
            ...clauses.filter((text) => !SOLD_ONCE.test(text))
              .map((text) => rowCondition(text, itemEvents.storyMarkers)),
          ],
          currency: row.currency || 'Money',
          once: row.limit != null || clauses.some((text) =>
            SOLD_ONCE.test(text)),
        });
      }
    }
  }
  return sales;
}

/**
 * When each sale opens, from the game files alone.
 * @param {!Array<!Sale>} sales
 * @param {function(number): ?number} reachBadgeOf Map id -> the badge count
 *     the mart's map is reached at; null when nothing dates it.
 * @param {!EventDating} dating
 * @param {function(string): ?number} currencyBadgeOf Currency -> the badge
 *     count from which it can be earned again and again; null for one that
 *     cannot, or that nothing dates.
 * @return {{stock: !Map<string, {badge: number, via: string}>,
 *     once: !Map<string, {badge: number, via: string}>, undated: number}}
 *     `stock` holds the earliest sale of each item that restocks; `once`
 *     the earliest sale of each item that is made a fixed number of times;
 *     `undated` counts the sales left out because their map, a condition
 *     or their currency could not be dated.
 */
export function datedSales(sales, reachBadgeOf, dating, currencyBadgeOf) {
  const stock = new Map();
  const once = new Map();
  let undated = 0;
  for (const sale of sales) {
    const parts = [
      reachBadgeOf(sale.mapId),
      conditionBadge(sale.conditions, dating),
      currencyBadgeOf(sale.currency),
    ];
    if (parts.some((badge) => badge == null)) {
      undated++;
      continue;
    }
    const badge = Math.max(...parts);
    const earliest = sale.once ? once : stock;
    if (earliest.has(sale.id) && earliest.get(sale.id).badge <= badge) {
      continue;
    }
    earliest.set(sale.id, { badge, via: sale.mapName });
  }
  return { stock, once, undated };
}

/**
 * @param {{itemNames: !Object<string, string>, events: !Array<!Object>,
 *     scriptRules: !Object, storyMarkers: !Object}} itemEvents The
 *     item-events extract.
 * @return {!Set<string>} The id of every item some mart in the game files
 *     sells: the marts on the maps and, where the game has one, the
 *     badge-tiered default mart.
 */
export function martStock(itemEvents) {
  const tiers = itemEvents.scriptRules.defaultMart?.tiers || [];
  return new Set([
    ...tiers.flatMap((tier) => tier.stock).map((symbol) =>
      itemId(itemEvents.itemNames[symbol] || symbol)),
    ...martSales(itemEvents).map((sale) => sale.id),
  ]);
}
