/**
 * @fileoverview What raises the switches and variables that gate an item.
 *
 * A give, a mart or a row of a mart sits under conditions on switches and
 * variables. One of those is on, or high enough, no earlier than the events
 * that raise it can run, so a consumer can date it from them. This records,
 * for every gating switch and variable the game's consumers do not already
 * date, each command that turns it on or raises it with the conditions that
 * command runs under, and counts its other writes; and the same for the
 * switches and variables behind the undated conditions of those commands,
 * until nothing new turns up.
 */
import {
  enclosingConditions,
  Names,
  pageConditions,
  stateWrites,
  walkCommands,
} from './event-commands.mjs';

const TRIGGERS = ['call', 'autorun', 'parallel'];

// A script's reads of a switch or a variable by number; pbGet is the
// engine's own way to read a variable.
const SWITCH_READ = /\$game_switches\[(\d+)\]/g;
const VARIABLE_READ = /(?:\$game_variables\[|pbGet\(\s*)(\d+)/g;

const noSwitchWrites = () => ({ on: [], turnedOff: 0 });
const noVariableWrites = () =>
  ({ raises: [], draws: 0, entered: 0, copies: 0, lowered: 0, other: 0 });
const NO_WRITES = { switches: noSwitchWrites, variables: noVariableWrites };

// The switches and variables one condition reads, as [kind, id] pairs.
function* idsRead(condition) {
  if (condition.not) yield* idsRead(condition.not);
  if (condition.switch != null) yield ['switches', condition.switch];
  if (condition.variable != null) yield ['variables', condition.variable];
  if (condition.value?.variable != null) {
    yield ['variables', condition.value.variable];
  }
  for (const [, id] of (condition.script ?? '').matchAll(SWITCH_READ)) {
    yield ['switches', Number(id)];
  }
  for (const [, id] of (condition.script ?? '').matchAll(VARIABLE_READ)) {
    yield ['variables', Number(id)];
  }
}

// Which of a variable's counts a write of it goes under, or `raises` for
// one that is listed: a positive constant assigned or added.
function variableWriteKind(write) {
  const { op, constant, random, entered, fromVariable } = write;
  if (random) return 'draws';
  if (entered) return 'entered';
  if (fromVariable) return 'copies';
  if (constant == null) return 'other';
  if (op === 'sub' || (op === 'set' && constant <= 0)) return 'lowered';
  return ['set', 'add'].includes(op) && constant > 0 ? 'raises' : 'other';
}

// Every command list of the game with where it is and the conditions it
// runs under: each page of each map event, then each common event. An
// autorun or parallel common event runs while its switch is on.
function* commandLists(files, names) {
  for (const { mapId, map } of files.maps) {
    const events = [...map.events.values()].sort((a, b) => a.id - b.id);
    for (const event of events) {
      for (const [index, page] of event.pages.entries()) {
        yield {
          at: { mapId, eventId: event.id, page: index + 1 },
          conditions: pageConditions(page.condition, names),
          list: page.list,
        };
      }
    }
  }
  for (const event of files.commonEvents) {
    if (!event) continue;
    yield {
      at: {
        commonEventId: event.id,
        ...(event.trigger ? { trigger: TRIGGERS[event.trigger] } : {}),
      },
      conditions: event.trigger ? [names.switch(event.switch_id)] : [],
      list: event.list,
    };
  }
}

/**
 * Reads every write of a switch or variable in the game, and every call of
 * a common event.
 * @return {{switches: !Map<number, !Object>, variables: !Map<number, !Object>,
 *     calls: !Map<number, !Array<!Object>>}} Switch or variable id -> its
 *     writes, as extractGateSetters returns them less the name; common
 *     event id -> the commands that call it, each where it is and the
 *     conditions it runs under.
 */
function readWrites(files, names) {
  const found = { switches: new Map(), variables: new Map(), calls: new Map() };
  const writesOf = (kind, id) => {
    if (!found[kind].has(id)) found[kind].set(id, NO_WRITES[kind]());
    return found[kind].get(id);
  };
  for (const { at, conditions, list } of commandLists(files, names)) {
    const steps = walkCommands(list, names);
    for (const step of steps) {
      const here = {
        ...at,
        conditions: [...conditions, ...enclosingConditions(steps, step.chain)],
      };
      if (step.code === 117) {
        const [called] = step.parameters;
        found.calls.set(called, [...(found.calls.get(called) ?? []), here]);
      }
      for (const write of stateWrites(step, names)) {
        if (write.switch != null) {
          const writes = writesOf('switches', write.switch);
          if (write.to) writes.on.push(here);
          else writes.turnedOff++;
          continue;
        }
        const writes = writesOf('variables', write.variable);
        const kind = variableWriteKind(write);
        const { op, constant } = write;
        if (kind === 'raises') writes.raises.push({ ...here, op, constant });
        else writes[kind]++;
      }
    }
  }
  return found;
}

/**
 * What raises every switch and variable that gates an item and is not
 * already dated.
 * @param {{maps: !Iterable<{mapId: number, map: !Object}>,
 *     commonEvents: !Array}} files Plain Map###.rxdata files and
 *     CommonEvents.rxdata.
 * @param {!Object} system Plain System.rxdata.
 * @param {!Array<!Object>} gates The conditions the gives, the marts and
 *     their rows sit under, as the item-events extract records a condition.
 * @param {function(!Object): boolean=} isDated Whether a condition is one
 *     the game's consumers date without this; none is unless said.
 * @return {{switches: !Object<string, !Object>,
 *     variables: !Object<string, !Object>,
 *     calledFrom: !Object<string, !Array<!Object>>}}
 *     `switches`: id -> {name, on, turnedOff}: the commands that turn it
 *     on, and how many turn it off. `variables`: id -> {name, raises,
 *     draws, entered, copies, lowered, other}: the commands that assign or
 *     add a positive constant, each with its `op` ('set' or 'add') and
 *     `constant`; and how many writes draw at random, store what the
 *     player enters (a number typed, a button pressed), take another
 *     variable's value, lower it (subtract, or assign zero or less), or do
 *     anything else (a value only a script knows, one of the engine's
 *     other sources). A listed command is {mapId,
 *     eventId, page, conditions}, in map order; then, for one in a common
 *     event, {commonEventId, conditions}, with `trigger` for an event that
 *     runs by itself. `calledFrom`: the id of each common event that holds
 *     a listed command -> the commands that call it, in the same shape.
 *     Covered are the switches and variables the undated gates read and,
 *     in turn, those read by the undated conditions of every command
 *     listed and of the calls of its common event. A dated condition ends
 *     the chain: its date is known without what sets it.
 */
export function extractGateSetters(
  files, system, gates, isDated = () => false,
) {
  // Its own names: the item-events extract counts the uses its events make.
  const { calls, ...writes } = readWrites(files, new Names(system));
  const covered = { switches: new Map(), variables: new Map() };
  const calledFrom = new Map();
  const undatedIds = (conditions) => conditions
    .filter((condition) => !isDated(condition))
    .flatMap((condition) => [...idsRead(condition)]);
  const pending = undatedIds(gates);
  while (pending.length) {
    const [kind, id] = pending.pop();
    if (covered[kind].has(id)) continue;
    const found = writes[kind].get(id) ?? NO_WRITES[kind]();
    covered[kind].set(id, { name: system[kind][id] ?? null, ...found });
    for (const setter of found.on ?? found.raises) {
      pending.push(...undatedIds(setter.conditions));
      if (setter.commonEventId == null) continue;
      const callers = calls.get(setter.commonEventId) ?? [];
      calledFrom.set(setter.commonEventId, callers);
      for (const caller of callers) {
        pending.push(...undatedIds(caller.conditions));
      }
    }
  }
  const byId = (index) =>
    Object.fromEntries([...index].sort((a, b) => a[0] - b[0]));
  return {
    switches: byId(covered.switches),
    variables: byId(covered.variables),
    calledFrom: byId(calledFrom),
  };
}

/**
 * @param {{switches: !Object, variables: !Object}} gateSetters
 * @return {!Object} Counts for a quick read: the switches and variables
 *     covered, the commands listed for them, and how many have none.
 */
export function summariseGateSetters({ switches, variables }) {
  const lists = [
    ...Object.values(switches).map((entry) => entry.on),
    ...Object.values(variables).map((entry) => entry.raises),
  ];
  return {
    switches: Object.keys(switches).length,
    variables: Object.keys(variables).length,
    setters: lists.reduce((sum, list) => sum + list.length, 0),
    withoutSetter: lists.filter((list) => !list.length).length,
  };
}
