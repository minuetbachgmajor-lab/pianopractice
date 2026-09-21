/* Drives the real app in a browser: the happy path she will actually tap.
 * Run: node tests/e2e.js  (add --shots to write screenshots) */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SHOT_DIR = process.env.SHOT_DIR || path.join(ROOT, 'screenshots');
const WANT_SHOTS = process.argv.indexOf('--shots') >= 0;

const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json'
};

function serve() {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file === '/') { file = '/index.html'; }
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'text/plain' });
    res.end(fs.readFileSync(full));
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

let passed = 0;
const failures = [];
async function step(name, fn) {
  try { await fn(); passed += 1; console.log('  ok   ' + name); }
  catch (err) { failures.push({ name, err }); console.log('  FAIL ' + name + ' — ' + err.message); }
}
function assert(cond, msg) { if (!cond) { throw new Error(msg); } }

(async () => {
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  /* iPad mini 3, portrait */
  const context = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);

  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') { consoleErrors.push(m.text()); } });

  if (WANT_SHOTS) { fs.mkdirSync(SHOT_DIR, { recursive: true }); }
  const shot = async (name) => {
    if (WANT_SHOTS) { await page.screenshot({ path: path.join(SHOT_DIR, name + '.png'), fullPage: true }); }
  };

  await page.goto(base, { waitUntil: 'load' });

  await step('home lists the seeded piece and its bits', async () => {
    await page.waitForSelector('.section-row');
    const text = await page.textContent('#app');
    assert(text.includes('Minuet in G major'), 'piece shown');
    assert((await page.$$('.section-row')).length === 3, 'three bits');
    await shot('01-home');
  });

  await step('tapping a bit opens the practice screen with an empty streak', async () => {
    await page.click('.section-row');
    await page.waitForSelector('.judge');
    assert((await page.$$('.star')).length === 3, 'three stars');
    assert((await page.$$('.star.lit')).length === 0, 'none lit yet');
    await shot('02-practice');
  });

  await step('a perfect pass lights one star', async () => {
    await page.click('.judge .perfect');
    await page.waitForSelector('.star.lit');
    assert((await page.$$('.star.lit')).length === 1, 'one star lit');
  });

  await step('an imperfect pass opens the criteria chips', async () => {
    await page.click('.judge .oops');
    await page.waitForSelector('.sheet .chip');
    const chips = await page.$$('.sheet .chip');
    assert(chips.length >= 8, 'chips shown, got ' + chips.length);
    await shot('03-criteria');
  });

  await step('tagging a mistake resets the streak and writes a timestamped log row', async () => {
    await page.click('.sheet .chip');   /* first chip on */
    await page.click('.sheet .chips:nth-of-type(1) .chip:nth-child(2)').catch(() => {});
    await page.click('text=Log it');
    await page.waitForSelector('.log-row');
    assert((await page.$$('.star.lit')).length === 0, 'streak back to zero');
    const rows = await page.$$('.log-row');
    assert(rows.length === 2, 'two passes logged, got ' + rows.length);
    const logText = await page.textContent('.log-row');
    assert(/\d(am|pm)/.test(await page.textContent('#app')), 'log shows a time');
    assert(logText.length > 0, 'log row has content');
  });

  await step('undo takes the last pass back', async () => {
    await page.click('text=Undo last');
    await page.waitForFunction(() => document.querySelectorAll('.log-row').length === 1);
    assert((await page.$$('.star.lit')).length === 1, 'the earlier star came back');
  });

  await step('three perfect in a row clears the bit and shows the score card', async () => {
    await page.click('.judge .perfect');
    await page.click('.judge .perfect');
    await page.waitForSelector('.scorecard');
    const card = await page.textContent('.scorecard');
    assert(card.includes('You did it') || card.includes('Flawless'), 'celebration copy');
    assert(card.includes('tries'), 'tries counted on the card');
    await shot('04-scorecard');
  });

  await step('the cleared bit earns a sticker in the collection', async () => {
    await page.click('.center-modal >> text=My pieces');
    await page.click('.tabbar button:nth-child(2)');
    await page.waitForSelector('.sticker');
    assert((await page.$$('.sticker')).length >= 1, 'a sticker landed');
    const badges = await page.$$('.badge:not(.locked)');
    assert(badges.length >= 2, 'badges earned, got ' + badges.length);
    await shot('05-collection');
  });

  await step('the coach offers help after repeated resets', async () => {
    await page.click('.tabbar button:nth-child(1)');
    await page.click('.section-row');
    await page.waitForSelector('.judge');
    for (let i = 0; i < 5; i++) {
      await page.click('.judge .oops');
      await page.waitForSelector('.sheet .chip');
      await page.click('.sheet .chip');
      await page.click('text=Log it');
      await page.waitForTimeout(60);
    }
    await page.waitForSelector('.coach');
    const coach = await page.textContent('.coach');
    assert(coach.includes('tricky'), 'coach card appeared');
    assert(coach.includes('Make it smaller'), 'shrink option offered');
    await shot('06-coach');
  });

  await step('the parent area is behind the PIN', async () => {
    await page.click('.tabbar button:nth-child(3)');
    await page.waitForSelector('.pin-input');
    await page.fill('.pin-input', '9999');
    await page.click('text=Unlock');
    assert(await page.isVisible('.pin-input'), 'wrong PIN keeps the door shut');
    await page.fill('.pin-input', '1234');
    await page.click('text=Unlock');
    await page.waitForSelector('.chart-card');
  });

  await step('the dashboard draws every chart', async () => {
    const cards = await page.$$('.chart-card');
    assert(cards.length === 4, 'four chart cards, got ' + cards.length);
    assert((await page.$$('.bar-row')).length > 0, 'ranked bars drawn');
    assert((await page.$$('.heat-cell')).length > 50, 'calendar drawn');
    await shot('07-reports');
  });

  await step('every chart has a table fallback', async () => {
    const toggles = await page.$$('text=Show the numbers');
    assert(toggles.length === 4, 'a table toggle per chart');
    await toggles[0].click();
    await page.waitForSelector('.data-table');
    assert((await page.$$('.data-table th')).length >= 3, 'table has columns');
  });

  await step('the CSV export carries the criteria and timestamps', async () => {
    await page.click('.tabs button:nth-child(5)');
    await page.click('text=Passes CSV');
    await page.waitForSelector('.sheet textarea');
    const csv = await page.inputValue('.sheet textarea');
    assert(csv.split('\n')[0].includes('criteria_labels'), 'criteria column present');
    assert(csv.split('\n')[0].includes('timestamp_iso'), 'timestamp column present');
    assert(csv.split('\n').length > 3, 'rows exported');
    await shot('08-export');
    await page.click('.sheet >> text=Done');
  });

  await step('pieces can be set up from the parent area', async () => {
    await page.click('.tabs button:nth-child(2)');
    await page.waitForSelector('text=+ Add a piece');
    await page.click('text=+ Add a piece');
    await page.waitForSelector('.center-modal input');
    await page.fill('.center-modal input', 'Für Elise');
    await page.click('.center-modal >> text=Add');
    await page.waitForSelector('text=Für Elise');
    await shot('09-parent-pieces');
  });

  await step('the practice data survives a reload', async () => {
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForSelector('.section-row');
    const text = await page.textContent('#app');
    assert(text.includes('Für Elise'), 'the new piece persisted');
    assert(/streak|Cleared/i.test(text), 'history persisted');
  });

  await step('no page errors along the way', async () => {
    assert(consoleErrors.length === 0, 'console errors: ' + consoleErrors.join(' | '));
  });

  await browser.close();
  server.close();

  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
