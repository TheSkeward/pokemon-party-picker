// Event commands and pages as RPG Maker XP stores them, for the tests of
// the readers that walk them (scripts/essentials/event-commands.mjs and
// item-events.mjs). A builder is named for the editor command it stands
// for; `indent` is the depth the editor nests the command at.

export const command = (code, indent, ...parameters) =>
  ({ code, indent, parameters });

// A Script command: its first line, then a continuation command per line.
export const script = (indent, ...lines) =>
  lines.map((line, i) => command(i === 0 ? 355 : 655, indent, line));

const COMPARISONS = ['==', '>=', '<=', '>', '<', '!='];
export const ifSwitch = (indent, id, on = true) =>
  command(111, indent, 0, id, on ? 0 : 1);
export const ifVariable = (indent, id, comparison, value) =>
  command(111, indent, 1, id, 0, value, COMPARISONS.indexOf(comparison));
export const ifScript = (indent, text) => command(111, indent, 12, text);
export const otherwise = (indent) => command(411, indent);
export const end = (indent) => command(412, indent);

export const showChoices = (indent, ...labels) =>
  command(102, indent, labels, 0);
export const whenChoice = (indent, index, label) =>
  command(402, indent, index, label);
export const whenCancel = (indent) => command(403, indent);
export const endChoices = (indent) => command(404, indent);

export const setSwitch = (indent, id, on = true) =>
  command(121, indent, id, id, on ? 0 : 1);
const OPERATIONS = ['set', 'add', 'sub', 'mul', 'div', 'mod'];
export const setVariable = (indent, id, operation, constant) =>
  command(122, indent, id, id, OPERATIONS.indexOf(operation), 0, constant);
export const setSelfSwitch = (indent, letter, on = true) =>
  command(123, indent, letter, on ? 0 : 1);

// A page of the commands given; a command list may nest lists, so a
// builder that makes several commands can sit among the others.
export const page = (list, condition = {}, look = {}) => ({
  condition,
  list: list.flat(),
  trigger: 0,
  graphic: { character_name: '', tile_id: 0 },
  ...look,
});
export const whenSwitch = (id) => ({ switch1_valid: true, switch1_id: id });
export const whenVariable = (id, value) =>
  ({ variable_valid: true, variable_id: id, variable_value: value });
export const whenSelfSwitch = (letter) =>
  ({ self_switch_valid: true, self_switch_ch: letter });
