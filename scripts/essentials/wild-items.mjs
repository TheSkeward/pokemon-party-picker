/**
 * @fileoverview The items wild Pokémon hold: each species' item slots from
 * mons.dat, and the chance each slot is held as the scripts roll it. The
 * engine family rolls in one of two places, read by the two readers here;
 * a game's adapter says which and in what files.
 */
import {
  numbersIn,
  RubySymbol,
  symbolsIn,
  toPlain,
} from './game-files.mjs';

const WILD_ITEM_SLOTS = [
  ['common', 'WildItemCommon'],
  ['uncommon', 'WildItemUncommon'],
  ['rare', 'WildItemRare'],
];

// The hold-chance rule in the extract's shape. `normal` and `boosted` are
// the three slot chances with the line that sets them; `condition` is the
// Ruby test that picks the boosted ones.
function holdChanceRule({ source, normal, boosted, condition, allSlotsSame }) {
  const slots = ([common, uncommon, rare]) => ({ common, uncommon, rare });
  return {
    source,
    roll: 'rand(100); slots are tested in order common, uncommon, rare, ' +
      'each owning the next band of that width',
    default: { ...slots(normal.chances), source: normal.source },
    boosted: {
      ...slots(boosted.chances),
      leadAbilities: symbolsIn(condition),
      condition: condition.trim(),
      source: boosted.source,
    },
    allSlotsSame: {
      rule: 'when all three slots name the same item it is always held',
      source: allSlotsSame,
    },
  };
}

/**
 * The chance a wild Pokémon holds each of its item slots, where
 * pbGenerateWildPokemon rolls it itself.
 * @param {!RubySource} field The file that defines pbGenerateWildPokemon.
 * @return {!Object}
 */
export function readGeneratorHoldChances(field) {
  const start = field.find(/^def pbGenerateWildPokemon/).line;
  const base = field.find(/^\s*chances = \[([\d, ]+)\]\s*$/, start);
  const boosted = field.find(/^\s*chances = \[([\d, ]+)\] if (.*)$/, base.line);
  const same = field.find(/items\[0\] == items\[1\] && items\[1\] == items\[2\]/, base.line);
  const end = field.find(/^\s*end\s*$/, same.line).line;
  return holdChanceRule({
    source: field.cite(base.line - 1, end),
    normal: {
      chances: numbersIn(base.match[1]),
      source: field.cite(base.line),
    },
    boosted: {
      chances: numbersIn(boosted.match[1]),
      source: field.cite(boosted.line),
    },
    condition: boosted.match[2],
    allSlotsSame: field.cite(same.line),
  });
}

/**
 * The chance a wild Pokémon holds each of its item slots, where a handler
 * of Events.onWildPokemonCreate rolls it from MonData#getWildItems.
 *
 * The handler's Item Drink branch (one of the species' items, always, while
 * the drink lasts) is not read: it runs only in a game that defines a
 * DrinkItems variable.
 * @param {!RubySource} modifiers The file that registers the handler.
 * @param {!RubySource} dataObjects The file that defines getWildItems,
 *     which is where three equal slots become an item always held.
 * @return {!Object}
 */
export function readCreationHandlerHoldChances(modifiers, dataObjects) {
  const start =
    modifiers.find(/itemhash = pokemon\.getCacheData\.getWildItems/).line;
  const lead = modifiers.find(/^\s*chances = (.*) \?\s*$/, start);
  const slots = /^\s*\{ common: (\d+), uncommon: (\d+), rare: (\d+) \}/;
  const boosted = modifiers.find(slots, lead.line + 1);
  const normal = modifiers.find(slots, boosted.line + 1);
  const end =
    modifiers.find(/pokemon\.setItem\(item\) if item/, normal.line).line;
  const same = dataObjects.find(/items\[:common\] == items\[:uncommon\] && items\[:uncommon\] == items\[:rare\]/);
  return holdChanceRule({
    source: modifiers.cite(start, end),
    normal: {
      chances: normal.match.slice(1).map(Number),
      source: modifiers.cite(normal.line),
    },
    boosted: {
      chances: boosted.match.slice(1).map(Number),
      source: modifiers.cite(boosted.line),
    },
    condition: lead.match[1],
    allSlotsSame: dataObjects.cite(same.line),
  });
}

/**
 * Wild held items for every species and form. A species' forms are listed
 * in form-number order, from 0, which is how an encounter slot names one.
 * @param {!Map} mons Parsed (not plain) mons.dat.
 * @param {boolean} formsInherit Whether a form without its own flag reads
 *     its base form's, as MonData#checkFlag? does.
 * @return {{species: !Object, items: !Array<string>}}
 */
export function extractWildItems(mons, formsInherit) {
  const species = {};
  const items = [];
  for (const [key, wrapper] of mons) {
    if (!(key instanceof RubySymbol)) continue;
    const forms = toPlain(wrapper.ivars.get('@pokemonData'));
    const formNames = toPlain(wrapper.ivars.get('@forms'));
    [...forms.keys()].forEach((formName, number) => {
      if (formNames.get(number) !== formName) {
        throw new Error(`${key.name}: forms are not stored in number order`);
      }
    });
    const entry = {};
    for (const [formName, mon] of forms) {
      const base = forms.get(formNames.get(mon.baseForm ?? 0));
      const record = { name: mon.name ?? base?.name ?? null };
      let inherited = false;
      for (const [slot, flag] of WILD_ITEM_SLOTS) {
        const own = mon.flags.get(flag) ?? null;
        const held = formsInherit ? own ?? base?.flags.get(flag) ?? null : own;
        record[slot] = held;
        if (own == null && held != null) inherited = true;
        if (held != null) items.push(held);
      }
      if (inherited) record.inheritedFromBaseForm = true;
      entry[formName] = record;
    }
    species[key.name] = entry;
  }
  return { species, items };
}
