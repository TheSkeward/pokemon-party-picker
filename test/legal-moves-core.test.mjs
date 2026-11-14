// The rules every legal-move builder shares (scripts/legal-moves): how a
// Pokémon's sources for a move are collected and written, how its line is
// walked, and, for the games on the Essentials engine, what a learnset
// grants. Three builders each carried a copy of these; the generated files
// were the only check that the copies agreed.
import assert from 'node:assert/strict';
import test from 'node:test';

import { Dex } from '@pkmn/dex';

import {
  createSourceTable, preEvolutionIds,
} from '../scripts/legal-moves/core.mjs';
import {
  addLearnsetSources, levelOneRelistIds, sketchUniverse,
} from '../scripts/legal-moves/essentials.mjs';

const dex = Dex.forGen(7);
const learnset = (overrides = {}) => ({
  levelUp: [], evolutionMoves: [], eggMoves: [], compatibleMoves: [],
  ...overrides,
});
const NONE = new Set();

// The sources a learnset yields, by move id.
function sourcesOf(params) {
  const table = createSourceTable();
  addLearnsetSources(table, {
    pokemonId: 'bibarel',
    learnset: learnset(),
    preEvolutions: [],
    machines: { tm: NONE, tmx: NONE, tutor: NONE },
    universalTms: NONE,
    noUniversalTms: NONE,
    sketchable: NONE,
    ...params,
  });
  return Object.fromEntries(
    table.moves(dex).map((move) => [move.id, move.sources]));
}

test('a move\'s sources are written in one shape, by move id', () => {
  const table = createSourceTable();
  table.get('tackle').levelUp.push(7, 1, 7);
  table.get('surf').tmx = true;
  table.get('aquajet').evolutionMove = true;
  table.get('notamove').tm = true;
  table.inheritLevelUp('superfang', 33, 'bidoof');
  table.inheritLevelUp('superfang', 33, 'bidoof');
  table.inheritLevelUp('superfang', 5, 'bidoof');
  assert.deepEqual(table.moves(dex), [
    {
      id: 'aquajet',
      sources: {
        levelUp: [], tm: false, tmx: false, tutor: false, egg: false,
        evolutionMove: true,
      },
    },
    // Only a pre-evolution learns it: still a move of this Pokémon, with
    // each level once and the form it comes from.
    {
      id: 'superfang',
      sources: {
        levelUp: [], tm: false, tmx: false, tutor: false, egg: false,
        preEvolutionLevelUp: [
          { level: 5, from: 'bidoof' }, { level: 33, from: 'bidoof' },
        ],
      },
    },
    {
      id: 'surf',
      sources: {
        levelUp: [], tm: false, tmx: true, tutor: false, egg: false,
      },
    },
    // Levels once each, lowest first. A move the dex does not know is
    // dropped.
    {
      id: 'tackle',
      sources: {
        levelUp: [1, 7], tm: false, tmx: false, tutor: false, egg: false,
      },
    },
  ]);
});

test('a line is walked from the base species, nearest ancestor first', () => {
  const line = (id, options) =>
    preEvolutionIds(Dex.forGen(9), Dex.forGen(9).species.get(id), options);
  assert.deepEqual(line('charizard'), ['charmeleon', 'charmander']);
  assert.deepEqual(line('charmander'), []);
  // A Mega inherits what its line learns.
  assert.deepEqual(line('charizardmegax'), ['charmeleon', 'charmander']);
  // A regional form walks the original line unless asked for its own.
  assert.deepEqual(line('persianalola'), ['meowth']);
  assert.deepEqual(
    line('persianalola', { ownPrevoFirst: true }), ['meowthalola']);
  assert.deepEqual(line('notaspecies'), []);
});

test('a level-1 block past four entries is the relearner\'s list', () => {
  const block = (...moves) => moves.map((move) => [1, move]);
  assert.deepEqual(
    levelOneRelistIds(learnset({ levelUp: block('a', 'b', 'c', 'd') })),
    new Set());
  // All but the last four, which are the moves known at level 1; a level-0
  // entry is in the block too. The evolution move is granted on evolving.
  assert.deepEqual(
    levelOneRelistIds(learnset({
      levelUp: [[0, 'evo'], ...block('a', 'b', 'c', 'd', 'e'), [5, 'f']],
      evolutionMoves: ['evo'],
    })),
    new Set(['a']));
});

test('a relist is flagged for the relearner, not listed at level 1', () => {
  const sources = sourcesOf({
    learnset: learnset({
      levelUp: [
        [1, 'tackle'], [1, 'growl'], [1, 'watergun'], [1, 'bite'],
        [1, 'headbutt'], [9, 'tackle'],
      ],
    }),
  });
  // Relisted at 1 and learned again at 9: the real level stands.
  assert.deepEqual(sources.tackle.levelUp, [9]);
  assert.equal(sources.tackle.levelOneRelist, true);
  assert.deepEqual(sources.growl.levelUp, [1]);
  assert.equal(sources.growl.levelOneRelist, undefined);
});

test('a machine teaches what the game hands out and the species can learn', () => {
  const machines = {
    tm: new Set(['toxic', 'protect', 'thunderbolt']),
    tmx: new Set(['surf']),
    tutor: new Set(['superfang', 'icepunch']),
  };
  const withPool = learnset({
    levelUp: [[1, 'tackle'], [5, 'growl'], [9, 'watergun']],
    compatibleMoves: ['toxic', 'surf', 'superfang', 'earthquake'],
  });
  const shared = { machines, universalTms: new Set(['protect']) };

  const listed = sourcesOf({ ...shared, learnset: withPool });
  assert.equal(listed.toxic.tm, true);
  assert.equal(listed.surf.tmx, true);
  assert.equal(listed.superfang.tutor, true);
  // On its list, but the game has no such machine.
  assert.equal(listed.earthquake, undefined);
  // A machine it is not listed for.
  assert.equal(listed.thunderbolt, undefined);
  assert.equal(listed.icepunch, undefined);
  // A universal TM goes to anything with a real movepool…
  assert.equal(listed.protect.tm, true);
  // …unless the species is named as an exception, or knows two moves.
  assert.equal(
    sourcesOf({
      ...shared, learnset: withPool, noUniversalTms: new Set(['bibarel']),
    }).protect,
    undefined);
  assert.equal(
    sourcesOf({
      ...shared,
      learnset: learnset({ levelUp: [[1, 'tackle'], [1, 'growl']] }),
    }).protect,
    undefined);

  // Mew learns every machine and tutor move.
  const mew = sourcesOf({ ...shared, pokemonId: 'mew' });
  assert.deepEqual(
    Object.keys(mew).sort(),
    ['icepunch', 'protect', 'superfang', 'surf', 'thunderbolt', 'toxic']);
});

test('a line passes down its egg moves and its level-up moves', () => {
  const sources = sourcesOf({
    learnset: learnset({
      levelUp: [[1, 'tackle']], evolutionMoves: ['aquajet'],
      eggMoves: ['aquatail'], relearnerMoves: ['rollout'],
    }),
    preEvolutions: [{
      id: 'bidoof',
      learnset: learnset({
        levelUp: [
          [1, 'tackle'], [1, 'growl'], [1, 'defensecurl'], [1, 'rollout'],
          [1, 'headbutt'], [33, 'superfang'],
        ],
        eggMoves: ['quickattack'],
      }),
    }],
  });
  assert.equal(sources.aquajet.evolutionMove, true);
  assert.equal(sources.aquatail.egg, true);
  assert.equal(sources.quickattack.egg, true);
  assert.equal(sources.rollout.rebornRelearner, true);
  assert.deepEqual(
    sources.superfang.preEvolutionLevelUp, [{ level: 33, from: 'bidoof' }]);
  // The pre-evolution's own relist is the relearner's on this line too,
  // and is not inherited as a level-1 move.
  assert.equal(sources.tackle.levelOneRelist, true);
  assert.deepEqual(sources.tackle.levelUp, [1]);
  assert.equal(sources.tackle.preEvolutionLevelUp, undefined);
  assert.deepEqual(
    sources.growl.preEvolutionLevelUp, [{ level: 1, from: 'bidoof' }]);
});

test('Smeargle may Sketch every move in the game but two', () => {
  const universe = sketchUniverse(
    [
      learnset({
        levelUp: [[1, 'tackle']], evolutionMoves: ['aquajet'],
        eggMoves: ['aquatail'], relearnerMoves: ['rollout'],
        compatibleMoves: ['surf', 'chatter'],
      }),
      learnset({ levelUp: [[1, 'struggle'], [1, 'sketch']] }),
    ],
    ['toxic'],
  );
  assert.deepEqual(
    [...universe].sort(),
    ['aquajet', 'aquatail', 'rollout', 'sketch', 'surf', 'tackle', 'toxic']);

  const sketching = (pokemonId) => sourcesOf({
    pokemonId, sketchable: new Set(['surf', 'tackle']),
  });
  assert.equal(sketching('smeargle').surf.sketch, true);
  assert.deepEqual(sketching('bibarel'), {});
});
