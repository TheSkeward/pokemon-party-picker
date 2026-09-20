/**
 * @fileoverview The active game's move sources and legality rules: its TM,
 * TMX (HM-like), and tutor option tables with pickup timing, and the rules
 * text the progression view states. Reads the descriptor, so the engine
 * never names one game's machines.
 */
import { getActiveGame } from './registry.js';

/**
 * @return {{tmOptions: !Array<!Object>, tmxOptions: !Array<!Object>,
 *     tmxLabel: string, tutorGroups: !Array<!Object>,
 *     tutorOptions: !Array<!Object>}}
 */
export function moveSources() {
  return getActiveGame().moveSources;
}

/**
 * @return {{levelDown: boolean, hiddenPowerTypeChanger: boolean,
 *     reusableTms: boolean}} The move-acquisition mechanics the game has
 *     (see games/reborn.js).
 */
export function mechanics() {
  return getActiveGame().mechanics;
}

/**
 * @return {{legalityBase: !Object, tmxMoves: !Array<string>,
 *     promotedTmMoves: !Array<string>, notes: !Array<string>}}
 */
export function legalityRules() {
  return getActiveGame().rules;
}
