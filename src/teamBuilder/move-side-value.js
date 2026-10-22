/**
 * @fileoverview Prices a status move's side effects, so two moves with the
 * same job are told apart by what they do besides it. Autotomize sheds 100
 * kg: Low Kick and Grass Knot then hit the user for less, Heavy Slam and
 * Heat Crash for more. A weight change is worth, over those attacks, how
 * often the ladder's sets carry the attack, times its effectiveness into the
 * mon, times the power change, as a share of a reference hit per opposing
 * set. PP is priced as the share of a long fight's clicks a move cannot
 * cover: nothing for a setup move's PP, real for a five-PP recovery move.
 * The first consumer is the stand-in comparison in the set builder.
 */
import { dex } from '../games/dex.js';
import { getTypeMultiplier } from '../playthrough/type-chart.js';
import { weightBucketPower, weightRatioPower } from './damage-model.js';
import { moveCarrierWeightOf, moveCarryOf } from './move-prior.js';

/** The power a reference hit carries; power changes are read against it. */
const REFERENCE_POWER = 80;
/**
 * Clicks a long fight asks of a move used every turn it is up (recovery,
 * Protect, status), and of one used once per switch-in (setup, hazards,
 * screens). PP at or above the count costs nothing.
 */
export const LONG_FIGHT_CLICKS = 12;
export const STINTS_PER_FIGHT = 3;
const ONCE_PER_STINT_ROLES = new Set(['setup', 'hazard_set', 'screen']);

/** Attacks whose power follows the target's weight. */
const TARGET_WEIGHT_ATTACKS = [
  { id: 'lowkick', type: 'Fighting' },
  { id: 'grassknot', type: 'Grass' },
];
/** Attacks whose power follows the user-to-target weight ratio. */
const RATIO_WEIGHT_ATTACKS = [
  { id: 'heavyslam', type: 'Steel' },
  { id: 'heatcrash', type: 'Fire' },
];

/**
 * @param {{id: string, types: !Array<string>}} member
 * @param {number} changeKg Negative sheds weight.
 * @return {number} Reference hits per opposing set the change saves the
 *     mon; negative when it costs. 0 for an unknown weight.
 */
export function weightChangeValue(member, changeKg) {
  if (!changeKg) return 0;
  const before = dex().weightsKg?.[member.id];
  if (!before) return 0;
  const after = Math.max(0.1, before + changeKg);
  const types = member.types || [];
  let value = 0;
  for (const attack of TARGET_WEIGHT_ATTACKS) {
    const carry = moveCarryOf(attack.id) / 100;
    if (!carry) continue;
    const delta = weightBucketPower(after) - weightBucketPower(before);
    value -=
      carry * getTypeMultiplier(attack.type, types) * delta / REFERENCE_POWER;
  }
  for (const attack of RATIO_WEIGHT_ATTACKS) {
    const carry = moveCarryOf(attack.id) / 100;
    const userKg = moveCarrierWeightOf(attack.id);
    if (!carry || !userKg) continue;
    const delta =
      weightRatioPower(userKg / after) - weightRatioPower(userKg / before);
    value -=
      carry * getTypeMultiplier(attack.type, types) * delta / REFERENCE_POWER;
  }
  return value;
}

/**
 * @param {{pp: number, roles: !Array<string>}} move
 * @return {number} Share of a long fight's clicks the move's PP cannot
 *     cover, 0 when it covers them or the PP is unknown.
 */
export function ppPenalty(move) {
  const pp = move.pp || 0;
  if (!pp) return 0;
  const oncePerStint = (move.roles || []).some(
    (role) => ONCE_PER_STINT_ROLES.has(role),
  );
  const clicks = oncePerStint ? STINTS_PER_FIGHT : LONG_FIGHT_CLICKS;
  return Math.max(0, 1 - pp / clicks);
}

/**
 * @param {!Object} move A decorated or hydrated legal move.
 * @param {{id: string, types: !Array<string>}} member
 * @return {number} The move's priced side effects, net of its PP penalty.
 */
export function statusSideValue(move, member) {
  return weightChangeValue(member, move.weightChangeKg || 0) - ppPenalty(move);
}
