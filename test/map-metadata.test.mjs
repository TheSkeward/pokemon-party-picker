// What maps.dat says of each map (scripts/essentials/map-metadata.mjs):
// its wild encounter tables slot by slot, how a slot names a form, and the
// switches the map exists under. The encounter extract dates every wild
// Pokémon and wild-held item, so a slot dropped or a rate misplaced here
// moves them without failing anything.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  extractEncounters,
  mapSwitchReader,
  readNamedSwitches,
  readSlotFormRule,
} from '../scripts/essentials/map-metadata.mjs';
import { rubySource } from './helpers/essentials-files.mjs';

const ENCOUNTER_TYPES = [
  ['Land', 'land'], ['Cave', 'cave'], ['OldRod', 'water'], ['Headbutt', 'land'],
];
const MAP_INFOS = new Map([[5, { name: 'Route 1' }], [9, { name: 'Lab' }]]);

test('a table is read slot by slot, each with its own rate', () => {
  // Plain maps.dat: a table keys a species to its [rate, min, max] slots.
  const mapData = [
    null,
    {
      mapid: 12,
      caverate: 3,
      Cave: new Map([['WOOBAT', [[10, 30, 33]]]]),
    },
    // A map without a table is left out.
    { mapid: 9, landrate: 25 },
    {
      mapid: 5,
      landrate: 21,
      waterrate: 7,
      Land: new Map([
        ['SENTRET', [[20, 11, 12], [4, 13, 14]]],
        ['POOCHYENA', [[15, 11, 12]]],
      ]),
      // A table the map has, with nothing in it.
      OldRod: new Map(),
    },
  ];
  assert.deepEqual(extractEncounters(mapData, MAP_INFOS, ENCOUNTER_TYPES), [
    {
      mapId: 5,
      mapName: 'Route 1',
      // One rate for each density the game's types draw on.
      density: { land: 21, cave: 0, water: 7 },
      types: {
        Land: [
          { species: 'SENTRET', min: 11, max: 12, rate: 20 },
          { species: 'SENTRET', min: 13, max: 14, rate: 4 },
          { species: 'POOCHYENA', min: 11, max: 12, rate: 15 },
        ],
        OldRod: [],
      },
    },
    {
      mapId: 12,
      mapName: null,
      density: { land: 0, cave: 3, water: 0 },
      types: { Cave: [{ species: 'WOOBAT', min: 30, max: 33, rate: 10 }] },
    },
  ]);
});

test('a slot keyed by species and form carries the form selector', () => {
  const slotForm = (selector) => {
    const mapData = [{
      mapid: 5,
      Land: new Map([[['BURMY', selector], [[10, 5, 6]]]]),
    }];
    const [{ types }] = extractEncounters(mapData, MAP_INFOS, ENCOUNTER_TYPES);
    assert.equal(types.Land[0].species, 'BURMY');
    return types.Land[0].form;
  };
  // A form number, a list to pick from, the name of a rule.
  assert.equal(slotForm(1), 1);
  assert.deepEqual(slotForm([0, 2]), [0, 2]);
  assert.equal(slotForm('Cloak'), 'Cloak');
  // A Range is the forms it spans, with or without its end.
  assert.deepEqual(slotForm({ excl: false, begin: 0, end: 3 }), [0, 1, 2, 3]);
  assert.deepEqual(slotForm({ excl: true, begin: 1, end: 3 }), [1, 2]);
});

test('the form rule is read with its lure item and its named rules', () => {
  const file = 'Scripts/Encounters.rb';
  const encounters = rubySource([
    'class PokemonEncounters',
    '  def pbDetermineForm(form)',
    '    return 0 if form.nil?',
    '    form = form.to_a if form.is_a?(Range)',
    '    if form.is_a?(Array) && $Trainer.party[0].item == :MIRRORLURE',
    '      return $Trainer.party[0].form',
    '    end',
    '    return form.sample if form.is_a?(Array)',
    '    return PBDayNight.isNight?(pbGetTimeNow) ? 1 : 0 if form == :Time',
    '    return (pbGetTimeNow.month - 1) % 4 if form == :Season',
    '    raise "unknown form #{form.inspect}"',
    '  end',
    '',
    '  def isCloaked?(form)',
    '    return form == :Cloak',
    '  end',
    'end',
  ], file);
  const rule = readSlotFormRule(encounters);
  assert.deepEqual(rule.source, { file, line: 2, endLine: 12 });
  assert.equal(rule.lureItem, 'MIRRORLURE');
  // Only the names the method itself tests for.
  assert.deepEqual(rule.namedRules, ['Time', 'Season']);
});

test('a map switch is its symbol, its id and its System.rxdata name', () => {
  const constants = rubySource([
    'Variables = {',
    '  Field_Effect: 5,',
    '}',
    'Switches = {',
    '  Seen_Pokerus: 2,',
    '  # Story.',
    '  Reborn_City_Restore: 479, # once the city is rebuilt',
    '}',
    'Other = {',
    '  Not_A_Switch: 7,',
    '}',
  ]);
  const named = readNamedSwitches(constants);
  assert.deepEqual([...named], [
    ['Seen_Pokerus', 2], ['Reborn_City_Restore', 479],
  ]);
  const switches = [];
  switches[479] = 'City Restore';
  const mapSwitches = mapSwitchReader(named, { switches });
  assert.deepEqual(
    mapSwitches({
      mapid: 14,
      Switches: [['Reborn_City_Restore', false], ['Unlisted', true]],
    }),
    [
      {
        switch: 479, symbol: 'Reborn_City_Restore', name: 'City Restore',
        is: false,
      },
      // A symbol the constants do not define keeps its place, unnamed.
      { switch: null, symbol: 'Unlisted', name: null, is: true },
    ]);
  // A map under no switch, and a map id maps.dat has nothing for.
  assert.deepEqual(mapSwitches({ mapid: 5 }), []);
  assert.deepEqual(mapSwitches(undefined), []);
});
