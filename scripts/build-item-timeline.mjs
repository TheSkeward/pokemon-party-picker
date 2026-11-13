/**
 * @fileoverview Generates each game's held-item sources
 * (src/generated/<game>ItemTimeline.generated.js) with the shared builder
 * (essentials/item-timeline.mjs) from what the game supplies
 * (<game>/item-timeline.mjs).
 *
 * Rerun: node scripts/build-item-timeline.mjs
 */

import { writeFileSync } from 'node:fs';

import {
  buildItemSources,
  renderItemSources,
} from './essentials/item-timeline.mjs';
import { rebornItemTimeline } from './reborn/item-timeline.mjs';

const GENERATOR = 'scripts/build-item-timeline.mjs';

const TIMELINES = [rebornItemTimeline];

for (const timeline of TIMELINES) {
  const { game, exportName, outFile, header } = timeline();
  const log = (message) => console.log(`[item-timeline] ${message}`);
  const built = buildItemSources(
    game, (message) => console.warn(`[item-timeline] ${message}`));
  writeFileSync(
    outFile, renderItemSources(exportName, header, built.sources, GENERATOR));

  const count = (kind) =>
    [...built.sources.values()].filter((list) =>
      list.some((source) => source.kind === kind)).length;
  log(
    `${exportName}: ${built.sources.size} held items sourced ` +
    `(of ${game.knownIds.size} known ids): ` +
    `${count('single')} with a single copy, ${count('shop')} in shops, ` +
    `${count('mining')} mined, ${count('wild')} wild-held, ` +
    `${count('pickup')} from Pickup, ${count('regrow')} regrowing`);
  log(
    `${built.missedShopItems} items sold in marts a listing's shop table ` +
    `lacks; ${built.undatedCopies} placed copies and ` +
    `${built.undatedRocks} mining rocks left out as undated`);
}
