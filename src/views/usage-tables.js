/**
 * @fileoverview The Usage Data page's tables, in tab order. The first opens
 * by default.
 */
import { ITEM_USAGE_TABLE } from './item-usage-view.js';
import { MOVE_USAGE_TABLE } from './move-usage-view.js';
import { POKEMON_USAGE_TABLE } from './pokemon-usage-view.js';

/** @const {!Array<!UsageTable>} */
export const USAGE_TABLES = Object.freeze([
  POKEMON_USAGE_TABLE,
  MOVE_USAGE_TABLE,
  ITEM_USAGE_TABLE,
]);

/**
 * @param {?string} id
 * @return {?UsageTable} Null for an unknown id.
 */
export function usageTableById(id) {
  return USAGE_TABLES.find((table) => table.id === id) || null;
}
