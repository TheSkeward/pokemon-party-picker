// The controls around a result: the table's sort and locks, the gamestate
// chips, the edits that mark a team stale and re-optimize it, the analysis
// a background run leaves for a button, and the pool's copy and clear.
// Every one is wired by the page controller, which no unit test loads.
import {
  BASE_URL, launchBrowser, openAllDetails, openPoolPage, check,
} from './helpers/env.mjs';

const POOL = [
  'Froakie', 'Onix', 'Spearow', 'Pachirisu', 'Pidove', 'Lillipup',
  'Purrloin', 'Patrat',
];

// The run and its analysis have both come to rest.
const settled = (page) => page.waitForFunction(() => {
  if (document.querySelector('[data-optimize-progress-bar]')) return false;
  if (!document.querySelector('.team-pick-row')) return false;
  return !/Sweeping alternative model settings|Evaluating the pool at the next level caps|still computing/
    .test(document.body.textContent);
}, null, { timeout: 180_000 });

const pickNames = (page) => page.$$eval(
  '.team-pick-row .row-link strong',
  (cells) => cells.map((cell) => cell.textContent.trim()));
const statusOf = (page, attribute) => page.$eval(
  `[${attribute}]`, (node) => node.textContent.trim());
const savedProgression = (page) => page.evaluate(() => {
  const key = Object.keys(localStorage)
    .find((name) => /progression/.test(name));
  return JSON.parse(localStorage.getItem(key) || '{}');
});
// A node planted in the page: gone after a full render, kept by an edit
// that patches the page in place.
const plantMarker = (page) => page.evaluate(() => {
  const marker = document.createElement('i');
  marker.id = 'render-marker';
  document.querySelector('.team-results-panel').append(marker);
});
const markerAlive = (page) =>
  page.evaluate(() => Boolean(document.getElementById('render-marker')));

const browser = await launchBrowser();
try {
  const context = await browser.newContext();
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: new URL(BASE_URL).origin,
  });
  const page = await openPoolPage(context);
  page.on('dialog', (dialog) => dialog.accept());

  await page.fill('#pool-query-input', POOL.join(', '));
  await page.click('#optimize-button');
  await settled(page);
  check(
    'an Optimize click runs the analysis too',
    /Inclusion frequency across \d+ settings/.test(
      await page.textContent('body')));

  // Sorting: names A to Z first, reversed by a second click, kept in the
  // address and across a reload.
  await page.click('[data-team-sort="current"]');
  const ascending = await pickNames(page);
  check(
    'names sort A to Z',
    ascending.join() === [...ascending].sort((a, b) => a.localeCompare(b)).join(),
    ascending.join());
  await page.click('[data-team-sort="current"]');
  check(
    'a second click reverses the order',
    (await pickNames(page)).join() === [...ascending].reverse().join());
  check(
    'the address carries the sort',
    /teamSort=current&teamSortDir=desc/.test(page.url()), page.url());

  // A row opens its set; "moves" jumps to the set card without closing it.
  await page.click('.team-pick-row .row-link');
  await page.waitForSelector('#team-builder-set-details-root');
  check('a row opens its set', Boolean(await page.$('.team-pick-row.selected-row')));
  await page.click('.team-pick-row.selected-row [data-jump-set-card]');
  check('"moves" marks the set card it jumps to',
    Boolean(await page.$('.is-jump-target')));
  check('and leaves the row open',
    Boolean(await page.$('#team-builder-set-details-root')));

  // A gamestate chip lands on the control that changes what it shows.
  await page.click('[data-open-progression="badges"]');
  check(
    'the badge chip lands on the badge picker',
    await page.evaluate(() =>
      document.activeElement?.matches('[data-progression-checkpoint]')));

  // Locking rewrites the pool text and optimizes again around the lock.
  const locked = await page.$eval(
    '.team-pick-row [data-lock-toggle]', (button) => button.dataset.lockToggle);
  await page.click(`[data-lock-toggle="${locked}"]`);
  await page.waitForSelector(
    `[data-lock-toggle="${locked}"][data-lock-state="locked"]`,
    { timeout: 60_000 });
  check(
    'a locked pick is marked in the pool text',
    (await page.inputValue('#pool-query-input')).includes(`${locked}!`));
  const benched = await page.$eval(
    '[data-lock-input]', (chip) => chip.dataset.lockInput);
  await page.click(`[data-lock-input="${benched}"]`);
  await page.waitForSelector(
    `[data-lock-toggle="${benched}"][data-lock-state="locked"]`,
    { timeout: 60_000 });
  check('a bench chip locks its Pokémon into the team', true);
  await page.click(`[data-lock-toggle="${benched}"]`);
  await page.waitForFunction(
    (name) => !document.getElementById('pool-query-input').value
      .includes(`${name}!`),
    benched, { timeout: 60_000 });
  check('unlocking takes the mark back out', true);
  await settled(page);

  // A dragged bias slider updates its readout in place; released, it is
  // saved, marks the team stale, and the team re-optimizes by itself.
  await openAllDetails(page);
  await plantMarker(page);
  const bias = await page.$eval('[data-bias-type]', (slider) => {
    slider.value = '2';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      type: slider.dataset.biasType,
      readout: document.querySelector(
        `[data-bias-value="${slider.dataset.biasType}"]`).textContent,
    };
  });
  check('the readout follows the drag', bias.readout === '2', bias.readout);
  await page.$eval('[data-bias-type]', (slider) =>
    slider.dispatchEvent(new Event('change', { bubbles: true })));
  check('the drag did not rebuild the page', await markerAlive(page));
  check(
    'the bias is saved',
    (await savedProgression(page)).opponentTypeBias?.[bias.type] === 2);
  check(
    'the team is marked stale',
    await page.$eval(
      '[data-progression-stale-warning]', (node) => !node.hidden));
  check(
    'the status says a re-optimize is coming',
    /Re-optimizing after edits settle/.test(
      await statusOf(page, 'data-progression-status')));
  await page.waitForFunction(
    () => !document.getElementById('render-marker'), null,
    { timeout: 60_000 });
  await settled(page);
  check(
    'the re-optimized team is current',
    await page.$eval(
      '[data-progression-stale-warning]', (node) => node.hidden));

  // That run was the page's own, so its analysis waits for the button.
  await page.waitForSelector('#compute-post-analysis-button');
  check('a background run leaves the analysis for a button', true);
  await page.click('#compute-post-analysis-button');
  await page.waitForFunction(
    () => /Inclusion frequency across \d+ settings/
      .test(document.body.textContent), null, { timeout: 120_000 });
  await settled(page);
  check('the button runs it', !(await page.$('#compute-post-analysis-button')));

  // A ticked unlock is saved and patched in without a rebuild.
  await openAllDetails(page);
  await plantMarker(page);
  await page.click('[data-progression-field="moveRelearnerUnlocked"]');
  check('ticking an unlock did not rebuild the page', await markerAlive(page));
  check(
    'the unlock is saved',
    (await savedProgression(page)).moveRelearnerUnlocked === true);
  await page.waitForFunction(
    () => !document.getElementById('render-marker'), null,
    { timeout: 60_000 });
  await settled(page);

  // The availability list and the pool copy.
  await page.click('#generate-availability-button');
  await page.waitForSelector('#availability-output-text', { timeout: 60_000 });
  check(
    'the availability list is shown',
    (await page.inputValue('#availability-output-text')).length > 0);
  check(
    'and reported',
    /Availability list (copied to clipboard|ready below)/.test(
      await statusOf(page, 'data-pool-status')));
  await page.click('#close-availability-button');
  check('Close takes it away', !(await page.$('#availability-output-text')));
  await page.click('#copy-pool-button');
  await page.waitForFunction(() => /Copied pool to clipboard/.test(
    document.querySelector('[data-pool-status]').textContent));
  check(
    'the pool is copied as written',
    (await page.evaluate(() => navigator.clipboard.readText())) ===
      (await page.inputValue('#pool-query-input')).trim());

  // A reload brings back the pool, the sort and the team.
  const poolText = await page.inputValue('#pool-query-input');
  const order = await pickNames(page);
  await page.reload({ waitUntil: 'networkidle' });
  await settled(page);
  check('the pool survives a reload',
    (await page.inputValue('#pool-query-input')) === poolText);
  check('so does the sort',
    (await pickNames(page)).join() === order.join());

  // Clearing: the progression goes back to its start, the pool empties,
  // and the donor box keeps what it was given.
  await openAllDetails(page);
  await page.click('#clear-progression-button');
  await page.waitForFunction(() => !document.querySelector(
    '[data-progression-field="moveRelearnerUnlocked"]').checked);
  check(
    'clearing the progression clears its saved copy',
    !(await savedProgression(page)).moveRelearnerUnlocked);
  await page.click('#clear-pool-button');
  await page.waitForFunction(
    () => !document.querySelector('.team-pick-row'));
  check('clearing the pool empties the box',
    (await page.inputValue('#pool-query-input')) === '');
  check('and reports it',
    /Saved pool cleared/.test(await statusOf(page, 'data-pool-status')));
  check(
    'the donor box keeps its names',
    (await page.inputValue('#donor-query-input')).includes('Froakie'));

  // Standalone, another family is another page load.
  const other = await page.$eval('#family-input', (select) =>
    [...select.options].find((option) => !option.selected)?.value || null);
  if (other) {
    await Promise.all([
      page.waitForURL(new RegExp(`family=${other}`), { timeout: 30_000 }),
      page.selectOption('#family-input', other),
    ]);
    await page.waitForSelector('#optimize-button');
    check(
      'choosing a family reloads into it',
      (await page.inputValue('#family-input')) === other);
  }
} finally {
  await browser.close();
}
console.log('team-controls: PASS');
