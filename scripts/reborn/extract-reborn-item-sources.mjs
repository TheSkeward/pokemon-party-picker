/**
 * @fileoverview Extracts where items come from in Pokémon Reborn, from an
 * install:
 *
 *   node scripts/reborn/extract-reborn-item-sources.mjs <install-path>
 *
 * Writes the four extracts beside this script. What they hold is described
 * in essentials/extract-item-sources.mjs; what is Reborn's own is in
 * item-source-adapter.mjs.
 */
import { runItemSourceExtractor } from '../essentials/extract-item-sources.mjs';
import { REBORN_ITEM_SOURCE_ADAPTER } from './item-source-adapter.mjs';

runItemSourceExtractor(REBORN_ITEM_SOURCE_ADAPTER, import.meta.url);
