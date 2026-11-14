// The app around the pages: the game picker and its format toggle, and
// Set Lookup answering in one step. main.js is the one module that wires
// them, and no unit test can load it.
import { BASE_URL, launchBrowser, check } from './helpers/env.mjs';

const pressed = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.game-nav [aria-pressed="true"]')]
    .map((button) => button.textContent.trim()));
const family = (page) =>
  page.evaluate(() => new URLSearchParams(location.search).get('family'));

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.goto(`${BASE_URL}/?view=resolver&family=singles`, {
    waitUntil: 'networkidle',
  });

  check(
    'the game and its format are the pressed choices',
    (await pressed(page)).join(' / ') === 'Reborn / Singles',
    (await pressed(page)).join(' / '),
  );

  // The format toggle switches family within the game.
  await page.click('.game-nav [role="group"][aria-label="Format"] button:not([aria-pressed="true"])');
  await page.waitForFunction(
    () => new URLSearchParams(location.search).get('family') === 'doubles');
  check(
    'Doubles is pressed',
    (await pressed(page)).join(' / ') === 'Reborn / Doubles',
  );

  // Another game keeps the format's place: Doubles stays Doubles.
  await page.click('.game-nav [role="group"][aria-label="Game"] button:first-child');
  await page.waitForFunction(
    () => new URLSearchParams(location.search).get('family') === 'gen4doubles',
    null, { timeout: 30_000 });
  const inOtherGame = await pressed(page);
  check(
    'the other game opens on its Doubles',
    inOtherGame.length === 2 && /Doubles$/.test(inOtherGame[1]),
    inOtherGame.join(' / '),
  );

  // Two clicks in quick succession end on the second.
  await page.click('.game-nav [role="group"][aria-label="Game"] button:last-child');
  await page.click('.game-nav [role="group"][aria-label="Game"] button:nth-child(3)');
  await page.waitForFunction(
    () => new URLSearchParams(location.search).get('family') === 'doubles',
    null, { timeout: 60_000 });
  await page.waitForTimeout(1500);
  check('the last game clicked wins', (await family(page)) === 'doubles');

  // Set Lookup: one Pokémon found opens by itself, and a name that
  // matched nothing is named.
  await page.goto(
    `${BASE_URL}/?view=resolver&family=singles&resolverQuery=gengar, zzz`,
    { waitUntil: 'networkidle' },
  );
  await page.waitForSelector('.moveset-method', { timeout: 60_000 });
  const lookup = await page.evaluate(() => ({
    unmatched: document.querySelector('.resolver-unmatched')?.textContent,
    opened: document.querySelector('.details-panel h2')?.textContent,
  }));
  check(
    'the unmatched name is listed',
    lookup.unmatched === 'Not recognised: zzz',
    lookup.unmatched,
  );
  check('the lone result is open', /^Gengar/.test(lookup.opened || ''), lookup.opened);
} finally {
  await browser.close();
}
console.log('app-shell: PASS');
