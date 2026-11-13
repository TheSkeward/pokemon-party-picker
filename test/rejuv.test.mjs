// Rejuvenation is the second Essentials game on the registry: a Gen 9 dex
// with the National Dex prior, its own learnsets resolved through the
// committed dex map, the game's hard level caps, reusable machines, the Link
// Heart, and Reborn's field seeds and gems. These pin the descriptor, its
// curated tables, and the data built from the game's extracts.
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

await loadGame('rejuv');

const { dex } = await import('../src/games/dex.js');
const { getCheckpoints, levelCapAtBadges } = await import(
  '../src/games/schedule.js',
);
const { normalizeProgression } = await import(
  '../src/playthrough/progression.js',
);
const { mechanics, moveSources } = await import('../src/games/legality.js');
const { getExpectedItemChanges, getItemUnlockBadge } = await import(
  '../src/games/items.js',
);
const { REJUV_PROGRESSION_CHECKPOINTS } = await import(
  '../src/rejuv/badge-timeline.js',
);
const { REJUV_MACHINES, REJUV_UNMAPPED_MACHINES } = await import(
  '../src/generated/rejuvMoveSources.generated.js',
);
const { GEN9_PROGRESSION_SPECIES } = await import(
  '../src/generated/gen9ProgressionSpecies.generated.js',
);
const { GEN7_PROGRESSION_SPECIES } = await import(
  '../src/generated/gen7ProgressionSpecies.generated.js',
);

function withRejuv(fn) {
  const previous = getActiveGame().id;
  setActiveGame('rejuv');
  try {
    return fn();
  } finally {
    setActiveGame(previous);
  }
}

function legalMoves(id) {
  return JSON.parse(
    fs.readFileSync(
      path.resolve('site-data', 'data', 'rejuv-legal-moves', 'all', `${id}.json`),
      'utf8',
    ),
  );
}

const sources = (id, moveId) =>
  legalMoves(id).moves.find((move) => move.id === moveId)?.sources;

test('rejuv is registered on the Gen 9 dex with the National Dex families', () => {
  const game = getGame('rejuv');
  assert.equal(game.dexGen, 9);
  assert.deepEqual(game.families, ['gen9natdexsingles', 'gen9natdexdoubles']);
  assert.equal(game.storage.progression, 'pokemon-party-picker:rejuv:progression:v1');
  assert.equal(game.data.legalMovesDir, 'rejuv-legal-moves');
  withRejuv(() => {
    assert.equal(dex().gen, 9);
    assert.equal(dex().types.length, 18);
    assert.ok('kingambit' in dex().progressionSpecies);
    assert.ok('venusaurmega' in dex().progressionSpecies);
  });
});

test('the schedule is the eighteen badges with the game\'s hard caps', () => {
  // The game hands the two Fairy Tale badges over together, so no
  // checkpoint holds sixteen; Sigil Pearl comes last.
  const badges = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18,
  ];
  const caps = [
    18, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 85, 90, 100, 100,
  ];
  const checkpoints = REJUV_PROGRESSION_CHECKPOINTS;
  assert.deepEqual(checkpoints.map((c) => c.badges), badges);
  assert.deepEqual(checkpoints.map((c) => c.levelCap), caps);
  withRejuv(() => {
    assert.equal(getCheckpoints()[1].label, 'PoisonHeart Badge (Venam)');
    assert.deepEqual(getCheckpoints().slice(16).map((c) => c.label), [
      'Fairy Tale Badges (Allen & Alice)',
      'Sigil Pearl Badge (Damien)',
    ]);
    // Something dated to the sixteenth badge waits for the pair.
    assert.equal(levelCapAtBadges(15), 90);
    assert.equal(levelCapAtBadges(16), 100);
    assert.equal(levelCapAtBadges(19), null);
    // A save from when sixteen was a checkpoint moves to the pair, cap
    // included; an id the timeline never had still clears.
    const moved = normalizeProgression({ checkpoint: 'badge-16', levelCap: '90' });
    assert.equal(moved.checkpoint, 'badge-17');
    assert.equal(moved.levelCap, '100');
    const unknown = normalizeProgression({ checkpoint: 'badge-19', levelCap: '90' });
    assert.equal(unknown.checkpoint, '');
    assert.equal(unknown.levelCap, '90');
    assert.equal(getItemUnlockBadge('linkheart'), 1);
    assert.equal(getItemUnlockBadge('safetygoggles'), 7);
  });
});

test('mechanics are the Essentials ones: level-downs and reusable TMs, no Hidden Power changer', () => {
  withRejuv(() => {
    assert.deepEqual(mechanics(), {
      levelDown: true,
      hiddenPowerTypeChanger: false,
      reusableTms: true,
    });
  });
});

test('machines come from the game data, timed by the walkthrough, the HMs apart', () => {
  assert.equal(REJUV_MACHINES.length + REJUV_UNMAPPED_MACHINES.length, 179);
  assert.ok(REJUV_UNMAPPED_MACHINES.some((m) => m.symbol === 'POISONSWEEP'));
  withRejuv(() => {
    const { tmOptions, tmxOptions, tmxLabel, tutorGroups, tutorOptions } =
      moveSources();
    assert.equal(tmxLabel, 'HM');
    assert.deepEqual(
      tmxOptions.map((o) => o.move).sort(),
      ['Cut', 'Dive', 'Fly', 'Strength', 'Surf', 'Waterfall'],
    );
    const tm30 = tmOptions.find((o) => o.code === 'TM30');
    assert.equal(tm30.move, 'Shadow Ball');
    assert.equal(tm30.available, 'After Badge 04');
    const rm05 = tmOptions.find((o) => o.code === 'RM05');
    assert.equal(rm05.move, 'Sucker Punch');
    assert.equal(rm05.available, 'After Badge 12');
    assert.ok(!tmOptions.some((o) => o.code === 'TM102'), 'Poison Sweep has no Gen 9 identity');
    assert.ok(tmOptions.find((o) => o.code === 'TM70'), 'the Game Corner TM is listed');
    // Every tutor group's moves are real Gen 9 moves the options dedupe.
    assert.equal(tutorGroups[0].label, "Luck's Tent - Marshie");
    assert.ok(tutorOptions.some((o) => o.id === 'dracometeor'));
    assert.equal(tutorOptions.filter((o) => o.id === 'firepledge').length, 1);
  });
});

test('legal moves follow the game\'s learnsets through the Gen 9 map', () => {
  // Bulbasaur: Vine Whip at 3 in Rejuvenation (level 1 in Scarlet and
  // Violet), Toxic on its compatible list as a TM, egg move Curse.
  assert.deepEqual(sources('bulbasaur', 'vinewhip').levelUp, [3]);
  assert.equal(sources('bulbasaur', 'toxic').tm, true);
  assert.equal(sources('bulbasaur', 'curse').egg, true);
  // Universal TMs are code-granted: Protect on nothing's list, everywhere.
  assert.equal(sources('bulbasaur', 'protect').tm, true);
  assert.equal(sources('caterpie', 'protect'), undefined);
  // Pre-evolution level-up moves carry the ancestor that learns them.
  assert.ok(sources('venusaur', 'vinewhip').preEvolutionLevelUp.some((e) => e.from === 'bulbasaur'));
  // A regional form with its own line: Perrserker inherits Galarian Meowth.
  assert.ok(sources('perrserker', 'payday') || sources('perrserker', 'metalclaw'));
  // Smeargle sketches the game's move universe.
  assert.equal(sources('smeargle', 'dracometeor').sketch, true);
  assert.equal(sources('smeargle', 'struggle'), undefined);
});

test('the item content prices with Reborn\'s proxies and offers the renewable stock', () => {
  withRejuv(() => {
    const game = getActiveGame();
    assert.equal(game.evolution.tradeItem, 'Link Heart');
    assert.equal(game.evolution.regionAccess.Alola.accessKey, 'evoAccessTerajuma');
    assert.deepEqual(game.items.fieldSeeds.names, ['Elemental Seed', 'Telluric Seed', 'Synthetic Seed', 'Magical Seed']);
    const ids = getExpectedItemChanges(1).map((item) => item.id);
    assert.ok(ids.includes('linkheart'));
    assert.ok(!ids.includes('firestone'), 'Lost Camp opens at badge 4');
  });
});

test('the Gen 7 species universe is Reborn\'s, untouched by the Gen 9 families', () => {
  assert.ok(!('kingambit' in GEN7_PROGRESSION_SPECIES));
  assert.ok('kingambit' in GEN9_PROGRESSION_SPECIES);
  assert.ok('venusaurmega' in GEN7_PROGRESSION_SPECIES);
});
