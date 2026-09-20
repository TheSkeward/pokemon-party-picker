// The engine's Reborn-only move mechanics (Common Candy level-downs, the
// Hidden Power Type Changer) are descriptor flags. A mainline game without
// them must neither offer the routes nor pretend the flags exist.
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getActiveGame,
  loadGame,
  setActiveGame,
} from '../src/games/registry.js';

await loadGame('hgss');

const { getAvailableMoves } = await import('../src/playthrough/legal-moves.js');
const { normalizeProgression } = await import('../src/playthrough/progression.js');
const { computeSetReadiness } = await import('../src/playthrough/set-readiness.js');
const { mechanics, moveSources } = await import('../src/games/legality.js');

function withGame(id, fn) {
  const previous = getActiveGame().id;
  setActiveGame(id);
  try {
    return fn();
  } finally {
    setActiveGame(previous);
  }
}

const source = (overrides) => ({
  levelUp: [], tm: false, tmx: false, tutor: false, egg: false, ...overrides,
});
// Staraptor arrives at 34 in both games; an own level-20 entry sits below
// that, so leveling never passes through it.
const STARAPTOR = {
  pokemonId: 'staraptor',
  moves: [{ id: 'closecombat', sources: source({ levelUp: [20] }) }],
};
const JOLTEON = {
  pokemonId: 'jolteon',
  moves: [{ id: 'hiddenpower', sources: source({ tm: true }) }],
};
const closeCombat = (progression) =>
  getAvailableMoves(STARAPTOR, progression).find(
    (move) => move.id === 'closecombat',
  );
const hiddenPowers = (progression) =>
  getAvailableMoves(JOLTEON, progression).filter((move) =>
    move.id.startsWith('hiddenpower'),
  );

test('a below-arrival level-up is a candy-down route only where levels can be lowered', () => {
  assert.equal(mechanics().levelDown, true);
  assert.equal(closeCombat({ levelCap: '50' }).availableSources[0].candyDown, true);

  withGame('hgss', () => {
    assert.equal(mechanics().levelDown, false);
    const locked = closeCombat({ levelCap: '50' });
    assert.ok(!locked || locked.availableSources.length === 0);
    // The relearner still teaches an own-learnset entry, candy or not.
    const relearned = closeCombat({ levelCap: '50', moveRelearnerUnlocked: true });
    assert.deepEqual(
      relearned.availableSources.map((entry) => entry.kind),
      ['relearner'],
    );
  });
});

test('Hidden Power is plannable only through a Type Changer', () => {
  // TM10 is Hidden Power in both games.
  const progression = {
    levelCap: '50',
    availableTmIds: ['tm10'],
    hiddenPowerTypeChangerUnlocked: true,
  };
  const tm10 = () => moveSources().tmOptions.find((o) => o.id === 'tm10').move;
  const changerFlag = () =>
    normalizeProgression(progression).hiddenPowerTypeChangerUnlocked;
  assert.equal(tm10(), 'Hidden Power');
  assert.equal(hiddenPowers(progression).length, 16);
  assert.equal(changerFlag(), true);

  withGame('hgss', () => {
    assert.equal(tm10(), 'Hidden Power');
    assert.equal(hiddenPowers(progression).length, 0);
    assert.equal(changerFlag(), false);

    const readiness = computeSetReadiness({
      legalMoveData: JOLTEON,
      availableMoves: [],
      topSet: { moveUsage: new Map([['hiddenpower', 60]]) },
      progression: {},
    });
    assert.equal(readiness.moves[0].status, 'blocked');
    assert.match(readiness.moves[0].detail, /IVs .*HGSS/);
  });
});

test('a single-use TM is one copy until a shop sells it', () => {
  // TM30 is Shadow Ball in both games: Morty's prize in HGSS, sold by the
  // Battle Frontier once the Champion is beaten.
  const GENGAR = {
    pokemonId: 'gengar',
    moves: [{ id: 'shadowball', sources: source({ tm: true }) }],
  };
  const tmSource = (checkpoint) =>
    getAvailableMoves(GENGAR, {
      levelCap: '100',
      checkpoint,
      availableTmIds: ['tm30'],
    })
      .find((move) => move.id === 'shadowball')
      .availableSources.find((entry) => entry.kind === 'tm');
  assert.equal(tmSource('badge-4').singleCopy, false);
  withGame('hgss', () => {
    assert.equal(tmSource('badge-4').machineId, 'tm30');
    assert.equal(tmSource('badge-4').singleCopy, true);
    assert.equal(tmSource('champion').singleCopy, false);
    assert.equal(tmSource('').singleCopy, false); // no cap: every shop open
  });
});

test('each game names its HM-like machines', () => {
  assert.equal(moveSources().tmxLabel, 'TMX');
  withGame('hgss', () => assert.equal(moveSources().tmxLabel, 'HM'));
});
