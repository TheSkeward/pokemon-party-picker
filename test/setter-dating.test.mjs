// Dating a quest switch or a counter from the events that set it
// (scripts/essentials/setter-dating.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';

import { conditionBadge } from '../scripts/essentials/event-sources.mjs';
import { setterDating } from '../scripts/essentials/setter-dating.mjs';

// The game's own rules: gym switches, and nothing else.
const game = {
  switchBadge: (name) => {
    const gym = /^Defeated Gym (\d+)$/.exec(name);
    return gym ? Number(gym[1]) : null;
  },
  variableBadge: () => null,
};
// Maps by the badge they are reached at; map 9 is never entered.
const REACH = { 1: 0, 2: 3, 3: 4, 4: 7, 5: 10 };
const reach = (mapId) => REACH[mapId] ?? null;
const on = (mapId, conditions = [], eventId = 1) =>
  ({ mapId, eventId, page: 1, conditions });
const add = (mapId, eventId, constant = 1, conditions = []) =>
  ({ mapId, eventId, page: 1, conditions, op: 'add', constant });
const set = (mapId, constant, conditions = []) =>
  ({ mapId, eventId: 1, page: 1, conditions, op: 'set', constant });
const counts = { draws: 0, copies: 0, lowered: 0, other: 0 };

const gateSetters = {
  switches: {
    10: { name: 'LostCamp', on: [on(2)] },
    // Found on Route 3 once the camp quest is on, or by a password.
    11: {
      name: 'MatthewFound',
      on: [
        on(3, [{ switch: 10, name: 'LostCamp' }, { choice: 'Yes' }]),
        on(1, [{ switch: 99, name: 'Password' }]),
      ],
    },
    // Turned on by a debug room nobody enters, and under a gym.
    12: {
      name: 'ShopOpen',
      on: [on(9), on(4, [{ switch: 5, name: 'Defeated Gym 8' }])],
    },
    // Each waits on the other.
    13: { name: 'Chicken', on: [on(1, [{ switch: 14, name: 'Egg' }])] },
    14: { name: 'Egg', on: [on(1, [{ switch: 13, name: 'Chicken' }])] },
    // Two ids under one name: both must be dated, and the later counts.
    15: { name: 'Twin', on: [on(2)] },
    16: { name: 'Twin', on: [on(4)] },
    // Turned on by a common event, which runs where it is called.
    17: {
      name: 'Festival',
      on: [{ commonEventId: 7, conditions: [{ choice: 'Yes' }] }],
    },
    18: { name: 'NeverCalled', on: [{ commonEventId: 8, conditions: [] }] },
  },
  variables: {
    // A stamp from each of four clerks; one clerk has two ways to give
    // his, and one gives two at once.
    20: {
      name: 'Stamps',
      ...counts,
      raises: [
        add(5, 1), add(5, 2), add(5, 2), add(4, 3, 2), add(9, 4),
      ],
    },
    // A quest's steps, assigned outright.
    21: {
      name: 'Quest',
      ...counts,
      lowered: 1,
      raises: [
        set(2, 1), set(3, 5, [{ switch: 10, name: 'LostCamp' }]), set(9, 9),
      ],
    },
    // Only ever drawn at random.
    22: { name: 'Stock', ...counts, draws: 1, raises: [] },
    // Never raised by anything this reads.
    23: { name: 'Typed', ...counts, other: 2, raises: [] },
  },
  calledFrom: {
    7: [
      { mapId: 5, eventId: 3, page: 1, conditions: [] },
      {
        mapId: 2, eventId: 4, page: 1,
        conditions: [{ switch: 5, name: 'Defeated Gym 6' }],
      },
    ],
  },
};
const dating = setterDating(gateSetters, reach, game);

test('a switch is on no earlier than its first setter can run', () => {
  // The game's own rules come first.
  assert.equal(dating.switchBadge('Defeated Gym 8'), 8);
  assert.equal(dating.switchBadge('LostCamp'), 3);
  // Under another quest switch, on a later map; the password page's own
  // gate is dated by nothing.
  assert.equal(dating.switchBadge('MatthewFound'), 4);
  // A setter on a map never entered does not count.
  assert.equal(dating.switchBadge('ShopOpen'), 8);
  // A ring of gates, a name nothing sets.
  assert.equal(dating.switchBadge('Chicken'), null);
  assert.equal(dating.switchBadge('Unheard'), null);
  assert.equal(dating.switchBadge('Twin'), 7);
  // The earlier of the two calls: a map at badge 3 under the sixth gym, or
  // a map at badge 10.
  assert.equal(dating.switchBadge('Festival'), 6);
  assert.equal(dating.switchBadge('NeverCalled'), null);
});

test('a counter reaches a value with enough of the events that add', () => {
  // The clerk who gives two, at badge 7.
  assert.equal(dating.variableBadge('Stamps', 1), 7);
  assert.equal(dating.variableBadge('Stamps', 2), 7);
  // Then the two clerks of the mall at badge 10, once each.
  assert.equal(dating.variableBadge('Stamps', 4), 10);
  // The fourth clerk is never met.
  assert.equal(dating.variableBadge('Stamps', 5), null);
});

test('a variable assigned outright is dated by a write that high', () => {
  assert.equal(dating.variableBadge('Quest', 1), 3);
  assert.equal(dating.variableBadge('Quest', 2), 4);
  assert.equal(dating.variableBadge('Quest', 6), null);
  // Drawn at random each time: no gate. Typed in by the player: no date.
  assert.equal(dating.variableBadge('Stock', 6), 0);
  assert.equal(dating.variableBadge('Typed', 1), null);
});

test('an event gated by a quest is dated through its conditions', () => {
  assert.equal(
    conditionBadge(
      [
        { switch: 11, name: 'MatthewFound' },
        { variable: 20, name: 'Stamps', op: '>=', value: 2 },
        { choice: 'Buy' },
      ],
      dating,
    ),
    7,
  );
  assert.equal(
    conditionBadge(
      [{ switch: 11, name: 'MatthewFound' }, { switch: 13, name: 'Chicken' }],
      dating,
    ),
    null,
  );
});
