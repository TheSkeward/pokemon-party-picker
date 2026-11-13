/**
 * @fileoverview Records which keys of a record a computation reads, so a
 * memo of its result can outlive a change to a key it never read.
 */

/**
 * @param {!Object} record
 * @return {{record: !Object, agreesWith: function(!Object): boolean}}
 *     `record` reads as the original and is what the computation is handed.
 *     `agreesWith(other)` says whether `other` holds the same value under
 *     every key read or tested so far. A computation that lists the keys
 *     has in effect read them all, so nothing but the original agrees.
 */
export function trackReads(record) {
  const keys = new Set();
  let enumerated = false;
  const note = (key) => {
    if (typeof key === 'string') keys.add(key);
  };
  return {
    record: new Proxy(record, {
      get(target, key, receiver) {
        note(key);
        return Reflect.get(target, key, receiver);
      },
      has(target, key) {
        note(key);
        return Reflect.has(target, key);
      },
      ownKeys(target) {
        enumerated = true;
        return Reflect.ownKeys(target);
      },
    }),
    agreesWith: (other) =>
      !enumerated && [...keys].every((key) => record[key] === other[key]),
  };
}
