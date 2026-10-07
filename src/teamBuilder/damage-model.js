import { getTypeMultiplier } from '../playthrough/type-chart.js';
import { toId } from '../utils/ids.js';
import { natureStatMultiplier } from '../natures.js';
import { dex } from '../games/dex.js';

// A naive, defender-agnostic damage model. We can't know the real opponent's
// stats, so every move is scored as "unresisted output" against a fixed neutral
// wall (base-70 defense, no investment, same level). The result is a relative
// damage number that's comparable across moves, members, and — crucially — the
// physical/special split, since it scales by the attacker's actual Atk vs SpA.
//
// This feeds two things: the surfaced "X dmg" estimate, and the move
// recommender's ranking, so a physical attacker prefers its physical moves
// (and a fixed-damage move like Seismic Toss keeps its value on a weak
// attacker, where it is genuinely the best option).

// dex().baseStats rows are [Atk, Def, SpA, SpD, Spe].
const STAT_INDEX = { atk: 0, def: 1, spa: 2, spd: 3, spe: 4 };
// Spread EV strings are HP/Atk/Def/SpA/SpD/Spe.
const EV_INDEX = { hp: 0, atk: 1, def: 2, spa: 3, spd: 4, spe: 5 };

const DEFAULT_LEVEL = 100;
// The median base Def and SpD across the dex are both 70, so a base-70 neutral
// wall makes the figures read close to real damage dealt against an average
// mon.
const REFERENCE_DEFENSE_BASE = 70;
const STAB_MULTIPLIER = 1.5;

// ————— The reference defender's fractional types —————
// The neutral wall has no single typing; it carries each type combination
// (mono-type or pair) in the share of the game's species that have it,
// generated per generation from the progression species. Pairs are kept
// whole because types do not occur independently. Ordinary effectiveness
// still stays out of the estimate (the coverage vector applies it per
// defending type), but a move whose damage depends on the defender's type
// is priced by the chance its condition holds against that defender.
const TYPE_CONDITIONAL_MOVES = {
  // Hits only a target sharing a type with the user: the summed share of
  // every combination that contains one of the user's types.
  synchronoise: (combinations, attackerTypes) => {
    const own = new Set(attackerTypes);
    let chance = 0;
    for (const [combination, share] of Object.entries(combinations)) {
      if (combination.split('/').some((type) => own.has(type))) chance += share;
    }
    return Math.min(1, chance);
  },
};

/**
 * @param {string} moveId
 * @return {boolean} Whether the move's damage depends on the defender's type.
 */
export function isTypeConditionalMove(moveId) {
  return Object.hasOwn(TYPE_CONDITIONAL_MOVES, String(moveId || ''));
}

/**
 * The chance a type-conditional move's condition holds against the reference
 * defender, given the user's types; 1 for every other move.
 * @param {?string} moveId
 * @param {!Array<string>} attackerTypes
 * @return {number}
 */
export function typeConditionMultiplier(moveId, attackerTypes = []) {
  const rule = TYPE_CONDITIONAL_MOVES[String(moveId || '')];
  if (!rule) return 1;
  return rule(dex().typeCombinationShares || {}, attackerTypes);
}

function abilityId(ability) {
  return String(ability || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

// Same-type-attack bonus, ability-aware. Protean/Libero change the user's type
// to the move's before it hits, so EVERY attack gets STAB — the whole point of
// the ability and the reason a Protean Greninja's coverage is undervalued if
// ignored. Adaptability turns STAB into 2x. Everything else is the ordinary
// 1.5-if-matching.
function abilityStab(ability, attackerTypes, moveType) {
  const id = abilityId(ability);
  // Protean and Libero change the user's type before every attack in both
  // fangames: Reborn's Battler.rb never checks a once-per-switch-in flag and
  // Rejuvenation's sets that flag only when it is not running as
  // Rejuvenation, so the Gen 9 once-per-entry rule never applies.
  if (id === 'protean' || id === 'libero') return STAB_MULTIPLIER;
  const matches = attackerTypes.includes(moveType);
  if (id === 'adaptability') return matches ? 2 : 1;
  return matches ? STAB_MULTIPLIER : 1;
}

// ————————————————— Ability damage layer —————————————————
// The current battle form's assumed ability (mapped from the canonical
// target's evolutionary slot) scales damage when its condition is a property
// of the MOVE — its type, flags, or base power — or one the SET guarantees
// for itself: an orb in the item slot that activates the ability (Guts,
// Toxic Boost, Flare Boost), Booster Energy for Protosynthesis and Quark
// Drive, weather or terrain the ability itself sets (Drought, Drizzle, the
// Surges, Orichalcum Pulse, Hadron Engine), and Download, priced by the
// share of the game's species whose Defense is the lower stat. Conditions
// the set cannot guarantee stay out, because the estimate prices a typical
// unconditioned turn against a neutral wall: Blaze/Torrent/Overgrow/Swarm
// (needs <1/3 HP), Sand Force/Solar Power (needs another mon's weather),
// Analytic/Stakeout/Tinted Lens/Sniper/Rivalry (needs a specific target or
// turn order), Defeatist (assumed above half HP), Hero form (needs a switch).
// Defender-side abilities never apply — the reference wall is ability-less
// by construction.

// The -ate abilities convert the user's NORMAL moves and boost them 1.2x
// (the Gen 7 value; it was 1.3x in Gen 6). Conversion changes everything
// downstream — STAB, effectiveness, coverage, type Gems — which is exactly
// why Mega Salamence runs Return and Sylveon runs Hyper Voice.
const ATE_CONVERSIONS = {
  aerilate: 'Flying',
  galvanize: 'Electric',
  pixilate: 'Fairy',
  refrigerate: 'Ice',
};

// A decorated move may already carry its converted type (stamped as `type`
// for coverage/bias/display), with the pre-conversion type preserved in
// `rawType`. Deriving from rawType-first makes both conversion and the
// multiplier idempotent — raw and decorated moves give identical answers.
function baseMoveType(move) {
  return move.rawType ?? move.type;
}

// Moves whose type is decided by their own mechanic; the -ate abilities and
// Normalize leave them alone.
const TYPE_LOCKED_MOVES = new Set([
  'hiddenpower', 'weatherball', 'judgment', 'multiattack', 'revelationdance',
  'naturalgift', 'technoblast', 'terrainpulse', 'struggle',
]);

function typeConvertible(move) {
  return !TYPE_LOCKED_MOVES.has(String(move.id || ''));
}

/**
 * The type a move actually deals damage as under the ability: -ate abilities
 * convert Normal moves, Liquid Voice makes sound moves Water (Primarina's
 * whole STAB plan), Normalize makes everything Normal. Unchanged otherwise,
 * and never for a move whose type is its own mechanic (Hidden Power,
 * Judgment, Weather Ball...).
 * @param {?string} ability
 * @param {!Object} move
 * @return {string}
 */
export function getAbilityEffectiveMoveType(ability, move) {
  const id = abilityId(ability);
  const type = baseMoveType(move);
  if (!typeConvertible(move)) return type;
  if (ATE_CONVERSIONS[id] && type === 'Normal') return ATE_CONVERSIONS[id];
  if (id === 'liquidvoice' && move.flags?.sound) return 'Water';
  if (id === 'normalize') return 'Normal';
  return type;
}

// Moves Parental Bond does not strike twice (Gen 7): charge moves, the
// escalating rollers, self-KO moves, and the handful the games list.
const NO_SECOND_STRIKE = new Set([
  'rollout', 'iceball', 'explosion', 'selfdestruct', 'finalgambit',
  'endeavor', 'fling', 'uproar', 'skydrop', 'counter', 'mirrorcoat',
  'metalburst', 'bide',
]);

// Terrain boosts were 1.5x in Gen 7 and 1.3x from Gen 8.
const terrainBoost = () => (dex().gen >= 8 ? 1.3 : 1.5);

/**
 * How many turns a mon is expected to stay on the field in a playthrough
 * fight. No dataset measures trainer fights, so this is set from what can
 * be measured (scripts/measure-stints.mjs, September 2026, about 150
 * recent replays per ladder): a Gen 7 OU battle runs a median 3 turns per
 * knockout, and a switch-in stays a median 2 turns, mean 2.3 (Gen 9 OU:
 * 3 and 2.8). Ladder players switch far more than a trainer fight allows,
 * so the ladder stint is a floor; a playthrough mon usually stays through
 * at least one knockout and often a second, which puts the stint between
 * the 3 turns of one knockout and the 4.5 of a six-mon fight shared by four
 * stints. Four turns splits that. A boost that starts a turn late (an orb
 * that activates at the end of the first turn) covers the other three.
 */
export const EXPECTED_STINT_TURNS = 4;

// The average multiplier over a stint for a boost that applies from the
// second turn: (1 + boost × (N − 1)) / N.
const lateBoost = (boost) =>
  (1 + boost * (EXPECTED_STINT_TURNS - 1)) / EXPECTED_STINT_TURNS;

// The stat Booster Energy, Protosynthesis and Quark Drive raise: the highest
// of the six, ties going to the earlier of Atk, Def, SpA, SpD, Spe.
function boostedStat(stats) {
  if (!stats) return null;
  const order = ['atk', 'def', 'spa', 'spd', 'spe'];
  let best = null;
  for (const key of order) {
    const value = stats[key];
    if (!Number.isFinite(value)) continue;
    if (best == null || value > stats[best]) best = key;
  }
  return best;
}

/**
 * Damage multiplier for the assumed ability: move-property conditions and
 * the conditions the set guarantees for itself (see the layer comment).
 * Only one branch can fire per call in practice (a mon has one ability),
 * but the composition is written multiplicatively so a single ability with
 * several clauses (the -ate type gate + boost) stays readable. Fixed-damage
 * moves never see this — estimateMoveDamage resolves them before
 * multipliers, matching the games (Huge Power does not change Seismic Toss).
 * @param {?string} ability
 * @param {!Object} move
 * @param {{heldItem: (?string|undefined), attackerTypes:
 *     (!Array<string>|undefined), stats: (?Object|undefined)}=} context
 *     The set's held item, the user's types (a Flying type is not grounded
 *     for terrain), and its stat line for the boosted-stat abilities.
 * @return {number}
 */
export function getAbilityDamageMultiplier(ability, move, context = {}) {
  const id = abilityId(ability);
  if (!id) return 1;
  const type = baseMoveType(move);
  const flags = move.flags || {};
  const physical = move.category === 'Physical';
  const special = move.category === 'Special';
  const item = toId(context.heldItem || '');
  const grounded = !(context.attackerTypes || []).includes('Flying');
  let multiplier = 1;

  // Conditions the set guarantees for itself. An orb activates at the end
  // of the first turn, so its boost is averaged over the stint.
  const orb = item === 'flameorb' || item === 'toxicorb';
  if (id === 'guts' && physical && orb) multiplier *= lateBoost(1.5);
  if (id === 'toxicboost' && physical && item === 'toxicorb') {
    multiplier *= lateBoost(1.5);
  }
  if (id === 'flareboost' && special && item === 'flameorb') {
    multiplier *= lateBoost(1.5);
  }
  if ((id === 'protosynthesis' || id === 'quarkdrive') && item === 'boosterenergy') {
    const boosted = boostedStat(context.stats);
    if ((boosted === 'atk' && physical) || (boosted === 'spa' && special)) {
      multiplier *= 1.3;
    }
  }
  // Weather the ability sets: sun and rain scale Fire and Water; the primal
  // weathers void the opposing type outright.
  if (id === 'drought' || id === 'desolateland' || id === 'orichalcumpulse') {
    if (type === 'Fire') multiplier *= 1.5;
    if (type === 'Water') multiplier *= id === 'desolateland' ? 0 : 0.5;
  }
  if (id === 'drizzle' || id === 'primordialsea') {
    if (type === 'Water') multiplier *= 1.5;
    if (type === 'Fire') multiplier *= id === 'primordialsea' ? 0 : 0.5;
  }
  if (id === 'orichalcumpulse' && physical) multiplier *= 4 / 3;
  // Terrain the ability sets boosts a grounded user's moves of its type.
  if (grounded) {
    if (id === 'electricsurge' && type === 'Electric') multiplier *= terrainBoost();
    if (id === 'grassysurge' && type === 'Grass') multiplier *= terrainBoost();
    if (id === 'psychicsurge' && type === 'Psychic') multiplier *= terrainBoost();
    if (id === 'hadronengine' && type === 'Electric') multiplier *= terrainBoost();
  }
  if (id === 'hadronengine' && special) multiplier *= 4 / 3;
  // Download: +1 to the attacking stat the target's lower defense invites,
  // priced by how often that is each stat across the game's species.
  if (id === 'download') {
    const share = downloadAttackShare();
    if (physical) multiplier *= 1 + 0.5 * share;
    if (special) multiplier *= 1 + 0.5 * (1 - share);
  }

  // Attack-stat rewrites (our damage is linear in the attacking stat).
  if ((id === 'hugepower' || id === 'purepower') && physical) multiplier *= 2;
  // Hustle: +50% Atk at -20% physical accuracy. The accuracy factor applied
  // later reads move.accuracy and can't see the ability, so the expected-value
  // haircut is folded in here: 1.5 × 0.8 = 1.2. A move that cannot miss
  // keeps the whole 1.5.
  if (id === 'hustle' && physical) {
    multiplier *= 1.5 * (flags.nevermiss ? 1 : 0.8);
  }
  // Slow Start halves Atk for the first five turns, longer than the
  // expected stint (EXPECTED_STINT_TURNS), so it is priced as always-on.
  if (id === 'slowstart' && physical) multiplier *= 0.5;

  // Base-power boosts gated on move properties.
  if (id === 'technician' && move.basePower > 0 && move.basePower <= 60) {
    multiplier *= 1.5; // per-hit BP gate — multi-hit moves qualify per hit
  }
  if (id === 'toughclaws' && flags.contact) multiplier *= 1.3;
  if (id === 'strongjaw' && flags.bite) multiplier *= 1.5;
  if (id === 'megalauncher' && flags.pulse) multiplier *= 1.5;
  if (id === 'ironfist' && flags.punch) multiplier *= 1.2;
  if (id === 'reckless' && flags.recoil) multiplier *= 1.2;
  if (id === 'sheerforce' && flags.secondary) multiplier *= 1.3;
  if (id === 'sharpness' && flags.slicing) multiplier *= 1.5;
  if (id === 'punkrock' && flags.sound) multiplier *= 1.3;
  if (id === 'gorillatactics' && physical) multiplier *= 1.5;
  // The Ruin abilities cut every other Pokémon's defense or special
  // defense by a quarter: 4/3 on the user's own attacks of that category.
  if (id === 'swordofruin' && physical) multiplier *= 4 / 3;
  if (id === 'beadsofruin' && special) multiplier *= 4 / 3;

  // Type-keyed boosts.
  if (id === 'waterbubble' && type === 'Water') multiplier *= 2;
  if (id === 'steelworker' && type === 'Steel') multiplier *= 1.5;
  if (id === 'dragonsmaw' && type === 'Dragon') multiplier *= 1.5;
  if (id === 'rockypayload' && type === 'Rock') multiplier *= 1.5;
  if (id === 'steelyspirit' && type === 'Steel') multiplier *= 1.5;
  // Transistor was 1.5x in Gen 8 and 1.3x from Gen 9; Rejuvenation's engine
  // keys the same split on its generation constant. Its terrain bonus is a
  // field condition and stays out.
  if (id === 'transistor' && type === 'Electric') {
    multiplier *= dex().gen >= 9 ? 1.3 : 1.5;
  }
  if (id === 'darkaura' && type === 'Dark') multiplier *= 4 / 3;
  if (id === 'fairyaura' && type === 'Fairy') multiplier *= 4 / 3;
  if (ATE_CONVERSIONS[id] && type === 'Normal' && typeConvertible(move)) {
    multiplier *= 1.2;
  }
  // Normalize's boost arrived in Gen 7; before that it only converted.
  if (id === 'normalize' && typeConvertible(move) && dex().gen >= 7) {
    multiplier *= 1.2;
  }

  // Parental Bond: the second hit lands at 25% (Gen 7) → 1.25x on single-hit
  // moves; genuinely multi-hit moves, charge moves and the listed exceptions
  // don't get a bonus hit in-game.
  if (
    id === 'parentalbond' &&
    !move.multihit &&
    !move.charge &&
    !NO_SECOND_STRIKE.has(String(move.id || ''))
  ) {
    multiplier *= 1.25;
  }

  return multiplier;
}

// Nature -> attacking-stat multipliers (only Atk/SpA matter here). Natures that
// touch neither Atk nor SpA (e.g. Sassy hits SpD/Spe, Hasty hits Spe/Def) are
// simply absent and treated as neutral (1.0 / 1.0).
const NATURE_ATTACK_MULTIPLIERS = {
  // +Atk
  lonely: { atk: 1.1 }, // -Def
  brave: { atk: 1.1 }, // -Spe
  adamant: { atk: 1.1, spa: 0.9 }, // -SpA
  naughty: { atk: 1.1 }, // -SpD
  // -Atk
  bold: { atk: 0.9 }, // +Def
  timid: { atk: 0.9 }, // +Spe
  calm: { atk: 0.9 }, // +SpD
  modest: { atk: 0.9, spa: 1.1 }, // +SpA -Atk
  // +SpA
  mild: { spa: 1.1 }, // -Def
  quiet: { spa: 1.1 }, // -Spe
  rash: { spa: 1.1 }, // -SpD
  // -SpA
  impish: { spa: 0.9 }, // +Def
  jolly: { spa: 0.9 }, // +Spe
  careful: { spa: 0.9 }, // +SpD
};

// Typical uninvested HP at a level (median base HP ≈ 70 across the dex, IV 31)
// — the defender that fraction-of-HP moves (Super Fang) are scored against,
// matching the base-70 neutral-wall convention used for defenses.
const REFERENCE_HP_BASE = 70;
/**
 * @param {number} level
 * @return {number} The reference defender's full HP at the level.
 */
export function referenceHp(level) {
  const lvl = normalizeLevel(level);
  return Math.floor(((2 * REFERENCE_HP_BASE + 31) * lvl) / 100) + lvl + 10;
}

/**
 * Membership derives from fixedMoveDamage itself, so the two can never drift.
 * @param {string} moveId
 * @return {boolean}
 */
export function isFixedDamageMove(moveId) {
  return fixedMoveDamage(moveId, 1) != null;
}

// ————— Variable-power moves (stat-, weight-, and state-scaled) —————
// The dex reports base power 0 for these; their effective power is priced
// against the same REFERENCE DEFENDER convention as everything else: median
// base stat across the dex, uninvested at the attacker's level — exactly the
// base-70-defense / base-70-HP convention — plus the median dex weight for
// the weight formulas. Medians are COMPUTED from the generated data so they
// cannot silently drift from it (today: Spe 70, Atk 76, 30 kg).
//
// State-scaled moves take the model's standing "typical unconditioned turn"
// assumptions: both sides at full HP (Crush Grip/Wring Out strong, Flail/
// Reversal weak), nobody boosted (Punishment at its floor). Excluded and
// left at zero, documented: Beat Up (party-dependent), Fling / Natural Gift
// (consumes an unknown item), Present (coin-flip heal), Trump Card (PP
// state), Spit Up (needs Stockpile in the same set).
function medianOf(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
}
// Medians over the active game's dex, memoized per bundle so switching games
// recomputes them.
const REFERENCE_BASES = new WeakMap();
function referenceBases() {
  const bundle = dex();
  let refs = REFERENCE_BASES.get(bundle);
  if (!refs) {
    const stats = Object.values(bundle.baseStats);
    refs = {
      speed: medianOf(stats.map((row) => row[4])),
      attack: medianOf(stats.map((row) => row[0])),
      weightKg: medianOf(
        Object.values(bundle.weightsKg).filter((kg) => kg > 0),
      ),
      // The share of species whose Defense is below their Special Defense:
      // how often Download raises Attack rather than Special Attack (a tie
      // raises Special Attack).
      downloadAttackShare: stats.length
        ? stats.filter((row) => row[1] < row[3]).length / stats.length
        : 0.5,
    };
    REFERENCE_BASES.set(bundle, refs);
  }
  return refs;
}

/**
 * @return {number} How often Download raises Attack against the reference
 *     defender's fractional stats: the share of the game's species whose
 *     Defense is the lower defensive stat.
 */
export function downloadAttackShare() {
  return referenceBases().downloadAttackShare;
}

const VARIABLE_POWER_MOVE_IDS = new Set([
  'electroball',
  'gyroball',
  'grassknot',
  'lowkick',
  'heavyslam',
  'heatcrash',
  'punishment',
  'crushgrip',
  'wringout',
  'flail',
  'reversal',
  'magnitude',
]);

/**
 * @param {string} moveId
 * @return {boolean}
 */
export function isVariablePowerMove(moveId) {
  return VARIABLE_POWER_MOVE_IDS.has(moveId);
}

// Weight-bucket power shared by Grass Knot and Low Kick (Gen 3+ table).
function weightBucketPower(kg) {
  if (kg >= 200) return 120;
  if (kg >= 100) return 100;
  if (kg >= 50) return 80;
  if (kg >= 25) return 60;
  if (kg >= 10) return 40;
  return 20;
}

/**
 * Effective base power of a variable-power move at the attacker's level, vs
 * the reference defender. Returns null for moves outside the family.
 * The user's side of the speed formulas is their EXACT speed — the top
 * spread's EVs + nature, the same figure the stat tooltip displays — passed
 * in as attackerSpe; only when no stat line exists (no spread data, or a
 * bare estimateMoveDamage call) does it fall back to the mon's uninvested
 * speed at level. The defender's side is always the reference: median base
 * speed, uninvested.
 * @param {string} moveId
 * @param {number} level
 * @param {?string} attackerId
 * @param {?number} attackerSpe
 * @return {?number}
 */
export function variableMovePower(
  moveId, level, attackerId = null, attackerSpe = null, ability = null) {
  if (!VARIABLE_POWER_MOVE_IDS.has(moveId)) return null;
  const lvl = normalizeLevel(level);
  const id = attackerId ? toId(attackerId) : null;
  const baseSpe = (id && dex().baseStats[id]?.[4]) || referenceBases().speed;
  // Heavy Metal doubles and Light Metal halves the user's own weight.
  const weightScale =
    abilityId(ability) === 'heavymetal' ? 2
      : abilityId(ability) === 'lightmetal' ? 0.5 : 1;
  const weight =
    ((id && dex().weightsKg[id]) || referenceBases().weightKg) * weightScale;
  const referenceSpe = statValue(referenceBases().speed, 0, lvl, 1);
  const userSpe = Math.max(1, attackerSpe ?? statValue(baseSpe, 0, lvl, 1));

  switch (moveId) {
    case 'electroball': {
      const ratio = userSpe / Math.max(1, referenceSpe);
      if (ratio >= 4) return 150;
      if (ratio >= 3) return 120;
      if (ratio >= 2) return 80;
      if (ratio >= 1) return 60;
      return 40;
    }
    case 'gyroball': {
      return Math.min(150, Math.floor((25 * referenceSpe) / userSpe) + 1);
    }
    case 'grassknot':
    case 'lowkick':
      return weightBucketPower(referenceBases().weightKg);
    case 'heavyslam':
    case 'heatcrash': {
      const ratio = weight / Math.max(0.1, referenceBases().weightKg);
      if (ratio >= 5) return 120;
      if (ratio >= 4) return 100;
      if (ratio >= 3) return 80;
      if (ratio >= 2) return 60;
      return 40;
    }
    case 'punishment':
      return 60; // unboosted reference target — the move's floor
    case 'crushgrip':
    case 'wringout':
      return 120; // full-HP target
    case 'flail':
    case 'reversal':
      return 20; // full-HP user
    case 'magnitude':
      // Expected value of the 5/10/20/30/20/10/5% magnitude table.
      return 71;
    default:
      return null;
  }
}

/**
 * Damage a move actually lands into a defensive type, for coverage purposes.
 * Fixed-damage moves ignore effectiveness multipliers but NOT immunities
 * (Gen 7 rules): Seismic Toss deals its flat damage to anything Fighting can
 * touch and zero to Ghosts — it is never "super effective" and never resisted.
 * Scrappy and Mind's Eye let Normal and Fighting moves hit Ghosts at full
 * damage.
 * @return {number}
 */
export function coverageDamageIntoType(
  moveId, moveType, damage, defenseType, ability = null) {
  const id = abilityId(ability);
  const ghostSeen =
    (id === 'scrappy' || id === 'mindseye') &&
    defenseType === 'Ghost' &&
    (moveType === 'Normal' || moveType === 'Fighting');
  const multiplier = ghostSeen ? 1 : getTypeMultiplier(moveType, [defenseType]);
  if (isFixedDamageMove(moveId)) return multiplier === 0 ? 0 : damage;
  return damage * multiplier;
}

/**
 * True damage of fixed/fractional moves at a level. These ignore the user's
 * stats, STAB, and items in-game, so they're priced at their real damage — a
 * lvl-25 Seismic Toss deals exactly 25. Returns null when the move isn't one
 * of these.
 * @param {string} moveId
 * @param {number} level
 * @return {?number}
 */
export function fixedMoveDamage(moveId, level) {
  const lvl = normalizeLevel(level);
  switch (moveId) {
    case 'seismictoss':
    case 'nightshade':
      return lvl;
    case 'psywave':
      // Uniform 0.5x–1.5x the user's level — expected value 1.0x.
      return lvl;
    case 'sonicboom':
      return 20;
    case 'dragonrage':
      return 40;
    case 'superfang':
    case 'naturemadness':
      return Math.round(referenceHp(lvl) / 2); // half a typical body's HP
    case 'guardianofalola':
      return Math.round(referenceHp(lvl) * 0.75);
    case 'finalgambit':
      return referenceHp(lvl); // ≈ the user's own full HP
    default:
      return null;
  }
}

/**
 * @param {*} levelCap
 * @return {number} The level clamped to [1, 100]; 100 when unparseable.
 */
export function normalizeLevel(levelCap) {
  const parsed = Number.parseInt(levelCap, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LEVEL;
  if (parsed < 1) return 1;
  if (parsed > 100) return 100;
  return parsed;
}

/**
 * Smogon spread strings look like "Nature:HP/Atk/Def/SpA/SpD/Spe".
 * @param {*} spreadName
 * @return {?{nature: string, natureLabel: string, evs: !Array<number>}} Null
 *     when the string doesn't parse.
 */
export function parseSpread(spreadName) {
  if (typeof spreadName !== 'string') return null;
  const [naturePart, evPart] = spreadName.split(':');
  if (!naturePart || !evPart) return null;

  const evs = evPart.split('/').map((value) => Number.parseInt(value, 10));
  if (evs.length < 6 || evs.some((value) => !Number.isFinite(value))) {
    return null;
  }

  // natureLabel is the spread's verbatim nature text ("Adamant"), for
  // display; nature is its id, for the multiplier tables.
  return { nature: toId(naturePart), natureLabel: naturePart, evs };
}

/**
 * The attacking side a competitive spread builds toward: the stat its EVs
 * favour, else the one its nature boosts or spares (a -Atk nature means a
 * special build). A player builds one side and natures and EVs are costly to
 * change, so the recommender prices the set as that build. Null when the
 * spread shows no side (a wall spread with a neutral nature) or does not
 * parse.
 * @param {*} spreadName
 * @return {?string} 'physical', 'special' or null.
 */
export function investmentSideOfSpread(spreadName) {
  const parsed = parseSpread(spreadName);
  if (!parsed) return null;
  const atkEvs = parsed.evs[EV_INDEX.atk];
  const spaEvs = parsed.evs[EV_INDEX.spa];
  if (atkEvs !== spaEvs) return atkEvs > spaEvs ? 'physical' : 'special';
  const nature = NATURE_ATTACK_MULTIPLIERS[parsed.nature] || {};
  if ((nature.atk ?? 1) > 1 || (nature.spa ?? 1) < 1) return 'physical';
  if ((nature.spa ?? 1) > 1 || (nature.atk ?? 1) < 1) return 'special';
  return null;
}

// Each attacking-sided nature and its counterpart on the other side, same
// secondary stat: Timid (+Spe -Atk) mirrors to Jolly (+Spe -SpA).
const MIRROR_NATURES = Object.freeze({
  timid: 'jolly', jolly: 'timid',
  modest: 'adamant', adamant: 'modest',
  bold: 'impish', impish: 'bold',
  calm: 'careful', careful: 'calm',
  quiet: 'brave', brave: 'quiet',
  mild: 'lonely', lonely: 'mild',
  rash: 'naughty', naughty: 'rash',
});

/**
 * The same spread built on the other attacking side: Atk and SpA EVs
 * swapped and the nature mirrored, speed and bulk untouched. The card shows
 * this when the scoring priced a mon on the side its competitive spread
 * does not build, so the card describes the build the score describes.
 * @param {*} spreadName
 * @return {?string} Null when the spread does not parse.
 */
export function mirrorSpreadSide(spreadName) {
  const parsed = parseSpread(spreadName);
  if (!parsed) return null;
  const evs = [...parsed.evs];
  const { atk, spa } = EV_INDEX;
  [evs[atk], evs[spa]] = [evs[spa], evs[atk]];
  const nature = MIRROR_NATURES[parsed.nature] || parsed.nature;
  const label = nature.charAt(0).toUpperCase() + nature.slice(1);
  return `${label}:${evs.join('/')}`;
}

function statValue(base, ev, level, natureMultiplier) {
  const inner =
    Math.floor(((2 * base + 31 + Math.floor(ev / 4)) * level) / 100);
  return Math.floor((inner + 5) * natureMultiplier);
}

// Species whose fixed ability puts them in another form the moment they
// attack or enter battle, so their attacks come from that form's stats:
// Stance Change (Blade on any attack), Schooling (School form from level
// 20), Shields Down (Meteor form above half HP, and the estimate assumes
// full HP), Tera Shift (Terastal form on entry). Battle-state forms that a
// set cannot guarantee (Zen Mode, Power Construct, Hero) stay excluded
// with the other battle-state abilities.
const BATTLE_FORMS = Object.freeze({
  aegislash: { form: 'aegislashblade', label: 'Blade form' },
  wishiwashi: { form: 'wishiwashischool', label: 'School form', fromLevel: 20 },
  minior: { form: 'miniormeteor', label: 'Meteor form' },
  terapagos: { form: 'terapagosterastal', label: 'Terastal form' },
});

function battleFormEntry(pokemonId, level) {
  const entry = BATTLE_FORMS[pokemonId];
  if (!entry || level < (entry.fromLevel || 0)) return null;
  return dex().baseStats[entry.form] ? entry : null;
}

/**
 * @param {string} pokemonId
 * @param {number} level
 * @return {?string} The id of the form the species attacks from at this
 *     level, when the active game's dex has it; null otherwise.
 */
export function battleFormFor(pokemonId, level) {
  return battleFormEntry(pokemonId, level)?.form || null;
}

/**
 * Computes a member's effective Atk and SpA at the given level. With a real top
 * spread we honour its EVs + nature. Without one we assume full investment
 * (252 EVs + a boosting nature) on one attacking side: the `side` the caller
 * names, else the naturally stronger one. The recommender names the side of
 * the mon's strongest obtainable attack (team-analysis assumedInvestment), so
 * a Swellow whose Attack is higher is still priced as the special build it
 * becomes once Boomburst is legal.
 * @return {?{level: number, atk: number, spa: number, spe: number}} Null when
 *     the species has no base-stat row.
 */
export function getAttackingStats({ pokemonId, levelCap, spread, side }) {
  const level = normalizeLevel(levelCap);
  const battleForm = battleFormEntry(toId(pokemonId), level);
  const stats = dex().baseStats[battleForm?.form || toId(pokemonId)];
  if (!stats) return null;
  const formLabel = battleForm ? `${battleForm.label}, ` : '';
  const baseAtk = stats[STAT_INDEX.atk];
  const baseSpa = stats[STAT_INDEX.spa];
  const baseSpe = stats[STAT_INDEX.spe];

  const parsed = spread ? parseSpread(spread) : null;

  const baseDef = stats[STAT_INDEX.def];
  const baseSpd = stats[STAT_INDEX.spd];

  if (parsed) {
    const nature = NATURE_ATTACK_MULTIPLIERS[parsed.nature] || {};
    return {
      level,
      // Where the figures come from, for the damage working shown on hover.
      spreadLabel: `${formLabel}${parsed.natureLabel}, EVs ${parsed.evs.join('/')}`,
      atk: statValue(baseAtk, parsed.evs[EV_INDEX.atk], level, nature.atk ?? 1),
      spa: statValue(baseSpa, parsed.evs[EV_INDEX.spa], level, nature.spa ?? 1),
      // The defenses matter only to the boosted-stat abilities (Booster
      // Energy raises the highest stat of the six).
      def: statValue(
        baseDef,
        parsed.evs[EV_INDEX.def],
        level,
        natureStatMultiplier(parsed.nature, 'def'),
      ),
      spd: statValue(
        baseSpd,
        parsed.evs[EV_INDEX.spd],
        level,
        natureStatMultiplier(parsed.nature, 'spd'),
      ),
      // The spread's REAL speed (EVs + nature) — the same figure the stat
      // tooltip shows. Speed-scaled move power (Electro Ball, Gyro Ball)
      // reads it: the user's exact speed vs the median-speed reference
      // defender.
      spe: statValue(
        baseSpe,
        parsed.evs[EV_INDEX.spe],
        level,
        natureStatMultiplier(parsed.nature, 'spe'),
      ),
    };
  }

  const physical = side ? side === 'physical' : baseAtk >= baseSpa;
  return {
    level,
    spreadLabel: `${formLabel}assumed 252 EVs and a boosting nature in ${physical ? 'Atk' : 'SpA'}`,
    atk: statValue(baseAtk, physical ? 252 : 0, level, physical ? 1.1 : 1),
    spa: statValue(baseSpa, physical ? 0 : 252, level, physical ? 1 : 1.1),
    def: statValue(baseDef, 0, level, 1),
    spd: statValue(baseSpd, 0, level, 1),
    spe: statValue(baseSpe, 0, level, 1),
  };
}

/**
 * The full six-stat line a nature + EV spread produces at a level (31 IVs
 * assumed, matching Smogon spreads). Display-layer only — scoring never calls
 * this. `evs` is the [HP,Atk,Def,SpA,SpD,Spe] array; nature by name or id.
 * Returns null when the species has no base-stat row.
 * @return {?Object<string, number>} level, hp, atk, def, spa, spd, spe.
 */
export function computeFinalStats({ pokemonId, level, nature, evs }) {
  const id = toId(pokemonId);
  const stats = dex().baseStats[id];
  const baseHp = dex().baseHp[id];
  if (!stats || baseHp == null) return null;

  const at = normalizeLevel(level);
  const evOf = (index) => {
    const value = Array.isArray(evs) ? Number.parseInt(evs[index], 10) : 0;
    return Number.isFinite(value) ? Math.max(0, Math.min(252, value)) : 0;
  };
  const hp =
    baseHp === 1 // Shedinja
      ? 1
      : Math.floor(
        ((2 * baseHp + 31 + Math.floor(evOf(EV_INDEX.hp) / 4)) * at) / 100) +
        at +
        10;
  const result = { level: at, hp };
  for (const key of ['atk', 'def', 'spa', 'spd', 'spe']) {
    result[key] = statValue(
      stats[STAT_INDEX[key]],
      evOf(EV_INDEX[key]),
      at,
      natureStatMultiplier(nature, key),
    );
  }
  return result;
}

/**
 * Estimated unresisted damage for one move. Fixed-damage moves (Seismic Toss,
 * Night Shade, ...) use their REAL in-game damage at the attacker's level —
 * no stats, no STAB, no item boosts, exactly as the games compute them.
 * @return {number}
 */
export function estimateMoveDamage(params) {
  return explainMoveDamage(params).damage;
}

// Two decimals at most, no trailing zeros: 1.5, 1.3, 0.11.
const factorText = (value) => `${Math.round(value * 100) / 100}`;

/**
 * The estimate with its working: every quantity the figure is built from,
 * one line each, so a reader can check a Sheer Force Nidoking against the
 * numbers on the page. Same arithmetic as the estimate; `damage` is the
 * per-hit figure the estimate returns.
 * @param {{moveId: ?string, moveName: (string|undefined), basePower: number,
 *     category: string, type: string, attackerTypes: !Array<string>,
 *     attackerStats: ?Object, level: (number|undefined),
 *     itemMultiplier: number, itemName: (string|undefined),
 *     abilityMultiplier: number, ability: ?string,
 *     attackerId: ?string}} params The estimate's inputs, plus display
 *     names for the item and, through `ability`, the ability.
 * @return {{damage: number, steps: !Array<string>}}
 */
export function explainMoveDamage({
  moveId = null,
  moveName = '',
  basePower,
  category,
  type,
  attackerTypes = [],
  attackerStats,
  level,
  itemMultiplier = 1,
  itemName = '',
  // Move-property-conditional ability boost (getAbilityDamageMultiplier) —
  // computed by the caller from the RAW move so Technician's ≤60 BP gate sees
  // per-hit power, not the effective-hit-scaled figure passed as basePower.
  abilityMultiplier = 1,
  ability = null,
  // The attacker's species id, for variable-power moves whose formula reads
  // the user's own speed or weight (Electro Ball, Gyro Ball, Heavy Slam...).
  attackerId = null,
}) {
  const label = moveName || moveId || 'move';
  const stab = abilityStab(ability, attackerTypes, type);
  const lvl = normalizeLevel(level ?? attackerStats?.level);
  const steps = [];

  const fixed = fixedMoveDamage(moveId, lvl);
  if (fixed != null) {
    steps.push(
      `${label}: fixed damage, ${fixed} at level ${lvl}; stats, STAB and items do not apply.`,
    );
    // Parental Bond strikes fixed-damage moves twice at full value; the
    // half-HP moves take half of what is left, three quarters in all.
    const secondStrike = abilityId(ability) === 'parentalbond'
      ? (['superfang', 'naturemadness'].includes(moveId) ? 1.5
        : ['seismictoss', 'nightshade', 'psywave', 'sonicboom', 'dragonrage']
          .includes(moveId) ? 2 : 1)
      : 1;
    if (secondStrike !== 1) {
      steps.push(`× ${factorText(secondStrike)} Parental Bond second strike`);
    }
    return { damage: Math.round(fixed * secondStrike), steps };
  }

  // A type-conditional move lands only as often as the reference defender's
  // fractional types satisfy it.
  const typeCondition = typeConditionMultiplier(moveId, attackerTypes);

  // Variable-power moves arrive with base power 0; resolve their effective
  // power against the reference defender at this level, using the attacker's
  // exact speed when the stat line carries it.
  const variablePower = basePower
    ? null
    : variableMovePower(
      moveId, lvl, attackerId, attackerStats?.spe ?? null, ability);
  const resolvedPower = basePower || variablePower || 0;
  steps.push(
    variablePower != null
      ? `${label} · ${category} · ${resolvedPower} effective power against the reference defender`
      : `${label} · ${category} · ${factorText(resolvedPower)} base power`,
  );

  if (!resolvedPower) {
    steps.push('No base power: no damage.');
    return { damage: 0, steps };
  }

  // Technician reads the power a variable-power move resolves to; the
  // caller's multiplier only saw the raw zero.
  const technicianOnVariable =
    abilityId(ability) === 'technician' && variablePower != null &&
    variablePower <= 60;
  const abilityFactor = abilityMultiplier * (technicianOnVariable ? 1.5 : 1);

  const factors = [];
  if (stab !== 1) {
    factors.push(
      `× ${factorText(stab)} STAB${abilityId(ability) === 'adaptability' ? ' (Adaptability)' : abilityId(ability) === 'protean' ? ' (Protean)' : ''}`,
    );
  }
  if (abilityFactor !== 1) {
    factors.push(`× ${factorText(abilityFactor)} ${ability || 'ability'}`);
  }
  if (itemMultiplier !== 1) {
    factors.push(`× ${factorText(itemMultiplier)} ${itemName || 'item'}`);
  }
  if (typeCondition !== 1) {
    factors.push(
      `× ${factorText(typeCondition)} chance the defender shares one of the user's types`,
    );
  }
  const multiplier = stab * itemMultiplier * abilityFactor * typeCondition;

  if (!attackerStats) {
    const damage = Math.round(resolvedPower * multiplier);
    steps.push('No base stats for this species: power-only estimate.');
    if (factors.length) steps.push(factors.join(' · '));
    steps.push(`= ${damage} per hit`);
    return { damage, steps };
  }

  // Foul Play deals damage with the TARGET's Attack stat, not the user's —
  // priced as the reference defender's median Atk, uninvested at level.
  const foulPlay = moveId === 'foulplay';
  const attack = foulPlay
    ? statValue(referenceBases().attack, 0, lvl, 1)
    : category === 'Physical'
      ? attackerStats.atk
      : attackerStats.spa;
  const defense = statValue(REFERENCE_DEFENSE_BASE, 0, lvl, 1);
  const attackLabel = foulPlay
    ? `the reference defender's Atk ${attack} (Foul Play)`
    : `${category === 'Physical' ? 'Atk' : 'SpA'} ${attack}${attackerStats.spreadLabel ? ` (${attackerStats.spreadLabel})` : ''}`;
  steps.push(
    `Level ${lvl}: ${attackLabel} against a base-70 defender's ${category === 'Physical' ? 'Def' : 'SpD'} ${defense}`,
  );

  const baseDamage =
    Math.floor(
      (Math.floor(((2 * lvl) / 5 + 2) * resolvedPower * attack) / defense) / 50,
    ) + 2;
  steps.push(`Base damage ${baseDamage}`);
  if (factors.length) steps.push(factors.join(' · '));

  const damage = Math.round(baseDamage * multiplier);
  steps.push(`= ${damage} per hit`);
  return { damage, steps };
}
