// Gamestate backup: export copies a parseable gamestate to the clipboard,
// import restores the one on the clipboard (modulo the app's own pool
// normalization), and a clipboard that cannot be read or holds anything
// else is turned away with a status the player can see, the pool left
// alone.
import {
  BASE_URL,
  launchBrowser,
  openPoolPage,
  check,
} from './helpers/env.mjs';

const ORIGIN = new URL(BASE_URL).origin;
const poolText = (page) =>
  page.evaluate(() => document.querySelector('#pool-query-input').value);
const setClipboard = (page, text) =>
  page.evaluate((value) => navigator.clipboard.writeText(value), text);

// Waits for the pool's status line to show text matching `pattern`.
async function seeStatus(page, pattern) {
  await page.waitForFunction((source) => {
    const node = document.querySelector('[data-pool-status]');
    return node && new RegExp(source).test(node.textContent) &&
        getComputedStyle(node).visibility === 'visible';
  }, pattern.source);
}

const browser = await launchBrowser();
try {
  const context = await browser.newContext();
  const allow = (permissions) =>
    context.grantPermissions(permissions, { origin: ORIGIN });
  await allow(['clipboard-read', 'clipboard-write']);
  const page = await openPoolPage(context);
  let asked = 0;
  page.on('dialog', (dialog) => {
    asked += 1;
    void dialog.accept();
  });
  await page.fill('#pool-query-input', 'Froakie\nOnix');

  await page.click('#export-gamestate-button');
  await seeStatus(page, /copied to clipboard/i);
  check('status reports the copy', true);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  const exported = JSON.parse(copied);
  check(
    'clipboard holds a versioned gamestate',
    exported.format === 'pokemon-usage-viewer-gamestate' && exported.version === 1,
  );
  check('pool captured', exported.pool.includes('Froakie'), exported.pool);

  // The refusals come first, while nothing is running: a run takes the
  // status line for its own caption.
  await page.fill('#pool-query-input', 'Pidgey');

  await setClipboard(page, '{"nope":true}');
  await page.click('#import-gamestate-button');
  await seeStatus(
    page, /Import from the clipboard failed: .*not a gamestate export/);
  check('other text on the clipboard is turned away, naming the clipboard', true);

  await setClipboard(page, ' ');
  await page.click('#import-gamestate-button');
  await seeStatus(page, /clipboard holds no text/);
  check('a clipboard with no text says so', true);

  // The clipboard is the only way in, so a refused read has to say what
  // to do about it.
  await setClipboard(page, copied);
  await context.clearPermissions();
  await page.click('#import-gamestate-button');
  await seeStatus(page, /Allow clipboard access/);
  check('a refused read says how to allow it', true);

  check('no refusal touched the pool', (await poolText(page)) === 'Pidgey');
  check('or asked to replace it', asked === 0, String(asked));

  // A pool is in the box, so the import asks before replacing it; the
  // clipboard is read before the question, which must not cost the read.
  await allow(['clipboard-read', 'clipboard-write']);
  await page.click('#import-gamestate-button');
  await page.waitForFunction(() =>
    document.querySelector('#pool-query-input').value.includes('Froakie'));
  const restored = await poolText(page);
  check('import asks before replacing a pool', asked === 1, String(asked));
  check(
    'import restores the pool from the clipboard (same mons; the app may ' +
    're-delimit)',
    restored.includes('Onix') && !restored.includes('Pidgey'),
    restored,
  );
} finally {
  await browser.close();
}
console.log('gamestate-backup: PASS');
