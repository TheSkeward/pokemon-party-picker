/**
 * @fileoverview Order-independent serialization for cache keys.
 */

/**
 * @param {*} value
 * @return {string} The same text for the same content: object keys are
 *     sorted, and so are array elements, which the callers hold as sets
 *     (owned items, TM ids, bias).
 */
export function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).sort().join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}
