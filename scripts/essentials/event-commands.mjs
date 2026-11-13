/**
 * @fileoverview Reads an RPG Maker XP command list (an event page's or a
 * common event's): the conditions a page and a branch test, the scripts a
 * list runs, and which commands run together.
 */

const COMPARISONS = ['==', '>=', '<=', '>', '<', '!='];
const TRIGGERS = ['action', 'playerTouch', 'eventTouch', 'autorun', 'parallel'];
const VARIABLE_OPS = ['set', 'add', 'sub', 'mul', 'div', 'mod'];

// A script's assignments to a switch or a variable by number; pbSet is the
// engine's own way to set a variable.
const SWITCH_ASSIGNMENT = /\$game_switches\[(\d+)\]\s*=\s*(true|false)/g;
const VARIABLE_ASSIGNMENT =
  /(?:\$game_variables\[(\d+)\]\s*([-+]?=)(?!=)|pbSet\(\s*(\d+)\s*,)/g;
// The number an assignment ends in, when a number is all it assigns.
const LITERAL_OPERAND = /^\s*(-?\d+)\s*(?:[;)\n]|$)/;

/**
 * @param {string} text
 * @return {string} The text on one line.
 */
export const collapse = (text) => text.replace(/\s+/g, ' ').trim();

/**
 * Names switches and variables the way System.rxdata does.
 */
export class Names {
  /** @param {!Object} system Plain System.rxdata. */
  constructor(system) {
    this.system = system;
    this.switchUses = new Map();
    this.variableUses = new Map();
  }

  /**
   * @param {number} id
   * @return {{switch: number, name: ?string}}
   */
  switch(id) {
    this.switchUses.set(id, (this.switchUses.get(id) ?? 0) + 1);
    return { switch: id, name: this.system.switches[id] ?? null };
  }

  /**
   * @param {number} id
   * @return {{variable: number, name: ?string}}
   */
  variable(id) {
    this.variableUses.set(id, (this.variableUses.get(id) ?? 0) + 1);
    return { variable: id, name: this.system.variables[id] ?? null };
  }

  /**
   * @return {!Object} The switches and variables named so far, by id. A
   *     marker's `uses` counts how often a reader named it, which can be
   *     more than once for one condition: a rough weight, not a count of
   *     the events it gates.
   */
  index() {
    const table = (uses, names) =>
      Object.fromEntries(
        [...uses]
          .sort((a, b) => a[0] - b[0])
          .map(([id, count]) => [id, { name: names[id] ?? null, uses: count }]),
      );
    return {
      switches: table(this.switchUses, this.system.switches),
      variables: table(this.variableUses, this.system.variables),
    };
  }
}

/**
 * @param {!Object} condition An event page's condition.
 * @param {!Names} names
 * @return {!Array<!Object>} What must hold for the page to be the live one.
 */
export function pageConditions(condition, names) {
  const out = [];
  if (condition.switch1_valid) out.push(names.switch(condition.switch1_id));
  if (condition.switch2_valid) out.push(names.switch(condition.switch2_id));
  if (condition.variable_valid) {
    out.push({
      ...names.variable(condition.variable_id),
      atLeast: condition.variable_value,
    });
  }
  if (condition.self_switch_valid) {
    out.push({ selfSwitch: condition.self_switch_ch });
  }
  return out;
}

function branchCondition(parameters, names) {
  const [type, a, b, c, d] = parameters;
  switch (type) {
    case 0:
      return { ...names.switch(a), is: b === 0 };
    case 1:
      return {
        ...names.variable(a),
        op: COMPARISONS[d],
        value: b === 0 ? c : names.variable(c),
      };
    case 2:
      return { selfSwitch: a, is: b === 0 };
    case 7:
      return { money: b === 0 ? '>=' : '<=', value: a };
    case 12:
      return { script: collapse(a) };
    default:
      return { conditionType: type, parameters: parameters.slice(1) };
  }
}

// A Script command's text with its continuation lines.
function scriptAt(list, index) {
  let text = list[index].parameters[0];
  for (let i = index + 1; list[i]?.code === 655; i++) {
    text += `\n${list[i].parameters[0]}`;
  }
  return text;
}

/**
 * @param {!Array<!Object>} list A command list.
 * @return {!Iterable<string>} Every script it runs or branches on.
 */
export function* scriptsIn(list) {
  for (const [index, { code, parameters }] of list.entries()) {
    if (code === 355) yield scriptAt(list, index);
    if (code === 111 && parameters[0] === 12) yield parameters[1];
  }
}

/**
 * Joins script commands with their continuation lines and gives every
 * command the chain of branch arms that encloses it, so a command can be
 * read with the conditions it sits under and the commands that run with it.
 * @param {!Array<!Object>} list An event page's or common event's commands.
 * @param {!Names} names
 * @return {!Array<!Object>} One step per command that matters: {index, code,
 *     parameters, chain, script?}. `chain` lists arm ids; `arms` on the
 *     returned array maps an arm id to its condition.
 */
export function walkCommands(list, names) {
  const steps = [];
  const arms = new Map();
  const stack = [];
  const closeDeeper = (indent) => {
    while (stack.length && stack.at(-1).indent > indent) stack.pop();
  };
  const setArm = (block, suffix, condition) => {
    block.arm = `${block.index}${suffix}`;
    arms.set(block.arm, condition);
  };
  list.forEach((command, index) => {
    const { code, indent, parameters } = command;
    closeDeeper(indent);
    const top = stack.at(-1);
    const owned = top && top.indent === indent;
    if (code === 411 && owned) {
      setArm(top, 'e', { not: top.condition });
      return;
    }
    if (code === 402 && owned) {
      setArm(top, `c${parameters[0]}`, { choice: parameters[1] });
      return;
    }
    if (code === 403 && owned) {
      setArm(top, 'x', { choice: null });
      return;
    }
    if ([412, 404, 413].includes(code)) {
      if (owned) stack.pop();
      return;
    }
    if ([401, 655, 0].includes(code)) return;
    const step = { index, code, parameters, chain: stack.map((b) => b.arm) };
    if (code === 355) step.script = scriptAt(list, index);
    if (code === 111) {
      const condition = branchCondition(parameters, names);
      const block = { index, indent, condition };
      setArm(block, 't', block.condition);
      stack.push(block);
      if (parameters[0] === 12) step.script = parameters[1];
    } else if (code === 102) {
      stack.push({ index, indent, arm: `${index}?` });
    } else if (code === 112) {
      const block = { index, indent };
      setArm(block, 'l', { loop: true });
      stack.push(block);
    }
    steps.push(step);
  });
  steps.arms = arms;
  return steps;
}

/**
 * @param {!Array<!Object>} steps The steps of walkCommands.
 * @param {!Array<string>} chain A step's chain of branch arms.
 * @return {!Array<!Object>} The conditions of the branches the step sits
 *     under, outermost first; a loop is no condition.
 */
export const enclosingConditions = (steps, chain) =>
  chain.map((arm) => steps.arms.get(arm)).filter((c) => c && !c.loop);

/**
 * The switches and variables a step writes: an event command's, or a
 * script's assignments. A switch write is {switch, name, to}. A variable
 * write is {variable, name, op} with its operand as the engine has it:
 * `constant`, `fromVariable` (another variable), `random` (a range),
 * `operandType` (one of the engine's other sources) or `entered` (a number
 * or a button the player is asked for). A script's write carries `script`,
 * and a `constant` only when a number is all it assigns.
 * @param {!Object} step A step of walkCommands.
 * @param {!Names} names
 * @return {!Array<!Object>}
 */
export function stateWrites(step, names) {
  const [a, b, c, d, e] = step.parameters;
  const out = [];
  if (step.code === 121) {
    for (let id = a; id <= b; id++) {
      out.push({ ...names.switch(id), to: c === 0 });
    }
  } else if (step.code === 122) {
    const operand = [
      () => ({ constant: e }),
      () => ({ fromVariable: names.variable(e) }),
      () => ({ random: [e, step.parameters[5]] }),
    ][d]?.() ?? { operandType: d };
    for (let id = a; id <= b; id++) {
      out.push({ ...names.variable(id), op: VARIABLE_OPS[c], ...operand });
    }
  } else if (step.code === 103 || step.code === 105) {
    out.push({ ...names.variable(a), op: 'set', entered: true });
  } else if (step.script) {
    const { script } = step;
    for (const m of script.matchAll(SWITCH_ASSIGNMENT)) {
      out.push({ ...names.switch(Number(m[1])), to: m[2] === 'true' });
    }
    for (const m of script.matchAll(VARIABLE_ASSIGNMENT)) {
      const op = { '+=': 'add', '-=': 'sub' }[m[2]] ?? 'set';
      const literal = LITERAL_OPERAND.exec(script.slice(m.index + m[0].length));
      out.push({
        ...names.variable(Number(m[1] ?? m[3])),
        op,
        ...(literal ? { constant: Number(literal[1]) } : {}),
        script: true,
      });
    }
  }
  return out;
}

/**
 * @param {!Array<string>} prefix A step's chain of branch arms.
 * @param {!Array<string>} chain Another's.
 * @return {boolean} Whether `chain` starts with `prefix`: the second step
 *     is in the first's scope or deeper.
 */
export const isPrefix = (prefix, chain) =>
  prefix.length <= chain.length && prefix.every((arm, i) => arm === chain[i]);

/**
 * How one step relates to another, the anchor: 'with' when it runs
 * whenever the anchor does (same or enclosing scope, or the anchor's own
 * success branch); 'before' or 'after' when it sits in an earlier or later
 * branch that the anchor's path may or may not enter; null when it is in a
 * sibling arm, which never runs together with the anchor.
 * @param {!Object} step
 * @param {!Object} anchor
 * @return {?string}
 */
export function relation(step, anchor) {
  if (step.index === anchor.index) return null;
  if (isPrefix(step.chain, anchor.chain)) return 'with';
  const depth = step.chain.findIndex((arm, i) => arm !== anchor.chain[i]);
  const arm = step.chain[depth];
  if (depth === anchor.chain.length) {
    if (arm === `${anchor.index}t`) return 'with';
    if (arm === `${anchor.index}e`) return null;
  } else if (parseInt(arm, 10) === parseInt(anchor.chain[depth], 10)) {
    return null;
  }
  return step.index > anchor.index ? 'after' : 'before';
}

/**
 * A page's gate and look; an action trigger, no conditions and no graphic
 * are the defaults and are left out.
 * @param {!Object} page
 * @param {number} index The page's position, from 0.
 * @param {!Names} names
 * @return {!Object}
 */
export function pageRecord(page, index, names) {
  const record = { page: index + 1 };
  const conditions = pageConditions(page.condition, names);
  if (conditions.length) record.conditions = conditions;
  if (page.trigger !== 0) record.trigger = TRIGGERS[page.trigger];
  const { character_name: character, tile_id: tile } = page.graphic;
  if (character || tile) record.graphic = character || 'tile';
  return record;
}
