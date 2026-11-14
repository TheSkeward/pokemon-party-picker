// Item inventory UX (the shop-haul flow): sticky 6+ picker, Enter-to-add
// with focus retention, row flash, never-lower re-adds, and the one-click
// sync to the counts the game has handed out by the player's badge.
import {
  launchBrowser,
  openPoolPage,
  openAllDetails,
  setBadgeCheckpoint,
  check,
} from './helpers/env.mjs';

const browser = await launchBrowser();
try {
  const page = await openPoolPage(browser);
  await openAllDetails(page);

  check(
    'count picker defaults to 6+',
    (await page.inputValue('[data-item-add-count]')) === '6',
  );

  await page.fill('[data-item-add-input]', 'Leftovers');
  await page.press('[data-item-add-input]', 'Enter');
  await page.waitForTimeout(300);
  check(
    'Enter-add lands at 6',
    (await page.inputValue('[data-owned-item-count][data-item-id="leftovers"]')) === '6',
  );
  check(
    'focus returns to the search box',
    await page.evaluate(() => document.activeElement?.matches('[data-item-add-input]')),
  );
  check(
    'added row flashes',
    await page.evaluate(() => Boolean(document.querySelector('.item-inventory-row.item-row-flash'))),
  );

  await page.selectOption('[data-item-add-count]', '1');
  await page.fill('[data-item-add-input]', 'Leftovers');
  await page.press('[data-item-add-input]', 'Enter');
  await page.waitForTimeout(300);
  check(
    're-add at x1 never lowers a 6',
    (await page.inputValue('[data-owned-item-count][data-item-id="leftovers"]')) === '6',
  );

  for (const name of ['Pixie Plate', 'Fire Gem']) {
    await page.fill('[data-item-add-input]', name);
    await page.press('[data-item-add-input]', 'Enter');
    await page.waitForTimeout(150);
  }

  await setBadgeCheckpoint(page, 7);
  await openAllDetails(page);
  const syncButton = await page.$('[data-expected-sync-button]');
  check(
    'the sync offers the expected counts with a badge set',
    /^Set \d+ items to expected$/.test(
      ((await syncButton?.textContent()) || '').trim()),
  );
  const beforeRows = await page.$$eval('.item-inventory-row', (rows) => rows.length);
  await syncButton.click();
  await page.waitForTimeout(400);
  const afterRows = await page.$$eval('.item-inventory-row', (rows) => rows.length);
  check(
    'sync adds what the game has handed out in one click',
    afterRows > beforeRows + 5,
    `${beforeRows} -> ${afterRows}`,
  );
  const countOf = (id) => page.inputValue(
    `[data-owned-item-count][data-item-id="${id}"]`);
  // A gem the shops sell by now is raised to a full supply; a plate the
  // game hands out once stays at the one copy.
  check('a shop item is raised from 1 to 6', (await countOf('firegem')) === '6');
  check('a single copy stays at 1', (await countOf('pixieplate')) === '1');
  check(
    'the sync then has nothing left to offer',
    await page.evaluate(() => {
      const button = document.querySelector('[data-expected-sync-button]');
      return button.disabled &&
        button.textContent.trim() === 'Matches the expected counts';
    }),
  );
} finally {
  await browser.close();
}
console.log('item-inventory: PASS');
