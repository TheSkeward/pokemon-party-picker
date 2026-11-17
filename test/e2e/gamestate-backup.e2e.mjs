// Gamestate backup: export copies a parseable gamestate to the clipboard,
// import restores the one on the clipboard (modulo the app's own pool
// normalization), and a clipboard that cannot be read or holds anything
// else is turned away with a status the player can see, the pool left
// alone. That status is seen during a run too: an answer to the player
// takes the status line from the run's caption for long enough to be read.
import {
  BASE_URL,
  LARGE_POOL,
  launchBrowser,
  openPoolPage,
  check,
} from './helpers/env.mjs';

const ORIGIN = new URL(BASE_URL).origin;
const poolText = (page) =>
  page.evaluate(() => document.querySelector('#pool-query-input').value);
const setClipboard = (page, text) =>
  page.evaluate((value) => navigator.clipboard.writeText(value), text);

// Waits for the pool's status line to show text matching `pattern`; with
// `running`, to show it while a run is on.
async function seeStatus(page, pattern, { running = false } = {}) {
  await page.waitForFunction(([source, duringRun]) => {
    const node = document.querySelector('[data-pool-status]');
    return node && new RegExp(source).test(node.textContent) &&
        getComputedStyle(node).visibility === 'visible' &&
        (!duringRun || Boolean(document.querySelector('[data-optimizing]')));
  }, [pattern.source, running]);
}

// What the status line is showing: which of its two texts is seen, how far
// the bar has got, and whether a run is on.
const statusLine = (page) => page.evaluate(() => {
  const seen = (selector) => getComputedStyle(
    document.querySelector(selector)).visibility === 'visible';
  return {
    running: Boolean(document.querySelector('[data-optimizing]')),
    status: seen('[data-pool-status]'),
    caption: seen('[data-optimize-progress-label]'),
    bar: parseFloat(
      document.querySelector('[data-optimize-progress-bar]').style.width),
  };
});

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
  await page.fill('#pool-query-input', `Froakie, ${LARGE_POOL}`);

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

  // The page's timers answer to the spec from here, once the refusals
  // above have had their time and left none running: the time an answer
  // has the line can then be made to pass while a run is still on.
  await page.waitForFunction(
    () => !document.querySelector('.pool-status[data-notice]'),
    null, { timeout: 12_000 });
  check('an answer stops being new once it has been up long enough', true);
  await page.clock.install();

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

  // The import starts a run on the restored pool, and a run's caption has
  // the status line. What the page says in answer to the player takes the
  // line all the same: the import's own word as the run starts (through
  // the render that starts it), then a refusal in the middle of it.
  await seeStatus(page, /Gamestate imported/, { running: true });
  check('the import says so over the run it starts', true);

  await setClipboard(page, '{"nope":true}');
  await page.click('#import-gamestate-button');
  await seeStatus(page, /Import from the clipboard failed/, { running: true });
  const refused = await statusLine(page);
  check('a refusal during a run is shown in place of the caption',
    refused.status && !refused.caption);
  await page.waitForFunction(
    (width) => parseFloat(document.querySelector(
      '[data-optimize-progress-bar]').style.width) > width,
    refused.bar);
  check('while the bar of the run carries on', true);

  // Once it has been up long enough to read, the run has its line back.
  await page.clock.fastForward(10_000);
  const after = await statusLine(page);
  check(
    'the caption has the line back once the answer has been read',
    after.running && after.caption && !after.status,
    JSON.stringify(after),
  );
} finally {
  await browser.close();
}
console.log('gamestate-backup: PASS');
