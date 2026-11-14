/**
 * @fileoverview End-to-end runner: builds the site, serves it with `vite
 * preview` (data symlinked from site-data so nothing is copied), runs every
 * test/e2e/*.e2e.mjs as a child process, and exits non-zero if any fail.
 * These specs cover behaviors the unit suites cannot see — focus retention,
 * scroll pinning, downloads, in-place DOM patching. Run: npm run e2e
 *
 * Needs the full site-data tree and an installed Chrome or Edge, both of
 * which a checkout on a GitHub runner has.
 */

import { spawn, execSync } from 'node:child_process';
import { readdirSync, symlinkSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const PORT = 4199;
const root = process.cwd();
const dataLink = path.join(root, 'dist', 'data');

function log(message) {
  console.log(`[e2e] ${message}`);
}

log('building…');
execSync('npm run build', { stdio: 'inherit' });

// A junction on Windows, where a plain directory symlink needs a privilege
// most accounts lack; elsewhere the type is ignored.
if (!existsSync(dataLink)) {
  symlinkSync(path.join(root, 'site-data', 'data'), dataLink, 'junction');
}

log(`starting preview on :${PORT}…`);
// Vite's own entry under this Node, not `npx`: a .cmd shim cannot be
// spawned without a shell on Windows.
const preview = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'),
    'preview', '--port', String(PORT), '--strictPort',
  ],
  { stdio: 'ignore', detached: false },
);

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://localhost:${PORT}/pokemon-party-picker/pool.html`);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('preview server never became ready');
}

function runSpec(file) {
  return new Promise((resolve) => {
    log(`running ${file}`);
    const child = spawn(process.execPath, [path.join('test', 'e2e', file)], {
      stdio: 'inherit',
      env: { ...process.env, E2E_BASE_URL: `http://localhost:${PORT}/pokemon-party-picker` },
    });
    child.on('exit', (code) => resolve({ file, code: code ?? 1 }));
  });
}

let failures = 0;
try {
  await waitForServer();
  const specs = readdirSync(path.join(root, 'test', 'e2e'))
    .filter((file) => file.endsWith('.e2e.mjs'))
    .sort();
  if (!specs.length) throw new Error('no specs found in test/e2e/');
  for (const spec of specs) {
    const { file, code } = await runSpec(spec);
    if (code !== 0) {
      failures += 1;
      log(`FAIL ${file} (exit ${code})`);
    }
  }
} finally {
  preview.kill('SIGTERM');
  rmSync(dataLink, { force: true });
}

log(failures ? `${failures} spec(s) FAILED` : 'all specs passed');
process.exit(failures ? 1 : 0);
