/* Screenshots of the app loaded with the demo history.
 * Run: node tools/shots.js [outDir] */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { generate } = require('./demo-data');

const ROOT = path.join(__dirname, '..');
const OUT = process.argv[2] || path.join(ROOT, 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

function serve() {
  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file === '/') { file = '/index.html'; }
    const full = path.join(ROOT, file);
    if (!full.startsWith(ROOT) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'text/plain' });
    res.end(fs.readFileSync(full));
  });
  return new Promise((r) => server.listen(0, () => r(server)));
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const demo = JSON.stringify(generate());
  const server = await serve();
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);

  await page.goto(base, { waitUntil: 'load' });
  await page.evaluate((json) => { window.localStorage.setItem('pianopractice.v1', json); }, demo);
  await page.goto(base, { waitUntil: 'load' });

  const shot = async (name) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
    console.log('wrote', name + '.png');
  };

  await page.waitForSelector('.section-row');
  await shot('home');

  await page.click('.section-row');
  await page.waitForSelector('.judge');
  await page.click('.judge .perfect');
  await shot('practice');

  await page.click('.judge .oops');
  await page.waitForSelector('.sheet .chip');
  await page.click('.sheet .chip');
  await shot('criteria-sheet');
  await page.click('text=Log it');

  await page.click('.tabbar button:nth-child(2)');
  await page.waitForSelector('.sticker');
  await shot('collection');

  await page.click('.tabbar button:nth-child(3)');
  await page.waitForSelector('.pin-input');
  await page.fill('.pin-input', '1234');
  await page.click('text=Unlock');
  await page.waitForSelector('.chart-card');
  await shot('reports');

  /* dark mode, since the charts declare their own dark steps */
  const dark = await ctx.newPage();
  await dark.emulateMedia({ colorScheme: 'dark' });
  await dark.goto(base, { waitUntil: 'load' });
  await dark.waitForSelector('.section-row');
  await dark.screenshot({ path: path.join(OUT, 'home-dark.png'), fullPage: true });
  console.log('wrote home-dark.png');

  await browser.close();
  server.close();
})();
