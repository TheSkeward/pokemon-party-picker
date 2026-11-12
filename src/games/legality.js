/**
 * @fileoverview The active game's move sources and legality rules: its TM,
 * TMX (HM-like), and tutor option tables with pickup timing, and the rules
 * text the progression view states. Reads the descriptor, so the engine
 * never names one game's machines.
 */
import { getActiveGame } from './registry.js';
import { moveId } from '../utils/ids.js';

/**
 * @return {{tmOptions: !Array<!Object>, tmxOptions: !Array<!Object>,
 *     tmxLabel: string, tutorGroups: !Array<!Object>,
 *     tutorOptions: !Array<!Object>}}
 */
export function moveSources() {
  return getActiveGame().moveSources;
}

/**
 * One machine or tutor that teaches a move. `label` is the machine's code
 * ("TM34", "TMX4", "HM03") or "Tutor"; `badge` is the badge count the
 * availability text names (0 from the start), null when it names none;
 * `location` is the pickup spot, or the tutor's.
 * @typedef {{kind: string, label: string, badge: ?number, available: string,
 *     location: string}}
 */
let TeachingRoute;

// Route index per game, keyed by its move-source tables.
const TEACHING_ROUTES = new WeakMap();

// "After Badge NN", "After the Champion (Badge 08)" and "From the start"
// are the forms the games' tables use.
function badgeOfAvailability(text) {
  if (/^From the start/i.test(text)) return 0;
  const match = /Badge\s+(\d+)/i.exec(text);
  return match ? Number.parseInt(match[1], 10) : null;
}

/**
 * @return {!Map<string, !Array<!TeachingRoute>>} Move id -> the machines
 *     and tutors that teach it in the active game, earliest badge first and
 *     a route with no badge last. Routes at one badge keep the tables'
 *     order: machines, HM-like machines, then tutors.
 */
export function teachingRoutesByMove() {
  const sources = moveSources();
  let routes = TEACHING_ROUTES.get(sources);
  if (routes) return routes;
  routes = new Map();
  const add = (id, kind, label, available, location) => {
    const text = String(available || '');
    const route = {
      kind,
      label,
      badge: badgeOfAvailability(text),
      available: text,
      location: String(location || ''),
    };
    routes.set(id, [...(routes.get(id) || []), route]);
  };
  for (const option of sources.tmOptions) {
    add(moveId(option.move), 'tm', option.code, option.available,
      option.location);
  }
  for (const option of sources.tmxOptions) {
    add(moveId(option.move), 'tmx', option.code, option.available,
      option.location);
  }
  for (const group of sources.tutorGroups) {
    for (const option of group.options || []) {
      add(option.id, 'tutor', 'Tutor', option.available || group.available,
        group.label);
    }
  }
  const order = (route) => route.badge ?? Number.MAX_SAFE_INTEGER;
  for (const list of routes.values()) {
    list.sort((a, b) => order(a) - order(b));
  }
  TEACHING_ROUTES.set(sources, routes);
  return routes;
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
