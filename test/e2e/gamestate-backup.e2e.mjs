// Gamestate backup: export copies a parseable gamestate to the clipboard,
// import restores a saved copy (modulo the app's own pool normalization),
// corrupt files are rejected with a readable status.
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  BASE_URL,
  launchBrowser,
  openPoolPage,
  check,
} from './helpers/env.mjs';

const browser = await launchBrowser();
const workDir = mkdtempSync(path.join(tmpdir(), 'gamestate-e2e-'));
try {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(BASE_URL).origin,
  });
  const page = await openPoolPage(context);
  await page.fill('textarea', 'Froakie\nOnix');

  await page.click('#export-gamestate-button');
  await page.waitForTimeout(400);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const exported = JSON.parse(copied);
  check(
    'clipboard holds a versioned gamestate',
    exported.format === 'pokemon-usage-viewer-gamestate' && exported.version === 1,
  );
  check('pool captured', exported.pool.includes('Froakie'), exported.pool);
  const copyStatus = await page.evaluate(() => document.querySelector('[data-pool-status]')?.textContent || '');
  check('status reports the copy', /copied to clipboard/i.test(copyStatus), copyStatus);

  const file = path.join(workDir, 'gamestate.json');
  writeFileSync(file, copied);
  await page.fill('textarea', '');
  page.on('dialog', (dialog) => dialog.accept());
  await page.click('#import-gamestate-button');
  await page.setInputFiles('#import-gamestate-input', file);
  await page.waitForTimeout(1500);
  const restored = await page.evaluate(() => document.querySelector('textarea')?.value || '');
  check(
    'import restores the pool (same mons; the app may re-delimit)',
    restored.includes('Froakie') && restored.includes('Onix'),
    restored,
  );

  const bad = path.join(workDir, 'bad.json');
  writeFileSync(bad, '{"nope":true}');
  await page.click('#import-gamestate-button');
  await page.setInputFiles('#import-gamestate-input', bad);
  await page.waitForTimeout(400);
  const status = await page.evaluate(() => document.querySelector('[data-pool-status]')?.textContent || '');
  check('corrupt file rejected with readable status', /Import failed/.test(status), status);
} finally {
  await browser.close();
}
console.log('gamestate-backup: PASS');
