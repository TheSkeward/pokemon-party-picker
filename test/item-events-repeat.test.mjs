// How often a give can happen: the `repeat` label of
// scripts/essentials/item-events.mjs, read off the state the event changes
// around the give and what the event itself reads back. The item timeline
// takes a one-time give for a single copy and a repeatable one for supply,
// so a label that shifts moves items between the two without failing
// anything. Command lists are written a branch to the line.
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  setSelfSwitchesResets,
} from '../scripts/essentials/item-events.mjs';
import {
  command,
  end,
  ifSwitch,
  ifVariable,
  page,
  script,
  setSelfSwitch,
  setSwitch,
  setVariable,
  whenSwitch,
  whenVariable,
} from './helpers/event-commands.mjs';
import {
  ballPages,
  extract,
  giveOf,
  givesOf,
  GOT_ROD,
  labels,
  receive,
  TALLY,
} from './helpers/item-events.mjs';

test('a switch the event reads makes the give once; another is state', () => {
  const gift = [receive(0, 'OLDROD'), setSwitch(0, 1)];
  // Read by another page of the event.
  const [paged] = givesOf([page(gift), page([], whenSwitch(1))]);
  assert.deepEqual(paged.sets, [{ ...GOT_ROD, to: true }]);
  assert.equal(paged.repeat, 'once');
  // Read by the branch the give sits in.
  const branched = giveOf([
    ifSwitch(0, 1, false), receive(1, 'OLDROD'), setSwitch(1, 1), end(0),
  ]);
  assert.deepEqual(branched.within, [{ ...GOT_ROD, is: false }]);
  assert.equal(branched.repeat, 'once');
  // Read by nothing here: story progress, most likely. Still a gift.
  assert.deepEqual(labels(giveOf(gift)), ['gift', 'stateOnly']);
  // Nor is another event's self switch read here.
  const other = giveOf([
    receive(0, 'OLDROD'), script(0, 'pbSetSelfSwitch(12, "A", true)'),
  ]);
  assert.deepEqual(other.sets, [{ selfSwitch: 'A', ofEvent: 12, to: true }]);
  assert.equal(other.repeat, 'stateOnly');
  // A flag raised and cleared again along the way limits nothing.
  const busy = giveOf([
    ifSwitch(0, 2, false),
    setSwitch(1, 2, true), receive(1, 'FRESHWATER'), setSwitch(1, 2, false),
    end(0),
  ]);
  assert.deepEqual(labels(busy), ['repeatableGift', 'unlimited']);
});

test('a variable moved past what gates the give makes it once', () => {
  // The page waits on Story 3 and the give moves it to 4.
  const [paged] = givesOf([
    page([receive(0, 'HARBORKEY'), setVariable(0, 1, 'set', 4)],
      whenVariable(1, 3)),
    page([], whenVariable(1, 4)),
  ]);
  assert.deepEqual(
    paged.sets, [{ variable: 1, name: 'Story', op: 'set', constant: 4 }]);
  assert.equal(paged.repeat, 'onceByVariable');
  // The branch tests Tally for 0 and the give leaves it at 1.
  const tested = (comparison, value, constant) => giveOf([
    ifVariable(0, 3, comparison, value),
    receive(1, 'SOULCANDLE'), setVariable(1, 3, 'set', constant),
    end(0),
  ]);
  assert.equal(tested('==', 0, 1).repeat, 'onceByVariable');
  // A value the test still passes at stops nothing: only state.
  assert.equal(tested('>=', 1, 5).repeat, 'stateOnly');
  // A reward at a count the page tallies elsewhere: nothing on the give's
  // own path changes, and still it comes once.
  const reward = giveOf([
    ifSwitch(0, 3), setVariable(1, 3, 'add', 1), end(0),
    ifVariable(0, 3, '==', 5), receive(1, 'NUGGET'), end(0),
  ]);
  assert.deepEqual(reward.within, [{ ...TALLY, op: '==', value: 5 }]);
  assert.deepEqual(labels(reward), ['gift', 'onceByVariable']);
  // Under a variable the page does not count it stays repeatable.
  const menu = giveOf([
    setVariable(0, 3, 'add', 1),
    ifVariable(0, 2, '==', 5), receive(1, 'NUGGET'), end(0),
  ]);
  assert.equal(menu.repeat, 'unlimited');
});

test('a self switch ends the give only where the give turns it on', () => {
  const lever = [ifSwitch(0, 3), setSelfSwitch(1, 'A'), end(0)];
  // In a branch the event may go on into, it may.
  const later = giveOf([receive(0, 'POTION'), lever]);
  assert.deepEqual(
    later.sets, [{ selfSwitch: 'A', to: true, afterBranch: true }]);
  assert.equal(later.repeat, 'onceIfBranchTaken');
  // In a branch before the give it is another path's.
  const earlier = giveOf([lever, receive(0, 'POTION')]);
  assert.ok(!('sets' in earlier));
  assert.equal(earlier.repeat, 'unlimited');
  // Turned off, it ends nothing.
  const off = giveOf([receive(0, 'POTION'), setSelfSwitch(0, 'A', false)]);
  assert.deepEqual(off.sets, [{ selfSwitch: 'A', to: false }]);
  assert.equal(off.repeat, 'unlimited');
  // Another arm of the same menu is never entered after this one.
  const [first, second] = givesOf([page([
    ifVariable(0, 2, '==', 0), receive(1, 'POTION'), end(0),
    ifVariable(0, 2, '==', 1),
    receive(1, 'ETHER'), setSelfSwitch(1, 'A'),
    end(0),
  ])]);
  assert.ok(!('sets' in first));
  assert.equal(first.repeat, 'unlimited');
  assert.equal(second.repeat, 'once');
});

test('an event timer makes a give timed; erasing lasts a map visit', () => {
  const timed = giveOf([receive(0, 'HONEY'), script(0, 'pbSetEventTime')]);
  assert.deepEqual(timed.sets, [{ eventTime: true }]);
  assert.deepEqual(labels(timed), ['repeatableGift', 'timed']);
  const erased = giveOf([receive(0, 'HONEY'), command(116, 0)]);
  assert.deepEqual(erased.sets, [{ eraseEvent: 'until the map reloads' }]);
  assert.equal(erased.repeat, 'mapReload');
  // And still does where the event also moves state nothing here reads.
  const flagged = giveOf([
    receive(0, 'HONEY'), command(116, 0), setSwitch(0, 3),
  ]);
  assert.equal(flagged.repeat, 'mapReload');
  const temp = giveOf([receive(0, 'HONEY'), script(0, 'setTempSwitchOn("A")')]);
  assert.deepEqual(temp.sets, [{ tempSwitch: 'A', to: true }]);
  assert.equal(temp.repeat, 'mapReload');
});

test('a give that only flips a self switch another event clears', () => {
  const loop = script(
    0,
    'for event in $game_map.events.values',
    '  pbSetSelfSwitch(event.id, "A", false)',
    'end');
  const { events, selfSwitchResets } = extract({
    10: [
      { name: 'Item', pages: ballPages('NUGGET') },
      // Ended by a global switch as well, which no reset clears.
      {
        name: 'Rod',
        pages: [
          page([receive(0, 'OLDROD'), setSelfSwitch(0, 'A'), setSwitch(0, 1)]),
          page([], whenSwitch(1)),
        ],
      },
      { name: 'Reset', pages: [page([loop], {}, { trigger: 3 })] },
      // A mart has no `repeat` to reset, whatever it flips.
      { pages: [page([script(0, 'pbDefaultMart'), setSelfSwitch(0, 'A')])] },
    ],
    11: [
      { name: 'Door', pages: [page([script(0, "set_self_switches(10,'A')")])] },
      // Turning self switches on brings nothing back.
      { pages: [page([script(0, 'set_self_switches(10, nil, true)')])] },
    ],
  });
  const [ball, rod, mart] = events.map((event) => event.gives[0]);
  assert.equal(ball.repeat, 'resetByEvent');
  assert.deepEqual(ball.resetBy, [
    { eventId: 3, page: 1 }, { mapId: 11, eventId: 1, page: 1 },
  ]);
  assert.equal(rod.repeat, 'once');
  assert.ok(!('resetBy' in rod));
  assert.ok(!('repeat' in mart));
  // A reset is listed with the map it clears, when that is another, and
  // with its event's pages: a later page taking over is what ends it.
  assert.deepEqual(selfSwitchResets, [
    {
      mapId: 10, mapName: 'Route 1', eventId: 3, eventName: 'Reset', page: 1,
      selfSwitch: 'A',
      call: 'for event in $game_map.events.values ' +
        'pbSetSelfSwitch(event.id, "A", false) end',
      pages: [{ page: 1, trigger: 'autorun' }],
    },
    {
      mapId: 11, mapName: 'Cave', eventId: 1, eventName: 'Door', page: 1,
      targetMapId: 10, targetMapName: 'Route 1',
      selfSwitch: 'A',
      call: "set_self_switches(10,'A')",
      pages: [{ page: 1 }],
    },
  ]);
  // Left to its defaults the call clears every self switch of the map the
  // script runs on.
  assert.deepEqual(
    setSelfSwitchesResets('set_self_switches'),
    ['A', 'B', 'C', 'D', 'E'].map(
      (selfSwitch) => ({ mapId: null, selfSwitch })));
});
