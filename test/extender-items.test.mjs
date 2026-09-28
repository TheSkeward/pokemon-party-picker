// A duration extender (weather rock, Light Clay, Terrain Extender) goes only
// to a member whose set starts the condition it extends, by a move or, from
// Generation 6 on, by an ability.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveGame,
  loadGame,
  setActiveGame,
} from '../src/games/registry.js';

globalThis.__ENV__ ??= { BASE_URL: '/' };
await loadGame('b2w2');
const { assignTeamItems, teamMemberKey } = await import(
  '../src/teamBuilder/item-recommendations.js',
);

function assignOne({ moveIds = [], ability = '', usage, ownedItems }) {
  const member = { inputPokemonId: 'm', pokemonId: 'm' };
  const key = teamMemberKey(member);
  const assignments = assignTeamItems({
    team: [member],
    usageByMember: new Map([[key, usage]]),
    ownedItems,
    itemContext: new Map([[key, { moveIds: new Set(moveIds), ability }]]),
  });
  return assignments[key]?.id;
}

const dampRockUsage = [{ id: 'damprock', name: 'Damp Rock', weight: 0.5 }];

test('a set without Rain Dance or Drizzle is never handed Damp Rock', () => {
  const weezing = { moveIds: ['sludgebomb', 'selfdestruct'], ability: 'levitate' };
  assert.equal(
    assignOne({
      ...weezing,
      usage: [
        ...dampRockUsage,
        { id: 'sitrusberry', name: 'Sitrus Berry', weight: 0.1 },
      ],
      ownedItems: { damprock: 1, sitrusberry: 1 },
    }),
    'sitrusberry',
  );
  // Nor as the leftover fallback.
  assert.equal(
    assignOne({ ...weezing, usage: [], ownedItems: { damprock: 1 } }),
    undefined,
  );
});

test('Rain Dance or Drizzle earns Damp Rock', () => {
  const ownedItems = { damprock: 1 };
  assert.equal(
    assignOne({ moveIds: ['raindance'], usage: dampRockUsage, ownedItems }),
    'damprock',
  );
  assert.equal(
    assignOne({ ability: 'drizzle', usage: dampRockUsage, ownedItems }),
    'damprock',
  );
});

test('before Generation 6 a weather ability does not earn the rock', () => {
  const previous = getActiveGame().id;
  setActiveGame('b2w2');
  try {
    assert.equal(
      assignOne({ ability: 'drizzle', usage: dampRockUsage,
        ownedItems: { damprock: 1 } }),
      undefined,
    );
  } finally {
    setActiveGame(previous);
  }
});

test('Light Clay needs a screen, Aurora Veil included', () => {
  const usage = [{ id: 'lightclay', name: 'Light Clay', weight: 0.5 }];
  const ownedItems = { lightclay: 1 };
  assert.equal(assignOne({ moveIds: ['auroraveil'], usage, ownedItems }),
    'lightclay');
  assert.equal(assignOne({ moveIds: ['reflect'], usage, ownedItems }),
    'lightclay');
  assert.equal(assignOne({ moveIds: ['blizzard'], usage, ownedItems }),
    undefined);
});

test('a member with no move context is not gated', () => {
  const member = { inputPokemonId: 'm', pokemonId: 'm' };
  const key = teamMemberKey(member);
  const assignments = assignTeamItems({
    team: [member],
    usageByMember: new Map([[key, dampRockUsage]]),
    ownedItems: { damprock: 1 },
    itemContext: null,
  });
  assert.equal(assignments[key]?.id, 'damprock');
});
