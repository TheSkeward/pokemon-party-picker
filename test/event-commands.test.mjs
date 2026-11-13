// How an RPG Maker XP command list is read
// (scripts/essentials/event-commands.mjs): what gates a page, which branch
// arms a command sits under, how two commands relate, what a command
// writes. Every give's conditions, costs and repeat label are read off
// these. test/gate-setters.test.mjs covers the plain switch and variable
// branches and most of a step's writes; this covers the rest.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  enclosingConditions,
  Names,
  pageConditions,
  pageRecord,
  relation,
  scriptsIn,
  stateWrites,
  walkCommands,
} from '../scripts/essentials/event-commands.mjs';
import {
  command,
  end,
  endChoices,
  ifScript,
  ifSwitch,
  ifVariable,
  otherwise,
  page,
  script,
  setSelfSwitch,
  showChoices,
  whenCancel,
  whenChoice,
  whenSwitch,
} from './helpers/event-commands.mjs';

const SYSTEM = {
  switches: [null, 'ShopOpen', 'QuestDone'],
  variables: [null, 'Stamps', 'Chapter', 'Price', 'Copy'],
};
const SHOP_OPEN = { switch: 1, name: 'ShopOpen' };
const STAMPS = { variable: 1, name: 'Stamps' };
const CHAPTER = { variable: 2, name: 'Chapter' };

// The steps of a command list, and each by its index in the list.
function walk(list) {
  const steps = walkCommands(list.flat(), new Names(SYSTEM));
  const at = (index) => steps.find((step) => step.index === index);
  const under = (index) => enclosingConditions(steps, at(index).chain);
  return { steps, at, under };
}

test('a switch or a variable is named as System.rxdata names it', () => {
  const names = new Names(SYSTEM);
  assert.deepEqual(names.switch(2), { switch: 2, name: 'QuestDone' });
  assert.deepEqual(names.variable(1), STAMPS);
  // One past the names the file holds has none.
  assert.deepEqual(names.switch(40), { switch: 40, name: null });
  names.switch(2);
  // The index is what was named, with how often.
  assert.deepEqual(names.index(), {
    switches: {
      2: { name: 'QuestDone', uses: 2 }, 40: { name: null, uses: 1 },
    },
    variables: { 1: { name: 'Stamps', uses: 1 } },
  });
});

test('a page is gated by the conditions that are ticked', () => {
  const names = new Names(SYSTEM);
  assert.deepEqual(
    pageConditions({
      switch1_valid: true, switch1_id: 1,
      switch2_valid: true, switch2_id: 2,
      variable_valid: true, variable_id: 2, variable_value: 4,
      self_switch_valid: true, self_switch_ch: 'B',
    }, names),
    [
      SHOP_OPEN, { switch: 2, name: 'QuestDone' },
      { ...CHAPTER, atLeast: 4 }, { selfSwitch: 'B' },
    ]);
  // The editor keeps an id beside a box that is not ticked.
  assert.deepEqual(
    pageConditions({
      switch1_valid: false, switch1_id: 1,
      switch2_valid: false, switch2_id: 1,
      variable_valid: false, variable_id: 1, variable_value: 0,
      self_switch_valid: false, self_switch_ch: 'A',
    }, names),
    []);
});

test('a page record leaves out the defaults', () => {
  const names = new Names(SYSTEM);
  assert.deepEqual(pageRecord(page([]), 0, names), { page: 1 });
  const clerk = page([], whenSwitch(1), {
    trigger: 3, graphic: { character_name: 'trchar020', tile_id: 0 },
  });
  assert.deepEqual(pageRecord(clerk, 1, names), {
    page: 2, conditions: [SHOP_OPEN], trigger: 'autorun',
    graphic: 'trchar020',
  });
  const rock = page([], {}, {
    trigger: 1, graphic: { character_name: '', tile_id: 384 },
  });
  assert.deepEqual(
    pageRecord(rock, 2, names),
    { page: 3, trigger: 'playerTouch', graphic: 'tile' });
});

test('a script is one step with its continuation lines; text is none', () => {
  const list = [
    command(101, 0, 'Take this.'),
    command(401, 0, 'You will need it.'),
    script(0, 'Kernel.pbReceiveItem(', '  :POTION)'),
    ifScript(0, '$PokemonBag.pbQuantity(:KEY)>0'),
    end(0),
    command(0, 0),
  ].flat();
  const { steps } = walk(list);
  assert.deepEqual(
    steps.map((step) => [step.index, step.code, step.script]),
    [
      [0, 101, undefined],
      [2, 355, 'Kernel.pbReceiveItem(\n  :POTION)'],
      [4, 111, '$PokemonBag.pbQuantity(:KEY)>0'],
    ]);
  // The scripts a list runs or branches on, the same way.
  assert.deepEqual([...scriptsIn(list)], [
    'Kernel.pbReceiveItem(\n  :POTION)', '$PokemonBag.pbQuantity(:KEY)>0',
  ]);
});

test('a command sits under the branches around it, outermost first', () => {
  const { steps, under } = walk([
    ifSwitch(0, 1),
    ifVariable(1, 2, '>=', 3),
    setSelfSwitch(2, 'A'),
    end(1),
    otherwise(0),
    command(116, 1),
    end(0),
    command(116, 0),
  ]);
  // Branch ends and arm headers are not steps.
  assert.deepEqual(steps.map((step) => step.index), [0, 1, 2, 5, 7]);
  const shopOpen = { ...SHOP_OPEN, is: true };
  assert.deepEqual(under(0), []);
  assert.deepEqual(under(1), [shopOpen]);
  assert.deepEqual(under(2), [shopOpen, { ...CHAPTER, op: '>=', value: 3 }]);
  assert.deepEqual(under(5), [{ not: shopOpen }]);
  assert.deepEqual(under(7), []);
});

test('a choice arm is under its label; a loop is no condition', () => {
  const { at, under } = walk([
    showChoices(0, 'Yes', 'No'),
    whenChoice(0, 0, 'Yes'),
    script(1, 'a'),
    whenChoice(0, 1, 'No'),
    script(1, 'b'),
    whenCancel(0),
    script(1, 'c'),
    endChoices(0),
    command(112, 0),
    script(1, 'd'),
    command(413, 0),
    script(0, 'e'),
  ]);
  assert.deepEqual(under(0), []);
  assert.deepEqual(under(2), [{ choice: 'Yes' }]);
  assert.deepEqual(under(4), [{ choice: 'No' }]);
  assert.deepEqual(under(6), [{ choice: null }]);
  assert.deepEqual(under(9), []);
  // A loop is a scope all the same, and what follows it is out of it.
  assert.equal(at(9).chain.length, 1);
  assert.deepEqual(at(11).chain, []);
});

test('a branch is read by what it tests', () => {
  const tested = (...parameters) =>
    walk([command(111, 0, ...parameters), end(0)]).steps.arms.get('0t');
  assert.deepEqual(tested(0, 1, 1), { ...SHOP_OPEN, is: false });
  assert.deepEqual(tested(1, 2, 0, 5, 0), { ...CHAPTER, op: '==', value: 5 });
  assert.deepEqual(tested(1, 2, 0, 5, 4), { ...CHAPTER, op: '<', value: 5 });
  assert.deepEqual(tested(1, 2, 0, 5, 5), { ...CHAPTER, op: '!=', value: 5 });
  // Against another variable.
  assert.deepEqual(
    tested(1, 1, 1, 3, 1),
    { ...STAMPS, op: '>=', value: { variable: 3, name: 'Price' } });
  assert.deepEqual(tested(2, 'A', 0), { selfSwitch: 'A', is: true });
  assert.deepEqual(tested(7, 200, 0), { money: '>=', value: 200 });
  assert.deepEqual(tested(7, 200, 1), { money: '<=', value: 200 });
  // A script, on one line.
  assert.deepEqual(
    tested(12, '$PokemonBag.pbQuantity(:KEY)\n  > 0'),
    { script: '$PokemonBag.pbQuantity(:KEY) > 0' });
  // What the reader has no reading of is kept as the editor stores it:
  // here, the player facing up.
  assert.deepEqual(
    tested(6, -1, 8), { conditionType: 6, parameters: [-1, 8] });
});

test('a command runs with, after or apart from another', () => {
  const { at } = walk([
    script(0, 'before'),
    ifScript(0, 'Kernel.pbItemBall(:POTION)'),
    setSelfSwitch(1, 'A'),
    otherwise(0),
    script(1, 'bag full'),
    end(0),
    ifSwitch(0, 1),
    script(1, 'later'),
    end(0),
  ]);
  const found = at(1);
  assert.equal(relation(found, found), null);
  // The same scope, and the branch taken when the item is picked up.
  assert.equal(relation(at(0), found), 'with');
  assert.equal(relation(at(6), found), 'with');
  assert.equal(relation(at(2), found), 'with');
  // The branch taken when it is not.
  assert.equal(relation(at(4), found), null);
  // A branch the event may or may not go on into, or have come through.
  assert.equal(relation(at(7), found), 'after');
  assert.equal(relation(at(2), at(7)), 'before');
  // The two arms of one branch never run together.
  assert.equal(relation(at(4), at(2)), null);
  assert.equal(relation(at(2), at(4)), null);
});

test('a variable command names its operation and its operand', () => {
  const names = new Names(SYSTEM);
  const writes = (...parameters) =>
    stateWrites({ code: 122, parameters }, names);
  // Every variable of the range.
  assert.deepEqual(writes(1, 2, 1, 0, 2), [
    { ...STAMPS, op: 'add', constant: 2 },
    { ...CHAPTER, op: 'add', constant: 2 },
  ]);
  assert.deepEqual(writes(3, 3, 3, 0, 2), [
    { variable: 3, name: 'Price', op: 'mul', constant: 2 },
  ]);
  assert.deepEqual(writes(3, 3, 5, 0, 10), [
    { variable: 3, name: 'Price', op: 'mod', constant: 10 },
  ]);
  assert.deepEqual(writes(1, 1, 0, 1, 4), [
    { ...STAMPS, op: 'set', fromVariable: { variable: 4, name: 'Copy' } },
  ]);
  // One of the engine's other sources: here, how many of an item are held.
  assert.deepEqual(writes(1, 1, 0, 3, 12), [
    { ...STAMPS, op: 'set', operandType: 3 },
  ]);
});
