// What the reader is looking at stays where it is while a run redraws the
// page above it. The render rebuilds the DOM and the sets fill in after
// it, thousands of pixels at a time; neither may move a panel being read.
// Only a real browser lays the page out, so only a spec can see this.
import {
  launchBrowser,
  openPoolPage,
  openAllDetails,
  setBadgeCheckpoint,
  optimizeSmallPool,
  check,
} from './helpers/env.mjs';

// The run and its analysis have both come to rest.
const settled = (page) => page.waitForFunction(() => {
  if (document.querySelector('[data-optimizing]')) return false;
  if (!document.querySelector('.team-set-card')) return false;
  return !/Sweeping alternative model settings|Evaluating the pool at the next level caps|still computing/
    .test(document.body.textContent);
}, null, { timeout: 180_000 });

const topOf = (page, selector) => page.evaluate(
  (sel) => Math.round(document.querySelector(sel).getBoundingClientRect().top),
  selector);

// Scrolls a part to just under the top of the window, so that it is the
// part the page holds (the one nearest the top), edits the pool, optimizes,
// and reports where the part sat before and after.
async function readThroughRun(page, selector, addition) {
  await page.evaluate((sel) => {
    const node = document.querySelector(sel);
    window.scrollTo(
      0, node.getBoundingClientRect().top + window.scrollY - 40);
  }, selector);
  // A frame, so the page has noted what is in view.
  await page.waitForTimeout(300);
  const before = await topOf(page, selector);
  await page.evaluate((names) => {
    const box = document.getElementById('pool-query-input');
    box.value += names;
    box.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('optimize-button').click();
  }, addition);
  await page.waitForTimeout(500);
  await settled(page);
  await page.waitForTimeout(1000);
  return { before, after: await topOf(page, selector) };
}

const browser = await launchBrowser();
try {
  const page = await openPoolPage(browser);
  await setBadgeCheckpoint(page);
  await optimizeSmallPool(
    page, ['Froakie', 'Onix', 'Spearow', 'Pachirisu', 'Pidove', 'Lillipup']);
  await settled(page);
  await openAllDetails(page);
  await page.waitForTimeout(300);

  // Below everything the run replaces: the team, bench and sets above it
  // change height by more than a window.
  const tms = await readThroughRun(
    page, '[data-details-id="tms"]', ', Purrloin, Patrat, Sewaddle');
  check(
    'a progression panel being read stays put through a run',
    Math.abs(tms.after - tms.before) <= 2,
    `${tms.before} -> ${tms.after}`,
  );

  // Inside what the run replaces: the sets are rebuilt under the reader.
  const sets = await readThroughRun(
    page, '#reborn-team-analysis-root', ', Tympole, Roggenrola');
  check(
    'the top of the sets stays put through a run',
    Math.abs(sets.after - sets.before) <= 2,
    `${sets.before} -> ${sets.after}`,
  );

  // At the top of the page nothing is held: the top stays the top.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    const box = document.getElementById('pool-query-input');
    box.value += ', Woobat';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    document.getElementById('optimize-button').click();
  });
  await page.waitForTimeout(500);
  await settled(page);
  check(
    'a page at its top stays at its top',
    (await page.evaluate(() => window.scrollY)) === 0,
  );
} finally {
  await browser.close();
}
