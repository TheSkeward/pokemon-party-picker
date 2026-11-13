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
// set under a switch. A chain longer than this stays undated. A quest that
// counts itself up, each step waiting on the last, is no such chain: its
// steps are worked out together, however many.
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
 * kind (a draw at random, a value the player enters, a copy of another
 * variable, a lowering, anything else), and per common event id the events
 * that call it.
 * @typedef {{
 *   switches: !Object<string, {name: string, on: !Array<!Setter>}>,
 *   variables: !Object<string, {name: string, raises: !Array<!Setter>,
 *       draws: number, entered: number, copies: number, lowered: number,
 *       other: number}>,
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

// The value of its own variable an assignment waits for: the floor of a
// condition that asks the variable to have reached something lower than
// what is assigned; 0 for any other condition.
function ownFloor(condition, name, assigned) {
  const floor = condition.atLeast ?? condition.value;
  const waits = condition.variable != null && condition.name === name &&
    (condition.atLeast != null || ['>=', '>', '=='].includes(condition.op));
  return waits && typeof floor === 'number' && floor > 0 && floor < assigned
    ? floor : 0;
}

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
  // A variable's steps at a depth, worked out once: by the entry itself,
  // since two ids may share a name.
  const stepMemo = new Map();
  const stepsOf = (entry, kind, depth, compute) => {
    const key = `${kind}|${depth}`;
    const known = stepMemo.get(entry) || new Map();
    stepMemo.set(entry, known);
    if (!known.has(key)) known.set(key, compute(entry, depth));
    return known.get(key);
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
  const setterBadge = (setter, depth, conditions = setter.conditions) => {
    const rules = rulesAt(depth - 1);
    const gate = conditionBadge(conditions, rules);
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

  // The outright assignments of a variable, each with the value it sets
  // and the badge it can first run at. A step may wait on the variable's
  // own earlier value, so the steps are worked out together: each is
  // lowered to the later of its own gate and the first step that reaches
  // the value it waits for, until nothing moves.
  const assignments = (entry, depth) => {
    const steps = entry.raises
      .filter((setter) => setter.op === 'set')
      .map((setter) => {
        const floors = setter.conditions.map((condition) =>
          ownFloor(condition, entry.name, setter.constant));
        return {
          value: setter.constant,
          waitsFor: Math.max(0, ...floors),
          gate: setterBadge(
            setter, depth,
            setter.conditions.filter((_, index) => !floors[index])),
          badge: Infinity,
        };
      })
      .filter((step) => step.gate != null);
    const reached = (value) => (value <= 0 ? 0 : Math.min(
      Infinity,
      ...steps.filter((step) => step.value >= value)
        .map((step) => step.badge)));
    for (let moved = true; moved;) {
      moved = false;
      for (const step of steps) {
        const badge = Math.max(step.gate, reached(step.waitsFor));
        if (badge < step.badge) {
          step.badge = badge;
          moved = true;
        }
      }
    }
    return steps.filter((step) => step.badge !== Infinity);
  };

  // The events that add to a variable, each once for the most it adds, in
  // the order they can first run.
  const additions = (entry, depth) => {
    const steps = new Map();
    for (const setter of entry.raises) {
      const badge = setter.op === 'add' ? setterBadge(setter, depth) : null;
      if (badge == null) continue;
      const key = setter.commonEventId != null
        ? `c${setter.commonEventId}` : `${setter.mapId}|${setter.eventId}`;
      const step = steps.get(key);
      steps.set(key, {
        badge: Math.min(step?.badge ?? Infinity, badge),
        amount: Math.max(step?.amount ?? 0, setter.constant),
      });
    }
    return [...steps.values()].sort((a, b) => a.badge - b.badge);
  };

  const variableDate = (name, floor, depth) =>
    latestOfIds(variables.get(name), (entry) => {
      // Written only by a draw at random or by what the player enters (a
      // menu pick, a number typed): a value of the moment, which any badge
      // count can see.
      if (
        !entry.raises.length && entry.draws + entry.entered > 0 &&
        !entry.copies && !entry.other
      ) {
        return 0;
      }
      // Assigned outright: the first step of a value that high.
      const assigned = earliest(
        stepsOf(entry, 'set', depth, assignments)
          .filter((step) => step.value >= floor)
          .map((step) => step.badge));
      // Counted up from nothing.
      let total = 0;
      let counted = null;
      for (const step of stepsOf(entry, 'add', depth, additions)) {
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
