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

test('Libero gives STAB on every move, like Protean, as both fangames apply it', () => {
  const plain = estimateMoveDamage({ ...waterPulse, attackerTypes: ['Normal'] });
  const libero = estimateMoveDamage({
    ...waterPulse,
    attackerTypes: ['Normal'],
    ability: 'Libero',
  });
  const protean = estimateMoveDamage({
    ...waterPulse,
    attackerTypes: ['Normal'],
    ability: 'Protean',
  });
  assert.equal(libero, protean);
  assert.ok(libero > plain);
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

test('a species that attacks from another form is priced from that form', async () => {
  const { battleFormFor, getAttackingStats } = await import(
    '../src/teamBuilder/damage-model.js',
  );
  const { dex } = await import('../src/games/dex.js');
  const atkOf = (id, level) =>
    getAttackingStats({ pokemonId: id, levelCap: level }).atk;
  // Stance Change: Aegislash attacks from Blade form's 150 Atk, not 50.
  assert.equal(battleFormFor('aegislash', 50), 'aegislashblade');
  assert.equal(atkOf('aegislash', 50), atkOf('aegislashblade', 50));
  assert.ok(atkOf('aegislash', 50) > 150);
  const blade = getAttackingStats({ pokemonId: 'aegislash', levelCap: 50 });
  assert.match(blade.spreadLabel, /^Blade form, /);
  // Schooling: School form from level 20, Solo form before it.
  assert.equal(battleFormFor('wishiwashi', 19), null);
  assert.equal(battleFormFor('wishiwashi', 20), 'wishiwashischool');
  assert.ok(atkOf('wishiwashi', 20) > 3 * atkOf('wishiwashi', 19));
  // Shields Down: at full HP Minior is in Meteor form, the weaker attacker.
  assert.equal(battleFormFor('minior', 50), 'miniormeteor');
  assert.equal(dex().baseStats.miniormeteor[0], 60);
  assert.equal(battleFormFor('gengar', 50), null);
});

test('accuracy abilities, Truant, Libero and Transistor reach the estimate', async () => {
  const { getAccuracyFactor, getEffectiveHitMultiplier } = await import(
    '../src/teamBuilder/team-analysis.js',
  );
  const { setActiveGame, getActiveGame, loadGame } = await import(
    '../src/games/registry.js',
  );
  await loadGame('rejuv');
  const hurricane = { id: 'hurricane', accuracy: 70, basePower: 110 };
  assert.equal(getAccuracyFactor(hurricane), 0.7);
  assert.equal(getAccuracyFactor(hurricane, 'No Guard'), 1);
  assert.equal(getAccuracyFactor(hurricane, 'Compound Eyes'), 0.91);
  assert.equal(getAccuracyFactor({ id: 'thunder', accuracy: 70 }, 'Victory Star'), 0.77);
  assert.equal(getAccuracyFactor({ id: 'stoneedge', accuracy: 80 }, 'Compound Eyes'), 1);

  // Truant: every move loses a turn in two; a recharge move already has.
  const ret = { id: 'return', basePower: 102 };
  const hyperBeam = { id: 'hyperbeam', basePower: 150, recharge: true };
  const bulletSeed = { id: 'bulletseed', basePower: 25, multihit: [2, 5] };
  assert.equal(getEffectiveHitMultiplier(ret, 'Truant'), 2 / 3);
  assert.equal(getEffectiveHitMultiplier(hyperBeam, 'Truant'), 2 / 3);
  assert.ok(Math.abs(getEffectiveHitMultiplier(bulletSeed, 'Truant') - 3.1 * (2 / 3)) < 1e-9);
  assert.equal(getEffectiveHitMultiplier(ret), 1);

  // Libero gives STAB on every move, like Protean, in both fangames.
  const bare = { ...waterPulse, attackerTypes: ['Fire'] };
  assert.equal(
    estimateMoveDamage({ ...bare, ability: 'Libero' }),
    estimateMoveDamage({ ...bare, ability: 'Protean' }),
  );
  assert.ok(estimateMoveDamage({ ...bare, ability: 'Libero' }) > estimateMoveDamage(bare));

  // Transistor: 1.5x on Gen 7 data, 1.3x on Gen 9 data.
  const thunderbolt = { id: 'thunderbolt', type: 'Electric', category: 'Special', basePower: 90, flags: {} };
  assert.equal(getAbilityDamageMultiplier('Transistor', thunderbolt), 1.5);
  const previous = getActiveGame().id;
  setActiveGame('rejuv');
  try {
    assert.equal(getAbilityDamageMultiplier('Transistor', thunderbolt), 1.3);
  } finally {
    setActiveGame(previous);
  }
});

test('conditions the set guarantees are priced; unguaranteed ones stay out', async () => {
  const { EXPECTED_STINT_TURNS, downloadAttackShare, coverageDamageIntoType } =
    await import('../src/teamBuilder/damage-model.js');
  const physical = { id: 'facade', type: 'Normal', category: 'Physical', basePower: 70, flags: {} };
  const special = { id: 'psychic', type: 'Psychic', category: 'Special', basePower: 90, flags: {} };
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  const late = (1 + 1.5 * (EXPECTED_STINT_TURNS - 1)) / EXPECTED_STINT_TURNS;

  // An orb in the item slot activates Guts from turn two.
  assert.ok(near(getAbilityDamageMultiplier('Guts', physical, { heldItem: 'Flame Orb' }), late));
  assert.equal(getAbilityDamageMultiplier('Guts', physical, { heldItem: 'Leftovers' }), 1);
  assert.equal(getAbilityDamageMultiplier('Guts', physical), 1);
  assert.ok(near(getAbilityDamageMultiplier('Toxic Boost', physical, { heldItem: 'Toxic Orb' }), late));
  assert.equal(getAbilityDamageMultiplier('Toxic Boost', physical, { heldItem: 'Flame Orb' }), 1);
  assert.ok(near(getAbilityDamageMultiplier('Flare Boost', special, { heldItem: 'Flame Orb' }), late));

  // Booster Energy raises the highest stat; only Atk or SpA reach damage.
  const bulkyAtk = { atk: 300, def: 200, spa: 100, spd: 150, spe: 250 };
  assert.equal(getAbilityDamageMultiplier('Protosynthesis', physical, { heldItem: 'Booster Energy', stats: bulkyAtk }), 1.3);
  assert.equal(getAbilityDamageMultiplier('Quark Drive', special, { heldItem: 'Booster Energy', stats: bulkyAtk }), 1);
  const fast = { atk: 200, def: 200, spa: 200, spd: 200, spe: 300 };
  assert.equal(getAbilityDamageMultiplier('Protosynthesis', physical, { heldItem: 'Booster Energy', stats: fast }), 1);

  // Weather and terrain the user sets itself.
  const fire = { id: 'flamethrower', type: 'Fire', category: 'Special', basePower: 90, flags: {} };
  const water = { id: 'surf', type: 'Water', category: 'Special', basePower: 90, flags: {} };
  assert.equal(getAbilityDamageMultiplier('Drought', fire), 1.5);
  assert.equal(getAbilityDamageMultiplier('Drought', water), 0.5);
  assert.equal(getAbilityDamageMultiplier('Desolate Land', water), 0);
  assert.equal(getAbilityDamageMultiplier('Drizzle', water), 1.5);
  const electric = { id: 'thunderbolt', type: 'Electric', category: 'Special', basePower: 90, flags: {} };
  assert.equal(getAbilityDamageMultiplier('Electric Surge', electric, { attackerTypes: ['Electric'] }), 1.5);
  assert.equal(getAbilityDamageMultiplier('Electric Surge', electric, { attackerTypes: ['Electric', 'Flying'] }), 1);
  assert.ok(near(getAbilityDamageMultiplier('Orichalcum Pulse', physical), 4 / 3));

  // Download by the population's chance, not a median tie.
  const share = downloadAttackShare();
  assert.ok(share > 0.2 && share < 0.8, String(share));
  assert.ok(near(getAbilityDamageMultiplier('Download', physical), 1 + 0.5 * share));
  assert.ok(near(getAbilityDamageMultiplier('Download', special), 1 + 0.5 * (1 - share)));

  // Gen 9 boosts.
  const slash = { id: 'nightslash', type: 'Dark', category: 'Physical', basePower: 70, flags: { slicing: 1 } };
  assert.equal(getAbilityDamageMultiplier('Sharpness', slash), 1.5);
  assert.equal(getAbilityDamageMultiplier('Sharpness', physical), 1);
  const boomburst = { id: 'boomburst', type: 'Normal', category: 'Special', basePower: 140, flags: { sound: 1 } };
  assert.equal(getAbilityDamageMultiplier('Punk Rock', boomburst), 1.3);
  assert.equal(getAbilityDamageMultiplier('Gorilla Tactics', physical), 1.5);
  assert.ok(near(getAbilityDamageMultiplier('Sword of Ruin', physical), 4 / 3));
  assert.equal(getAbilityDamageMultiplier('Sword of Ruin', special), 1);

  // Scrappy reaches Ghosts with Normal and Fighting, nothing else.
  assert.equal(coverageDamageIntoType('return', 'Normal', 100, 'Ghost'), 0);
  assert.equal(coverageDamageIntoType('return', 'Normal', 100, 'Ghost', 'Scrappy'), 100);
  assert.equal(coverageDamageIntoType('shadowball', 'Ghost', 100, 'Normal', 'Scrappy'), 0);
  assert.equal(coverageDamageIntoType('return', 'Normal', 100, 'Rock', 'Scrappy'), 50);
});
