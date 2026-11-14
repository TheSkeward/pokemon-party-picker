// A Team Builder that is left stops working. The app shell mounts the page
// afresh on every render, and the one it replaced used to carry on: its
// stability sweep ran to the end behind the new page, changing the scoring
// constants for the whole thread as it went, and its scroll listener and
// timers were never removed.
import { BASE_URL, launchBrowser, check } from './helpers/env.mjs';

// Enough lines that the sweep is still running a few seconds after the
// team appears.
const POOL = [
  'Gastly', 'Venipede', 'Torchic', 'Togepi', 'Magnemite', 'Budew',
  'Growlithe', 'Yamask', 'Shellos', 'Espurr', 'Abra', 'Machop', 'Geodude',
  'Zubat', 'Oddish', 'Poliwag', 'Bellsprout', 'Tentacool', 'Ponyta',
  'Slowpoke', 'Doduo', 'Seel', 'Grimer', 'Shellder', 'Onix', 'Drowzee',
].join(', ');

// How many times a sweep setting has been put in force on the page.
const settingsApplied = (page) => page.evaluate(() => window.__sweepSettings);

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  // The sweep's settings are held in one global; counting the writes to it
  // shows a sweep at work without reaching into the page's modules.
  await page.addInitScript(() => {
    let overrides = null;
    window.__sweepSettings = 0;
    Object.defineProperty(window, '__SCORING_OVERRIDES__', {
      get: () => overrides,
      set(value) {
        if (value) window.__sweepSettings += 1;
        overrides = value;
      },
    });
  });
  await page.goto(`${BASE_URL}/?view=pool&family=singles`, {
    waitUntil: 'networkidle',
  });
  await page.waitForSelector('#optimize-button', { timeout: 60_000 });

  await page.fill('#pool-query-input', POOL);
  await page.click('#optimize-button');
  await page.waitForSelector('.team-pick-row', { timeout: 180_000 });
  // Leave once the sweep is under way.
  await page.waitForFunction(
    () => window.__sweepSettings >= 2, null, { timeout: 120_000 });
  await page.click('[data-app-view="resolver"]');
  await page.waitForSelector('#resolver-query-input', { timeout: 30_000 });
  const onLeaving = await settingsApplied(page);
  await page.waitForTimeout(6000);
  const later = await settingsApplied(page);
  check(
    'the sweep stops within a setting of the page being left',
    later - onLeaving <= 1, `${onLeaving} then ${later}`);

  // Back on the Team Builder, a new page takes over from the saved pool.
  await page.click('[data-app-view="pool"]');
  await page.waitForSelector('.team-pick-row', { timeout: 180_000 });
  check('the team is back', true);
  // Its run was the page's own, so the analysis the first page never
  // finished is offered rather than run.
  await page.waitForSelector(
    '#compute-post-analysis-button', { timeout: 60_000 });
  const beforeAnalysis = await settingsApplied(page);
  await page.click('#compute-post-analysis-button');
  await page.waitForFunction(
    () => /Inclusion frequency across \d+ settings/
      .test(document.body.textContent), null, { timeout: 180_000 });
  check(
    'and its analysis runs when asked for',
    (await settingsApplied(page)) > beforeAnalysis);
} finally {
  await browser.close();
}
console.log('leaving-team-builder: PASS');
