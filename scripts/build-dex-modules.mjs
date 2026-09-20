/**
 * @fileoverview Runs every dex-module generator for one generation, in
 * dependency order, so a game's generated data is rebuilt with one command:
 *
 *   node scripts/build-dex-modules.mjs <gen> [--level-up=<table.json>]
 *
 * Held items come last because they are read off the set index, which the
 * usage-data build produces; the rest read only {@code @pkmn/dex}. Extra
 * arguments pass through to every generator; the progression-species one
 * takes a game's level-up table (build-bulbapedia-level-up.mjs) for its
 * move-evolution levels.
 */

import { execFileSync } from 'node:child_process';
import { parseGenArg } from './dex-gen.mjs';

const GENERATORS = [
  'build-base-stats.mjs',
  'build-move-meta.mjs',
  'build-item-damage.mjs',
  'build-unburden-species.mjs',
  'build-progression-species.mjs',
  'build-line-representatives.mjs',
  'build-type-chart.mjs',
  'build-held-items.mjs',
];

const gen = parseGenArg();
const extraArgs = process.argv.slice(3);
for (const script of GENERATORS) {
  execFileSync(
    process.execPath,
    [`scripts/${script}`, String(gen), ...extraArgs],
    { stdio: 'inherit' },
  );
}
