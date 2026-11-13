/**
 * @fileoverview Dates the switches and variables a game's own rules do not
 * date, from the events that set them (the gate-setters extract). A quest
 * switch is on no earlier than the first event that turns it on can run;
 * a counter reaches a value no earlier than enough of the events that add
 * to it can. Pure: the timeline builder feeds it the extract, the tests
 * feed it fixtures.
 *
 * Every shortcut here errs late, never early: a write this cannot read, an
 * event that could run twice, a chain cut off for depth each leave a gate
 * dated later than it may open, or not at all.
 */

import { conditionBadge } from './event-sources.mjs';

// How many setters deep a gate is followed: a switch set under a switch
// set under a switch. A chain longer than this stays undated.
const CHAIN_DEPTH = 6;

/**
 * One write that raises a gate: turns a switch on, or adds or assigns a
 * positive constant to a variable. It sits in a map event, or in a common
 * event, which runs where it is called from.
 * @typedef {{mapId: (number|undefined), eventId: (number|undefined),
 *     commonEventId: (number|undefined), conditions: !Array<!Object>,
 *     op: (string|undefined), constant: (number|undefined)}}
 */
let Setter;

/**
 * The gate-setters extract: per switch id the writes that turn it on, per
 * variable id the writes that raise it and how many other writes it has by
 * kind, and per common event id the events that call it.
 * @typedef {{
 *   switches: !Object<string, {name: string, on: !Array<!Setter>}>,
 *   variables: !Object<string, {name: string, raises: !Array<!Setter>,
 *       draws: number, copies: number, lowered: number, other: number}>,
 *   calledFrom: !Object<string, !Array<{mapId: number,
 *       conditions: !Array<!Object>}>>,
 * }}
 */
let GateSetters;

// Entries by name: conditions name what they test, and two ids may share a
// name.
function byName(entries) {
  const named = new Map();
  for (const entry of Object.values(entries)) {
    named.set(entry.name, [...(named.get(entry.name) || []), entry]);
  }
  return named;
}

const earliest = (badges) => {
  const dated = badges.filter((badge) => badge != null);
  return dated.length ? Math.min(...dated) : null;
};

/**
 * @param {!GateSetters} gateSetters
 * @param {function(number): ?number} reachBadgeOf Map id -> the badge count
 *     the map is reached at; null for one nothing dates or never entered.
 * @param {!EventDating} dating The game's own rules, which come first.
 * @return {!EventDating} Those rules, and behind them the date each
 *     remaining switch or variable takes from its setters.
 */
export function setterDating(gateSetters, reachBadgeOf, dating) {
  const switches = byName(gateSetters.switches);
  const variables = byName(gateSetters.variables);
  const memo = new Map();
  const remember = (key, compute) => {
    if (!memo.has(key)) memo.set(key, compute());
    return memo.get(key);
  };

  // The rules at a depth: the game's own, then setters dated by the rules
  // one level down. At depth 0 only the game's own.
  const rulesAt = (depth) => ({
    switchBadge: (name) => dating.switchBadge(name) ??
      (depth > 0
        ? remember(`${depth}|s|${name}`, () => switchDate(name, depth))
        : null),
    variableBadge: (name, floor) => dating.variableBadge(name, floor) ??
      (depth > 0
        ? remember(
          `${depth}|v|${name}|${floor}`,
          () => variableDate(name, floor, depth))
        : null),
  });

  // When a write can first run: its map reached and its conditions met,
  // or, in a common event, the first of its callers.
  const setterBadge = (setter, depth) => {
    const rules = rulesAt(depth - 1);
    const gate = conditionBadge(setter.conditions, rules);
    if (gate == null) return null;
    if (setter.commonEventId == null) {
      const reached = reachBadgeOf(setter.mapId);
      return reached == null ? null : Math.max(reached, gate);
    }
    const callers = gateSetters.calledFrom[setter.commonEventId] || [];
    const called = earliest(callers.map((caller) => {
      const reached = reachBadgeOf(caller.mapId);
      const callGate = conditionBadge(caller.conditions, rules);
      return reached == null || callGate == null
        ? null : Math.max(reached, callGate);
    }));
    return called == null ? null : Math.max(called, gate);
  };

  // A name two ids share is dated only when both are, by the later.
  const latestOfIds = (entries, dateOf) => {
    if (!entries) return null;
    const dates = entries.map(dateOf);
    return dates.some((badge) => badge == null) ? null : Math.max(...dates);
  };

  const switchDate = (name, depth) =>
    latestOfIds(switches.get(name), (entry) =>
      earliest(entry.on.map((setter) => setterBadge(setter, depth))));

  const variableDate = (name, floor, depth) =>
    latestOfIds(variables.get(name), (entry) => {
      // Written only by a draw at random: a value of the moment, which any
      // badge count can see.
      if (
        !entry.raises.length && entry.draws > 0 && !entry.copies &&
        !entry.other
      ) {
        return 0;
      }
      const dated = entry.raises
        .map((setter) => ({ ...setter, badge: setterBadge(setter, depth) }))
        .filter((setter) => setter.badge != null);
      // Assigned outright: the first write of a value that high.
      const assigned = earliest(dated
        .filter((setter) => setter.op === 'set' && setter.constant >= floor)
        .map((setter) => setter.badge));
      // Counted up from nothing: each event adds once, the most it can.
      const steps = new Map();
      for (const setter of dated.filter((write) => write.op === 'add')) {
        const key = setter.commonEventId != null
          ? `c${setter.commonEventId}` : `${setter.mapId}|${setter.eventId}`;
        const step = steps.get(key);
        steps.set(key, {
          badge: Math.min(step?.badge ?? Infinity, setter.badge),
          amount: Math.max(step?.amount ?? 0, setter.constant),
        });
      }
      let total = 0;
      let counted = null;
      for (const step of
        [...steps.values()].sort((a, b) => a.badge - b.badge)) {
        total += step.amount;
        if (total >= floor) {
          counted = step.badge;
          break;
        }
      }
      return earliest([assigned, counted]);
    });

  return rulesAt(CHAIN_DEPTH);
}
