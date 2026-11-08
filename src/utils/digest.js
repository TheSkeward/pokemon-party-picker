/**
 * @fileoverview Fixed-length digest of a string, for cache keys built from
 * large descriptions (a progression, a breeding context). Four independent
 * 32-bit multiplicative lanes give 128 bits: a collision would serve one
 * context's cached verdict for another, so the lanes are deliberately more
 * than a key needs. Not cryptographic.
 */

const LANES = [
  [0x811c9dc5, 0x01000193],
  [0x9e3779b9, 0x85ebca6b],
  [0x27d4eb2f, 0xc2b2ae35],
  [0x165667b1, 0x27d4eb2f],
];

/**
 * @param {string} text
 * @return {string} 28 base-36 characters, the same for the same text.
 */
export function digest(text) {
  const lanes = LANES.map(([seed]) => seed);
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    for (let lane = 0; lane < lanes.length; lane += 1) {
      lanes[lane] = Math.imul(lanes[lane] ^ code, LANES[lane][1]);
    }
  }
  return lanes.map((lane) => (lane >>> 0).toString(36).padStart(7, '0')).join('');
}
