// A fresh attacking type fills a slot only where it raises the set's best
// damage into at least one defense type. A 75-power move without STAB lands
// under a 102-power STAB move even into a type it hits super effectively,
// so Thunder Punch on Lopunny covers nothing the scoring can see and the
// slot goes to a priority attack or a utility move instead.
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

test('Thunder Punch never out-hits Return, so it fills no slot', () => {
  for (const movePreference of ['default', 'coverage']) {
    const ids = idsOf(buildCandidateLegalityProfile({
      member: lopunny, moves: lopunnyMoves, moveUsage: lopunnyUsage,
      levelCap: 35, ability: 'Scrappy', movePreference,
    }));
    assert.ok(!ids.includes('thunderpunch'), `${movePreference}: ${ids}`);
    assert.ok(ids.includes('jumpkick'), `${movePreference}: ${ids}`);
  }
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

test('a fresh type that out-hits the set into some type still seats', () => {
  const ids = idsOf(buildCandidateLegalityProfile({
    member: tauros, moves: taurosMoves, levelCap: 35,
  }));
  // Earthquake out-hits a resisted Return into Rock and Steel. The three
  // punches out-hit the set nowhere, so at most one lands, as filler.
  assert.ok(ids.includes('earthquake'), ids);
  const punches = ids.filter((id) => /punch$/.test(id));
  assert.ok(punches.length <= 1, ids);
});

test('a dominated priority attack seats ahead of dominated filler', () => {
  // Three punches compete with Quick Attack for the last two slots; the
  // priority attack takes one and a single punch is left as filler. (The
  // card lists moves by damage, so order says nothing about seating.)
  const ids = idsOf(buildCandidateLegalityProfile({
    member: tauros, moves: taurosMoves, levelCap: 35,
  }));
  assert.ok(ids.includes('quickattack'), ids);
  assert.equal(ids.filter((id) => /punch$/.test(id)).length, 1, ids);
});
