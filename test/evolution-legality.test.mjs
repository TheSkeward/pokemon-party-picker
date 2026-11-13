// Evolution legality-with-friction (roadmap 4B acceptance): uniform rules,
// legal-with-K where requirements are satisfiable, UNKNOWN surfaced — never
// silently blocked, never verdict-fitted.
//
// Friction DEFAULTS are 0 (requirements are information, the
// player prices their own grind), so the K-pricing assertions here run under
// explicit overrides — they pin the machinery (trade+item stacking, chain
// summing) that a future re-enable would turn back on.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEvolutionRequirement,
  evolutionChainProof,
} from '../src/playthrough/evolution-requirements.js';
import { describeItemSource } from '../src/games/items.js';
import { setScoringOverrides } from '../src/teamBuilder/scoring-constants.js';
import { GEN7_PROGRESSION_SPECIES } from '../src/generated/gen7ProgressionSpecies.generated.js';

const species = (id) => GEN7_PROGRESSION_SPECIES[id];

const PRICED = {
  FRIENDSHIP_FRICTION: 15,
  ITEM_FRICTION: 20,
  TRADE_FRICTION: 20,
  TIME_FRICTION: 5,
};

function withPricedFriction(fn) {
  setScoringOverrides(PRICED);
  try {
    return fn();
  } finally {
    setScoringOverrides(null);
  }
}

test('default friction is 0 across methods: requirements inform, never price', () => {
  for (const id of ['pikachu', 'chansey', 'raichu', 'alakazam', 'steelix', 'sylveon']) {
    const req = getEvolutionRequirement(species(id));
    assert.equal(req.status, 'legal');
    assert.equal(req.friction, 0, `${id} must carry no default friction`);
  }
  assert.equal(evolutionChainProof('blissey').friction, 0);
});

test('level evolution: legal, K = 0, gated by evoLevel', () => {
  const req = getEvolutionRequirement(species('frogadier'));
  assert.equal(req.status, 'legal');
  assert.equal(req.levelRequired, 16);
  assert.equal(req.friction, 0);
});

test('friendship evolution: legal with friendship K (priced overrides)', () => {
  withPricedFriction(() => {
    const req = getEvolutionRequirement(species('pikachu'));
    assert.equal(req.status, 'legal');
    assert.equal(req.method, 'friendship');
    assert.ok(req.friction > 0);
  });
});

test('Happiny -> Chansey: legal via the Oval Stone, with item K + proof', () => {
  withPricedFriction(() => {
    const req = getEvolutionRequirement(species('chansey'));
    assert.equal(req.status, 'legal');
    assert.equal(req.method, 'item');
    assert.ok(req.friction > 0);
    // The reason names the item and its source, with no word on the effort.
    // The source is the item's supply in words, read from the game's item
    // data: no wild Pokémon of Reborn's holds an Oval Stone, the rocks do.
    assert.match(req.reason, /Oval Stone \(mined from badge \d+/);
  });
});

test('every item a Reborn evolution spends has a source in the game data', () => {
  const items = new Set(['Link Stone']);
  for (const entry of Object.values(GEN7_PROGRESSION_SPECIES)) {
    if (entry.prevoId && entry.evoItem) items.add(entry.evoItem);
  }
  assert.ok(items.size >= 25, 'the dex names the evolution items');
  for (const item of items) {
    assert.ok(describeItemSource(item), `${item} has no source`);
  }
});

test('an item evolution is legal by the item\'s sources in the game files', () => {
  const sourced = {
    aromatisse: 'Sachet',
    slurpuff: 'Whipped Dream',
    dusknoir: 'Reaper Cloth',
    milotic: 'Prism Scale',
    porygon2: 'Up-Grade',
    porygonz: 'Dubious Disc',
    rhyperior: 'Protector',
  };
  for (const [id, item] of Object.entries(sourced)) {
    const req = getEvolutionRequirement(species(id));
    assert.equal(req.status, 'legal', id);
    assert.ok(req.reason.includes(`${item} (`), `${id}: ${req.reason}`);
  }
  assert.match(
    getEvolutionRequirement(species('slurpuff')).reason,
    /Whipped Dream \(sold from badge \d+\)/);
});

test('an item costs the same K wherever it comes from; an owned one is free', () => {
  withPricedFriction(() => {
    const raichu = getEvolutionRequirement(species('raichu'));
    const chansey = getEvolutionRequirement(species('chansey'));
    assert.equal(raichu.status, 'legal');
    assert.doesNotMatch(raichu.reason, /tedious|grind/i);
    assert.equal(raichu.friction, chansey.friction);
    const owned = getEvolutionRequirement(species('raichu'), {
      ownedItems: { thunderstone: 1 },
    });
    assert.equal(owned.friction, 0);
    assert.match(owned.reason, /Thunder Stone \(owned\)/);
  });
});

test('trade evolution: legal via Link Stone (Reborn), trade + item stack for Steelix', () => {
  const alakazam = getEvolutionRequirement(species('alakazam'));
  assert.equal(alakazam.status, 'legal');
  assert.match(alakazam.reason, /Link Stone/);
  withPricedFriction(() => {
    const steelix = getEvolutionRequirement(species('steelix'));
    assert.equal(steelix.status, 'legal');
    const priced = getEvolutionRequirement(species('alakazam'));
    assert.ok(steelix.friction > priced.friction, 'trade WITH item costs more');
  });
});

test('trade with a partner species: the Link Stone wants the partner in the party', () => {
  const escavalier = getEvolutionRequirement(species('escavalier'));
  assert.equal(escavalier.status, 'legal');
  assert.match(escavalier.reason, /Link Stone .*with a Shelmet in the party/);
  // The party gate holds even with a Link Stone in the bag; a plain trade
  // (Alakazam) never sees that gate.
  const blocked = getEvolutionRequirement(species('escavalier'), {
    evoAccessPartyCondition: false,
    ownedItems: { linkstone: 1 },
  });
  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.reason, /Party-condition/);
  const alakazam = getEvolutionRequirement(species('alakazam'), {
    evoAccessPartyCondition: false,
  });
  assert.equal(alakazam.status, 'legal');
});

test('unknown item: surfaced as unknown, not silently blocked or allowed', () => {
  // An item neither the game's sources nor its table know.
  const stranger = {
    ...species('milotic'),
    evoType: 'useItem',
    evoItem: 'Sourceless Scale',
  };
  const unknown = getEvolutionRequirement(stranger);
  assert.equal(unknown.status, 'unknown');
  assert.match(unknown.reason, /Sourceless Scale availability unknown/);
  // In the bag it is a settled fact.
  const owned = getEvolutionRequirement(stranger, {
    ownedItems: { sourcelessscale: 1 },
  });
  assert.equal(owned.status, 'legal');
});

test("move-based evolution: gated by the pre-evo's learn level", () => {
  const tangrowth = getEvolutionRequirement(species('tangrowth'));
  assert.equal(tangrowth.status, 'legal');
  assert.equal(tangrowth.levelRequired, 38);
});

test('affection condition reads as friendship-like', () => {
  const sylveon = getEvolutionRequirement(species('sylveon'));
  assert.equal(sylveon.status, 'legal');
  assert.equal(sylveon.method, 'affection');
});

test('chain proof sums friction with per-step reasons', () => {
  withPricedFriction(() => {
    const blissey = evolutionChainProof('blissey');
    assert.equal(blissey.steps.length, 2);
    assert.ok(blissey.friction > 0);
    assert.match(blissey.steps[0].reason, /Oval Stone/);
    assert.equal(blissey.steps[1].method, 'friendship');
  });
});

test('chain proof stops at the input form: owned evolutions are already paid', () => {
  withPricedFriction(() => {
    const fromChansey = evolutionChainProof('blissey', null, 'chansey');
    assert.equal(fromChansey.steps.length, 1);
    assert.equal(fromChansey.steps[0].method, 'friendship');
    assert.ok(fromChansey.friction < evolutionChainProof('blissey').friction);

    const fromBlissey = evolutionChainProof('blissey', null, 'blissey');
    assert.equal(fromBlissey.steps.length, 0);
    assert.equal(fromBlissey.friction, 0);

    // An off-chain input id must not truncate the walk.
    const offChain = evolutionChainProof('blissey', null, 'pikachu');
    assert.equal(offChain.steps.length, 2);
  });
});
