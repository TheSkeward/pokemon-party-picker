// Usage-data families come from the availability index and each activates
// the game that claims it; the species index narrows to that game's dex.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gameForFamily,
  getActiveGame,
  setActiveGame,
  setActiveGameForFamily,
} from '../src/games/registry.js';
import {
  filterToActiveGame,
  getDefaultBrowserFormat,
  listFamilies,
} from '../src/data.js';

const AVAILABILITY = {
  familyConfigs: {
    singles: { label: 'Singles', gen: 7, defaultBrowserFormat: 'gen7anythinggoes' },
    doubles: { label: 'Doubles', gen: 7, defaultBrowserFormat: 'gen7doublesou' },
    gen4singles: { label: 'Gen 4 Singles', gen: 4, defaultBrowserFormat: 'gen4ou' },
  },
};

test('every published family is claimed by exactly one game', () => {
  assert.deepEqual(
    listFamilies(AVAILABILITY).map((family) => [family.id, family.label]),
    [['singles', 'Singles'], ['doubles', 'Doubles'], ['gen4singles', 'Gen 4 Singles']],
  );
  assert.equal(gameForFamily('singles').id, 'reborn');
  assert.equal(gameForFamily('doubles').id, 'reborn');
  assert.equal(gameForFamily('gen4singles').id, 'soulsilver');
  assert.equal(gameForFamily('gen9ou'), null);
  assert.equal(getDefaultBrowserFormat(AVAILABILITY, 'gen4singles'), 'gen4ou');
  assert.equal(getDefaultBrowserFormat(AVAILABILITY, 'gen9ou'), '');
});

test('selecting a family activates its game; an unclaimed family keeps the current one', () => {
  try {
    assert.equal(setActiveGameForFamily('gen4singles').id, 'soulsilver');
    assert.equal(getActiveGame().id, 'soulsilver');
    assert.equal(setActiveGameForFamily('gen9ou').id, 'soulsilver');
    assert.equal(setActiveGameForFamily('singles').id, 'reborn');
  } finally {
    setActiveGame('reborn');
  }
});

test('the species index narrows to the active game and stays whole for Reborn', () => {
  const index = [
    { id: 'garchomp', name: 'Garchomp' },
    { id: 'sylveon', name: 'Sylveon' },
    { id: 'rotomwash', name: 'Rotom-Wash' },
    { id: 'charizardmegax', name: 'Charizard-Mega-X' },
  ];
  assert.deepEqual(filterToActiveGame(index), index);
  try {
    setActiveGame('soulsilver');
    assert.deepEqual(
      filterToActiveGame(index).map((entry) => entry.id),
      ['garchomp', 'rotomwash'],
    );
  } finally {
    setActiveGame('reborn');
  }
});
