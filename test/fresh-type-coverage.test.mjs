// A fresh attacking type fills a slot only where it raises the set's best
// damage into at least one defensive typing the game's dex contains, pairs
// included. A 75-power move without STAB lands under a 102-power STAB move
// into every single type it hits super effectively, so Thunder Punch on
// Lopunny earns nothing from pure Water; it earns its slot from Water/Flying,
// where the 4x hit doubles Return. An attack that out-hits the set nowhere,
// pairs included, is dominated: the slot goes to a priority attack or a
// utility move instead.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import {
  buildCandidateLegalityProfile,
} from '../src/teamBuilder/team-analysis.js';

const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
const idsOf = (profile) => profile.recommendedMoves.map((move) => move.id);
const lopunny = {
  id: 'lopunnymega', name: 'Lopunny-Mega', types: ['Normal', 'Fighting'],
};
// Lopunny-Mega's real usage: Quick Attack is its fourth canonical move.
const lopunnyUsage = new Map([
  ['highjumpkick', 99], ['fakeout', 95], ['return', 58], ['quickattack', 52],
  ['icepunch', 30], ['encore', 0.3],
]);
const lopunnyMoves = [
  'fakeout', 'return', 'jumpkick', 'thunderpunch', 'quickattack', 'encore',
].map(legal);

test('Thunder Punch seats only where a pair doubles it over Return', () => {
  // The standard set is full of canonical moves and Jump Kick before the
  // fill reaches Thunder Punch. The coverage build rebuilds the attacks from
  // damage, and there Thunder Punch earns a slot for Water/Flying.
  const standard = idsOf(buildCandidateLegalityProfile({
    member: lopunny, moves: lopunnyMoves, moveUsage: lopunnyUsage,
    levelCap: 35, ability: 'Scrappy',
  }));
  assert.ok(!standard.includes('thunderpunch'), standard);
  assert.ok(standard.includes('jumpkick'), standard);
  const coverage = idsOf(buildCandidateLegalityProfile({
    member: lopunny, moves: lopunnyMoves, moveUsage: lopunnyUsage,
    levelCap: 35, ability: 'Scrappy', movePreference: 'coverage',
  }));
  assert.ok(coverage.includes('thunderpunch'), coverage);
  assert.ok(coverage.includes('jumpkick'), coverage);
});

test('the standard set keeps the canonical Quick Attack', () => {
  const ids = idsOf(buildCandidateLegalityProfile({
    member: lopunny, moves: lopunnyMoves, moveUsage: lopunnyUsage,
    levelCap: 35, ability: 'Scrappy',
  }));
  assert.deepEqual(
    new Set(ids), new Set(['fakeout', 'return', 'quickattack', 'jumpkick']),
  );
});

// Six candidates for four slots on a plain Normal type with no usage data,
// so the fill order alone decides the set.
const tauros = { id: 'tauros', name: 'Tauros', types: ['Normal'] };
const taurosMoves = [
  'return', 'earthquake', 'thunderpunch', 'firepunch', 'icepunch',
  'quickattack',
].map(legal);

test('a fresh type that out-hits the set into some typing seats', () => {
  const ids = idsOf(buildCandidateLegalityProfile({
    member: tauros, moves: taurosMoves, levelCap: 35,
  }));
  // Earthquake out-hits a resisted Return into Rock and Steel and seats
  // first, as the stronger move. Each punch out-hits Return only into the
  // pairs it hits 4x (Bug/Steel, Ground/Dragon, Water/Flying), so the two
  // remaining slots go to punches by damage order and the dominated Quick
  // Attack is left out.
  assert.ok(ids.includes('earthquake'), ids);
  assert.equal(ids.filter((id) => /punch$/.test(id)).length, 2, ids);
  assert.ok(!ids.includes('quickattack'), ids);
});

test('among dominated filler, a type the set lacks beats a stronger covered one', () => {
  // A fresh-file Frogadier at cap 20: Water Pulse is the attack, Quick
  // Attack the priority filler, and the last two slots are dead moves. Lick
  // (Ghost, 30 power off an empty Attack) beats Pound (Normal, 40), because
  // Pound is never clicked beside Quick Attack while Lick is the button
  // against a Ghost and the type Protean turns Frogadier into.
  const frogadier = { id: 'frogadier', name: 'Frogadier', types: ['Water'] };
  const ids = idsOf(buildCandidateLegalityProfile({
    member: frogadier,
    moves: [
      'waterpulse', 'bubble', 'pound', 'quickattack', 'lick', 'smokescreen',
    ].map(legal),
    levelCap: 20, ability: 'Protean', investmentSide: 'special',
  }));
  assert.ok(ids.includes('lick') && !ids.includes('pound'), ids);
  assert.ok(ids.includes('quickattack') && ids.includes('waterpulse'), ids);
  // Bubble is a dead same-type attack too: a status move with an effect,
  // Smokescreen, takes the last slot over it.
  assert.ok(!ids.includes('bubble'), ids);
});

test('a dead slot takes a status move with an effect over a dead attack', () => {
  // A fresh-file Linoone at cap 20: Headbutt and Pin Missile are the set;
  // the other two slots go to Baby-Doll Eyes (priority) and Sand Attack
  // (accuracy drop), not to Tackle and Fury Swipes, which Headbutt out-hits.
  const linoone = { id: 'linoone', name: 'Linoone', types: ['Normal'] };
  const ids = idsOf(buildCandidateLegalityProfile({
    member: linoone,
    moves: [
      'headbutt', 'pinmissile', 'furyswipes', 'tackle', 'babydolleyes',
      'sandattack', 'growl', 'tailwhip', 'mudsport', 'odorsleuth',
    ].map(legal),
    levelCap: 20, ability: 'Gluttony',
  }));
  assert.deepEqual(
    new Set(ids),
    new Set(['headbutt', 'pinmissile', 'babydolleyes', 'sandattack']),
    ids,
  );
});

test('a dominated priority attack seats ahead of dominated filler', () => {
  // Weaker same-type attacks are out-hit by Return into every typing, so
  // they are dominated: Quick Attack takes a slot for its priority, and the
  // last slot goes to the strongest dead attack, Strength, for its PP. (The
  // card lists moves by damage, so order says nothing about seating.)
  const ids = idsOf(buildCandidateLegalityProfile({
    member: tauros,
    moves: [
      'return', 'earthquake', 'quickattack', 'tackle', 'strength', 'hornattack',
    ].map(legal),
    levelCap: 35,
  }));
  assert.deepEqual(
    new Set(ids),
    new Set(['return', 'earthquake', 'quickattack', 'strength']),
    ids,
  );
});

test('a stronger same-type attack earns a slot: STAB has no standing of its own', () => {
  // A Poison type whose canonical attack is Clear Smog: Sludge out-hits it
  // into every type, so it seats although Poison is already carried.
  const koffing = { id: 'koffing', name: 'Koffing', types: ['Poison'] };
  const ids = idsOf(buildCandidateLegalityProfile({
    member: koffing,
    moves: ['clearsmog', 'sludge', 'smokescreen', 'selfdestruct', 'tackle']
      .map(legal),
    moveUsage: new Map([['clearsmog', 60], ['smokescreen', 50]]),
    levelCap: 25, ability: 'Levitate',
  }));
  assert.ok(ids.includes('sludge'), ids);
});

const klink = { id: 'klink', name: 'Klink', types: ['Steel'] };
const klinkUsage = new Map([
  ['geargrind', 99], ['magnetrise', 31], ['irondefense', 0.3],
]);

test('Klink\'s weak off-type attacks are clicks where a pair says so', () => {
  // Gear Grind out-hits Vise Grip and Thunder Shock into every single type,
  // Water included. Vise Grip still out-hits it into the pairs that resist
  // Steel twice (Lanturn, Rotom-Wash), and Thunder Shock into Water/Flying,
  // where the 4x hit doubles a resisted Gear Grind. The stronger of the two
  // is tried first and takes the slot ahead of Charge.
  const moves = [
    'geargrind', 'visegrip', 'charge', 'thundershock', 'irondefense',
    'magnetrise',
  ].map(legal);
  const plain = idsOf(buildCandidateLegalityProfile({
    member: klink, moves, moveUsage: klinkUsage, levelCap: 25,
    ability: 'Clear Body',
  }));
  assert.deepEqual(
    new Set(plain),
    new Set(['geargrind', 'magnetrise', 'irondefense', 'visegrip']),
    plain,
  );
  const withoutGrip = idsOf(buildCandidateLegalityProfile({
    member: klink, moves: moves.filter((move) => move.id !== 'visegrip'),
    moveUsage: klinkUsage, levelCap: 25, ability: 'Clear Body',
  }));
  assert.ok(withoutGrip.includes('thundershock'), withoutGrip);
});

test('an attack the set out-hits into every typing is a click only under Protean', () => {
  // Bind, 15 power off Klink's Attack, lands under a quarter-strength Gear
  // Grind even into Fire/Water, so nothing clicks it and the slot goes to
  // Charge. Under Protean the uncovered type is also the defensive type, so
  // it is a click after all.
  const moves = ['geargrind', 'bind', 'charge', 'irondefense', 'magnetrise']
    .map(legal);
  const plain = idsOf(buildCandidateLegalityProfile({
    member: klink, moves, moveUsage: klinkUsage, levelCap: 25,
    ability: 'Clear Body',
  }));
  assert.deepEqual(
    new Set(plain),
    new Set(['geargrind', 'magnetrise', 'irondefense', 'charge']),
    plain,
  );
  const protean = idsOf(buildCandidateLegalityProfile({
    member: klink, moves, moveUsage: klinkUsage, levelCap: 25,
    ability: 'Protean',
  }));
  assert.ok(protean.includes('bind'), protean);
});
