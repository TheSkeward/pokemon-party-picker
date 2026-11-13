/**
 * @fileoverview Finds every map event and common event that can hand the
 * player an item, with what gates the give, what it costs, what state it
 * changes and so how often it can happen. It reports what the game files
 * say; when a give opens in a playthrough is left to its consumers.
 *
 * The script calls that give items differ a little from game to game; a
 * game's adapter lists its own (EventCalls).
 */
import {
  collapse,
  enclosingConditions,
  isPrefix,
  pageConditions,
  pageRecord,
  relation,
  scriptsIn,
  stateWrites,
  walkCommands,
} from './event-commands.mjs';
import { numbersIn, splitArgs, symbolsIn } from './game-files.mjs';

/**
 * The script calls a game's events give items with.
 *
 * `gives` maps a call that takes an item and a quantity to the method its
 * give is recorded under: 'itemBall' (found on the map), 'receive' (handed
 * over), 'store' (put in the Bag without a word) or 'berryTree'.
 * `defaultMart` is the call that opens the badge-tiered default mart, and
 * `dataMart` the call that opens a mart of marts.dat by name; null where
 * the game has no such call. `poolDraws` maps a call that finds an item
 * drawn from a named pool to where the pool is named: the position of the
 * pool argument, and the pool drawn from when it is left out. The pools
 * themselves are the game's `itemPools` script rule, keyed by the call.
 * `eventTimers` are the calls that stamp the event's clock, after which
 * the event stays spent until its time has passed. `selfSwitchResets`
 * reads from a script the self switches it clears on every event of a map
 * (`mapId` null for the map the script runs on).
 * @typedef {{
 *   gives: !Object<string, string>,
 *   defaultMart: ?string,
 *   dataMart: ?string,
 *   poolDraws: !Object<string,
 *       {poolArgument: number, defaultPool: (string|undefined)}>,
 *   eventTimers: !Array<string>,
 *   selfSwitchResets:
 *       function(string): !Array<{mapId: ?number, selfSwitch: string}>,
 * }}
 */
let EventCalls;

/**
 * The calls every game of the engine family gives items with.
 * @const {!Object<string, string>}
 */
export const ENGINE_GIVE_CALLS = Object.freeze({
  'Kernel.pbItemBall': 'itemBall',
  'Kernel.pbReceiveItem': 'receive',
  '$PokemonBag.pbStoreItem': 'store',
  pbPickBerry: 'berryTree',
});

/**
 * A reset written out as a loop: a script that clears one self switch on
 * every event of the map it runs on.
 * @param {string} script
 * @return {!Array<{mapId: ?number, selfSwitch: string}>}
 */
export function selfSwitchLoopResets(script) {
  const loop = /for event in \$game_map\.events\.values\s+pbSetSelfSwitch\(event\.id,\s*"(\w)",\s*false\)/g;
  return [...script.matchAll(loop)]
    .map((match) => ({ mapId: null, selfSwitch: match[1] }));
}

/**
 * A reset made with set_self_switches(map, switches, value), which sets
 * the named self switches (all five when none is named) of every event of
 * a map (the current one when none is named). Only a call that turns them
 * off is a reset.
 * @param {string} script
 * @return {!Array<{mapId: ?number, selfSwitch: string}>}
 */
export function setSelfSwitchesResets(script) {
  const resets = [];
  const call = /\bset_self_switches\b(?:\s*\(([^()]*)\))?/g;
  for (const [, args = ''] of script.matchAll(call)) {
    const [map, switches, value] = splitArgs(args);
    if (value === 'true') continue;
    const named = switches == null || switches === 'nil'
      ? ['A', 'B', 'C', 'D', 'E']
      : [...switches.matchAll(/['"](\w)['"]/g)].map((match) => match[1]);
    const mapId = map == null || map === 'nil' ? null : Number(map);
    for (const selfSwitch of named) resets.push({ mapId, selfSwitch });
  }
  return resets;
}

// A call's argument list, parentheses nested one deep.
const ARGUMENTS = '\\s*\\(((?:[^()]|\\([^()]*\\))*)\\)';

// The names as a regular expression alternation; one that matches nothing
// when there are none.
function anyOf(names) {
  if (!names.length) return '(?!)';
  return names
    .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');
}

/**
 * A game's event calls as the patterns the reader matches scripts with.
 * @param {!EventCalls} calls
 * @param {!Object<string, {pools: !Object<string, !Array<string>>}>}
 *     itemPools The game's item-pool rules, by the call that draws.
 * @return {!Object}
 */
function compileCalls(calls, itemPools) {
  const { defaultMart, dataMart } = calls;
  return {
    give: new RegExp(`(${anyOf(Object.keys(calls.gives))})${ARGUMENTS}`, 'g'),
    giveMethods: calls.gives,
    poolDraw:
      new RegExp(`(${anyOf(Object.keys(calls.poolDraws))})${ARGUMENTS}`, 'g'),
    poolDraws: calls.poolDraws,
    itemPools,
    defaultMart: defaultMart && new RegExp(`\\b${anyOf([defaultMart])}\\b`),
    dataMart:
      dataMart && new RegExp(`\\b${anyOf([dataMart])}\\s*\\(\\s*:(\\w+)`),
    eventTimer: new RegExp(`\\b(?:${anyOf(calls.eventTimers)})\\b`),
    selfSwitchResets: calls.selfSwitchResets,
  };
}

// Whether two sets of branch conditions cannot both hold: each tests the
// same variable for a different value, as the arms of a menu do.
const excludes = (conditions, others) =>
  conditions.some((a) =>
    others.some(
      (b) => a.op === '==' && b.op === '==' && a.variable === b.variable &&
        typeof a.value === 'number' && typeof b.value === 'number' &&
        a.value !== b.value,
    ),
  );

const INLINE_MART = /pbPokemonMart\s*\(\s*\[([^\]]*)\]/;
const TRAINER_BATTLE = /\bpb(?:Double)?TrainerBattle(?:100)?\s*\(/;
const HELD_ITEM = /\b(\w+)\.(?:setItem\(\s*:(\w+)\s*\)|item\s*=\s*:(\w+))/g;

// The item a pool draw finds: one of the pool its call names.
function poolDrawGive(match, calls) {
  const [text, call, args] = match;
  const { poolArgument, defaultPool } = calls.poolDraws[call];
  const named = splitArgs(args)[poolArgument];
  const pool = named == null ? defaultPool : named.replace(/^:/, '');
  const itemCandidates = calls.itemPools[call]?.pools[pool];
  if (!itemCandidates) {
    throw new Error(`${collapse(text)}: no item pool "${pool}" was read`);
  }
  return { method: 'itemBall', call: collapse(text), pool, itemCandidates };
}

// The mart a script opens, if any: one stocked in the call, else the
// default mart, else a mart of marts.dat.
function martGive(script, calls) {
  const inline = script.match(INLINE_MART);
  if (inline) return { method: 'mart', stock: symbolsIn(inline[1]) };
  if (calls.defaultMart?.test(script)) {
    return { method: 'mart', defaultMart: true };
  }
  const named = calls.dataMart && script.match(calls.dataMart);
  return named ? { method: 'mart', mart: named[1] } : null;
}

/**
 * Finds every item-giving call in one script text.
 * @param {string} script
 * @param {!Object} calls The game's compiled event calls.
 * @return {!Array<!Object>} Partial give records.
 */
function givesInScript(script, calls) {
  const gives = [];
  for (const match of script.matchAll(calls.give)) {
    const [itemArg, quantityArg] = splitArgs(match[2]);
    const pairs = [...script.matchAll(/:(\w+)\s*=>\s*(\d+)/g)];
    if (/^[a-z_]+$/.test(itemArg ?? '') && pairs.length) {
      // A hash literal of item => quantity, stored pair by pair.
      for (const [, item, quantity] of pairs) {
        gives.push({
          method: calls.giveMethods[match[1]],
          call: collapse(script),
          item,
          quantity: Number(quantity),
        });
      }
      continue;
    }
    const give = {
      method: calls.giveMethods[match[1]],
      call: collapse(match[0]),
    };
    const symbol = itemArg?.match(/^:(\w+)$/);
    if (symbol) give.item = symbol[1];
    else give.itemExpression = itemArg ?? '';
    if (quantityArg == null) give.quantity = 1;
    else if (/^\d+$/.test(quantityArg)) give.quantity = Number(quantityArg);
    else give.quantityExpression = quantityArg;
    gives.push(give);
  }
  for (const match of script.matchAll(calls.poolDraw)) {
    gives.push(poolDrawGive(match, calls));
  }
  for (const match of script.matchAll(HELD_ITEM)) {
    const wild = /pbGenerateWildPokemon|pbWildBattle/.test(script);
    const species = script.match(
      /(?:PokeBattle_Pokemon\.new|pbGenerateWildPokemon)\(\s*:(\w+)/,
    );
    gives.push({
      method: wild ? 'wildEventHeldItem' : 'giftPokemonHeldItem',
      item: match[2] ?? match[3],
      quantity: 1,
      species: species?.[1] ?? null,
      call: collapse(script),
    });
  }
  const mart = martGive(script, calls);
  if (mart) gives.push({ ...mart, call: collapse(script) });
  if (/\bpbMiningGame\b/.test(script)) {
    gives.push({ method: 'mining', call: collapse(script) });
  }
  if (/\bpbBerryPlant\b/.test(script)) {
    gives.push({ method: 'berryPlot', call: collapse(script) });
  }
  const conversion = script.match(
    /\$PokemonBag\.pbChangeItem\(\s*:(\w+)\s*,\s*:(\w+)\s*\)/,
  );
  if (conversion) {
    gives.push({
      method: 'conversion',
      item: conversion[2],
      quantity: 1,
      costs: [{ item: conversion[1], quantity: 'all held' }],
      call: collapse(conversion[0]),
    });
  }
  return gives;
}

/**
 * State a step changes, in the shapes the `sets` list reports.
 * @return {!Array<!Object>}
 */
function stateChanges(step, names, calls) {
  const [a, b] = step.parameters;
  switch (step.code) {
    case 121:
    case 122:
      return stateWrites(step, names);
    case 123:
      return [{ selfSwitch: a, to: b === 0 }];
    case 116:
      return [{ eraseEvent: 'until the map reloads' }];
    case 355:
    case 111: {
      if (!step.script) return [];
      const out = [];
      const script = step.script;
      if (calls.eventTimer.test(script)) out.push({ eventTime: true });
      if (/\bpbEraseThisEvent\b/.test(script)) {
        out.push({ eraseEvent: 'until the map reloads' });
      }
      for (const m of script.matchAll(/setTempSwitchOn\(\s*"(\w)"\s*\)/g)) {
        out.push({ tempSwitch: m[1], to: true });
      }
      for (const m of script.matchAll(
        /pbSetSelfSwitch\(\s*(\d+)\s*,\s*"(\w)"\s*,\s*(true|false)\s*\)/g,
      )) {
        out.push({ selfSwitch: m[2], ofEvent: Number(m[1]), to: m[3] === 'true' });
      }
      // What a script sets a variable to stays out of `sets`: `repeat`
      // reads a constant there as a step the event itself counts.
      for (const { constant, ...write } of stateWrites(step, names)) {
        out.push(write);
      }
      return out;
    }
    default:
      return [];
  }
}

/**
 * What a step takes from the player, in the shapes the `costs` list reports.
 * @return {!Array<!Object>}
 */
function stepCosts(step, names, steps) {
  if (step.code === 125 && step.parameters[0] === 1) {
    const [, operandType, value] = step.parameters;
    return [{ money: operandType === 0 ? value : names.variable(value) }];
  }
  if (step.code === 122 && step.parameters[2] === 2) {
    // A variable spent like a currency (Battle Points). The price usually
    // sits in a second variable set just before, sometimes multiplied by a
    // chosen quantity.
    const [first, last, , operandType, operand] = step.parameters;
    const out = [];
    for (let id = first; id <= last; id++) {
      const cost = { ...names.variable(id) };
      if (operandType === 0) {
        cost.amount = operand;
      } else if (operandType === 1) {
        cost.amountVariable = names.variable(operand);
        const writes = steps.filter(
          (s) =>
            s.code === 122 &&
            s.index < step.index &&
            s.parameters[0] <= operand &&
            operand <= s.parameters[1] &&
            isPrefix(s.chain, step.chain),
        );
        const set = writes.findLast((s) => s.parameters[2] === 0);
        if (set?.parameters[3] === 0) cost.amount = set.parameters[4];
        const scaled = writes.find(
          (s) => s.index > set?.index && s.parameters[2] === 3,
        );
        if (scaled) cost.timesVariable = names.variable(scaled.parameters[4]);
      }
      out.push(cost);
    }
    return out;
  }
  if (!step.script) return [];
  const out = [];
  for (const m of step.script.matchAll(
    /\$PokemonBag\.pbDeleteItem\(((?:[^()]|\([^()]*\))*)\)/g,
  )) {
    const [item, quantity] = splitArgs(m[1]);
    const symbol = item.match(/^:(\w+)$/);
    out.push({
      ...(symbol ? { item: symbol[1] } : { itemExpression: item }),
      quantity: quantity == null ? 1 : /^\d+$/.test(quantity) ? Number(quantity) : quantity,
    });
  }
  for (const m of step.script.matchAll(/\$PokemonGlobal\.coins\s*-=\s*(\d+)/g)) {
    out.push({ coins: Number(m[1]) });
  }
  return out;
}

// Whether a condition on a variable stops holding once the variable is set
// to `constant`.
function falsifiedBy(condition, constant) {
  if (typeof condition.value !== 'number') return false;
  const holds = {
    '==': constant === condition.value,
    '!=': constant !== condition.value,
    '>=': constant >= condition.value,
    '<=': constant <= condition.value,
    '>': constant > condition.value,
    '<': constant < condition.value,
  }[condition.op];
  return !holds;
}

/**
 * How often a give can happen, read off the state it changes:
 *   timed             stamps the event's clock (an event-timer call)
 *   once              flips a self switch, or a switch this event reads
 *   onceByVariable    sets a variable this event gates on
 *   onceIfBranchTaken flips such a switch only in a later branch
 *   mapReload         erases the event or sets a temp switch, nothing more
 *   stateOnly         changes a switch or variable nothing here reads
 *   unlimited         changes nothing lasting
 * markReset later turns a self-switch-only `once` into `resetByEvent`
 * where another event clears that self switch on the give's map.
 * State nothing here reads is reported as such rather than guessed at: it
 * is usually story progress read by other events.
 * @param {!Array<!Object>} sets
 * @param {!Array<!Object>} gates Page conditions and enclosing branch
 *     conditions that could stop the give.
 * @param {string=} quantityExpression The give's quantity, when computed.
 * @return {string}
 */
function repeatOf(sets, gates, quantityExpression = '') {
  if (sets.some((s) => s.eventTime)) return 'timed';
  // A global switch gates the give only if this event reads it; one set and
  // then cleared again along the way is a busy flag.
  const read = new Set(gates.map((gate) => (gate.not ?? gate).switch));
  const switchesSetTo = (value) =>
    new Set(sets.filter((s) => s.to === value).map((s) => s.switch));
  const cleared = switchesSetTo(false);
  const raised = switchesSetTo(true);
  const flips = (s) =>
    ('selfSwitch' in s && s.to && !('ofEvent' in s)) ||
    ('switch' in s && 'to' in s && read.has(s.switch) &&
      !(cleared.has(s.switch) && raised.has(s.switch)));
  if (sets.some((s) => flips(s) && !s.afterBranch)) return 'once';
  // A variable another command reads back as an operand or a quantity is
  // working storage, not progress.
  const scratch = new Set([
    ...sets.map((s) => s.fromVariable?.variable),
    ...numbersIn(quantityExpression),
  ]);
  const progress = sets.filter(
    (s) => s.op === 'set' && 'constant' in s && !scratch.has(s.variable),
  );
  const gated = progress.some((s) =>
    gates.some((gate) => {
      const condition = gate.not ?? gate;
      if (condition.variable !== s.variable) return false;
      if ('atLeast' in condition) return true;
      return s.op === 'set' && !gate.not && falsifiedBy(condition, s.constant);
    }),
  );
  if (gated) return 'onceByVariable';
  if (sets.some(flips)) return 'onceIfBranchTaken';
  const unread = (s) =>
    ('switch' in s && 'to' in s && !read.has(s.switch) &&
      !(cleared.has(s.switch) && raised.has(s.switch))) || 'ofEvent' in s;
  const reloads = (s) => 'tempSwitch' in s || 'eraseEvent' in s;
  if (sets.some((s) => reloads(s) && !s.afterBranch)) return 'mapReload';
  if (sets.some(unread) || progress.length) return 'stateOnly';
  return sets.some(reloads) ? 'mapReload' : 'unlimited';
}

const ONE_TIME = ['once', 'onceByVariable', 'onceIfBranchTaken', 'stateOnly'];

// Whether any command sets or adds a constant to the variable.
const countsVariable = (steps, id) =>
  steps.some((s) => {
    const [first, last, op, operandType] = s.parameters;
    return s.code === 122 && first <= id && id <= last && op <= 1 &&
      operandType === 0;
  });

function kindOf(give, context) {
  switch (give.method) {
    case 'itemBall':
      return context.hidden ? 'hiddenItem' : 'itemBall';
    case 'receive':
    case 'store':
      if (/\.party\[\w+\]\.item$/.test(give.itemExpression ?? '')) {
        return 'returnedHeldItem';
      }
      if (give.itemExpression != null && !give.itemCandidates) return 'dynamic';
      if (context.afterTrainerBattle) return 'trainerReward';
      if (context.vending) return 'vending';
      if (give.costs?.length) return 'exchange';
      return ONE_TIME.includes(give.repeat) ? 'gift' : 'repeatableGift';
    default:
      return give.method;
  }
}

/**
 * Reads one command list for item gives, each with its enclosing branch
 * conditions, the state changed along with it, and what it costs.
 * @param {!Array<!Object>} list
 * @param {!Names} names
 * @param {!Object} calls The game's compiled event calls.
 * @param {!Map<number, !Object>} commonEvents Analysed common events, to
 *     follow Call Common Event into.
 * @param {!Array<!Object>} gates The owning event's page conditions.
 * @return {!Array<!Object>}
 */
function analyseCommands(list, names, calls, commonEvents, gates) {
  const steps = walkCommands(list, names);
  const within = (chain) => enclosingConditions(steps, chain);
  const found = [];
  for (const step of steps) {
    const partials = step.script ? givesInScript(step.script, calls) : [];
    if (step.code === 117) {
      for (const inner of commonEvents.get(step.parameters[0])?.gives ?? []) {
        partials.push({
          ...inner,
          viaCommonEvent: step.parameters[0],
          innerWithin: inner.within,
          innerSets: inner.sets,
        });
      }
    }
    for (const partial of partials) found.push({ step, partial });
  }

  const battles = steps.filter(
    (s) => s.script && TRAINER_BATTLE.test(s.script),
  );
  const prices = steps.flatMap((s) =>
    [...(s.script ?? '').matchAll(/set(Sell)?Price\(([^)]*)\)/g)].map((m) => {
      const [item, first, second] = splitArgs(m[2]);
      const price = { item: item.replace(/^:/, '') };
      if (m[1]) price.sell = Number(first);
      else {
        price.buy = Number(first);
        if (second != null) price.sell = Number(second);
      }
      return { step: s, price };
    }),
  );

  return found.map(({ step, partial }) => {
    const { innerWithin = [], innerSets = [], ...give } = partial;
    const enclosing = within(step.chain);
    const sets = [...innerSets];
    const spent = [];
    for (const other of steps) {
      const how = relation(other, step);
      if (!how || how === 'before') continue;
      if (how === 'after' && excludes(within(other.chain), enclosing)) continue;
      for (const change of stateChanges(other, names, calls)) {
        sets.push(how === 'after' ? { ...change, afterBranch: true } : change);
      }
      if (how === 'with') spent.push(...stepCosts(other, names, steps));
    }
    // A script that gives and pays in one command is its own cost.
    if (give.method !== 'conversion') {
      spent.push(...stepCosts(step, names, steps));
    }
    for (const change of stateChanges(step, names, calls)) sets.push(change);
    // pbPickBerry turns the tree into an empty plot itself.
    if (give.method === 'berryTree') sets.push({ selfSwitch: 'A', to: true });

    // A variable is a currency only when the give first checks the player
    // has enough of it; other subtractions are arithmetic.
    const costs = [
      ...(give.costs ?? []),
      ...spent.filter(
        (cost) => !('variable' in cost) || enclosing.some(
          (c) => c.variable === cost.variable && c.op === '>=',
        ),
      ),
    ];
    const record = {
      ...give,
      within: [...enclosing, ...innerWithin],
      sets,
      costs,
    };
    if (give.method === 'mart') {
      const own = prices.filter(
        ({ step: s }) => s.index <= step.index && isPrefix(s.chain, step.chain),
      );
      if (own.length) record.prices = own.map(({ price }) => price);
      record.repeat = 'unlimited';
    } else {
      record.repeat = repeatOf(
        sets,
        [...gates, ...record.within],
        give.quantityExpression,
      );
      // A free give under `variable == n` is a milestone reward when the
      // page counts that variable up elsewhere (a quest tally), even though
      // nothing on the give's own path changes state.
      const milestone = record.within.some(
        (c) => c.op === '==' && typeof c.value === 'number' &&
          countsVariable(steps, c.variable),
      );
      if (record.repeat === 'unlimited' && !costs.length && milestone) {
        record.repeat = 'onceByVariable';
      }
    }
    record.afterTrainerBattle = Boolean(give.afterTrainerBattle) ||
      battles.some(
        (b) => b.index === step.index ||
          (b.index < step.index && relation(b, step) !== null),
      );
    return record;
  });
}

function finishGive(record, context) {
  const { method, afterTrainerBattle, ...give } = record;
  const kind = kindOf(record, { ...context, afterTrainerBattle });
  const out = { page: context.page, kind, ...give };
  if (afterTrainerBattle) out.afterTrainerBattle = true;
  if (!out.costs.length) delete out.costs;
  if (!out.sets.length) delete out.sets;
  if (!out.within.length) delete out.within;
  if (kind === 'mart' || kind === 'berryPlot') delete out.repeat;
  return out;
}

const COINS_GAINED = /\$PokemonGlobal\.coins\s*\+=\s*(\d+)/g;
const COIN_GAME = /\b(pbSlotMachine|pbRoulette|pbVoltorbFlip)\b/;
const BADGE_AWARD = /\$Trainer\.badges\[(\d+)\]\s*=\s*true/;

/**
 * A give whose only lasting change is a self switch comes back when
 * another event clears that self switch for every event of its map.
 * @param {!Array<!Object>} mapEvents The item events of the map the reset
 *     clears.
 * @param {!Object} reset A self-switch reset, as the extract records it.
 */
function markReset(mapEvents, reset) {
  for (const event of mapEvents) {
    for (const give of event.gives) {
      const lasting = (give.sets ?? []).filter((s) => !s.afterBranch);
      const onlySelfSwitch = lasting.length > 0 && lasting.every(
        (s) => s.selfSwitch === reset.selfSwitch && s.to && !('ofEvent' in s),
      );
      if (give.repeat !== 'once' && !give.resetBy) continue;
      if (!onlySelfSwitch) continue;
      give.repeat = 'resetByEvent';
      const by = { eventId: reset.eventId, page: reset.page };
      (give.resetBy ??= []).push(
        reset.mapId === event.mapId ? by : { mapId: reset.mapId, ...by });
    }
  }
}

const HIDDEN_ITEM_NAME = /hiddenitem/i;
const VENDING_NAME = /vending/i;

// The lottery stores its prize with setVariable(:ITEM) and hands it out with
// pbReceiveItem(getVariable()); the candidates are every prize the event can
// store.
function resolveCandidates(records, event) {
  for (const record of records) {
    if (record.itemExpression !== 'getVariable()') continue;
    const stored = event.pages.flatMap((page) =>
      page.list.flatMap((command) =>
        [355, 655].includes(command.code)
          ? [...command.parameters[0].matchAll(/setVariable\(\s*:(\w+)\s*\)/g)]
          : [],
      ),
    );
    record.itemCandidates = [...new Set(stored.map((m) => m[1]))];
  }
}

/**
 * Every map event that can hand the player an item.
 * @param {{maps: !Iterable<{mapId: number, map: !Object}>,
 *     commonEvents: !Array, mapInfos: !Map}} files Plain Map###.rxdata
 *     files, CommonEvents.rxdata and MapInfos.rxdata.
 * @param {!Names} names
 * @param {!EventCalls} eventCalls The game's item-giving calls.
 * @param {!Object<string, !Object>=} itemPools The game's item-pool rules,
 *     by the call that draws from them.
 * @return {{events: !Array<!Object>, commonEvents: !Array<!Object>,
 *     coinSources: !Array<!Object>, badgeAwards: !Array<!Object>,
 *     selfSwitchResets: !Array<!Object>}}
 */
export function extractItemEvents(files, names, eventCalls, itemPools = {}) {
  const { mapInfos } = files;
  const calls = compileCalls(eventCalls, itemPools);
  const commonEvents = new Map();
  for (const event of files.commonEvents) {
    if (!event) continue;
    const gives = analyseCommands(event.list, names, calls, new Map(), []);
    if (gives.length) commonEvents.set(event.id, { event, gives });
  }

  const eventsByMap = new Map();
  const coinSources = [];
  const badgeAwards = [];
  const selfSwitchResets = [];
  const callers = new Map();
  for (const { mapId, map } of files.maps) {
    const mapName = mapInfos.get(mapId)?.name ?? null;
    const mapEvents = [];
    const sorted = [...map.events.values()].sort((a, b) => a.id - b.id);
    for (const event of sorted) {
      const where = {
        mapId,
        mapName,
        eventId: event.id,
        eventName: event.name,
      };
      const gates = event.pages.flatMap((page) =>
        pageConditions(page.condition, names),
      );
      const gives = [];
      event.pages.forEach((page, pageIndex) => {
        const context = {
          page: pageIndex + 1,
          hidden: HIDDEN_ITEM_NAME.test(event.name),
          vending: VENDING_NAME.test(event.name),
        };
        const records =
          analyseCommands(page.list, names, calls, commonEvents, gates);
        resolveCandidates(records, event);
        for (const record of records) {
          gives.push(finishGive(record, context));
          if (record.viaCommonEvent != null) {
            const list = callers.get(record.viaCommonEvent) ?? [];
            list.push(`${mapId}/${event.id}/${pageIndex + 1}`);
            callers.set(record.viaCommonEvent, list);
          }
        }
        const at = { ...where, page: pageIndex + 1 };
        const conditions = pageConditions(page.condition, names);
        for (const script of scriptsIn(page.list)) {
          const call = collapse(script);
          for (const [, coins] of script.matchAll(COINS_GAINED)) {
            coinSources.push({ ...at, coins: Number(coins), call });
          }
          const game = script.match(COIN_GAME);
          if (game) coinSources.push({ ...at, game: game[1], call });
          const badge = script.match(BADGE_AWARD);
          if (badge) {
            const badgeNumber = Number(badge[1]) + 1;
            badgeAwards.push({ badge: badgeNumber, ...at, conditions });
          }
          for (const reset of calls.selfSwitchResets(script)) {
            const target = reset.mapId ?? mapId;
            selfSwitchResets.push({
              ...at,
              ...(target === mapId ? {} : {
                targetMapId: target,
                targetMapName: mapInfos.get(target)?.name ?? null,
              }),
              selfSwitch: reset.selfSwitch,
              call,
              // Later pages take over once their conditions hold, which is
              // what ends the resetting.
              pages: event.pages.map((p, i) => pageRecord(p, i, names)),
            });
          }
        }
      });
      if (!gives.length) continue;
      mapEvents.push({
        ...where,
        x: event.x,
        y: event.y,
        kinds: [...new Set(gives.map((g) => g.kind))].sort(),
        pages: event.pages.map((page, i) => pageRecord(page, i, names)),
        gives,
      });
    }
    eventsByMap.set(mapId, mapEvents);
  }
  // A reset may clear another map's self switches, so it is applied once
  // every map has been read.
  for (const reset of selfSwitchResets) {
    const cleared = eventsByMap.get(reset.targetMapId ?? reset.mapId) ?? [];
    markReset(cleared, reset);
  }

  const commonEventRecords = [...commonEvents.values()].map(
    ({ event, gives }) => ({
      commonEventId: event.id,
      name: event.name,
      trigger: ['call', 'autorun', 'parallel'][event.trigger],
      // Autorun and parallel common events run while their switch is on.
      triggerSwitch: event.trigger ? names.switch(event.switch_id) : undefined,
      calledFrom: [...new Set(callers.get(event.id) ?? [])],
      gives: gives.map((g) => finishGive(g, { page: null, hidden: false })),
    }),
  );
  badgeAwards.sort((a, b) => a.badge - b.badge || a.mapId - b.mapId);
  return {
    events: [...eventsByMap.values()].flat(),
    commonEvents: commonEventRecords,
    coinSources,
    badgeAwards,
    selfSwitchResets,
  };
}

/**
 * @param {{events: !Array<!Object>, commonEvents: !Array<!Object>}}
 *     extracted The result of extractItemEvents.
 * @return {!Array<!Object>} Every condition a give sits under: its page's
 *     and its enclosing branches'; for a common event's give, the switch
 *     the common event runs under.
 */
export function giveConditions({ events, commonEvents }) {
  const conditions = [];
  for (const event of events) {
    for (const give of event.gives) {
      const page = event.pages.find((entry) => entry.page === give.page);
      conditions.push(...(page.conditions ?? []), ...(give.within ?? []));
    }
  }
  for (const { triggerSwitch, gives } of commonEvents) {
    if (triggerSwitch) conditions.push(triggerSwitch);
    for (const give of gives) conditions.push(...(give.within ?? []));
  }
  return conditions;
}

/**
 * Counts for a quick read of the item-events extract.
 * @param {!Array<!Object>} events
 * @return {!Object} The counts, with `items` the set of every item symbol
 *     the events give or sell.
 */
export function summarise(events) {
  const givesByKind = {};
  const eventsByKind = {};
  const repeatByKind = {};
  const items = new Set();
  const unresolved = [];
  for (const event of events) {
    for (const kind of event.kinds) {
      eventsByKind[kind] = (eventsByKind[kind] ?? 0) + 1;
    }
    for (const give of event.gives) {
      givesByKind[give.kind] = (givesByKind[give.kind] ?? 0) + 1;
      if (give.repeat) {
        const tally = (repeatByKind[give.kind] ??= {});
        tally[give.repeat] = (tally[give.repeat] ?? 0) + 1;
      }
      if (give.item) items.add(give.item);
      for (const item of give.stock ?? []) items.add(item);
      for (const item of give.itemCandidates ?? []) items.add(item);
      if (give.kind === 'dynamic') {
        unresolved.push({
          mapId: event.mapId,
          eventId: event.eventId,
          page: give.page,
          call: give.call,
        });
      }
    }
  }
  const sortKeys = (object) =>
    Object.fromEntries(
      Object.entries(object).sort(([a], [b]) => (a < b ? -1 : 1)),
    );
  return {
    events: events.length,
    eventsByKind: sortKeys(eventsByKind),
    givesByKind: sortKeys(givesByKind),
    repeatByKind: sortKeys(repeatByKind),
    distinctItems: items.size,
    unresolved,
    items,
  };
}
