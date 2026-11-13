// The JSON layouts of the game-file extracts
// (scripts/essentials/format-json.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatJson,
  formatJsonRows,
} from '../scripts/essentials/format-json.mjs';

const LONG = 'a condition too long for one line';
const RECORDS = {
  1: {
    name: 'ShopOpen',
    on: [
      { mapId: 10, eventId: 1, page: 1, conditions: [{ script: LONG }] },
      { mapId: 11, eventId: 2, page: 1, conditions: [] },
    ],
    turnedOff: 0,
  },
};

test('what fits on a line stays on one; the rest is broken up', () => {
  assert.equal(formatJson({ a: 1, b: [2, 3] }), '{ "a": 1, "b": [2, 3] }');
  assert.equal(formatJson(RECORDS), [
    '{',
    '  "1": {',
    '    "name": "ShopOpen",',
    '    "on": [',
    '      {',
    '        "mapId": 10,',
    '        "eventId": 1,',
    '        "page": 1,',
    `        "conditions": [{ "script": "${LONG}" }]`,
    '      },',
    '      { "mapId": 11, "eventId": 2, "page": 1, "conditions": [] }',
    '    ],',
    '    "turnedOff": 0',
    '  }',
    '}',
  ].join('\n'));
});

test('the rows layout keeps every entry of an array on one line', () => {
  assert.equal(formatJsonRows(RECORDS), [
    '{',
    '  "1": {',
    '    "name": "ShopOpen",',
    '    "on": [',
    '      { "mapId": 10, "eventId": 1, "page": 1, ' +
      `"conditions": [{ "script": "${LONG}" }] },`,
    '      { "mapId": 11, "eventId": 2, "page": 1, "conditions": [] }',
    '    ],',
    '    "turnedOff": 0',
    '  }',
    '}',
  ].join('\n'));
  // Both parse back to what was written.
  assert.deepEqual(JSON.parse(formatJsonRows(RECORDS)), RECORDS);
  assert.deepEqual(JSON.parse(formatJson(RECORDS)), RECORDS);
});
