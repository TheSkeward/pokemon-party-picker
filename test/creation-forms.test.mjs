// The form a wild Pokémon is made in where its species decides it
// (scripts/essentials/creation-forms.mjs). Reborn's tables name no form:
// the species' creation rule does, most by the map. Read without it, every
// wild Pokémon was its first form, and the site dated wild Cell Battery to
// the thirteenth badge, eight after the Alolan Geodude of Tanzan Mountain.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  creationFormReader,
  readCreationFormRule,
  readMapLists,
  withCreationForms,
} from '../scripts/essentials/creation-forms.mjs';
import { REBORN_ITEM_SOURCES } from '../src/generated/rebornItemTimeline.generated.js';
import {
  rubyObject,
  rubySource,
  rubyString,
  symbol,
} from './helpers/essentials-files.mjs';

// Parsed mons.dat: species -> its creation rule, as the game compiles the
// proc's source; an empty hash where a species has none.
function mons(rules) {
  return new Map(Object.entries(rules).map(([species, rule]) => [
    symbol(species),
    rubyObject('MonWrapper', {
      formInit: rule === null ? new Map() : rubyString(rule),
    }),
  ]));
}

const BY_MAP = (list, inList = 1, otherwise = 0) => [
  'proc {',
  ' # Map IDs for alolan form',
  ` next $game_map && ${list}.include?($game_map.map_id) ? ${inList} : ${otherwise}`,
  ' }',
].join('\n');

test('the rule is cited where the generator applies it', () => {
  const file = 'Scripts/Field.rb';
  const field = rubySource([
    'def pbGenerateWildPokemon(species, level, form = nil)',
    '  if $cache.pkmn[species].formInit.is_a?(String) && form.nil?',
    '    genwildpoke = PokeBattle_Pokemon.new(species, level, $Trainer, false, eval($cache.pkmn[species].formInit).call)',
    '  else',
    '    genwildpoke = PokeBattle_Pokemon.new(species, level, $Trainer, true, form == nil ? 0 : form)',
    '  end',
    'end',
  ], file);
  const rule = readCreationFormRule(field);
  assert.deepEqual(rule.source, { file, line: 2, endLine: 3 });
  assert.match(rule.rule, /a slot without `form` is form 0/);
});

test('the map lists are the constants file\'s lists of numbers', () => {
  const lists = readMapLists(rubySource([
    'Switches = {',
    '  Gym_1: 4,',
    '}',
    'PickupNormal = [:ORANBERRY, :GREATBALL]',
    'Rattata = [170, 524, 866] # and aMeowth!',
    'Geodude = [',
    '  231, 247, 251, # Tanzan',
    '  340, 341',
    ']',
    'Meowth = [] # gMeowth',
  ]));
  assert.deepEqual([...lists], [
    ['Rattata', [170, 524, 866]],
    ['Geodude', [231, 247, 251, 340, 341]],
    // A list with nothing in it is still a list: the form is met nowhere.
    ['Meowth', []],
  ]);
});

test('a rule that goes by the map gives the form its list says', () => {
  const formOf = creationFormReader(
    mons({
      GEODUDE: BY_MAP('Geodude'),
      SHELLOS: BY_MAP('Shellos', 2, 1),
      PIDGEY: null,
    }),
    new Map([['Geodude', [231, 247]], ['Shellos', [206]]]),
  );
  assert.equal(formOf('GEODUDE', 247), 1);
  // Its first form elsewhere, which a slot states by naming none.
  assert.equal(formOf('GEODUDE', 21), undefined);
  // The rule's own numbers, either way.
  assert.equal(formOf('SHELLOS', 206), 2);
  assert.equal(formOf('SHELLOS', 14), 1);
  // No rule, and a species the data does not have.
  assert.equal(formOf('PIDGEY', 247), undefined);
  assert.equal(formOf('MISSINGNO', 247), undefined);
});

test('a rule that does not go by the map gives every form it can', () => {
  const formOf = creationFormReader(
    mons({
      BASCULIN: 'proc { rand(2) }',
      DEERLING: 'proc {\n time = pbGetTimeNow\n next (time.month - 1) % 4\n }',
      LYCANROC: [
        'proc {',
        ' next 2 if PBDayNight.isDusk?(pbGetTimeNow)',
        ' next 0 if PBDayNight.isDay?(pbGetTimeNow)',
        ' next 1',
        ' }',
      ].join('\n'),
    }),
    new Map(),
  );
  // At random; by the season; by the hour. The map changes nothing.
  assert.deepEqual(formOf('BASCULIN', 232), [0, 1]);
  assert.deepEqual(formOf('DEERLING', 285), [0, 1, 2, 3]);
  assert.deepEqual(formOf('LYCANROC', 1), [0, 1, 2]);
  assert.deepEqual(formOf('LYCANROC', 2), [0, 1, 2]);
});

test('a rule that cannot be read stops the extract', () => {
  // Read as nothing, either would put the first form on every map.
  const unknownList =
    creationFormReader(mons({ VULPIX: BY_MAP('Vulpix') }), new Map());
  assert.throws(() => unknownList('VULPIX', 439), /no map list named Vulpix/);
  const unknownShape = creationFormReader(
    mons({ ODDISH: 'proc { $game_switches[12] ? form_a : form_b }' }),
    new Map());
  assert.throws(() => unknownShape('ODDISH', 1), /ODDISH: creation rule not understood/);
});

test('a slot that names no form takes the one its species\' rule gives', () => {
  const slot = (species, extra = {}) =>
    ({ species, ...extra, min: 30, max: 35, rate: 20 });
  const tables = [
    {
      mapId: 247,
      mapName: 'Tanzan Depths',
      types: {
        Cave: [slot('GEODUDE'), slot('ONIX'), slot('BASCULIN')],
        // Named by the table itself: left as it is.
        OldRod: [slot('GEODUDE', { form: 0 })],
      },
    },
    { mapId: 21, mapName: 'Pyrous Mountain', types: { RockSmash: [slot('GEODUDE')] } },
  ];
  const formed = withCreationForms(
    tables,
    creationFormReader(
      mons({ GEODUDE: BY_MAP('Geodude'), BASCULIN: 'proc { rand(2) }' }),
      new Map([['Geodude', [247]]])),
  );
  assert.deepEqual(formed[0].types.Cave, [
    { species: 'GEODUDE', form: 1, min: 30, max: 35, rate: 20 },
    slot('ONIX'),
    { species: 'BASCULIN', form: [0, 1], min: 30, max: 35, rate: 20 },
  ]);
  // The form follows the species in a slot, as a table's own does.
  assert.deepEqual(
    Object.keys(formed[0].types.Cave[0]),
    ['species', 'form', 'min', 'max', 'rate']);
  assert.deepEqual(formed[0].types.OldRod, tables[0].types.OldRod);
  assert.deepEqual(formed[1], tables[1]);
  assert.equal(formed[0].mapName, 'Tanzan Depths');
});

test('Reborn\'s regional forms are met where the game puts them', () => {
  const { data } = JSON.parse(readFileSync(
    new URL('../scripts/reborn/reborn-encounters.generated.json', import.meta.url),
    'utf8'));
  const formsOf = (species, mapName) => new Set(data.maps
    .filter((map) => map.mapName === mapName)
    .flatMap((map) => Object.values(map.types).flat())
    .filter((slot) => slot.species === species)
    .map((slot) => JSON.stringify(slot.form)));
  // Alolan in the Tanzan caves, ordinary on Pyrous Mountain.
  assert.deepEqual([...formsOf('GEODUDE', 'Tanzan Depths')], ['1']);
  assert.deepEqual([...formsOf('GEODUDE', 'Pyrous Mountain')], [undefined]);
  // Either stripe, wherever it is fished.
  assert.deepEqual([...formsOf('BASCULIN', 'Tanzan Cove')], ['[0,1]']);

  // So the item each form holds is dated from that form's maps.
  const wild = (id) =>
    REBORN_ITEM_SOURCES[id].filter((source) => source.kind === 'wild');
  assert.deepEqual(wild('cellbattery'), [
    { kind: 'wild', badge: 5, via: 'Alolan Geodude (5%), Tanzan Mountain' },
  ]);
  // Ametrine City's Vulpix are Alolan and hold a Snowball.
  assert.ok(wild('charcoal').every((source) => !/Vulpix/.test(source.via)));
});
