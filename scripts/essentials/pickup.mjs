/**
 * @fileoverview The Pickup table, as the scripts implement it.
 */
import { numbersIn, symbolsIn } from './game-files.mjs';

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
 * @param {!RubySource} field The file that defines Kernel.pbPickup.
 * @param {!RubySource} constants The file that defines the Pickup lists.
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
