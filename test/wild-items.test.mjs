// The items wild Pokémon hold (scripts/essentials/wild-items.mjs): the
// chance each slot is held, read out of either game's Ruby, and every
// species' slots by form, with or without the base form's to fall back
// on. The games differ in both, and the renewable-source odds are worked
// out from what is read here.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractWildItems,
  readCreationHandlerHoldChances,
  readGeneratorHoldChances,
} from '../scripts/essentials/wild-items.mjs';
import {
  rubyObject,
  rubySource,
  rubyString,
  symbol,
} from './helpers/essentials-files.mjs';

const LEAD_TEST = '[:COMPOUNDEYES, :SUPERLUCK].include?(lead.ability)';

test('hold chances are read where the generator rolls them', () => {
  const file = 'Scripts/Field.rb';
  const field = rubySource([
    'def pbGenerateWildPokemon(species, level)',
    '  genwildpoke = PokeBattle_Pokemon.new(species, level)',
    '  items = genwildpoke.wildHoldItems',
    '  chances = [50, 5, 1]',
    `  chances = [60, 20, 5] if ${LEAD_TEST}`,
    '  itemrnd = rand(100)',
    '  if itemrnd < chances[0] || (items[0] == items[1] && items[1] == items[2])',
    '    genwildpoke.setItem(items[0])',
    '  elsif itemrnd < (chances[0] + chances[1])',
    '    genwildpoke.setItem(items[1])',
    '  end',
    '  return genwildpoke',
    'end',
  ], file);
  const rule = readGeneratorHoldChances(field);
  // From the line before the chances to the end of the roll.
  assert.deepEqual(rule.source, { file, line: 3, endLine: 11 });
  assert.deepEqual(rule.default, {
    common: 50, uncommon: 5, rare: 1, source: { file, line: 4 },
  });
  assert.deepEqual(rule.boosted, {
    common: 60,
    uncommon: 20,
    rare: 5,
    leadAbilities: ['COMPOUNDEYES', 'SUPERLUCK'],
    condition: LEAD_TEST,
    source: { file, line: 5 },
  });
  assert.deepEqual(rule.allSlotsSame.source, { file, line: 7 });
});

test('hold chances are read where a creation handler rolls them', () => {
  const file = 'Scripts/EncounterModifiers.rb';
  // The boosted chances come first here: the handler picks with a ternary.
  const modifiers = rubySource([
    'Events.onWildPokemonCreate += proc { |sender, e|',
    '  pokemon = e[0]',
    '  itemhash = pokemon.getCacheData.getWildItems',
    '  lead = fieldAbilityUser',
    `  chances = ${LEAD_TEST} ?`,
    '    { common: 60, uncommon: 20, rare: 5 } :',
    '    { common: 50, uncommon: 5, rare: 1 }',
    '  itemrnd = rand(100)',
    '  item = itemhash[:common] if itemrnd < chances[:common]',
    '  pokemon.setItem(item) if item',
    '}',
  ], file);
  const dataObjects = rubySource([
    'def getWildItems',
    '  items = {}',
    '  if items[:common] == items[:uncommon] && items[:uncommon] == items[:rare]',
    '    items[:always] = items[:common]',
    '  end',
    'end',
  ], 'Scripts/DataObjects.rb');
  const rule = readCreationHandlerHoldChances(modifiers, dataObjects);
  assert.deepEqual(rule.source, { file, line: 3, endLine: 10 });
  assert.deepEqual(rule.default, {
    common: 50, uncommon: 5, rare: 1, source: { file, line: 7 },
  });
  assert.deepEqual(rule.boosted, {
    common: 60,
    uncommon: 20,
    rare: 5,
    leadAbilities: ['COMPOUNDEYES', 'SUPERLUCK'],
    condition: LEAD_TEST,
    source: { file, line: 6 },
  });
  assert.deepEqual(
    rule.allSlotsSame.source, { file: 'Scripts/DataObjects.rb', line: 3 });
});

// mons.dat as the Marshal reader hands it over: a species' forms by name,
// and the names by form number.
const mon = (name, slots, baseForm = 0) => rubyObject('MonData', {
  ...(name ? { name: rubyString(name) } : {}),
  flags: new Map(Object.entries(slots).map(
    ([flag, item]) => [symbol(flag), symbol(item)])),
  baseForm,
});
const species = (forms) => rubyObject('MonWrapper', {
  pokemonData: new Map(Object.entries(forms).map(
    ([formName, data]) => [rubyString(formName), data])),
  forms: new Map(Object.keys(forms).map(
    (formName, number) => [number, rubyString(formName)])),
});
const MONS = new Map([
  [symbol('BEEDRILL'), species({
    'Normal Form': mon('Beedrill', { WildItemUncommon: 'POISONBARB' }),
    'Mega Form': mon(null, {}),
  })],
  [symbol('SANDSHREW'), species({
    'Normal Form': mon(
      'Sandshrew', { WildItemCommon: 'GRIPCLAW', WildItemRare: 'SOFTSAND' }),
    'Alolan Form': mon('Sandshrew', { WildItemCommon: 'NEVERMELTICE' }),
    // A form of the Alolan form, not of the first.
    'Totem Form': mon(null, {}, 1),
  })],
]);
const NOTHING = { common: null, uncommon: null, rare: null };
const itemsOf = ({ items }) => [...new Set(items)].sort();

test('a form holds its base form\'s items where the game falls back', () => {
  const wild = extractWildItems(MONS, true);
  assert.deepEqual(wild.species, {
    BEEDRILL: {
      'Normal Form': { ...NOTHING, name: 'Beedrill', uncommon: 'POISONBARB' },
      'Mega Form': {
        ...NOTHING,
        name: 'Beedrill',
        uncommon: 'POISONBARB',
        inheritedFromBaseForm: true,
      },
    },
    SANDSHREW: {
      'Normal Form': {
        name: 'Sandshrew', common: 'GRIPCLAW', uncommon: null, rare: 'SOFTSAND',
      },
      // Slot by slot: its own common item, the base form's rare one.
      'Alolan Form': {
        name: 'Sandshrew',
        common: 'NEVERMELTICE',
        uncommon: null,
        rare: 'SOFTSAND',
        inheritedFromBaseForm: true,
      },
      // The base form's own slots, not what that form inherits in turn.
      'Totem Form': {
        ...NOTHING,
        name: 'Sandshrew',
        common: 'NEVERMELTICE',
        inheritedFromBaseForm: true,
      },
    },
  });
  assert.deepEqual(
    itemsOf(wild), ['GRIPCLAW', 'NEVERMELTICE', 'POISONBARB', 'SOFTSAND']);
});

test('a form holds only its own items where the game does not', () => {
  const wild = extractWildItems(MONS, false);
  // A form without a name still goes by its base form's.
  assert.deepEqual(wild.species.BEEDRILL['Mega Form'], {
    ...NOTHING, name: 'Beedrill',
  });
  assert.deepEqual(wild.species.SANDSHREW['Alolan Form'], {
    ...NOTHING, name: 'Sandshrew', common: 'NEVERMELTICE',
  });
  assert.deepEqual(wild.species.SANDSHREW['Totem Form'], {
    ...NOTHING, name: 'Sandshrew',
  });
});

test('forms stored out of number order are refused', () => {
  // An encounter slot names a form by its number, which the extract gives
  // only as the order it lists the forms in.
  const shuffled = species({
    'Normal Form': mon('Beedrill', {}),
    'Mega Form': mon(null, {}),
  });
  shuffled.ivars.set('@forms', new Map([
    [0, rubyString('Mega Form')], [1, rubyString('Normal Form')],
  ]));
  assert.throws(
    () => extractWildItems(new Map([[symbol('BEEDRILL'), shuffled]]), true),
    /BEEDRILL: forms are not stored in number order/);
});
