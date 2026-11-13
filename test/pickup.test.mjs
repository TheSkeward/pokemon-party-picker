// The Pickup table (scripts/essentials/pickup.mjs), read out of a cut-down
// Kernel.pbPickup: which items a level bracket's window holds and at what
// odds. The renewable sources quote these odds per level, so a window off
// by one slot would misplace every item without failing anything.
import assert from 'node:assert/strict';
import test from 'node:test';

import { extractPickup } from '../scripts/essentials/pickup.mjs';
import { rubySource } from './helpers/essentials-files.mjs';

const FIELD = 'Scripts/Field.rb';
const CONSTANTS = 'Scripts/SystemConstants.rb';

// Three common slots and two rare ones, so three brackets of ten levels.
const field = rubySource([
  'def Kernel.pbPickup(pokemon)',
  '  return if pokemon.ability != :PICKUP || pokemon.isEgg?',
  '  return if rand(20) != 0',
  '  randlist = [50, 30, 15, 4, 1]',
  '  plevel = [100, pokemon.level].min',
  '  itemstart = (plevel - 1) / 10',
  '  return items[rand(5)]',
  'end',
  '',
  'def Kernel.pbRunPickup(pokemon)',
  '  item = Kernel.pbPickup(pokemon)',
  'end',
  '',
  'def pbAfterBattle(decision)',
  '  for pkmn in $Trainer.party',
  '    Kernel.pbRunPickup(pkmn)',
  '    if pkmn.ability == :BALLFETCH && !pkmn.hasAnItem?',
  '      $PokemonBag.pbStoreItem(:SNOWBALL)',
  '    end',
  '    if (pkmn.ability == :HONEYGATHER) && !pkmn.isEgg?',
  '      chance = 5 + ((pkmn.level - 1) / 10) * 5',
  '      $PokemonBag.pbStoreItem(:HONEY) if rand(100) < chance',
  '    end',
  '  end',
  'end',
], FIELD);
const NORMAL =
  ['ORANBERRY', 'GREATBALL', 'SUPERREPEL', 'ULTRAPOTION', 'REVIVE'];
const RARE = ['NUGGET', 'RARECANDY', 'LEFTOVERS', 'LUCKYEGG'];
const constantsOf = (normal, rare) => rubySource([
  'PickupNormal = [',
  ...normal.map((item) => `  :${item},`),
  ']',
  '',
  'PickupRare = [',
  ...rare.map((item) => `  :${item},`),
  ']',
], CONSTANTS);

test('a level bracket picks a window of the common and rare lists', () => {
  const pickup = extractPickup(field, constantsOf(NORMAL, RARE));
  const slots = (...items) => items.map(
    (item, i) => ({ item, chance: [50, 30, 15, 4, 1][i] }));
  // Each bracket's window starts one item further down both lists.
  assert.deepEqual(pickup.table, [
    {
      minLevel: 1,
      maxLevel: 10,
      slots: slots(
        'ORANBERRY', 'GREATBALL', 'SUPERREPEL', 'NUGGET', 'RARECANDY'),
    },
    {
      minLevel: 11,
      maxLevel: 20,
      slots: slots(
        'GREATBALL', 'SUPERREPEL', 'ULTRAPOTION', 'RARECANDY', 'LEFTOVERS'),
    },
    {
      minLevel: 21,
      maxLevel: 30,
      slots: slots(
        'SUPERREPEL', 'ULTRAPOTION', 'REVIVE', 'LEFTOVERS', 'LUCKYEGG'),
    },
  ]);
  // One battle in twenty.
  assert.equal(pickup.trigger.chancePercent, 5);
  assert.equal(pickup.levelRule.rule, 'bracket = (min(100, level) - 1) / 10');
});

test('the rule and its lists are cited where they were read', () => {
  const pickup = extractPickup(field, constantsOf(NORMAL, RARE));
  assert.deepEqual(pickup.source, { file: FIELD, line: 1, endLine: 8 });
  assert.deepEqual(pickup.trigger.source, { file: FIELD, line: 3 });
  assert.deepEqual(
    pickup.trigger.runSource, { file: FIELD, line: 10, endLine: 16 });
  assert.deepEqual(pickup.slotOdds, {
    values: [50, 30, 15, 4, 1], source: { file: FIELD, line: 4 },
  });
  assert.deepEqual(pickup.lists, {
    PickupNormal: {
      values: NORMAL, source: { file: CONSTANTS, line: 1, endLine: 7 },
    },
    PickupRare: {
      values: RARE, source: { file: CONSTANTS, line: 9, endLine: 14 },
    },
  });
  // The abilities that find an item the same way.
  assert.deepEqual(
    pickup.relatedAbilities.map(({ when, ...ability }) => ability),
    [
      {
        ability: 'HONEYGATHER',
        item: 'HONEY',
        chancePercent: '5 + ((pkmn.level - 1) / 10) * 5',
        source: { file: FIELD, line: 20, endLine: 21 },
      },
      {
        ability: 'BALLFETCH',
        item: 'SNOWBALL',
        chancePercent: 100,
        source: { file: FIELD, line: 17 },
      },
    ]);
});

test('lists that no longer fill every window are refused', () => {
  // The game itself gives nothing unless the lists are exactly as long as
  // the brackets need.
  assert.throws(
    () => extractPickup(field, constantsOf(NORMAL, RARE.slice(1))),
    /Pickup lists no longer fit the bracket windows/);
  assert.throws(
    () => extractPickup(field, constantsOf([...NORMAL, 'ETHER'], RARE)),
    /Pickup lists no longer fit the bracket windows/);
});
