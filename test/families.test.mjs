// Usage-data families come from the availability index and each activates
// the game that claims it; the species index narrows to that game's dex.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  activateGameForFamily,
  gameForFamily,
  getActiveGame,
  orderFamilies,
  loadGame,
  setActiveGame,
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
  assert.equal(gameForFamily('gen4singles').id, 'hgss');
  assert.equal(gameForFamily('gen9ou'), null);
  assert.equal(getDefaultBrowserFormat(AVAILABILITY, 'gen4singles'), 'gen4ou');
  assert.equal(getDefaultBrowserFormat(AVAILABILITY, 'gen9ou'), '');
});

test('selecting a family loads and activates its game; an unclaimed family keeps the current one', async () => {
  try {
    assert.equal((await activateGameForFamily('gen4singles')).id, 'hgss');
    assert.equal(getActiveGame().id, 'hgss');
    assert.equal((await activateGameForFamily('gen9ou')).id, 'hgss');
    assert.equal((await activateGameForFamily('singles')).id, 'reborn');
  } finally {
    setActiveGame('reborn');
  }
});

test('the species index narrows to the active game and stays whole for Reborn', async () => {
  await loadGame('hgss');
  const index = [
    { id: 'garchomp', name: 'Garchomp' },
    { id: 'sylveon', name: 'Sylveon' },
    { id: 'rotomwash', name: 'Rotom-Wash' },
    { id: 'charizardmegax', name: 'Charizard-Mega-X' },
  ];
  assert.deepEqual(filterToActiveGame(index), index);
  try {
    setActiveGame('hgss');
    assert.deepEqual(
      filterToActiveGame(index).map((entry) => entry.id),
      ['garchomp', 'rotomwash'],
    );
  } finally {
    setActiveGame('reborn');
  }
});

test('families display in generation order, each game\x27s together', () => {
  const published = [
    { id: 'singles' }, { id: 'doubles' }, { id: 'gen4singles' },
    { id: 'gen9ou' }, { id: 'gen5doubles' }, { id: 'gen5singles' },
    { id: 'gen4doubles' },
  ];
  assert.deepEqual(
    orderFamilies(published).map((family) => family.id),
    [
      'gen4singles', 'gen4doubles', 'gen5singles', 'gen5doubles',
      'singles', 'doubles', 'gen9ou',
    ],
  );
});
