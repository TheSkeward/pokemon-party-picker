/**
 * @fileoverview The JSON layout of the game-file extracts.
 */

function inlineJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(', ')}]`;
  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .map(([key, entry]) => `${JSON.stringify(key)}: ${inlineJson(entry)}`);
  return entries.length ? `{ ${entries.join(', ')} }` : '{}';
}

// `wholeRows`: whether an array's entries stay on one line however long.
function layOut(value, indent, wholeRows) {
  const inline = inlineJson(value);
  if (value === null || typeof value !== 'object') return inline;
  if (indent.length + inline.length <= 80) return inline;
  const inner = `${indent}  `;
  const body = Array.isArray(value)
    ? value.map((entry) => inner +
        (wholeRows ? inlineJson(entry) : layOut(entry, inner, wholeRows)))
    : Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .map(
        ([key, entry]) =>
          `${inner}${JSON.stringify(key)}: ${layOut(entry, inner, wholeRows)}`,
      );
  const [open, close] = Array.isArray(value) ? '[]' : '{}';
  return `${open}\n${body.join(',\n')}\n${indent}${close}`;
}

/**
 * JSON with 2-space indentation, except that an array or object short
 * enough for one line stays on one line. The event extract is mostly small
 * records (a page condition, an encounter slot); one line each keeps it
 * readable and a third the size.
 * @param {*} value
 * @param {string=} indent
 * @return {string}
 */
export function formatJson(value, indent = '') {
  return layOut(value, indent, false);
}

/**
 * The same layout, except that every entry of an array takes one line,
 * however long. For an extract that lists records by the thousand, each
 * too long for a line of formatJson's: broken up, they are half
 * indentation.
 * @param {*} value
 * @return {string}
 */
export function formatJsonRows(value) {
  return layOut(value, '', true);
}
