// What raises the switches and variables that gate an item
// (scripts/essentials/gate-setters.mjs), on small hand-built maps: which
// are covered, which writes are listed and which only counted.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  Names,
  stateWrites,
  walkCommands,
} from '../scripts/essentials/event-commands.mjs';
import {
  extractGateSetters,
  summariseGateSetters,
} from '../scripts/essentials/gate-setters.mjs';
import { giveConditions } from '../scripts/essentials/item-events.mjs';
import {
  scriptRuleConditions,
} from '../scripts/essentials/script-item-rules.mjs';

const SYSTEM = {
  switches: [
    null, 'ShopOpen', 'QuestDone', 'TalkedToClerk', 'Unrelated', 'Door',
    'Lever', 'Cutscene',
  ],
  variables: [null, 'Stamps', 'Chapter', 'Dice', 'Copy', 'Scratch', 'Cells'],
};
const SHOP_OPEN = { switch: 1, name: 'ShopOpen' };
const CHAPTER = { variable: 2, name: 'Chapter' };

// Event commands as RPG Maker XP stores them.
const command = (code, indent, ...parameters) => ({ code, indent, parameters });
const setSwitch = (indent, first, last, on) =>
  command(121, indent, first, last, on ? 0 : 1);
const OPS = { set: 0, add: 1, sub: 2 };
const setVariable = (indent, id, op, ...operand) =>
  command(122, indent, id, id, OPS[op], ...operand);
const ifSwitch = (indent, id) => command(111, indent, 0, id, 0);
const ifVariable = (indent, id, value) =>
  command(111, indent, 1, id, 0, value, 1);
const end = (indent) => command(412, indent);
const script = (indent, text) => command(355, indent, text);

const page = (list, condition = {}) => ({ condition, list });
const whenSwitch = (id) => ({ switch1_valid: true, switch1_id: id });
const whenVariable = (id, value) =>
  ({ variable_valid: true, variable_id: id, variable_value: value });

// A game of the maps given: map id -> its events, each a list of pages.
function game(maps, commonEvents = []) {
  return {
    maps: Object.entries(maps).map(([mapId, events]) => ({
      mapId: Number(mapId),
      map: {
        events: new Map(events.map((pages, index) =>
          [index + 1, { id: index + 1, pages }])),
      },
    })),
    commonEvents: [null, ...commonEvents],
  };
}

const at = (mapId, eventId, pageNumber = 1) =>
  ({ mapId, eventId, page: pageNumber });

test('a gating switch lists what turns it on, and counts the rest', () => {
  const files = game({
    10: [
      [page([
        ifSwitch(0, 2),
        setSwitch(1, 1, 1, true),
        end(0),
        setSwitch(0, 1, 1, false),
      ], whenVariable(2, 4))],
    ],
  });
  const { switches } = extractGateSetters(files, SYSTEM, [SHOP_OPEN]);
  assert.deepEqual(switches[1], {
    name: 'ShopOpen',
    on: [{
      ...at(10, 1),
      conditions: [
        { ...CHAPTER, atLeast: 4 },
        { switch: 2, name: 'QuestDone', is: true },
      ],
    }],
    turnedOff: 1,
  });
});

test('what a listed command is gated by is covered in turn, and no more', () => {
  const files = game({
    10: [
      [page([setSwitch(0, 1, 1, true)], whenSwitch(2))],
      [page([setSwitch(0, 2, 2, true)], whenSwitch(3))],
      [page([setSwitch(0, 4, 4, true)])],
      // Turning ShopOpen off is not listed, so its gate is not followed.
      [page([setSwitch(0, 1, 1, false)], whenSwitch(5))],
    ],
  });
  const result = extractGateSetters(files, SYSTEM, [SHOP_OPEN]);
  // ShopOpen needs QuestDone, which needs TalkedToClerk, which nothing
  // sets; the switch no gate leads to is left out.
  assert.deepEqual(Object.keys(result.switches), ['1', '2', '3']);
  assert.deepEqual(result.switches[2].on, [{
    ...at(10, 2), conditions: [{ switch: 3, name: 'TalkedToClerk' }],
  }]);
  assert.deepEqual(
    result.switches[3], { name: 'TalkedToClerk', on: [], turnedOff: 0 });
  assert.deepEqual(summariseGateSetters(result), {
    switches: 3, variables: 0, setters: 2, withoutSetter: 1,
  });
});

test('a dated condition is no gate, and ends the chain', () => {
  const files = game({
    10: [
      [page([setSwitch(0, 1, 1, true)], whenVariable(2, 5))],
      [page([setSwitch(0, 2, 2, true)], whenVariable(2, 3))],
      [page([setVariable(0, 2, 'set', 0, 3)], whenSwitch(6))],
    ],
  });
  // The game dates Chapter from 5 up, and nothing else.
  const isDated = (condition) =>
    condition.name === 'Chapter' && condition.atLeast >= 5;
  const result = extractGateSetters(
    files, SYSTEM,
    [SHOP_OPEN, { switch: 2, name: 'QuestDone' }, { ...CHAPTER, atLeast: 9 }],
    isDated);
  // ShopOpen waits on a dated Chapter; QuestDone on one that is not, which
  // covers Chapter and, behind it, Lever.
  assert.deepEqual(Object.keys(result.switches), ['1', '2', '6']);
  assert.deepEqual(result.variables[2].raises, [{
    ...at(10, 3), conditions: [{ switch: 6, name: 'Lever' }],
    op: 'set', constant: 3,
  }]);
  // Left to itself, the extract takes every gate for undated.
  const all = extractGateSetters(files, SYSTEM, [{ ...CHAPTER, atLeast: 9 }]);
  assert.deepEqual(Object.keys(all.variables), ['2']);
  assert.deepEqual(Object.keys(all.switches), ['6']);
});

test('a range command writes every switch of its range', () => {
  const files = game({ 10: [[page([setSwitch(0, 5, 7, true)])]] });
  const { switches } = extractGateSetters(files, SYSTEM, [
    { switch: 5, name: 'Door' }, { not: { switch: 7, name: 'Cutscene' } },
  ]);
  const opened = [{ ...at(10, 1), conditions: [] }];
  assert.deepEqual(switches, {
    5: { name: 'Door', on: opened, turnedOff: 0 },
    7: { name: 'Cutscene', on: opened, turnedOff: 0 },
  });
});

test('a variable lists what raises it and counts its other writes', () => {
  const files = game({
    10: [
      [page([
        setVariable(0, 1, 'add', 0, 1),
        setVariable(0, 1, 'set', 0, 5),
        setVariable(0, 1, 'set', 2, 0, 10),
        setVariable(0, 1, 'sub', 1, 4),
        setVariable(0, 1, 'sub', 0, 1),
        setVariable(0, 1, 'set', 0, 0),
        setVariable(0, 1, 'add', 0, -1),
        setVariable(0, 1, 'set', 6, -1, 0),
        // The player types a number in.
        command(103, 0, 1, 2),
      ])],
      [page([setVariable(0, 4, 'set', 0, 3)])],
    ],
  });
  const { variables } = extractGateSetters(
    files, SYSTEM, [{ variable: 1, name: 'Stamps', atLeast: 2 }]);
  const here = { ...at(10, 1), conditions: [] };
  // The variable it copies from is not followed: a copy is only counted.
  assert.deepEqual(variables, {
    1: {
      name: 'Stamps',
      raises: [
        { ...here, op: 'add', constant: 1 },
        { ...here, op: 'set', constant: 5 },
      ],
      draws: 1,
      entered: 1,
      copies: 1,
      lowered: 2,
      other: 2,
    },
  });
});

test('a script assignment counts as the command would', () => {
  const files = game({
    10: [
      [page([
        script(0, '$game_switches[1] = true'),
        script(0, '$game_variables[1] += 2\n$game_variables[1]=pbGet(4) + 1'),
        script(0, 'pbSet(1, 5)'),
        // A comparison is no write.
        script(0, 'pbMessage("x") if $game_variables[1] == 3'),
      ])],
    ],
  });
  const result = extractGateSetters(files, SYSTEM, [
    SHOP_OPEN,
    // A script's own reads count as a gate.
    { script: '$game_variables[1] >= 2' },
  ]);
  const here = { ...at(10, 1), conditions: [] };
  assert.deepEqual(result.switches[1].on, [here]);
  assert.deepEqual(result.variables[1], {
    name: 'Stamps',
    raises: [
      { ...here, op: 'add', constant: 2 },
      { ...here, op: 'set', constant: 5 },
    ],
    draws: 0,
    entered: 0,
    copies: 0,
    lowered: 0,
    // What the second assignment works out is not known.
    other: 1,
  });
});

test('a command in a common event names it; its callers are listed once', () => {
  const files = game(
    {
      10: [
        [page([
          ifVariable(0, 6, 50),
          command(117, 1, 1),
          end(0),
        ], whenSwitch(3))],
      ],
    },
    [
      { id: 1, trigger: 0, switch_id: 1, list: [setSwitch(0, 1, 2, true)] },
      {
        id: 2, trigger: 2, switch_id: 7,
        list: [setVariable(0, 6, 'add', 0, 1)],
      },
    ],
  );
  const result = extractGateSetters(files, SYSTEM, [SHOP_OPEN]);
  assert.deepEqual(result.switches[1].on, [
    { commonEventId: 1, conditions: [] },
  ]);
  assert.deepEqual(result.calledFrom, {
    1: [{
      ...at(10, 1),
      conditions: [
        { switch: 3, name: 'TalkedToClerk' },
        { variable: 6, name: 'Cells', op: '>=', value: 50 },
      ],
    }],
    // A common event that runs by itself runs under its switch, and may
    // have no caller.
    2: [],
  });
  // The caller's gates are followed: Cells is covered.
  assert.deepEqual(result.variables[6].raises, [{
    commonEventId: 2, trigger: 'parallel',
    conditions: [{ switch: 7, name: 'Cutscene' }],
    op: 'add', constant: 1,
  }]);
  assert.ok('7' in result.switches);
});

test('the gates are every give\'s conditions and the mart rows\' tests', () => {
  const extracted = {
    events: [{
      pages: [
        { page: 1 },
        { page: 2, conditions: [{ switch: 1, name: 'ShopOpen' }] },
      ],
      gives: [
        { page: 1, kind: 'itemBall' },
        {
          page: 2, kind: 'mart',
          within: [{ variable: 1, name: 'Stamps', op: '>=', value: 2 }],
        },
      ],
    }],
    commonEvents: [{
      triggerSwitch: { switch: 7, name: 'Cutscene' },
      gives: [{ page: null, within: [{ choice: 'Yes' }] }],
    }],
  };
  assert.deepEqual(giveConditions(extracted), [
    { switch: 1, name: 'ShopOpen' },
    { variable: 1, name: 'Stamps', op: '>=', value: 2 },
    { switch: 7, name: 'Cutscene' },
    { choice: 'Yes' },
  ]);
  const rules = {
    mining: { items: [] },
    marts: {
      marts: {
        Stall: {
          categories: {
            Buy: [
              { item: 'POTION' },
              {
                item: 'TM01',
                conditions: [
                  '$game_switches[2] == false && $game_variables[1] >= 3',
                  '!searchItem(self.item)',
                ],
              },
            ],
            More: { mart: 'Other' },
          },
        },
      },
    },
  };
  // Each clause of a test apart, as a branch on that script.
  assert.deepEqual(scriptRuleConditions(rules), [
    { script: '$game_switches[2] == false' },
    { script: '$game_variables[1] >= 3' },
    { script: '!searchItem(self.item)' },
  ]);
  // Or as the game's reader makes of it.
  const stamps = /^\$game_variables\[1\] >= (\d+)$/;
  const read = (clause) => (stamps.test(clause)
    ? { variable: 1, name: 'Stamps', atLeast: Number(stamps.exec(clause)[1]) }
    : { script: clause });
  assert.deepEqual(scriptRuleConditions(rules, read)[1], {
    variable: 1, name: 'Stamps', atLeast: 3,
  });
  assert.deepEqual(scriptRuleConditions({ mining: { items: [] } }), []);
});

test('a step\'s writes are read off its command or its script', () => {
  const names = new Names(SYSTEM);
  const writes = (list) =>
    walkCommands(list, names).flatMap((step) => stateWrites(step, names));
  assert.deepEqual(writes([setSwitch(0, 1, 1, false)]), [
    { switch: 1, name: 'ShopOpen', to: false },
  ]);
  assert.deepEqual(writes([setVariable(0, 3, 'set', 2, 1, 6)]), [
    { variable: 3, name: 'Dice', op: 'set', random: [1, 6] },
  ]);
  // A script that assigns a number ends in it; one that computes does not.
  assert.deepEqual(
    writes([script(0, '$game_variables[5] -= 1; $game_variables[5] = rand(3)')]),
    [
      { variable: 5, name: 'Scratch', op: 'sub', constant: 1, script: true },
      { variable: 5, name: 'Scratch', op: 'set', script: true },
    ],
  );
  // Input Number and Button Input store what the player enters.
  assert.deepEqual(writes([command(103, 0, 3, 2), command(105, 0, 5)]), [
    { variable: 3, name: 'Dice', op: 'set', entered: true },
    { variable: 5, name: 'Scratch', op: 'set', entered: true },
  ]);
  assert.deepEqual(writes([command(101, 0, 'Hello.')]), []);
});
