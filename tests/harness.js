/* Loads the browser scripts into a fake window so the pure logic can be
 * tested in Node. The app files are plain scripts (no modules) on purpose —
 * iPadOS 12 loads them straight off the filesystem. */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function makeWindow() {
  const mem = {};
  const win = {
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      setItem: (k, v) => { mem[k] = String(v); },
      removeItem: (k) => { delete mem[k]; }
    }
  };
  win.window = win;
  return win;
}

function loadApp(files) {
  const win = makeWindow();
  const ctx = vm.createContext(win);
  (files || ['js/criteria.js', 'js/stickers.js', 'js/badges.js', 'js/store.js', 'js/engine.js', 'js/stats.js'])
    .forEach((f) => {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      vm.runInContext(src, ctx, { filename: f });
    });
  return win;
}

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed += 1; }
  catch (err) { failures.push({ name, err }); }
}
function assert(cond, msg) {
  if (!cond) { throw new Error(msg || 'assertion failed'); }
}
function eq(a, b, msg) {
  if (a !== b) { throw new Error((msg || 'not equal') + ': ' + JSON.stringify(a) + ' !== ' + JSON.stringify(b)); }
}
function report() {
  failures.forEach((f) => {
    console.error('FAIL  ' + f.name);
    console.error('      ' + f.err.message);
  });
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
}

module.exports = { loadApp, test, assert, eq, report };
