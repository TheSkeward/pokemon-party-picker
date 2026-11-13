// A small game for the tests of the item-event reader
// (scripts/essentials/item-events.mjs): the names of its switches and
// variables, the calls its events give items with, and the extract of
// hand-built maps.
import assert from 'node:assert/strict';

import { Names } from '../../scripts/essentials/event-commands.mjs';
import {
  ENGINE_GIVE_CALLS,
  extractItemEvents,
  selfSwitchLoopResets,
  setSelfSwitchesResets,
} from '../../scripts/essentials/item-events.mjs';
import {
  end,
  ifScript,
  page,
  script,
  setSelfSwitch,
  whenSelfSwitch,
} from './event-commands.mjs';

const SYSTEM = {
  switches: [null, 'GotRod', 'Busy', 'Lever', 'Rematch'],
  variables: [null, 'Story', 'Choice', 'Tally', 'Points', 'Price'],
};
export const GOT_ROD = { switch: 1, name: 'GotRod' };
export const TALLY = { variable: 3, name: 'Tally' };
export const POINTS = { variable: 4, name: 'Points' };
const MAP_INFOS = new Map([[10, { name: 'Route 1' }], [11, { name: 'Cave' }]]);

// The calls of both games of the family at once.
const CALLS = {
  gives: { ...ENGINE_GIVE_CALLS, addItemSilent: 'store' },
  defaultMart: 'pbDefaultMart',
  dataMart: 'pbComplexMart',
  poolDraws: {
    luckItem: { poolArgument: 2, defaultPool: 'itemball' },
    generateWonderTowerItem: { poolArgument: 0 },
  },
  eventTimers: ['pbSetEventTime'],
  selfSwitchResets: (text) =>
    [...selfSwitchLoopResets(text), ...setSelfSwitchesResets(text)],
};
const ITEM_POOLS = {
  luckItem: { pools: { itemball: ['ETHER', 'REVIVE'], chest: ['LEFTOVERS'] } },
  generateWonderTowerItem: { pools: { castleTM1: ['TM55', 'TM81'] } },
};

// Extracts a game of the maps given: map id -> its events, each an event's
// name and pages. Maps 10 and 11 are in the map list.
export function extract(maps, commonEvents = []) {
  const files = {
    maps: Object.entries(maps).map(([mapId, events]) => ({
      mapId: Number(mapId),
      map: {
        events: new Map(events.map((event, index) =>
          [index + 1, { id: index + 1, name: 'EV', x: 0, y: 0, ...event }])),
      },
    })),
    commonEvents: [null, ...commonEvents],
    mapInfos: MAP_INFOS,
  };
  return extractItemEvents(files, new Names(SYSTEM), CALLS, ITEM_POOLS);
}

// The gives of one event on map 10, and the one give of a one-page event.
export const givesOf = (pages, name = 'EV') =>
  extract({ 10: [{ name, pages }] }).events[0].gives;
export function giveOf(list, name) {
  const gives = givesOf([page(list)], name);
  assert.equal(gives.length, 1);
  return gives[0];
}
export const labels = ({ kind, repeat }) => [kind, repeat];

export const receive = (indent, item) =>
  script(indent, `Kernel.pbReceiveItem(:${item})`);
// An item ball as the games build one: found, then gone for good.
export const ballPages = (item) => [
  page([
    ifScript(0, `Kernel.pbItemBall(:${item})`), setSelfSwitch(1, 'A'), end(0),
  ]),
  page([], whenSelfSwitch('A')),
];
