// A canonical status move the cap still blocks is stood in for by the legal
// move that does the same job: the same role and, for setup, the same
// primary stat; for status, the same condition. The stand-in takes the
// blocked move's seat, and among several, priced side effects decide before
// the prior. A move the game never teaches the mon gets no stand-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateLegalMove } from '../src/move-meta.js';
import { setMovePrior } from '../src/teamBuilder/move-prior.js';
import {
  buildCandidateLegalityProfile,
} from '../src/teamBuilder/team-analysis.js';
import {
  bestChoice,
  progressionAt,
  runPool,
} from './helpers/harness.mjs';

const legal = (id) => hydrateLegalMove({ id, sources: ['level'] });
const idsOf = (profile) => profile.recommendedMoves.map((move) => move.id);
const standInOf = (profile, id) =>
  profile.recommendedMoves.find((move) => move.id === id)?.standsInFor;

const klink = { id: 'klink', name: 'Klink', types: ['Steel'] };
// Klink's record: Shift Gear is canonical and arrives at level 48.
const klinkUsage = new Map([
  ['geargrind', 94], ['shiftgear', 90], ['wildcharge', 69], ['return', 43],
  ['substitute', 12],
]);
const klinkMoves = [
  'geargrind', 'autotomize', 'rockpolish', 'charge', 'irondefense',
  'substitute', 'facade', 'visegrip',
].map(legal);
// Priors with the ladder's carry rates for the weight-scaled attacks.
const LADDER = new Map([
  ['lowkick', { prior: 5, carry: 0.37 }],
  ['grassknot', { prior: 8, carry: 1.17 }],
  ['heavyslam', { prior: 10, carry: 0.71, carrierWeightKg: 400 }],
  ['autotomize', { prior: 3.5 }],
  ['rockpolish', { prior: 4 }],
  ['irondefense', { prior: 2.5 }],
  ['charge', { prior: 0.5 }],
  ['substitute', { prior: 4.3 }],
  ['protect', { prior: 5.9 }],
  ['growth', { prior: 3 }],
  ['stunspore', { prior: 5 }],
  ['toxic', { prior: 10 }],
  ['harden', { prior: 0.5 }],
  ['agility', { prior: 3.7 }],
]);
const withPrior = (prior, run) => {
  const previous = setMovePrior(prior);
  try {
    return run();
  } finally {
    setMovePrior(previous);
  }
};

test('Autotomize stands in for Shift Gear, by its shed weight', () => {
  withPrior(LADDER, () => {
    const profile = buildCandidateLegalityProfile({
      member: klink, moves: klinkMoves, moveUsage: klinkUsage, levelCap: 35,
      ability: 'Clear Body',
    });
    const ids = idsOf(profile);
    assert.ok(ids.includes('autotomize'), ids);
    assert.ok(!ids.includes('charge') && !ids.includes('irondefense'), ids);
    assert.deepEqual(
      standInOf(profile, 'autotomize'), { id: 'shiftgear', name: 'Shift Gear' },
    );
    // Rock Polish may still seat later as ordinary utility, but it is not
    // what answers for Shift Gear.
    assert.ok(!standInOf(profile, 'rockpolish'));
    // The stand-in reads in Shift Gear's place: second, after Gear Grind.
    assert.equal(ids[1], 'autotomize', ids);
  });
});

test('with no weight effect to price, the prior decides the stand-in', () => {
  const noCarry = new Map(
    [...LADDER].map(([id, entry]) => [id, { prior: entry.prior }]),
  );
  withPrior(noCarry, () => {
    const profile = buildCandidateLegalityProfile({
      member: klink, moves: klinkMoves, moveUsage: klinkUsage, levelCap: 35,
      ability: 'Clear Body',
    });
    const ids = idsOf(profile);
    assert.ok(ids.includes('rockpolish'), ids);
    assert.equal(standInOf(profile, 'rockpolish')?.id, 'shiftgear');
    assert.ok(!standInOf(profile, 'autotomize'));
  });
});

test('a move the game never teaches the mon is absent, not blocked', () => {
  withPrior(LADDER, () => {
    const profile = buildCandidateLegalityProfile({
      member: klink, moves: klinkMoves, moveUsage: klinkUsage, levelCap: 35,
      ability: 'Clear Body',
      learnableMoveIds: new Set(klinkMoves.map((move) => move.id)),
    });
    assert.ok(
      profile.recommendedMoves.every((move) => !move.standsInFor),
      idsOf(profile),
    );
  });
});

test('a setup stand-in must raise the same primary stat', () => {
  withPrior(LADDER, () => {
    // Swords Dance blocked: Harden raises Defense, Agility Speed. Neither
    // answers for an Attack boost, whatever else seats them.
    const ninjask = { id: 'ninjask', name: 'Ninjask', types: ['Bug', 'Flying'] };
    const profile = buildCandidateLegalityProfile({
      member: ninjask,
      moves: ['furycutter', 'aerialace', 'harden', 'agility', 'protect']
        .map(legal),
      moveUsage: new Map([
        ['swordsdance', 66], ['batonpass', 60], ['protect', 50],
      ]),
      levelCap: 35,
    });
    assert.ok(
      profile.recommendedMoves.every((move) => !move.standsInFor),
      idsOf(profile),
    );
    // Calm Mind blocked: Growth shares Special Attack with it and answers.
    const comfey = { id: 'comfey', name: 'Comfey', types: ['Fairy'] };
    const grown = buildCandidateLegalityProfile({
      member: comfey,
      moves: ['drainingkiss', 'growth', 'synthesis', 'round'].map(legal),
      moveUsage: new Map([
        ['calmmind', 94], ['drainingkiss', 90], ['synthesis', 70],
      ]),
      levelCap: 35,
    });
    assert.equal(standInOf(grown, 'growth')?.id, 'calmmind', idsOf(grown));
  });
});

test('a status stand-in must inflict the same condition', () => {
  withPrior(LADDER, () => {
    const member = { id: 'tangela', name: 'Tangela', types: ['Grass'] };
    const profile = buildCandidateLegalityProfile({
      member,
      moves: ['gigadrain', 'stunspore', 'toxic', 'knockoff'].map(legal),
      moveUsage: new Map([
        ['gigadrain', 90], ['thunderwave', 80], ['knockoff', 70],
      ]),
      levelCap: 35,
    });
    assert.equal(standInOf(profile, 'stunspore')?.id, 'thunderwave');
    assert.ok(!standInOf(profile, 'toxic'));
  });
});

test('the real Klink at badge 2 runs Autotomize for Shift Gear', async () => {
  const result = await runPool({
    pool: ['Klink'],
    progression: progressionAt({ badge: 2, levelCap: 35 }),
  });
  const profile = bestChoice(result, 'Klink').legalityProfile;
  assert.ok(idsOf(profile).includes('autotomize'), idsOf(profile));
  assert.equal(standInOf(profile, 'autotomize')?.id, 'shiftgear');
});
