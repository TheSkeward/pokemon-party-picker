// An optimize answers for the pool and the badges it was started on, and
// its result outlives a reload. Three things the page controller got
// wrong and no unit test loads it to see: an edit during a run let the old
// pool's team land as current, "No cap" kept the cap it claimed to lift,
// and the result cache is only ever exercised by a real IndexedDB.
import { launchBrowser, openPoolPage, check } from './helpers/env.mjs';

// Large enough that the search is still running a moment after the click.
const LARGE = [
  'Gastly', 'Venipede', 'Torchic', 'Togepi', 'Magnemite', 'Budew',
  'Growlithe', 'Yamask', 'Shellos', 'Espurr', 'Abra', 'Machop', 'Geodude',
  'Zubat', 'Oddish', 'Poliwag', 'Bellsprout', 'Tentacool', 'Ponyta',
  'Slowpoke', 'Doduo', 'Seel', 'Grimer', 'Shellder', 'Onix', 'Drowzee',
  'Krabby', 'Voltorb', 'Exeggcute', 'Cubone', 'Koffing', 'Rhyhorn',
  'Horsea', 'Goldeen', 'Staryu', 'Scyther', 'Magikarp', 'Eevee',
].join(', ');
// Names the donor box has not seen, enough to add a line to it.
const NEWCOMERS = [
  'Froakie', 'Spearow', 'Pachirisu', 'Pidove', 'Lillipup', 'Purrloin',
  'Patrat', 'Sewaddle', 'Tympole', 'Roggenrola', 'Woobat', 'Drilbur',
].join(', ');

const browser = await launchBrowser();
try {
  const page = await openPoolPage(browser);

  // An edit while the optimizer runs disowns that run.
  await page.fill('#pool-query-input', LARGE);
  await page.click('#optimize-button');
  await page.waitForSelector('[data-optimize-progress-bar]', { timeout: 20_000 });
  await page.evaluate(() => {
    const box = document.getElementById('pool-query-input');
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  });
  await page.keyboard.type(', Pidgey');
  const edited = await page.evaluate(() => ({
    progress: Boolean(document.querySelector('[data-optimize-progress-bar]')),
    focused: document.activeElement?.id === 'pool-query-input',
    tail: document.getElementById('pool-query-input').value.slice(-8),
  }));
  check('the progress panel comes down', !edited.progress);
  check('the box keeps its focus and the typing', edited.focused && edited.tail === ', Pidgey', edited.tail);
  // Long enough for the disowned search to have finished unheard.
  await page.waitForTimeout(15_000);
  check(
    'no team lands for the pool as it was',
    !(await page.$('.team-results-panel table')),
  );

  // "No cap" lifts the cap along with the badge.
  await page.selectOption('[data-progression-checkpoint]', { index: 8 });
  await page.waitForTimeout(300);
  await page.selectOption('[data-progression-checkpoint]', '');
  await page.waitForTimeout(300);
  const uncapped = await page.evaluate(() => {
    const key = Object.keys(localStorage)
      .find((name) => /progression/.test(name));
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      checkpoint: saved.checkpoint,
      levelCap: saved.levelCap,
      chip: document.querySelector('.gamestate-chip')?.textContent.trim(),
    };
  });
  check('no badge is saved', uncapped.checkpoint === '');
  check('no cap is saved', uncapped.levelCap === '', String(uncapped.levelCap));
  check('the gamestate says so', uncapped.chip === 'No cap', uncapped.chip);

  // The pool's names join the donor box when the pool box loses focus,
  // and pressing Optimize is what takes the focus. Nothing may move then:
  // a donor box that grew a line slid the button out from under the
  // click, and the press did nothing.
  await page.fill('#pool-query-input', NEWCOMERS);
  const buttonTop = () => page.evaluate(() => Math.round(
    document.getElementById('optimize-button').getBoundingClientRect().top +
      window.scrollY));
  const before = await buttonTop();
  await page.evaluate(() => {
    const box = document.getElementById('pool-query-input');
    box.blur();
    box.dispatchEvent(new Event('change', { bubbles: true }));
  });
  check(
    'the names joined the donor box',
    await page.evaluate(() =>
      document.getElementById('donor-query-input').value.includes('Tympole')),
  );
  const after = await buttonTop();
  check(
    'Optimize stays where it is when the pool box loses focus',
    before === after,
    `${before} -> ${after}`,
  );

  // A result is kept across a reload, in a store of the current schema.
  await page.fill('#pool-query-input', 'Froakie, Onix, Spearow, Pachirisu');
  await page.click('#optimize-button');
  await page.waitForSelector('.team-set-card', { timeout: 180_000 });
  await page.waitForTimeout(1500);
  const store = await page.evaluate(() => new Promise((resolve) => {
    const request = indexedDB.open('pokemon-usage-viewer');
    request.onsuccess = () => {
      const db = request.result;
      const results = db.transaction('team-results')
        .objectStore('team-results');
      const count = results.count();
      count.onsuccess = () => {
        resolve({ indexes: [...results.indexNames], records: count.result });
        db.close();
      };
    };
    request.onerror = () => resolve({ indexes: [], records: 0 });
  }));
  check('the result is persisted', store.records >= 1, String(store.records));
  check(
    'retired versions can be found without reading records',
    store.indexes.includes('version'),
    store.indexes.join(','),
  );
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('.team-set-card', { timeout: 20_000 });
  check('the same pool comes back after a reload', true);
} finally {
  await browser.close();
}
console.log('optimize-lifecycle: PASS');
