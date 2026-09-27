// Damage / ability / coverage correctness tests — the cases most likely to hide
// a "very cursed if missed" bug (double-counting type effectiveness, or an
// ability that boosts the wrong moves).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  estimateMoveDamage,
  explainMoveDamage,
  getAbilityDamageMultiplier,
  isTypeConditionalMove,
  typeConditionMultiplier,
} from '../src/teamBuilder/damage-model.js';
import { dex } from '../src/games/dex.js';
import { getTypeMultiplier } from '../src/playthrough/type-chart.js';

const attacker = { level: 50, atk: 120, spa: 120 };
const waterPulse = {
  basePower: 60,
  category: 'Special',
  type: 'Water',
  attackerStats: attacker,
};

test('estimateMoveDamage is NEUTRAL — it never applies target type effectiveness', () => {
  // The coverage vector multiplies effectiveness in separately; if
  // estimateMoveDamage also did, matchups would double-count.
  const d = estimateMoveDamage({ ...waterPulse, attackerTypes: ['Water'] });
  const intoFire = d * getTypeMultiplier('Water', ['Fire']);
  const intoWater = d * getTypeMultiplier('Water', ['Water']);
  assert.equal(getTypeMultiplier('Water', ['Fire']), 2);
  assert.equal(getTypeMultiplier('Water', ['Water']), 0.5);
  assert.equal(intoFire, d * 2);
  assert.equal(intoWater, d * 0.5);
});

test('STAB: same-type move gets ×1.5 over a non-STAB move', () => {
  const stab = estimateMoveDamage({ ...waterPulse, attackerTypes: ['Water'] });
  const nonStab = estimateMoveDamage({ ...waterPulse, attackerTypes: ['Normal'] });
  assert.ok(stab > nonStab);
  assert.ok(Math.abs(stab / nonStab - 1.5) < 0.05);
});

test('Protean: a NON-STAB move gains STAB', () => {
  const plain = estimateMoveDamage({ ...waterPulse, attackerTypes: ['Normal'] });
  const protean = estimateMoveDamage({
    ...waterPulse,
    attackerTypes: ['Normal'],
    ability: 'Protean',
  });
  assert.ok(protean > plain);
  assert.ok(Math.abs(protean / plain - 1.5) < 0.05);
});

test('Protean: an ALREADY-STAB move is unchanged (no double STAB)', () => {
  const stab = estimateMoveDamage({ ...waterPulse, attackerTypes: ['Water'] });
  const proteanStab = estimateMoveDamage({
    ...waterPulse,
    attackerTypes: ['Water'],
    ability: 'Protean',
  });
  assert.equal(proteanStab, stab);
});

test('Torrent (no STAB effect) vs Protean on a non-STAB move: Protean is higher', () => {
  const torrent = estimateMoveDamage({
    ...waterPulse,
    attackerTypes: ['Normal'],
    ability: 'Torrent',
  });
  const protean = estimateMoveDamage({
    ...waterPulse,
    attackerTypes: ['Normal'],
    ability: 'Protean',
  });
  assert.ok(protean > torrent);
});

test('Adaptability turns STAB into ×2', () => {
  const stab = estimateMoveDamage({ ...waterPulse, attackerTypes: ['Water'] });
  const adaptability = estimateMoveDamage({
    ...waterPulse,
    attackerTypes: ['Water'],
    ability: 'Adaptability',
  });
  assert.ok(Math.abs(adaptability / stab - 2 / 1.5) < 0.05);
});

test('Weak chip coverage stays low even when super-effective', () => {
  // Lick: 30 BP physical. Even into a Ghost-weak target, its coverage value
  // must stay well below a real STAB nuke — the noisy-OR must not read it as an
  // answer.
  const lick = { basePower: 30, category: 'Physical', type: 'Ghost', attackerStats: attacker };
  const lickNeutral = estimateMoveDamage({ ...lick, attackerTypes: ['Normal'] });
  const hydroPump = estimateMoveDamage({
    basePower: 110,
    category: 'Special',
    type: 'Water',
    attackerTypes: ['Water'],
    attackerStats: attacker,
  });
  assert.ok(lickNeutral * 2 < hydroPump);
});

test('Libero is inert (Gen-8 ability; vanilla Reborn is Gen-7)', () => {
  const plain = estimateMoveDamage({ ...waterPulse, attackerTypes: ['Normal'] });
  const libero = estimateMoveDamage({
    ...waterPulse,
    attackerTypes: ['Normal'],
    ability: 'Libero',
  });
  assert.equal(libero, plain);
});

// --- Fixed-damage moves: real in-game damage, not base-power fictions --------
// (User-reported: a lvl-25 Mankey was recommended Seismic Toss because the old
// model priced it as a 60-BP STAB attack — 90 flat at any level.)
test("Seismic Toss / Night Shade deal exactly the user's level, no STAB", async () => {
  const { fixedMoveDamage } = await import('../src/teamBuilder/damage-model.js');
  assert.equal(fixedMoveDamage('seismictoss', 25), 25);
  assert.equal(fixedMoveDamage('nightshade', 25), 25);
  const viaEstimate = estimateMoveDamage({
    moveId: 'seismictoss',
    basePower: 0,
    category: 'Physical',
    type: 'Fighting',
    attackerTypes: ['Fighting'], // STAB must NOT apply
    attackerStats: { level: 25, atk: 999, spa: 999 }, // stats must NOT apply
    itemMultiplier: 1.3, // items must NOT apply
  });
  assert.equal(viaEstimate, 25);
});

test('Super Fang halves a typical body at the level; flat moves stay flat', async () => {
  const { fixedMoveDamage, referenceHp } = await import(
    '../src/teamBuilder/damage-model.js',
  );
  // Reference defender at 25: floor(171*25/100) + 25 + 10 = 77 HP → 39
  // (rounded).
  assert.equal(referenceHp(25), 77);
  assert.equal(fixedMoveDamage('superfang', 25), 39);
  assert.ok(fixedMoveDamage('superfang', 75) > 2 * fixedMoveDamage('superfang', 25));
  assert.equal(fixedMoveDamage('dragonrage', 25), 40);
  assert.equal(fixedMoveDamage('sonicboom', 25), 20);
  assert.equal(fixedMoveDamage('tackle', 25), null);
});

test('a real STAB attack outdamages Seismic Toss on a decent attacker at low caps', () => {
  // Mankey-ish at 25: Karate Chop (50 BP, Fighting STAB) vs Seismic Toss (25).
  const karateChop = estimateMoveDamage({
    basePower: 50,
    category: 'Physical',
    type: 'Fighting',
    attackerTypes: ['Fighting'],
    attackerStats: { level: 25, atk: 60, spa: 30 },
  });
  const seismicToss = estimateMoveDamage({
    moveId: 'seismictoss',
    basePower: 0,
    category: 'Physical',
    type: 'Fighting',
    attackerTypes: ['Fighting'],
    attackerStats: { level: 25, atk: 60, spa: 30 },
  });
  assert.ok(
    karateChop > seismicToss,
    `Karate Chop ${karateChop} should beat Seismic Toss ${seismicToss} at cap 25 on a real attacker`,
  );
});

test('fixed-damage coverage: flat into everything its type can touch, zero into immunities', async () => {
  const { coverageDamageIntoType, isFixedDamageMove } = await import(
    '../src/teamBuilder/damage-model.js',
  );
  // Seismic Toss (Fighting): never super effective, never resisted...
  assert.equal(coverageDamageIntoType('seismictoss', 'Fighting', 25, 'Normal'), 25);
  assert.equal(coverageDamageIntoType('seismictoss', 'Fighting', 25, 'Flying'), 25);
  // ...but Ghosts are immune.
  assert.equal(coverageDamageIntoType('seismictoss', 'Fighting', 25, 'Ghost'), 0);
  // Night Shade (Ghost) can't touch Normals.
  assert.equal(coverageDamageIntoType('nightshade', 'Ghost', 25, 'Normal'), 0);
  assert.equal(coverageDamageIntoType('nightshade', 'Ghost', 25, 'Psychic'), 25);
  // Ordinary moves keep full effectiveness scaling.
  assert.equal(coverageDamageIntoType('karatechop', 'Fighting', 30, 'Normal'), 60);
  assert.equal(coverageDamageIntoType('karatechop', 'Fighting', 30, 'Flying'), 15);
  assert.ok(isFixedDamageMove('superfang'));
  assert.ok(!isFixedDamageMove('karatechop'));
});

test('Synchronoise is priced by the chance the fractional-type defender shares a type', () => {
  const shares = dex().typeCombinationShares;
  const shareOf = (types) => Object.entries(shares)
    .filter(([combination]) =>
      combination.split('/').some((type) => types.includes(type)))
    .reduce((sum, [, share]) => sum + share, 0);
  assert.ok(isTypeConditionalMove('synchronoise'));
  assert.ok(!isTypeConditionalMove('psychic'));
  assert.equal(typeConditionMultiplier('psychic', ['Psychic']), 1);

  const psychic = typeConditionMultiplier('synchronoise', ['Psychic']);
  assert.ok(psychic > 0.05 && psychic < 0.3, String(psychic));
  assert.ok(Math.abs(psychic - shareOf(['Psychic'])) < 1e-9);

  // A dual-typed user counts a defender carrying both of its types once:
  // the union of the two singles, not their sum.
  const pair = typeConditionMultiplier('synchronoise', ['Normal', 'Flying']);
  const union = shareOf(['Normal']) + shareOf(['Flying']) -
    (shares['Normal/Flying'] || 0);
  assert.ok(Math.abs(pair - union) < 1e-9);
  assert.ok(pair < shareOf(['Normal']) + shareOf(['Flying']));

  const move = {
    moveId: 'synchronoise', basePower: 120, category: 'Special',
    type: 'Psychic', attackerStats: attacker, attackerTypes: ['Psychic'],
  };
  const full = estimateMoveDamage({ ...move, moveId: 'psychic' });
  const conditioned = estimateMoveDamage(move);
  assert.ok(Math.abs(conditioned - full * psychic) <= 1, `${conditioned} vs ${full * psychic}`);
});

test('the damage working names every factor and lands on the estimate', () => {
  // A Sheer Force Nidoking's Sludge Wave: the secondary effect earns 1.3×.
  const sludgeWave = {
    id: 'sludgewave', name: 'Sludge Wave', basePower: 95, category: 'Special',
    type: 'Poison', flags: { secondary: 1 },
  };
  const params = {
    moveId: sludgeWave.id,
    moveName: sludgeWave.name,
    basePower: sludgeWave.basePower,
    category: sludgeWave.category,
    type: sludgeWave.type,
    attackerTypes: ['Poison', 'Ground'],
    attackerStats: { ...attacker, spreadLabel: 'Modest, EVs 0/0/0/252/4/252' },
    itemMultiplier: 1.3,
    itemName: 'Life Orb',
    abilityMultiplier: getAbilityDamageMultiplier('Sheer Force', sludgeWave),
    ability: 'Sheer Force',
  };
  const { damage, steps } = explainMoveDamage(params);
  assert.equal(damage, estimateMoveDamage(params));
  const text = steps.join('\n');
  assert.match(text, /Sludge Wave · Special · 95 base power/);
  assert.match(text, /Level 50: SpA 120 \(Modest, EVs 0\/0\/0\/252\/4\/252\) against a base-70 defender's SpD/);
  assert.match(text, /× 1\.5 STAB/);
  assert.match(text, /× 1\.3 Sheer Force/);
  assert.match(text, /× 1\.3 Life Orb/);
  assert.match(text, new RegExp(`= ${damage} per hit$`));

  // Fixed damage says so instead of pretending to have a formula.
  const toss = explainMoveDamage({
    moveId: 'seismictoss', moveName: 'Seismic Toss', basePower: 0,
    category: 'Physical', type: 'Fighting', attackerStats: attacker,
  });
  assert.equal(toss.damage, 50);
  assert.match(toss.steps[0], /fixed damage, 50 at level 50/);
});
