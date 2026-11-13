// In a game whose progression has no field for an evolution item, an
// evolution spends the item from the held-item list: a copy pays for one
// evolution, six or more for any number, and an item not on the list pays
// for none, whatever the badge. A game whose progression lists a field for
// the item goes by the field.
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
  evolutionItemsSpentFromList,
} from '../src/games/evolution.js';
import { dex } from '../src/games/dex.js';
import {
  contestedEvolutionItems,
  getEvolutionRequirement,
} from '../src/playthrough/evolution-requirements.js';
import {
  DEFAULT_PROGRESSION,
  MAX_TRACKED_ITEM_COUNT,
  normalizeProgression,
} from '../src/playthrough/progression.js';
import { renderProgressionPanel } from '../src/playthrough/progression-view.js';
import { progressionAt } from './helpers/harness.mjs';

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

const holding = (ownedItems, rest = {}) => ({ ownedItems, ...rest });
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

test('the count on the held-item list is how many evolutions an item pays for', () => {
  // Two Thunder Stones: Raichu is legal, and the two are the limit.
  const two = holding({ thunderstone: 2 });
  const raichu = requirement('raichu', two);
  assert.equal(raichu.status, 'legal');
  assert.match(raichu.reason, /Thunder Stone \(owned\)/);
  assert.deepEqual(contestedEvolutionItems('raichu', 'pikachu', two), [
    { id: 'thunderstone', name: 'Thunder Stone', copies: 2 },
  ]);

  // Six or more is plenty: nothing to share out.
  const plenty = holding({ thunderstone: MAX_TRACKED_ITEM_COUNT });
  assert.equal(requirement('raichu', plenty).status, 'legal');
  assert.deepEqual(contestedEvolutionItems('raichu', 'pikachu', plenty), []);

  // None on the list: blocked, with where a copy comes from.
  const none = requirement('raichu', holding({}));
  assert.equal(none.status, 'blocked');
  assert.match(
    none.reason,
    /^Thunder Stone: none among your held items \(a copy at badge 2/);
  assert.deepEqual(
    contestedEvolutionItems('raichu', 'pikachu', holding({})), []);
});

test('a badge opens no item: only the list does', () => {
  // The first Reaper Cloth is reached with ten badges, and a shop sells it
  // from sixteen. Neither puts one on the list.
  for (const badges of [9, 10, 17]) {
    const dusknoir = requirement(
      'dusknoir', holding({ linkstone: 6 }, { checkpoint: `badge-${badges}` }));
    assert.equal(dusknoir.status, 'blocked', `badge ${badges}`);
    assert.match(dusknoir.reason, /^Reaper Cloth: none among your held items/);
  }
  // A copy found sooner than the game data has it is still a copy.
  const early = requirement('dusknoir', holding(
    { linkstone: 1, reapercloth: 1 }, { checkpoint: 'badge-3' }));
  assert.equal(early.status, 'legal');
});

test('every item an evolution spends must be on the list', () => {
  // Scizor spends the Link Stone and a Metal Coat.
  const half = requirement('scizor', holding({ linkstone: 1 }));
  assert.equal(half.status, 'blocked');
  assert.match(half.reason, /^Metal Coat: none among your held items/);
  const both = holding({ linkstone: 1, metalcoat: 1 });
  assert.equal(requirement('scizor', both).status, 'legal');
  assert.deepEqual(
    contestedEvolutionItems('scizor', 'scyther', both).map((item) => item.id),
    ['linkstone', 'metalcoat']);
});

test('a progression that keeps no item list withholds nothing', () => {
  assert.equal(requirement('dusknoir', {}).status, 'legal');
  assert.equal(requirement('dusknoir', null).status, 'legal');
  assert.equal(requirement('dusknoir', { levelCap: '20' }).status, 'legal');
});

test('the test player holds the evolution items handed out by its badge', () => {
  // What the list holds once it is set to the expected counts, so the
  // suites plan with what a player at that badge can have.
  assert.deepEqual(progressionAt({ badge: 0 }).ownedItems, {});
  const three = progressionAt({ badge: 3, levelCap: 40 }).ownedItems;
  assert.equal(three.linkstone, 2);
  assert.equal(three.thunderstone, 2);
  assert.equal(three.reapercloth, undefined);
  // Only items an evolution spends: no Leftovers, no Berries.
  assert.ok(!('leftovers' in progressionAt({ badge: 17 }).ownedItems));
  assert.equal(
    progressionAt({ badge: 17 }).ownedItems.reapercloth,
    MAX_TRACKED_ITEM_COUNT);
});

test('Reborn lists no field for an evolution item, and says so', () => {
  assert.equal(evolutionItemsSpentFromList(), true);
  for (const item of ['Fire Stone', 'Metal Coat', 'Link Stone']) {
    assert.equal(evolutionItemAccessKey(item), null, item);
  }
  assert.ok(!accessFields().some((field) => field.item));
  const html = renderPanel();
  assert.doesNotMatch(html, /data-progression-field="evoAccess\w*Stone"/);
  assert.doesNotMatch(html, /data-progression-field="evoAccessOtherEvoItems"/);
  assert.match(
    html,
    /Evolution items \(a stone, the Link Stone, a Metal Coat\) have no box here\. An evolution spends one from your held items owned/);
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
    assert.equal(evolutionItemsSpentFromList(), false);
    assert.equal(evolutionItemAccessKey('Moon Stone'), 'evoAccessMoonStone');
    assert.equal(
      evolutionItemAccessKey('Metal Coat'), 'evoAccessOtherEvoItems');
    const html = renderPanel();
    assert.match(html, /data-progression-field="evoAccessMoonStone"/);
    assert.doesNotMatch(html, /have no box here/);

    // An open box supplies the stone, list or no list; a closed one leaves
    // the copies in the bag.
    assert.equal(requirement('clefable', holding({})).status, 'legal');
    const closed = holding({}, { evoAccessMoonStone: false });
    const blocked = requirement('clefable', closed);
    assert.equal(blocked.status, 'blocked');
    assert.match(blocked.reason, /^Moon Stone not yet accessible/);
    const owned = holding({ moonstone: 2 }, { evoAccessMoonStone: false });
    assert.equal(requirement('clefable', owned).status, 'legal');
    assert.deepEqual(contestedEvolutionItems('clefable', 'clefairy', owned), [
      { id: 'moonstone', name: 'Moon Stone', copies: 2 },
    ]);
  });
});
