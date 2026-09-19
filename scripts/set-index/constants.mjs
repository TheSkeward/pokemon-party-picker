import path from 'node:path';
import { FAMILY_CONFIGS, familiesOfGen } from '../config.mjs';

/** @type {string} */
export const DATA_ROOT = path.resolve('site-data', 'data');
/** @type {string} */
export const OUT_ROOT = path.join(DATA_ROOT, 'set-index');

/** @type {!Array<string>} */
export const FAMILIES = Object.keys(FAMILY_CONFIGS);

/**
 * Source families per build family: own family first, then the other
 * families of the same generation as fallback (a Gen 7 singles set may fall
 * back to Gen 7 doubles data, never to another generation's).
 * @type {!Object<string, !Array<string>>}
 */
export const FALLBACK_FAMILY_ORDER = Object.fromEntries(
  FAMILIES.map((family) => [
    family,
    [
      family,
      ...familiesOfGen(FAMILY_CONFIGS[family].gen).filter((f) => f !== family),
    ],
  ]),
);

/** Placeholder rows in Smogon moveset sections, dropped from aggregation. */
export const HIDDEN_ENTRY_KEYS = new Set(['other', 'nothing']);

/**
 * Usage percent below which a set entry is a trace, not signal. @type {number}
 */
export const MIN_MEANINGFUL_SET_ENTRY_USAGE_PERCENT = 0.1;
