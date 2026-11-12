/**
 * @fileoverview Extracts where items come from in Pokémon Reborn, straight
 * from an install's compiled data and Ruby sources:
 *
 *   node scripts/reborn/extract-reborn-item-sources.mjs <install-path>
 *
 * Writes four extracts beside this script: wild held items, wild encounter
 * tables, item-giving map events, and the Pickup table. The extracts report
 * what the game files say and how each event is gated; deciding when an item
 * becomes obtainable in a playthrough is left to their consumers.
 *
 * Script-side rules (hold chances, Pickup, mining, the badge-tiered mart)
 * are parsed out of the Ruby sources and cited by file and line, so a game
 * update that moves or rewrites them fails loudly instead of going stale.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseMarshal, RubyObject, RubySymbol } from './parse-marshal.mjs';

const GAME = 'Pokemon Reborn';

// The Marshal reader decodes byte strings as latin1; the game files are
// UTF-8.
const decode = (value) =>
  Buffer.from(value.rubyString, 'latin1').toString('utf8');

/**
 * Converts a parsed Marshal value to plain JS: symbols and strings to
 * strings, objects to records keyed by ivar name without the `@`. Hashes
 * stay Maps so integer and symbol keys keep their order and type.
 * @param {*} value
 * @return {*}
 */
export function toPlain(value) {
  if (value == null) return null;
  if (value instanceof RubySymbol) return value.name;
  if (value instanceof RubyObject) {
    const out = {};
    for (const [key, entry] of value.ivars) {
      out[key.replace(/^@/, '')] = toPlain(entry);
    }
    return out;
  }
  if (value instanceof Map) {
    const out = new Map();
    for (const [key, entry] of value) out.set(toPlain(key), toPlain(entry));
    return out;
  }
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === 'object') {
    if ('rubyString' in value) return decode(value);
    if ('rubyFloat' in value) return value.rubyFloat;
    if ('rubyUserdef' in value) return null;
  }
  return value;
}

/**
 * A Ruby source file split into lines, for line-cited constant lookups.
 */
class RubySource {
  /**
   * @param {string} installDir
   * @param {string} file Path relative to the install, forward slashes.
   */
  constructor(installDir, file) {
    this.file = file;
    this.lines = fs
      .readFileSync(path.join(installDir, file), 'utf8')
      .split(/\r?\n/);
  }

  /**
   * @param {!RegExp} pattern
   * @param {number=} from 1-based line to start at.
   * @return {{line: number, match: !RegExpMatchArray}} First matching line.
   */
  find(pattern, from = 1) {
    for (let i = from - 1; i < this.lines.length; i++) {
      const match = this.lines[i].match(pattern);
      if (match) return { line: i + 1, match };
    }
    throw new Error(`${this.file}: no line matches ${pattern} from ${from}`);
  }

  /**
   * @param {number} from 1-based, inclusive.
   * @param {number} to 1-based, inclusive.
   * @return {string}
   */
  text(from, to) {
    return this.lines.slice(from - 1, to).join('\n');
  }

  /**
   * @param {number} line
   * @param {number=} endLine
   * @return {{file: string, line: number, endLine: (number|undefined)}}
   */
  cite(line, endLine) {
    return endLine
      ? { file: this.file, line, endLine }
      : { file: this.file, line };
  }
}

const symbolsIn = (text) =>
  [...text.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map((m) => m[1]);

const numbersIn = (text) => (text.match(/-?\d+/g) ?? []).map(Number);

/**
 * @param {!Map} items Plain items.dat.
 * @param {!Iterable<string>} symbols
 * @return {!Object<string, string>} Symbol → display name, sorted by symbol;
 *     symbols the game does not define are left out.
 */
function itemNames(items, symbols) {
  const out = {};
  for (const symbol of [...new Set(symbols)].sort()) {
    const item = items.get(symbol);
    if (item) out[symbol] = item.name;
  }
  return out;
}

function inlineJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(', ')}]`;
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => `${JSON.stringify(key)}: ${inlineJson(entry)}`);
  return entries.length ? `{ ${entries.join(', ')} }` : '{}';
}

/**
 * JSON with 2-space indentation, except that an array or object short
 * enough for one line stays on one line. The event extract is mostly small
 * records (a page condition, an encounter slot); one line each keeps it
 * readable and a third the size.
 * @param {*} value
 * @param {string=} indent
 * @return {string}
 */
export function formatJson(value, indent = '') {
  const inline = inlineJson(value);
  if (value === null || typeof value !== 'object') return inline;
  if (indent.length + inline.length <= 80) return inline;
  const inner = `${indent}  `;
  const body = Array.isArray(value)
    ? value.map((entry) => `${inner}${formatJson(entry, inner)}`)
    : Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(
        ([key, entry]) =>
          `${inner}${JSON.stringify(key)}: ${formatJson(entry, inner)}`,
      );
  const [open, close] = Array.isArray(value) ? '[]' : '{}';
  return `${open}\n${body.join(',\n')}\n${indent}${close}`;
}

// ---------------------------------------------------------------------------
// Wild held items
// ---------------------------------------------------------------------------

const WILD_ITEM_SLOTS = [
  ['common', 'WildItemCommon'],
  ['uncommon', 'WildItemUncommon'],
  ['rare', 'WildItemRare'],
];

/**
 * The chance a wild Pokémon holds each of its item slots, as
 * pbGenerateWildPokemon rolls it.
 * @param {!RubySource} field Scripts/Field.rb.
 * @return {!Object}
 */
export function readHoldChances(field) {
  const start = field.find(/^def pbGenerateWildPokemon/).line;
  const base = field.find(/^\s*chances = \[([\d, ]+)\]\s*$/, start);
  const boosted = field.find(/^\s*chances = \[([\d, ]+)\] if (.*)$/, base.line);
  const same = field.find(/items\[0\] == items\[1\] && items\[1\] == items\[2\]/, base.line);
  const end = field.find(/^\s*end\s*$/, same.line).line;
  const slots = (match) => {
    const [common, uncommon, rare] = numbersIn(match[1]);
    return { common, uncommon, rare };
  };
  return {
    source: field.cite(base.line - 1, end),
    roll: 'rand(100); slots are tested in order common, uncommon, rare, ' +
      'each owning the next band of that width',
    default: { ...slots(base.match), source: field.cite(base.line) },
    boosted: {
      ...slots(boosted.match),
      leadAbilities: symbolsIn(boosted.match[2]),
      condition: boosted.match[2].trim(),
      source: field.cite(boosted.line),
    },
    allSlotsSame: {
      rule: 'when all three slots name the same item it is always held',
      source: field.cite(same.line),
    },
  };
}

/**
 * Wild held items for every species and form. A form without its own flag
 * reads its base form's, as MonData#checkFlag? does.
 * @param {!Map} mons Parsed (not plain) mons.dat.
 * @return {{species: !Object, items: !Array<string>}}
 */
export function extractWildItems(mons) {
  const species = {};
  const items = [];
  for (const [key, wrapper] of mons) {
    if (!(key instanceof RubySymbol)) continue;
    const forms = toPlain(wrapper.ivars.get('@pokemonData'));
    const formNames = toPlain(wrapper.ivars.get('@forms'));
    const entry = {};
    for (const [formName, mon] of forms) {
      const base = forms.get(formNames.get(mon.baseForm ?? 0));
      const record = { name: mon.name ?? base?.name ?? null };
      let inherited = false;
      for (const [slot, flag] of WILD_ITEM_SLOTS) {
        const own = mon.flags.get(flag) ?? null;
        const fallback = own ?? base?.flags.get(flag) ?? null;
        record[slot] = fallback;
        if (own == null && fallback != null) inherited = true;
        if (fallback != null) items.push(fallback);
      }
      if (inherited) record.inheritedFromBaseForm = true;
      entry[formName] = record;
    }
    species[key.name] = entry;
  }
  return { species, items };
}

// ---------------------------------------------------------------------------
// Encounters
// ---------------------------------------------------------------------------

// The order PokemonEncounters#setup reads MapMetadata in (Encounters.rb,
// EncounterTypes), with the density each type draws on.
const ENCOUNTER_TYPES = [
  ['Land', 'land'],
  ['Cave', 'cave'],
  ['Water', 'water'],
  ['RockSmash', 'cave'],
  ['OldRod', 'water'],
  ['GoodRod', 'water'],
  ['SuperRod', 'land'],
  ['Headbutt', 'land'],
  ['LandMorning', 'land'],
  ['LandDay', 'land'],
  ['LandNight', 'land'],
  ['BugContest', 'land'],
];

/**
 * @param {!RubySource} constants Scripts/Reborn/SystemConstants.rb.
 * @return {!Map<string, number>} Named switch symbol → switch id.
 */
function readNamedSwitches(constants) {
  const start = constants.find(/^Switches = \{/).line;
  const end = constants.find(/^\}/, start).line;
  const out = new Map();
  for (const line of constants.lines.slice(start, end - 1)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*):\s*(\d+)/);
    if (match) out.set(match[1], Number(match[2]));
  }
  return out;
}

/**
 * Wild encounter tables per map, from maps.dat (the file Cache.rb loads;
 * encounters.dat is only the map editor's copy). A table stores each species
 * with its slots, and each slot carries its own rate.
 * @param {!Array} mapData Plain maps.dat.
 * @param {!Map} mapInfos Plain MapInfos.rxdata.
 * @return {!Array<!Object>} Maps that have a table, sorted by map id.
 */
export function extractEncounters(mapData, mapInfos) {
  const maps = [];
  for (const meta of mapData) {
    if (!meta) continue;
    const types = {};
    for (const [type] of ENCOUNTER_TYPES) {
      const table = meta[type];
      if (!table) continue;
      types[type] = [...table].flatMap(([species, slots]) =>
        slots.map(([rate, min, max]) => ({ species, min, max, rate })),
      );
    }
    if (!Object.keys(types).length) continue;
    maps.push({
      mapId: meta.mapid,
      mapName: mapInfos.get(meta.mapid)?.name ?? null,
      density: {
        land: meta.landrate ?? 0,
        cave: meta.caverate ?? 0,
        water: meta.waterrate ?? 0,
      },
      types,
    });
  }
  return maps.sort((a, b) => a.mapId - b.mapId);
}

// ---------------------------------------------------------------------------
// Pickup
// ---------------------------------------------------------------------------

function readSymbolArray(source, name) {
  const start = source.find(new RegExp(`^${name} = \\[`)).line;
  const end = source.find(/^\]/, start).line;
  return {
    values: symbolsIn(source.text(start + 1, end - 1)),
    source: source.cite(start, end),
  };
}

/**
 * The Pickup table as Kernel.pbPickup implements it: a level bracket picks a
 * window of nine common items and two rare ones, and one roll picks a slot.
 * @param {!RubySource} field Scripts/Field.rb.
 * @param {!RubySource} constants Scripts/Reborn/SystemConstants.rb.
 * @return {!Object}
 */
export function extractPickup(field, constants) {
  const normal = readSymbolArray(constants, 'PickupNormal');
  const rare = readSymbolArray(constants, 'PickupRare');
  const start = field.find(/^def Kernel\.pbPickup\(/).line;
  const trigger = field.find(/return if rand\((\d+)\) != 0/, start);
  const odds = field.find(/randlist = \[([\d, ]+)\]/, start);
  const bracket = field.find(/itemstart = \(plevel - 1\) \/ (\d+)/, start);
  const end = field.find(/^end\s*$/, odds.line).line;
  const run = field.find(/^def Kernel\.pbRunPickup\(/, end);
  const hook = field.find(/Kernel\.pbRunPickup\(pkmn\)/, run.line);

  const slotOdds = numbersIn(odds.match[1]);
  const width = Number(bracket.match[1]);
  const commonSlots = slotOdds.length - 2;
  // pbPickup refuses to run unless the lists are exactly this long, which is
  // what makes every bracket's window fit.
  const brackets = normal.values.length - commonSlots + 1;
  if (rare.values.length !== brackets + 1) {
    throw new Error('Pickup lists no longer fit the bracket windows');
  }
  const table = [];
  for (let b = 0; b < brackets; b++) {
    const items = [
      ...normal.values.slice(b, b + commonSlots),
      rare.values[b],
      rare.values[b + 1],
    ];
    table.push({
      minLevel: b * width + 1,
      maxLevel: (b + 1) * width,
      slots: items.map((item, i) => ({ item, chance: slotOdds[i] })),
    });
  }

  const honey = field.find(/pkmn\.ability == :HONEYGATHER/, hook.line);
  const honeyChance = field.find(/chance = (.*)$/, honey.line);
  const ballFetch = field.find(/pkmn\.ability == :BALLFETCH/, hook.line);
  return {
    source: field.cite(start, end),
    trigger: {
      chancePercent: 100 / Number(trigger.match[1]),
      when: 'after each battle won, for every party Pokémon with Pickup ' +
        'that is not an egg and holds nothing; the item goes to the Bag, ' +
        'or is held if the Bag cannot take it',
      source: field.cite(trigger.line),
      runSource: field.cite(run.line, hook.line),
    },
    levelRule: {
      rule: `bracket = (min(100, level) - 1) / ${width}`,
      source: field.cite(bracket.line),
    },
    slotOdds: { values: slotOdds, source: field.cite(odds.line) },
    lists: {
      PickupNormal: normal,
      PickupRare: rare,
    },
    table,
    relatedAbilities: [
      {
        ability: 'HONEYGATHER',
        item: 'HONEY',
        chancePercent: honeyChance.match[1].trim(),
        when: 'after each battle won, holder not an egg and holding nothing',
        source: field.cite(honey.line, honeyChance.line),
      },
      {
        ability: 'BALLFETCH',
        item: 'SNOWBALL',
        chancePercent: 100,
        when: 'after each battle won on the Snowy Mountain field, holder ' +
          'not an egg and holding nothing',
        source: field.cite(ballFetch.line),
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Script-side item rules that map events lean on
// ---------------------------------------------------------------------------

/**
 * The mining minigame's buried-item weights.
 * @param {!RubySource} mining Scripts/MinigameMining.rb.
 * @return {!Object}
 */
export function readMiningTable(mining) {
  const start = mining.find(/^\s*ITEMS = \[/).line;
  const end = mining.find(/^\s*\]\s*$/, start).line;
  const count = mining.find(/numitems = (\d+) \+ rand\((\d+)\)/, end);
  const weights = new Map();
  for (const line of mining.lines.slice(start, end - 1)) {
    const match = line.match(/^\s*\[:([A-Z0-9_]+),\s*(\d+),/);
    if (!match) continue;
    weights.set(match[1], (weights.get(match[1]) ?? 0) + Number(match[2]));
  }
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  return {
    source: mining.cite(start, end),
    itemsPerGame: {
      min: Number(count.match[1]),
      max: Number(count.match[1]) + Number(count.match[2]) - 1,
      source: mining.cite(count.line),
    },
    totalWeight: total,
    items: [...weights].map(([item, weight]) => ({ item, weight })),
  };
}

/**
 * The stock pbDefaultMart sells at each badge count.
 * @param {!RubySource} mart Scripts/Mart.rb.
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

/**
 * Growth time and yield per berry for planted berries.
 * @param {!RubySource} berries Scripts/BerryPlants.rb.
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
  const plant = berries.find(/^def pbBerryPlant/);
  const pick = berries.find(/^def pbPickBerry/);
  return {
    source: berries.cite(start, end),
    stages: 'four growth stages after planting; yield scales with how ' +
      'many stages were watered',
    plantSource: berries.cite(plant.line, pick.line - 1),
    pickSource: berries.cite(pick.line, berries.lines.length),
    values,
  };
}

// ---------------------------------------------------------------------------
// Map events
// ---------------------------------------------------------------------------

const COMPARISONS = ['==', '>=', '<=', '>', '<', '!='];
const VARIABLE_OPS = ['set', 'add', 'sub', 'mul', 'div', 'mod'];
const TRIGGERS = ['action', 'playerTouch', 'eventTouch', 'autorun', 'parallel'];

const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * Splits a Ruby argument list on its top-level commas.
 * @param {string} text
 * @return {!Array<string>}
 */
function splitArgs(text) {
  const args = [];
  let depth = 0;
  let quote = null;
  let current = '';
  for (const ch of text) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if ('([{'.includes(ch)) {
      depth++;
    } else if (')]}'.includes(ch)) {
      depth--;
    } else if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * Names switches and variables the way System.rxdata does.
 */
class Names {
  /** @param {!Object} system Plain System.rxdata. */
  constructor(system) {
    this.system = system;
    this.switchUses = new Map();
    this.variableUses = new Map();
  }

  switch(id) {
    this.switchUses.set(id, (this.switchUses.get(id) ?? 0) + 1);
    return { switch: id, name: this.system.switches[id] ?? null };
  }

  variable(id) {
    this.variableUses.set(id, (this.variableUses.get(id) ?? 0) + 1);
    return { variable: id, name: this.system.variables[id] ?? null };
  }

  /** @return {!Object} The switches and variables named so far, by id. */
  index() {
    const table = (uses, names) =>
      Object.fromEntries(
        [...uses]
          .sort((a, b) => a[0] - b[0])
          .map(([id, count]) => [id, { name: names[id] ?? null, uses: count }]),
      );
    return {
      switches: table(this.switchUses, this.system.switches),
      variables: table(this.variableUses, this.system.variables),
    };
  }
}

function pageConditions(condition, names) {
  const out = [];
  if (condition.switch1_valid) out.push(names.switch(condition.switch1_id));
  if (condition.switch2_valid) out.push(names.switch(condition.switch2_id));
  if (condition.variable_valid) {
    out.push({
      ...names.variable(condition.variable_id),
      atLeast: condition.variable_value,
    });
  }
  if (condition.self_switch_valid) {
    out.push({ selfSwitch: condition.self_switch_ch });
  }
  return out;
}

function branchCondition(parameters, names) {
  const [type, a, b, c, d] = parameters;
  switch (type) {
    case 0:
      return { ...names.switch(a), is: b === 0 };
    case 1:
      return {
        ...names.variable(a),
        op: COMPARISONS[d],
        value: b === 0 ? c : names.variable(c),
      };
    case 2:
      return { selfSwitch: a, is: b === 0 };
    case 7:
      return { money: b === 0 ? '>=' : '<=', value: a };
    case 12:
      return { script: collapse(a) };
    default:
      return { conditionType: type, parameters: parameters.slice(1) };
  }
}

// A Script command's text with its continuation lines.
function scriptAt(list, index) {
  let text = list[index].parameters[0];
  for (let i = index + 1; list[i]?.code === 655; i++) {
    text += `\n${list[i].parameters[0]}`;
  }
  return text;
}

// Every script a command list runs or branches on.
function* scriptsIn(list) {
  for (const [index, { code, parameters }] of list.entries()) {
    if (code === 355) yield scriptAt(list, index);
    if (code === 111 && parameters[0] === 12) yield parameters[1];
  }
}

/**
 * Joins script commands with their continuation lines and gives every
 * command the chain of branch arms that encloses it, so a give can be read
 * with the conditions it sits under and the commands that run with it.
 * @param {!Array<!Object>} list An event page's or common event's commands.
 * @param {!Names} names
 * @return {!Array<!Object>} One step per command that matters: {index, code,
 *     parameters, chain, script?}. `chain` lists arm ids; `arms` on the
 *     returned array maps an arm id to its condition.
 */
function walkCommands(list, names) {
  const steps = [];
  const arms = new Map();
  const stack = [];
  const closeDeeper = (indent) => {
    while (stack.length && stack.at(-1).indent > indent) stack.pop();
  };
  const setArm = (block, suffix, condition) => {
    block.arm = `${block.index}${suffix}`;
    arms.set(block.arm, condition);
  };
  list.forEach((command, index) => {
    const { code, indent, parameters } = command;
    closeDeeper(indent);
    const top = stack.at(-1);
    const owned = top && top.indent === indent;
    if (code === 411 && owned) {
      setArm(top, 'e', { not: top.condition });
      return;
    }
    if (code === 402 && owned) {
      setArm(top, `c${parameters[0]}`, { choice: parameters[1] });
      return;
    }
    if (code === 403 && owned) {
      setArm(top, 'x', { choice: null });
      return;
    }
    if ([412, 404, 413].includes(code)) {
      if (owned) stack.pop();
      return;
    }
    if ([401, 655, 0].includes(code)) return;
    const step = { index, code, parameters, chain: stack.map((b) => b.arm) };
    if (code === 355) step.script = scriptAt(list, index);
    if (code === 111) {
      const condition = branchCondition(parameters, names);
      const block = { index, indent, condition };
      setArm(block, 't', block.condition);
      stack.push(block);
      if (parameters[0] === 12) step.script = parameters[1];
    } else if (code === 102) {
      stack.push({ index, indent, arm: `${index}?` });
    } else if (code === 112) {
      const block = { index, indent };
      setArm(block, 'l', { loop: true });
      stack.push(block);
    }
    steps.push(step);
  });
  steps.arms = arms;
  return steps;
}

const isPrefix = (prefix, chain) =>
  prefix.length <= chain.length && prefix.every((arm, i) => arm === chain[i]);

/**
 * How a step relates to a give: 'with' when it runs whenever the give does
 * (same or enclosing scope, or the give's own success branch); 'before' or
 * 'after' when it sits in an earlier or later branch that the give's path
 * may or may not enter; null when it is in a sibling arm, which never runs
 * together with the give.
 */
function relation(step, give) {
  if (step.index === give.index) return null;
  if (isPrefix(step.chain, give.chain)) return 'with';
  const depth = step.chain.findIndex((arm, i) => arm !== give.chain[i]);
  const arm = step.chain[depth];
  if (depth === give.chain.length) {
    if (arm === `${give.index}t`) return 'with';
    if (arm === `${give.index}e`) return null;
  } else if (parseInt(arm, 10) === parseInt(give.chain[depth], 10)) {
    return null;
  }
  return step.index > give.index ? 'after' : 'before';
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

const GIVE_CALL =
  /(Kernel\.pbItemBall|Kernel\.pbReceiveItem|\$PokemonBag\.pbStoreItem|pbPickBerry)\s*\(((?:[^()]|\([^()]*\))*)\)/g;
const GIVE_METHODS = {
  'Kernel.pbItemBall': 'itemBall',
  'Kernel.pbReceiveItem': 'receive',
  '$PokemonBag.pbStoreItem': 'store',
  pbPickBerry: 'berryTree',
};
const TRAINER_BATTLE = /\bpb(?:Double)?TrainerBattle(?:100)?\s*\(/;
const HELD_ITEM = /\b(\w+)\.(?:setItem\(\s*:(\w+)\s*\)|item\s*=\s*:(\w+))/g;

/**
 * Finds every item-giving call in one script text.
 * @param {string} script
 * @return {!Array<!Object>} Partial give records.
 */
function givesInScript(script) {
  const gives = [];
  for (const match of script.matchAll(GIVE_CALL)) {
    const [itemArg, quantityArg] = splitArgs(match[2]);
    const pairs = [...script.matchAll(/:(\w+)\s*=>\s*(\d+)/g)];
    if (/^[a-z_]+$/.test(itemArg ?? '') && pairs.length) {
      // A hash literal of item => quantity, stored pair by pair.
      for (const [, item, quantity] of pairs) {
        gives.push({
          method: GIVE_METHODS[match[1]],
          call: collapse(script),
          item,
          quantity: Number(quantity),
        });
      }
      continue;
    }
    const give = { method: GIVE_METHODS[match[1]], call: collapse(match[0]) };
    const symbol = itemArg?.match(/^:(\w+)$/);
    if (symbol) give.item = symbol[1];
    else give.itemExpression = itemArg ?? '';
    if (quantityArg == null) give.quantity = 1;
    else if (/^\d+$/.test(quantityArg)) give.quantity = Number(quantityArg);
    else give.quantityExpression = quantityArg;
    gives.push(give);
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
  const mart = script.match(/pbPokemonMart\s*\(\s*\[([^\]]*)\]/);
  if (mart) {
    gives.push({ method: 'mart', stock: symbolsIn(mart[1]), call: collapse(script) });
  } else if (/\bpbDefaultMart\b/.test(script)) {
    gives.push({ method: 'mart', defaultMart: true, call: collapse(script) });
  }
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
function stateChanges(step, names) {
  const [a, b, c, d, e] = step.parameters;
  switch (step.code) {
    case 121: {
      const out = [];
      for (let id = a; id <= b; id++) {
        out.push({ ...names.switch(id), to: c === 0 });
      }
      return out;
    }
    case 122: {
      const operand = [
        () => ({ constant: e }),
        () => ({ fromVariable: names.variable(e) }),
        () => ({ random: [e, step.parameters[5]] }),
      ][d]?.() ?? { operandType: d };
      const out = [];
      for (let id = a; id <= b; id++) {
        out.push({ ...names.variable(id), op: VARIABLE_OPS[c], ...operand });
      }
      return out;
    }
    case 123:
      return [{ selfSwitch: a, to: b === 0 }];
    case 116:
      return [{ eraseEvent: 'until the map reloads' }];
    case 355:
    case 111: {
      if (!step.script) return [];
      const out = [];
      const script = step.script;
      if (/\bpbSetEventTime\b/.test(script)) out.push({ eventTime: true });
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
      for (const m of script.matchAll(
        /\$game_switches\[(\d+)\]\s*=\s*(true|false)/g,
      )) {
        out.push({ ...names.switch(Number(m[1])), to: m[2] === 'true' });
      }
      for (const m of script.matchAll(
        /(?:\$game_variables\[(\d+)\]\s*([-+]?=)(?!=)|pbSet\(\s*(\d+)\s*,)/g,
      )) {
        const op = { '+=': 'add', '-=': 'sub' }[m[2]] ?? 'set';
        out.push({ ...names.variable(Number(m[1] ?? m[3])), op, script: true });
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
 *   timed             stamps the event's clock (pbSetEventTime)
 *   once              flips a self switch, or a switch this event reads
 *   onceByVariable    sets a variable this event gates on
 *   onceIfBranchTaken flips such a switch only in a later branch
 *   mapReload         erases the event or sets a temp switch, nothing more
 *   stateOnly         changes a switch or variable nothing here reads
 *   unlimited         changes nothing lasting
 * markResets later turns a self-switch-only `once` into `resetByEvent` on
 * maps where another event clears that self switch.
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
 * @param {!Map<number, !Object>} commonEvents Analysed common events, to
 *     follow Call Common Event into.
 * @param {!Array<!Object>} gates The owning event's page conditions.
 * @return {!Array<!Object>}
 */
function analyseCommands(list, names, commonEvents, gates) {
  const steps = walkCommands(list, names);
  const within = (chain) =>
    chain.map((arm) => steps.arms.get(arm)).filter((c) => c && !c.loop);
  const found = [];
  for (const step of steps) {
    const partials = step.script ? givesInScript(step.script) : [];
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
      for (const change of stateChanges(other, names)) {
        sets.push(how === 'after' ? { ...change, afterBranch: true } : change);
      }
      if (how === 'with') spent.push(...stepCosts(other, names, steps));
    }
    // A script that gives and pays in one command is its own cost.
    if (give.method !== 'conversion') {
      spent.push(...stepCosts(step, names, steps));
    }
    for (const change of stateChanges(step, names)) sets.push(change);
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

// A page's gate and look; an action trigger, no conditions and no graphic
// are the defaults and are left out.
function pageRecord(page, index, names) {
  const record = { page: index + 1 };
  const conditions = pageConditions(page.condition, names);
  if (conditions.length) record.conditions = conditions;
  if (page.trigger !== 0) record.trigger = TRIGGERS[page.trigger];
  const { character_name: character, tile_id: tile } = page.graphic;
  if (character || tile) record.graphic = character || 'tile';
  return record;
}

const COINS_GAINED = /\$PokemonGlobal\.coins\s*\+=\s*(\d+)/g;
const COIN_GAME = /\b(pbSlotMachine|pbRoulette|pbVoltorbFlip)\b/;
const BADGE_AWARD = /\$Trainer\.badges\[(\d+)\]\s*=\s*true/;
// A script that clears one self switch on every event of the current map.
const MAP_SELF_SWITCH_RESET =
  /for event in \$game_map\.events\.values\s+pbSetSelfSwitch\(event\.id,\s*"(\w)",\s*false\)/;

/**
 * A give whose only lasting change is a self switch comes back when another
 * event on its map clears that self switch for every event.
 * @param {!Array<!Object>} mapEvents One map's item events.
 * @param {!Array<!Object>} resets That map's self-switch resets.
 */
function markResets(mapEvents, resets) {
  for (const reset of resets) {
    for (const event of mapEvents) {
      for (const give of event.gives) {
        const lasting = (give.sets ?? []).filter((s) => !s.afterBranch);
        const onlySelfSwitch = lasting.length > 0 && lasting.every(
          (s) => s.selfSwitch === reset.selfSwitch && s.to && !('ofEvent' in s),
        );
        if (give.repeat !== 'once' && !give.resetBy) continue;
        if (!onlySelfSwitch) continue;
        give.repeat = 'resetByEvent';
        (give.resetBy ??= []).push({
          eventId: reset.eventId,
          page: reset.page,
        });
      }
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
 * @param {function(): !Iterable<{mapId: number, map: !Object}>} maps Plain
 *     Map###.rxdata files.
 * @param {!Array} commonEventList Plain CommonEvents.rxdata.
 * @param {!Map} mapInfos Plain MapInfos.rxdata.
 * @param {!Names} names
 * @return {{events: !Array<!Object>, commonEvents: !Array<!Object>,
 *     coinSources: !Array<!Object>, badgeAwards: !Array<!Object>,
 *     selfSwitchResets: !Array<!Object>}}
 */
export function extractItemEvents(maps, commonEventList, mapInfos, names) {
  const commonEvents = new Map();
  for (const event of commonEventList) {
    if (!event) continue;
    const gives = analyseCommands(event.list, names, new Map(), []);
    if (gives.length) commonEvents.set(event.id, { event, gives });
  }

  const events = [];
  const coinSources = [];
  const badgeAwards = [];
  const selfSwitchResets = [];
  const callers = new Map();
  for (const { mapId, map } of maps()) {
    const mapName = mapInfos.get(mapId)?.name ?? null;
    const mapEvents = [];
    const resets = [];
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
        const records = analyseCommands(page.list, names, commonEvents, gates);
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
          const reset = script.match(MAP_SELF_SWITCH_RESET);
          if (reset) {
            resets.push({
              ...at,
              selfSwitch: reset[1],
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
    markResets(mapEvents, resets);
    events.push(...mapEvents);
    selfSwitchResets.push(...resets);
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
    events,
    commonEvents: commonEventRecords,
    coinSources,
    badgeAwards,
    selfSwitchResets,
  };
}

/**
 * Counts for a quick read of the item-events extract.
 * @param {!Array<!Object>} events
 * @return {!Object}
 */
function summarise(events) {
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

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

function main(installDir) {
  const dataDir = path.join(installDir, 'Data');
  const outDir = path.dirname(fileURLToPath(import.meta.url));
  const parse = (name) =>
    parseMarshal(fs.readFileSync(path.join(dataDir, name)));
  const load = (name) => toPlain(parse(name));
  const source = (file) => new RubySource(installDir, file);

  const version = source('Scripts/Reborn/Bootstrap.rb')
    .find(/^GAMEVERSION = '([^']+)'/).match[1];
  const field = source('Scripts/Field.rb');
  const constants = source('Scripts/Reborn/SystemConstants.rb');
  const items = load('items.dat');
  const mapInfos = load('MapInfos.rxdata');
  const write = (stem, from, data) => {
    const file = path.join(outDir, `${stem}.generated.json`);
    const body = { game: GAME, version, source: from, data };
    fs.writeFileSync(file, `${formatJson(body)}\n`);
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`[reborn-item-sources] ${stem}: ${kb} KB`);
  };

  const wild = extractWildItems(parse('mons.dat'));
  write('reborn-wild-items', 'mons.dat + Scripts/Field.rb + items.dat', {
    holdChances: readHoldChances(field),
    itemNames: itemNames(items, wild.items),
    species: wild.species,
  });

  const mapData = load('maps.dat');
  const namedSwitches = readNamedSwitches(constants);
  const system = load('System.rxdata');
  const mapSwitches = (meta) =>
    (meta.Switches ?? []).map(([symbol, value]) => ({
      switch: namedSwitches.get(symbol) ?? null,
      symbol,
      name: system.switches[namedSwitches.get(symbol)] ?? null,
      is: value,
    }));
  write('reborn-encounters', 'maps.dat + MapInfos.rxdata + Scripts/Encounters.rb', {
    encounterTypes: ENCOUNTER_TYPES.map(([type, density]) => ({
      type,
      density,
    })),
    maps: extractEncounters(mapData, mapInfos).map((entry) => {
      const switches = mapSwitches(mapData[entry.mapId]);
      return switches.length ? { ...entry, mapSwitches: switches } : entry;
    }),
  });

  const pickup = extractPickup(field, constants);
  write('reborn-pickup', 'Scripts/Field.rb + Scripts/Reborn/SystemConstants.rb + items.dat', {
    itemNames: itemNames(items, [
      ...pickup.lists.PickupNormal.values,
      ...pickup.lists.PickupRare.values,
      ...pickup.relatedAbilities.map((a) => a.item),
    ]),
    ...pickup,
  });

  const names = new Names(system);
  const mapFiles = fs
    .readdirSync(dataDir)
    .filter((name) => /^Map\d+\.rxdata$/.test(name))
    .sort();
  const maps = function* () {
    for (const name of mapFiles) {
      yield { mapId: Number(name.match(/\d+/)[0]), map: load(name) };
    }
  };
  const extracted = extractItemEvents(
    maps,
    load('CommonEvents.rxdata'),
    mapInfos,
    names,
  );
  const { items: eventItems, ...summary } = summarise(extracted.events);
  const mining = readMiningTable(source('Scripts/MinigameMining.rb'));
  const defaultMart = readDefaultMart(source('Scripts/Mart.rb'));
  const berryPlants = readBerryValues(source('Scripts/BerryPlants.rb'));
  const scriptItems = [
    ...mining.items.map((entry) => entry.item),
    ...defaultMart.tiers.flatMap((tier) => tier.stock),
    ...extracted.commonEvents.flatMap((ce) => ce.gives.map((g) => g.item)),
  ].filter(Boolean);
  const allItems = [...eventItems, ...scriptItems];
  write(
    'reborn-item-events',
    'Map###.rxdata + CommonEvents.rxdata + System.rxdata + MapInfos.rxdata + maps.dat + items.dat + Scripts',
    {
      summary: {
        ...summary,
        unknownItems: [...new Set(allItems)]
          .filter((symbol) => !items.has(symbol))
          .sort(),
      },
      itemNames: itemNames(items, allItems),
      scriptRules: { mining, defaultMart, berryPlants },
      storyMarkers: {
        badgeAwards: extracted.badgeAwards,
        ...names.index(),
      },
      maps: Object.fromEntries(
        [...mapInfos]
          .sort((a, b) => a[0] - b[0])
          .map(([id, info]) => {
            const switches = mapData[id] ? mapSwitches(mapData[id]) : [];
            return [id, {
              name: info.name,
              parentId: info.parent_id,
              ...(switches.length ? { mapSwitches: switches } : {}),
            }];
          }),
      ),
      commonEvents: extracted.commonEvents,
      coinSources: extracted.coinSources,
      selfSwitchResets: extracted.selfSwitchResets,
      events: extracted.events,
    },
  );
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const installDir = process.argv[2];
  if (!installDir) {
    console.error(
      'Usage: node scripts/reborn/extract-reborn-item-sources.mjs <install-path>',
    );
    process.exit(1);
  }
  main(installDir);
}
