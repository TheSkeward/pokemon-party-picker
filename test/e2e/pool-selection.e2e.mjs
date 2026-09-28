// The pool textarea keeps its focus and selection across the renders the
// user did not ask for: the post-optimize analysis lands seconds after the
// team appears and rebuilds the page, and a name the user dragged over to
// remove must still be selected when it does.
import { launchBrowser, openPoolPage, check } from './helpers/env.mjs';

const browser = await launchBrowser();
try {
  const page = await openPoolPage(browser);
  await page.fill('textarea', 'Froakie, Onix, Spearow, Pachirisu');
  await page.click('#optimize-button');
  await page.waitForSelector('.team-set-card', { timeout: 180_000 });

  // Select "Onix" the moment the team is up, then outlast the analysis.
  const selected = await page.evaluate(() => {
    const box = document.getElementById('pool-query-input');
    box.focus();
    const start = box.value.indexOf('Onix');
    box.setSelectionRange(start, start + 4);
    return box.value.slice(start, start + 4);
  });
  check('selection made', selected === 'Onix', selected);
  await page.waitForTimeout(8000);

  const after = await page.evaluate(() => {
    const box = document.getElementById('pool-query-input');
    return {
      focused: document.activeElement === box,
      text: box.value.slice(box.selectionStart, box.selectionEnd),
    };
  });
  check('textarea still focused after the analysis lands', after.focused);
  check('selection survives the rebuild', after.text === 'Onix', after.text);
} finally {
  await browser.close();
}
console.log('pool-selection: PASS');
