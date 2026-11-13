/**
 * @fileoverview Extracts where items come from in Pokémon Rejuvenation,
 * from an install:
 *
 *   node scripts/rejuv/extract-rejuv-item-sources.mjs <install-path>
 *
 * Writes the four extracts beside this script. What they hold is described
 * in essentials/extract-item-sources.mjs; what is Rejuvenation's own is in
 * item-source-adapter.mjs.
 */
import { runItemSourceExtractor } from '../essentials/extract-item-sources.mjs';
import { REJUV_ITEM_SOURCE_ADAPTER } from './item-source-adapter.mjs';

runItemSourceExtractor(REJUV_ITEM_SOURCE_ADAPTER, import.meta.url);
