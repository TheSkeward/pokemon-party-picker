// SoulSilver is the first mainline game on the registry: a Gen 4 dex, real
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
  setActiveGame,
} from '../src/games/registry.js';

const { dex } = await import('../src/games/dex.js');
const { getCheckpoints } = await import('../src/games/schedule.js');
const { moveSources } = await import('../src/games/legality.js');
const { computeSetReadiness } = await import('../src/reborn/set-readiness.js');
const { describeEvolutionPath, getEvolutionRequirement } = await import(
  '../src/reborn/evolution-requirements.js',
);
const { tunable } = await import('../src/teamBuilder/scoring-constants.js');

function withSoulSilver(fn) {
  const previous = getActiveGame().id;
  setActiveGame('soulsilver');
  try {
    return fn();
  } finally {
    setActiveGame(previous);
  }
}

function legalMoves(id) {
  return JSON.parse(
    fs.readFileSync(
      path.resolve('site-data', 'data', 'soulsilver-legal-moves', 'all', `${id}.json`),
      'utf8',
    ),
  );
}

test('soulsilver is registered on the Gen 4 dex under namespaced keys', () => {
  const game = getGame('soulsilver');
  assert.equal(game.dexGen, 4);
  assert.equal(game.storage.progression, 'pokemon-party-picker:soulsilver:progression:v1');
  assert.equal(game.storage.pool, 'pokemon-party-picker:soulsilver:owned-pool:v1');
  assert.equal(game.data.legalMovesDir, 'soulsilver-legal-moves');
  withSoulSilver(() => {
    assert.equal(dex().gen, 4);
    assert.equal(dex().types.length, 17);
    assert.ok('garchomp' in dex().progressionSpecies);
    assert.ok(!('sylveon' in dex().progressionSpecies));
  });
  assert.equal(getActiveGame().id, 'reborn');
});

test('the schedule is the sixteen badges with obedience-threshold caps', () => {
  withSoulSilver(() => {
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
  withSoulSilver(() => {
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
  withSoulSilver(() => {
    const species = dex().progressionSpecies;

    const gengar = getEvolutionRequirement(species.gengar);
    assert.equal(gengar.status, 'legal');
    assert.equal(gengar.method, 'trade');
    assert.equal(gengar.friction, tunable('TRADE_FRICTION'));
    assert.match(gengar.reason, /trade evolution/);
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
    assert.match(scizor.reason, /trade evolution.*Metal Coat \(farmable: Athlete Shop/);
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
      assert.match(requirement.reason, /does not exist in SoulSilver/);
    }

    assert.equal(getEvolutionRequirement(species.mantine).status, 'legal');
    assert.equal(getEvolutionRequirement(species.espeon).method, 'friendship');
  });
});

test('set readiness prices SoulSilver machines against its own caps', () => {
  withSoulSilver(() => {
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

  // Defog is a Diamond/Pearl HM, not a SoulSilver machine.
  const crobat = legalMoves('crobat');
  const defog = crobat.moves.find((move) => move.id === 'defog');
  assert.ok(!defog || (!defog.sources.tm && !defog.sources.tmx));

  // A form the dex gives no learnset of its own inherits its base species'
  // and gains its form-change move on taking the form.
  const rotomwash = legalMoves('rotomwash');
  assert.equal(rotomwash.learnsetPokemonId, 'rotom');
  assert.ok(rotomwash.moves.find((move) => move.id === 'hydropump').sources.evolutionMove);
  assert.ok(rotomwash.moves.find((move) => move.id === 'thunderbolt').sources.tm);

  // Egg moves are recorded on the base form and inherited up the line.
  const dragonite = legalMoves('dragonite');
  assert.ok(dragonite.moves.find((move) => move.id === 'extremespeed').sources.egg);

  const smeargle = legalMoves('smeargle');
  assert.ok(smeargle.moves.find((move) => move.id === 'spore').sources.sketch);
  assert.ok(!smeargle.moves.some((move) => move.id === 'chatter'));
});
