/**
 * @fileoverview Copies the checked-in runtime data into the built site.
 * DEPLOY_EXCLUDE_DATA names top-level data roots to leave out of a
 * deployment, comma-separated: the raw monthly Smogon sources and the
 * monthly moveset files are build inputs the site never reads, and the
 * sources alone exceed what GitHub Pages accepts in one artifact. The
 * manifest records the same list (scripts/build-manifest.mjs).
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceDir = path.join(projectRoot, 'site-data', 'data');
const targetDir = path.join(projectRoot, 'dist', 'data');
const excluded = new Set(
  (process.env.DEPLOY_EXCLUDE_DATA || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean),
);

try {
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(targetDir), { recursive: true });
  await fs.cp(sourceDir, targetDir, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(sourceDir, source);
      const root = relative.split(path.sep)[0];
      return !(root && excluded.has(root));
    },
  });
  console.log(`copied ${sourceDir} -> ${targetDir}`);
  if (excluded.size) {
    console.log(`excluded data roots: ${[...excluded].join(', ')}`);
  }
} catch (error) {
  console.error(error);
  process.exit(1);
}
