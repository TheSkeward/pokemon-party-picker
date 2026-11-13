// A game that reads its item sources from its files gates no evolution item
// by hand: an item opens at the badge its first source does, and one the
// player already owns is usable sooner. A game whose progression lists a
// field for the item goes by the field.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveGame,
  loadGame,
  setActiveGame,
} from '../src/games/registry.js';
import {
  accessFields,
  evolutionItemAccessKey,
  evolutionItemsFollowSources,
} from '../src/games/evolution.js';
import { getItemUnlockBadge } from '../src/games/items.js';
import { dex } from '../src/games/dex.js';
import {
  contestedEvolutionItems,
  getEvolutionRequirement,
} from '../src/playthrough/evolution-requirements.js';
import {
  DEFAULT_PROGRESSION,
  normalizeProgression,
} from '../src/playthrough/progression.js';
import { renderProgressionPanel } from '../src/playthrough/progression-view.js';

await loadGame('hgss');

function withGame(id, fn) {
  const previous = getActiveGame().id;
  setActiveGame(id);
  try {
    return fn();
  } finally {
    setActiveGame(previous);
  }
}

const at = (badges, rest = {}) => ({ checkpoint: `badge-${badges}`, ...rest });
const requirement = (id, access) =>
  getEvolutionRequirement(dex().progressionSpecies[id], access);

function renderPanel() {
  globalThis.localStorage = { getItem: () => null };
  try {
    return renderProgressionPanel({ ...DEFAULT_PROGRESSION });
  } finally {
    delete globalThis.localStorage;
  }
}

test('an evolution item opens at the badge its first source does', () => {
  // The Reaper Cloth's first copy is an item ball reached with ten badges.
  assert.equal(getItemUnlockBadge('reapercloth'), 10);
  const early = requirement('dusknoir', at(9));
  assert.equal(early.status, 'blocked');
  assert.match(
    early.reason, /^Reaper Cloth not yet obtainable \(a copy at badge 10/);
  assert.equal(requirement('dusknoir', at(10)).status, 'legal');

  // The item that stands in for a trade is timed the same way.
  assert.equal(getItemUnlockBadge('linkstone'), 3);
  const untraded = requirement('alakazam', at(2));
  assert.equal(untraded.status, 'blocked');
  assert.match(untraded.reason, /^Link Stone not yet obtainable/);
  assert.equal(requirement('alakazam', at(3)).status, 'legal');

  // Both items of a trade with an item must be out: the Link Stone at 3,
  // the Metal Coat at 7.
  assert.match(requirement('scizor', at(6)).reason, /^Metal Coat not yet/);
  assert.equal(requirement('scizor', at(7)).status, 'legal');
});

test('an owned item is usable before its first source', () => {
  const owned = requirement(
    'dusknoir', at(3, { ownedItems: { reapercloth: 1 } }));
  assert.equal(owned.status, 'legal');
  assert.match(owned.reason, /Reaper Cloth \(owned\)/);
  // Owning one of two items leaves the other to its badge.
  const half = requirement('scizor', at(2, { ownedItems: { metalcoat: 1 } }));
  assert.equal(half.status, 'blocked');
  assert.match(half.reason, /^Link Stone not yet/);
});

test('a copy owned before the first source is the only copy; after it, the game supplies', () => {
  const early = at(9, { ownedItems: { reapercloth: 1, linkstone: 2 } });
  assert.deepEqual(contestedEvolutionItems('dusknoir', 'dusclops', early), [
    { id: 'reapercloth', name: 'Reaper Cloth', copies: 1 },
  ]);
  const late = at(10, { ownedItems: { reapercloth: 1, linkstone: 2 } });
  assert.deepEqual(contestedEvolutionItems('dusknoir', 'dusclops', late), []);
});

test('without a badge count nothing is withheld', () => {
  assert.equal(requirement('dusknoir', {}).status, 'legal');
  assert.equal(requirement('dusknoir', null).status, 'legal');
  // The level cap stands in for the badge picker: cap 40 is three badges.
  assert.equal(requirement('alakazam', { levelCap: '35' }).status, 'blocked');
  assert.equal(requirement('alakazam', { levelCap: '40' }).status, 'legal');
});

test('Reborn lists no field for an evolution item, and says so', () => {
  assert.equal(evolutionItemsFollowSources(), true);
  for (const item of ['Fire Stone', 'Metal Coat', 'Link Stone']) {
    assert.equal(evolutionItemAccessKey(item), null, item);
  }
  assert.ok(!accessFields().some((field) => field.item));
  const html = renderPanel();
  assert.doesNotMatch(html, /data-progression-field="evoAccess\w*Stone"/);
  assert.doesNotMatch(html, /data-progression-field="evoAccessOtherEvoItems"/);
  assert.match(
    html,
    /Evolution items \(a stone, the Link Stone, a Metal Coat\) have no box here/);
  // A box an old save unticked is dropped with the field.
  const saved = normalizeProgression({
    evoAccessMoonStone: false,
    evoAccessOtherEvoItems: false,
    evoAccessLinkStone: false,
    evoAccessStones: false,
    evoAccessMossyRock: false,
  });
  assert.equal(saved.evoAccessMoonStone, undefined);
  assert.equal(saved.evoAccessOtherEvoItems, undefined);
  assert.equal(saved.evoAccessLinkStone, undefined);
  assert.equal(saved.evoAccessStones, undefined);
  assert.equal(saved.evoAccessMossyRock, false);
});

test('a game with item fields still goes by them', () => {
  withGame('hgss', () => {
    assert.equal(evolutionItemsFollowSources(), false);
    assert.equal(evolutionItemAccessKey('Moon Stone'), 'evoAccessMoonStone');
    assert.equal(
      evolutionItemAccessKey('Metal Coat'), 'evoAccessOtherEvoItems');
    const html = renderPanel();
    assert.match(html, /data-progression-field="evoAccessMoonStone"/);
    assert.doesNotMatch(html, /have no box here/);

    // The box, not the badge count, withholds the stone; a copy in the bag
    // is then the only copy.
    assert.equal(requirement('clefable', { levelCap: '10' }).status, 'legal');
    const closed = { evoAccessMoonStone: false };
    const blocked = requirement('clefable', closed);
    assert.equal(blocked.status, 'blocked');
    assert.match(blocked.reason, /^Moon Stone not yet accessible/);
    const owned = { ...closed, ownedItems: { moonstone: 2 } };
    assert.equal(requirement('clefable', owned).status, 'legal');
    assert.deepEqual(contestedEvolutionItems('clefable', 'clefairy', owned), [
      { id: 'moonstone', name: 'Moon Stone', copies: 2 },
    ]);
  });
});
