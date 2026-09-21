/* Regression test for the bug that hid three releases from an installed iPad.
 *
 * The original service worker served the app shell cache-first under a
 * hand-bumped cache name. Forgetting the bump meant an installed device kept
 * serving the day-one build forever, with no symptom the person holding it
 * could see. This test installs that exact worker, then ships a new build
 * over the top, and fails unless the new build actually arrives.
 *
 * Run: node tests/sw-update.js
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TYPES = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.png': 'image/png', '.webmanifest': 'application/manifest+json'
};

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach((name) => {
    if (name === '.git' || name === 'node_modules' || name === 'tests' || name === 'tools') { return; }
    const src = path.join(from, name), dst = path.join(to, name);
    if (fs.statSync(src).isDirectory()) { copyTree(src, dst); }
    else { fs.copyFileSync(src, dst); }
  });
}

function stampVersion(dir, version) {
  const file = path.join(dir, 'js', 'app.js');
  const src = fs.readFileSync(file, 'utf8')
    .replace(/w\.PP\.appVersion = '[^']*';/, `w.PP.appVersion = '${version}';`);
  fs.writeFileSync(file, src);
}

let passed = 0;
const failures = [];
async function step(name, fn) {
  try { await fn(); passed += 1; console.log('  ok   ' + name); }
  catch (err) { failures.push(name); console.log('  FAIL ' + name + ' — ' + err.message); }
}
function assert(cond, msg) { if (!cond) { throw new Error(msg); } }

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-sw-'));
  copyTree(ROOT, dir);

  /* the shipped-and-broken worker, straight out of git history */
  const oldSw = execSync('git show fc1ced4:sw.js', { cwd: ROOT }).toString();
  fs.writeFileSync(path.join(dir, 'sw.js'), oldSw);
  stampVersion(dir, 'OLD-BUILD');

  const server = http.createServer((req, res) => {
    let file = decodeURIComponent(req.url.split('?')[0]);
    if (file === '/') { file = '/index.html'; }
    const full = path.join(dir, file);
    if (!full.startsWith(dir) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    /* mimic GitHub Pages: do not let the HTTP cache mask the test */
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'text/plain', 'Cache-Control': 'no-cache' });
    res.end(fs.readFileSync(full));
  });
  await new Promise((r) => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port + '/index.html';

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 768, height: 1024 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(10000);

  /* The fixed worker reloads the page the moment it takes over, so a read
   * can land mid-navigation. Retry rather than call that a failure. */
  async function version() {
    for (let i = 0; i < 6; i++) {
      try {
        return await page.evaluate(() => window.PP && window.PP.appVersion);
      } catch (err) {
        if (!/context was destroyed|navigation/i.test(err.message)) { throw err; }
        await page.waitForLoadState('load').catch(() => {});
        await page.waitForTimeout(300);
      }
    }
    throw new Error('page kept navigating');
  }

  await step('the old build installs and takes control', async () => {
    await page.goto(base, { waitUntil: 'load' });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 10000 });
    assert((await version()) === 'OLD-BUILD', 'serving the old build');
  });

  await step('the old worker would have served the old build forever', async () => {
    /* ship a new build WITHOUT touching sw.js — the exact mistake */
    stampVersion(dir, 'NEW-BUILD');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    assert((await version()) === 'OLD-BUILD',
      'this is the bug: cache-first + unchanged cache name pins the old build');
  });

  await step('shipping the fixed worker delivers the new build', async () => {
    fs.copyFileSync(path.join(ROOT, 'sw.js'), path.join(dir, 'sw.js'));
    /* two launches: the first swaps the worker in, the second is served by it */
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(700);
      if ((await version()) === 'NEW-BUILD') { break; }
    }
    assert((await version()) === 'NEW-BUILD', 'the new build never arrived');
  });

  await step('a later release now lands without touching sw.js', async () => {
    stampVersion(dir, 'NEWER-BUILD');
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(500);
    assert((await version()) === 'NEWER-BUILD',
      'network-first must pick up new files with no cache-name bump');
  });

  await step('and it still works with the network gone', async () => {
    await ctx.setOffline(true);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.section-row', { timeout: 15000 });
    assert((await version()) === 'NEWER-BUILD', 'offline falls back to the cached build');
    await ctx.setOffline(false);
  });

  await browser.close();
  server.close();
  fs.rmSync(dir, { recursive: true, force: true });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
