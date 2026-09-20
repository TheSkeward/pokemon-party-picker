// Black 2 and White 2 is the second mainline game on the registry: a Gen 5
// dex, reusable machines, the four shard tutors, the obedience caps, and a
// postgame that opens half of Unova. These pin the descriptor, its curated
// tables, and the data built from the B2W2 level-up lists.
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

await loadGame('b2w2');

const { dex } = await import('../src/games/dex.js');
const { getCheckpoints, getItemUnlockBadge } = await import(
  '../src/games/schedule.js',
);
const { loadSavedProgression } = await import('../src/playthrough/progression.js');
const { mechanics, moveSources } = await import('../src/games/legality.js');
const { getEvolutionRequirement } = await import(
  '../src/playthrough/evolution-requirements.js',
);
const { getRenewablyObtainableItems } = await import('../src/games/items.js');
const { toId } = await import('../src/utils/ids.js');
const {
  B2W2_EVOLUTION_ITEM_AVAILABILITY,
  B2W2_EXTRA_INVENTORY_ITEMS,
  B2W2_ITEM_UNLOCK_BADGES,
  B2W2_SHOP_ITEM_BADGES,
} = await import('../src/b2w2/items.js');
const { B2W2_PROGRESSION_CHECKPOINTS } = await import('../src/b2w2/schedule.js');
const { GEN5_PROGRESSION_SPECIES } = await import(
  '../src/generated/gen5ProgressionSpecies.generated.js',
);
const { GEN5_HELD_ITEMS_BY_ID } = await import(
  '../src/generated/gen5HeldItems.generated.js',
);
const { GEN7_HELD_ITEMS_BY_ID } = await import(
  '../src/generated/gen7HeldItems.generated.js',
);

function withB2w2(fn) {
  const previous = getActiveGame().id;
  setActiveGame('b2w2');
  try {
    return fn();
  } finally {
    setActiveGame(previous);
  }
}

function legalMoves(id) {
  return JSON.parse(
    fs.readFileSync(
      path.resolve('site-data', 'data', 'b2w2-legal-moves', 'all', `${id}.json`),
      'utf8',
    ),
  );
}

const levelUpTable = JSON.parse(
  fs.readFileSync(
    path.resolve('scripts', 'b2w2', 'level-up.generated.json'),
    'utf8',
  ),
);

test('b2w2 is registered on the Gen 5 dex under namespaced keys', () => {
  const game = getGame('b2w2');
  assert.equal(game.dexGen, 5);
  assert.deepEqual(game.families, ['gen5singles']);
  assert.equal(game.storage.progression, 'pokemon-party-picker:b2w2:progression:v1');
  assert.equal(game.storage.pool, 'pokemon-party-picker:b2w2:owned-pool:v1');
  assert.equal(game.data.legalMovesDir, 'b2w2-legal-moves');
  withB2w2(() => {
    assert.equal(dex().gen, 5);
    assert.equal(dex().types.length, 17);
    assert.ok('haxorus' in dex().progressionSpecies);
    assert.ok(!('greninja' in dex().progressionSpecies));
  });
});

test('the schedule is the eight badges and the Champion, with obedience caps', () => {
  withB2w2(() => {
    const checkpoints = getCheckpoints();
    assert.deepEqual(
      checkpoints.map((checkpoint) => checkpoint.levelCap),
      [10, 20, 30, 40, 50, 60, 70, 80, 100, 100],
    );
    const champion = checkpoints.find((checkpoint) => checkpoint.id === 'champion');
    assert.equal(champion.badges, 8);
    assert.equal(champion.postgame, 1);
    // The Day Care is on Route 3, behind the Champion; the Move Reminder
    // is at the PWT.
    assert.ok(champion.unlocks.flags.includes('daycareUnlocked'));
    assert.ok(
      checkpoints.find((checkpoint) => checkpoint.id === 'badge-5')
        .unlocks.flags.includes('moveRelearnerUnlocked'),
    );
  });
});

test('a playthrough with no save starts at the first checkpoint', () => {
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: () => null,
    setItem() {},
    removeItem() {},
    key: () => null,
    length: 0,
  };
  try {
    withB2w2(() => {
      const progression = loadSavedProgression();
      assert.equal(progression.checkpoint, 'start');
      assert.equal(progression.levelCap, '10');
    });
  } finally {
    globalThis.localStorage = previous;
  }
});

test('machines are the Gen 5 TMs and the B2W2 HMs, reusable, with pickup timing', () => {
  withB2w2(() => {
    const { tmOptions, tmxOptions, tutorOptions } = moveSources();
    assert.equal(tmOptions.length, 95);
    assert.equal(new Set(tmOptions.map((option) => option.move)).size, 95);
    assert.deepEqual(
      tmxOptions.map((option) => option.move),
      ['Cut', 'Strength', 'Fly', 'Surf', 'Dive', 'Waterfall'],
    );
    const byId = new Map(tmOptions.map((option) => [option.id, option]));
    assert.equal(byId.get('tm27').move, 'Return');
    assert.equal(byId.get('tm27').available, 'From the start');
    assert.equal(byId.get('tm55').available, 'After Badge 08');
    assert.equal(byId.get('tm89').available, 'After the Champion (Badge 08)');
    assert.equal(byId.get('tm26').location, 'Route 15');
    // Generation V TMs are reusable: no copy timing anywhere.
    assert.equal(mechanics().reusableTms, true);
    assert.ok(tmOptions.every((option) => option.renewableFrom === undefined));
    assert.ok(tutorOptions.some((option) => option.id === 'drainpunch'));
    assert.ok(tutorOptions.some((option) => option.id === 'stealthrock'));
    assert.ok(!tutorOptions.some((option) => option.id === 'relicsong'));
  });
});

test('evolutions price real trades and keep every location evolution', () => {
  const game = getGame('b2w2');
  assert.equal(game.evolution.tradeItem, null);
  assert.ok(!game.evolution.unavailableAccessKeys.has('evoAccessMagneticField'));
  withB2w2(() => {
    const species = dex().progressionSpecies;
    // Feebas evolves by trade holding a Prism Scale here, not by Beauty.
    assert.equal(toId(species.milotic.evoItem), 'prismscale');
    const milotic = getEvolutionRequirement(species.milotic);
    assert.equal(milotic.status, 'legal');
    assert.equal(milotic.method, 'trade');
    const blocked = getEvolutionRequirement(species.milotic, {
      evoAccessTrading: false,
    });
    assert.equal(blocked.status, 'blocked');
    // Unova has the location evolutions HGSS lacked.
    for (const id of ['leafeon', 'glaceon', 'magnezone']) {
      assert.equal(getEvolutionRequirement(species[id]).status, 'legal', id);
    }
  });
});

test('level-up levels are Black 2 and White 2 own, not Black and White', () => {
  // Riolu's page lists both games; Feint moved from 15 to 11 in B2W2.
  assert.deepEqual(levelUpTable.riolu.feint, [11]);
  assert.deepEqual(levelUpTable.snivy.leaftornado, [16]);
  const riolu = legalMoves('riolu');
  assert.deepEqual(
    riolu.moves.find((move) => move.id === 'feint').sources.levelUp,
    [11],
  );
});

test('move-evolution levels follow the B2W2 level-up table', () => {
  const moveEvolutions = withB2w2(() =>
    Object.values(dex().progressionSpecies).filter(
      (species) => species.evoType === 'levelMove',
    ),
  );
  assert.equal(moveEvolutions.length, 7);
  for (const species of moveEvolutions) {
    const levels = levelUpTable[species.prevoId][toId(species.evoMove)];
    assert.equal(species.evoMoveLevel, Math.min(...levels), species.id);
  }
});

test('legal-move files carry Gen 5 sources in the Reborn file shape', () => {
  const haxorus = legalMoves('haxorus');
  const byId = new Map(haxorus.moves.map((move) => [move.id, move]));
  assert.deepEqual(haxorus.types, ['Dragon']);
  assert.ok(byId.get('earthquake').sources.tm);
  assert.ok(byId.get('outrage').sources.levelUp.length > 0);
  assert.ok(byId.get('aquatail').sources.tutor);
  assert.ok(byId.get('cut').sources.tmx);
  assert.ok(!byId.has('dragondance') || !byId.get('dragondance').sources.tm);
  // Egg moves are recorded on the base form and inherited up the line.
  assert.ok(byId.get('nightslash').sources.egg);
  // Scald is a Gen 5 TM.
  const samurott = legalMoves('samurott');
  assert.ok(samurott.moves.find((move) => move.id === 'scald').sources.tm);
  // No Gen 6 move leaks in.
  assert.ok(!samurott.moves.some((move) => move.id === 'liquidation'));
});

test('every Gen 5 evolution item has a sourced availability entry', () => {
  const evolutionItems = new Set(
    Object.values(GEN5_PROGRESSION_SPECIES)
      .filter((species) =>
        ['useItem', 'levelHold', 'trade'].includes(species.evoType) &&
        species.evoItem)
      .map((species) => toId(species.evoItem)),
  );
  assert.equal(evolutionItems.size, 24);
  for (const id of evolutionItems) {
    const entry = B2W2_EVOLUTION_ITEM_AVAILABILITY[id];
    assert.ok(entry, `${id} has no availability entry`);
    assert.ok(['farmable', 'farmable-tedious'].includes(entry.status), id);
    assert.ok(entry.source.length > 0, id);
  }
});

test('every B2W2 timeline and shop id is a real item', () => {
  const extras = new Set(B2W2_EXTRA_INVENTORY_ITEMS.map((item) => item.id));
  const known = (id) =>
    id in GEN5_HELD_ITEMS_BY_ID ||
    id in GEN7_HELD_ITEMS_BY_ID ||
    extras.has(id);
  for (const id of Object.keys(B2W2_ITEM_UNLOCK_BADGES)) {
    assert.ok(known(id), `unknown timeline item ${id}`);
  }
  for (const id of Object.keys(B2W2_SHOP_ITEM_BADGES)) {
    assert.ok(known(id), `unknown shop item ${id}`);
    const first = B2W2_ITEM_UNLOCK_BADGES[id]?.badge;
    if (first !== undefined) {
      assert.ok(
        B2W2_SHOP_ITEM_BADGES[id] >= first,
        `${id}: shop badge precedes the timeline`,
      );
    }
  }
  for (const item of B2W2_EXTRA_INVENTORY_ITEMS) {
    assert.ok(!(item.id in GEN5_HELD_ITEMS_BY_ID), `${item.id} is already in the catalog`);
  }
});

test('B2W2 checkpoint headline items agree with the timeline', () => {
  for (const checkpoint of B2W2_PROGRESSION_CHECKPOINTS) {
    for (const id of checkpoint.unlocks.items || []) {
      assert.equal(
        B2W2_ITEM_UNLOCK_BADGES[id]?.badge,
        checkpoint.badges,
        `${id} on ${checkpoint.id}`,
      );
    }
  }
  withB2w2(() => {
    assert.equal(getItemUnlockBadge('leftovers'), 2);
    assert.equal(getItemUnlockBadge('eviolite'), 2);
    assert.equal(getItemUnlockBadge('lifeorb'), 8);
    assert.equal(getItemUnlockBadge('custapberry'), null); // event only
    // Nothing competitive is buyable before the Champion.
    const early = getRenewablyObtainableItems(7).map((item) => item.id);
    assert.ok(!early.includes('choicescarf'));
    assert.ok(!early.includes('lifeorb'));
    const late = getRenewablyObtainableItems(8).map((item) => item.id);
    assert.ok(late.includes('choicescarf') && late.includes('lifeorb'));
  });
});
