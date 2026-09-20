// HGSS is the first mainline game on the registry: a Gen 4 dex, real
// trades, obedience-threshold level caps, and the machines and tutors of
// HeartGold/SoulSilver alone. These pin the descriptor and the engine
// branches Reborn never exercised.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  getActiveGame,
  getGame,
  loadGame,
  setActiveGame,
} from '../src/games/registry.js';

await loadGame('hgss');

const { dex } = await import('../src/games/dex.js');
const { getCheckpoints } = await import('../src/games/schedule.js');
const { moveSources } = await import('../src/games/legality.js');
const { computeSetReadiness } = await import('../src/playthrough/set-readiness.js');
const { describeEvolutionPath, getEvolutionRequirement } = await import(
  '../src/playthrough/evolution-requirements.js',
);
const { tunable } = await import('../src/teamBuilder/scoring-constants.js');
const { readSavedState } = await import('../src/games/saved-state.js');

function withHgss(fn) {
  const previous = getActiveGame().id;
  setActiveGame('hgss');
  try {
    return fn();
  } finally {
    setActiveGame(previous);
  }
}

function legalMoves(id) {
  return JSON.parse(
    fs.readFileSync(
      path.resolve('site-data', 'data', 'hgss-legal-moves', 'all', `${id}.json`),
      'utf8',
    ),
  );
}

test('hgss is registered on the Gen 4 dex under namespaced keys', () => {
  const game = getGame('hgss');
  assert.equal(game.dexGen, 4);
  assert.equal(game.storage.progression, 'pokemon-party-picker:hgss:progression:v1');
  assert.equal(game.storage.pool, 'pokemon-party-picker:hgss:owned-pool:v1');
  assert.equal(game.data.legalMovesDir, 'hgss-legal-moves');
  withHgss(() => {
    assert.equal(dex().gen, 4);
    assert.equal(dex().types.length, 17);
    assert.ok('garchomp' in dex().progressionSpecies);
    assert.ok(!('sylveon' in dex().progressionSpecies));
  });
  assert.equal(getActiveGame().id, 'reborn');
});

test('saves made under the launch id "soulsilver" move to the hgss keys', () => {
  const store = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    key: () => null,
    length: 0,
  };
  store.set('pokemon-party-picker:soulsilver:owned-pool:v1', 'Cyndaquil');
  try {
    withHgss(() => {
      assert.equal(readSavedState('pool'), 'Cyndaquil');
      assert.equal(store.get('pokemon-party-picker:hgss:owned-pool:v1'), 'Cyndaquil');
      assert.ok(!store.has('pokemon-party-picker:soulsilver:owned-pool:v1'));
      assert.equal(readSavedState('progression'), '');
    });
  } finally {
    globalThis.localStorage = previous;
  }
});

test('the schedule is the sixteen badges with obedience-threshold caps', () => {
  withHgss(() => {
    const checkpoints = getCheckpoints();
    assert.deepEqual(
      checkpoints.map((checkpoint) => checkpoint.id),
      ['start', ...Array.from({ length: 16 }, (_, i) => `badge-${i + 1}`)],
    );
    assert.deepEqual(
      checkpoints.map((checkpoint) => checkpoint.levelCap),
      // Rising and every Kanto badge: all levels obey.
      [10, 20, 30, 30, 50, 70, 70, 70, ...Array(9).fill(100)],
    );
  });
});

test('machines are the Gen 4 TMs and the HeartGold/SoulSilver HMs with pickup timing', () => {
  withHgss(() => {
    const { tmOptions, tmxOptions, tutorOptions } = moveSources();
    assert.equal(tmOptions.length, 92);
    assert.equal(new Set(tmOptions.map((option) => option.move)).size, 92);
    // Sorted by pickup badge: the Route 36 Rock Smash first, Rock Climb last.
    assert.deepEqual(
      tmxOptions.map((option) => option.move),
      ['Rock Smash', 'Cut', 'Surf', 'Strength', 'Fly', 'Whirlpool', 'Waterfall', 'Rock Climb'],
    );
    assert.ok(!tmxOptions.some((option) => option.move === 'Defog'));
    const roost = tmOptions.find((option) => option.id === 'tm51');
    assert.equal(roost.move, 'Roost');
    assert.equal(roost.available, 'After Badge 01');
    assert.ok(tutorOptions.some((option) => option.id === 'headbutt'));
    assert.ok(!tutorOptions.some((option) => option.id === 'volttackle'));
  });
});

test('evolutions price real trades and block the methods the game lacks', () => {
  withHgss(() => {
    const species = dex().progressionSpecies;

    const gengar = getEvolutionRequirement(species.gengar);
    assert.equal(gengar.status, 'legal');
    assert.equal(gengar.method, 'trade');
    assert.equal(gengar.friction, tunable('TRADE_FRICTION'));
    assert.equal(gengar.reason, 'trade');
    assert.equal(describeEvolutionPath('haunter', 'gengar'), ' (trade)');

    const blocked = getEvolutionRequirement(species.gengar, {
      evoAccessTrading: false,
    });
    assert.equal(blocked.status, 'blocked');
    assert.match(blocked.reason, /Trading .* not yet accessible/);

    // A trade with an item prices both: the trade and the curated item.
    const scizor = getEvolutionRequirement(species.scizor);
    assert.equal(scizor.status, 'legal');
    assert.equal(scizor.method, 'trade');
    assert.match(scizor.reason, /^trade \+ Metal Coat \(Athlete Shop/);
    assert.equal(
      scizor.friction,
      tunable('TRADE_FRICTION') + tunable('ITEM_FRICTION'),
    );
    // A 48 BP Frontier price is a real grind.
    const weavile = getEvolutionRequirement(species.weavile);
    assert.equal(weavile.status, 'legal');
    assert.equal(weavile.friction, Math.round(tunable('ITEM_FRICTION') * 1.5));

    for (const [id, method] of [
      ['leafeon', /Moss Rock/],
      ['glaceon', /Ice Rock/],
      ['magnezone', /magnetic field/],
      ['milotic', /special evolution condition/],
    ]) {
      const requirement = getEvolutionRequirement(species[id]);
      assert.equal(requirement.status, 'blocked', id);
      assert.match(requirement.reason, method);
      assert.match(requirement.reason, /does not exist in HGSS/);
    }

    assert.equal(getEvolutionRequirement(species.mantine).status, 'legal');
    assert.equal(getEvolutionRequirement(species.espeon).method, 'friendship');
  });
});

test('set readiness prices HGSS machines against its own caps', () => {
  withHgss(() => {
    const readiness = computeSetReadiness({
      legalMoveData: {
        pokemonId: 'pidgey',
        moves: [{ id: 'roost', sources: { tm: true } }],
      },
      availableMoves: [],
      topSet: { moveUsage: new Map([['roost', 50]]) },
      progression: {},
    });
    assert.match(readiness.moves[0].detail, /TM\/tutor @1 badge/);
    assert.equal(readiness.fullAtCap, 20);
  });
});

test('move-evolution levels follow the HGSS level-up table', () => {
  const table = JSON.parse(
    fs.readFileSync(
      path.resolve('scripts', 'hgss', 'level-up.generated.json'),
      'utf8',
    ),
  );
  const toId = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  const moveEvolutions = withHgss(() =>
    Object.values(dex().progressionSpecies).filter(
      (species) => species.evoType === 'levelMove',
    ),
  );
  assert.equal(moveEvolutions.length, 7);
  for (const species of moveEvolutions) {
    const levels = table[species.prevoId][toId(species.evoMove)];
    assert.equal(species.evoMoveLevel, Math.min(...levels), species.id);
  }
});

test('legal-move files carry Gen 4 sources in the Reborn file shape', () => {
  const garchomp = legalMoves('garchomp');
  const byId = new Map(garchomp.moves.map((move) => [move.id, move]));
  assert.deepEqual(garchomp.types, ['Dragon', 'Ground']);
  assert.ok(byId.get('earthquake').sources.tm);
  assert.ok(byId.get('outrage').sources.tutor);
  assert.ok(byId.get('rockclimb').sources.tmx);
  assert.ok(byId.get('dragonrush').sources.levelUp.length > 0);
  // Pre-evolution level-up moves stay attributed to their learner.
  assert.ok(
    byId.get('sandstorm').sources.preEvolutionLevelUp?.some(
      (entry) => entry.from === 'gible'),
  );
  assert.ok(!byId.has('scald'));

  // Defog is a Diamond/Pearl HM, not a HGSS machine.
  const crobat = legalMoves('crobat');
  const defog = crobat.moves.find((move) => move.id === 'defog');
  assert.ok(!defog || (!defog.sources.tm && !defog.sources.tmx));

  // A form the dex gives no learnset of its own inherits its base species'
  // and gains its form-change move on taking the form.
  const rotomwash = legalMoves('rotomwash');
  assert.equal(rotomwash.learnsetPokemonId, 'rotom');
  assert.ok(rotomwash.moves.find((move) => move.id === 'hydropump').sources.evolutionMove);
  assert.ok(rotomwash.moves.find((move) => move.id === 'thunderbolt').sources.tm);

  // Level-up levels are HeartGold/SoulSilver's own, not Diamond and Pearl's:
  // a starter Cyndaquil learns Smokescreen at 6 here (the dex says 4).
  const cyndaquil = legalMoves('cyndaquil');
  assert.deepEqual(
    cyndaquil.moves.find((move) => move.id === 'smokescreen').sources.levelUp,
    [6],
  );

  // Egg moves are recorded on the base form and inherited up the line.
  const dragonite = legalMoves('dragonite');
  assert.ok(dragonite.moves.find((move) => move.id === 'extremespeed').sources.egg);

  const smeargle = legalMoves('smeargle');
  assert.ok(smeargle.moves.find((move) => move.id === 'spore').sources.sketch);
  assert.ok(!smeargle.moves.some((move) => move.id === 'chatter'));
});
