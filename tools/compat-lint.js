/* Guards the Safari 12 / iPadOS 12.5 baseline (iPad mini 3).
 *
 * Chromium will happily run syntax that the target device cannot parse, and a
 * parse error on an iPad shows up as a blank white screen — so the baseline is
 * checked here instead of hoped for. Run: node tools/compat-lint.js */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* Everything below landed in Safari 13 or later. */
const JS_BANNED = [
  { re: /(?<![?\w"'`])\?\.(?![\d])/, name: 'optional chaining (?.)', since: 'Safari 13.1' },
  { re: /[^?"'`]\?\?[^?]/, name: 'nullish coalescing (??)', since: 'Safari 13.1' },
  { re: /\|\|=|&&=|\?\?=/, name: 'logical assignment', since: 'Safari 14' },
  { re: /\bglobalThis\b/, name: 'globalThis', since: 'Safari 12.1' },
  { re: /\bstructuredClone\s*\(/, name: 'structuredClone()', since: 'Safari 15.4' },
  { re: /\bcrypto\.randomUUID\b/, name: 'crypto.randomUUID()', since: 'Safari 15.4' },
  { re: /\bObject\.fromEntries\b/, name: 'Object.fromEntries()', since: 'Safari 12.1' },
  { re: /\bObject\.hasOwn\b/, name: 'Object.hasOwn()', since: 'Safari 15.4' },
  { re: /\.matchAll\s*\(/, name: 'String.matchAll()', since: 'Safari 13' },
  { re: /\.replaceAll\s*\(/, name: 'String.replaceAll()', since: 'Safari 13.1' },
  { re: /\]\.at\s*\(|\)\.at\s*\(|\w+\.at\s*\(\s*-/, name: 'Array.at()', since: 'Safari 15.4' },
  { re: /\bResizeObserver\b/, name: 'ResizeObserver', since: 'Safari 13.1' },
  { re: /\bPromise\.allSettled\b/, name: 'Promise.allSettled()', since: 'Safari 13' },
  { re: /\bBigInt\b/, name: 'BigInt', since: 'Safari 14' },
  { re: /\bdialog\b\s*\)|createElement\(['"]dialog['"]\)/, name: '<dialog> element', since: 'Safari 15.4' },
  { re: /navigator\.clipboard/, name: 'navigator.clipboard', since: 'Safari 13.1' }
];

const CSS_BANNED = [
  { re: /:is\(/, name: ':is()', since: 'Safari 14' },
  { re: /:where\(/, name: ':where()', since: 'Safari 14' },
  { re: /\bclamp\(/, name: 'clamp()', since: 'Safari 13.1' },
  { re: /[:\s]min\(\s*\d/, name: 'CSS min()', since: 'Safari 13.1' },
  { re: /[:\s]max\(\s*\d/, name: 'CSS max()', since: 'Safari 13.1' },
  { re: /aspect-ratio\s*:/, name: 'aspect-ratio', since: 'Safari 15' },
  { re: /^\s*inset\s*:/, name: 'inset shorthand', since: 'Safari 14.1' },
  { re: /\bgap\s*:\s*\d.*\bflex\b/, name: 'gap in a flex container', since: 'Safari 14.1' },
  { re: /overscroll-behavior/, name: 'overscroll-behavior', since: 'Safari 16' },
  { re: /content-visibility/, name: 'content-visibility', since: 'Safari 15.4' },
  { re: /\bgrid-template-columns:\s*subgrid/, name: 'subgrid', since: 'Safari 16' }
];

const problems = [];

/* Blanks out comment text while keeping the line count, so a rule written
 * down in a comment is not reported as a violation. */
function readCode(file) {
  const lines = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n');
  let inBlock = false;
  return lines.map((line) => {
    let out = '';
    for (let i = 0; i < line.length; i++) {
      if (inBlock) {
        if (line[i] === '*' && line[i + 1] === '/') { inBlock = false; i += 1; }
        continue;
      }
      if (line[i] === '/' && line[i + 1] === '*') { inBlock = true; i += 1; continue; }
      if (line[i] === '/' && line[i + 1] === '/') { break; }
      out += line[i];
    }
    return out;
  });
}

function scan(file, rules) {
  const lines = readCode(file);
  lines.forEach((line, i) => {
    rules.forEach((rule) => {
      if (rule.re.test(line)) {
        problems.push(`${file}:${i + 1}  ${rule.name} — not supported before ${rule.since}\n    ${line.trim()}`);
      }
    });
  });
}

/* Every `gap:` must sit next to a `grid-gap:` fallback, which is what
 * Safari 12 actually reads inside a grid container. */
function checkGapFallback(file) {
  const lines = readCode(file);
  lines.forEach((line, i) => {
    if (/(^|;|\s)gap\s*:/.test(line) && !/grid-gap\s*:/.test(line)) {
      problems.push(`${file}:${i + 1}  \`gap\` without a \`grid-gap\` fallback for Safari 12\n    ${line.trim()}`);
    }
  });
}

const jsFiles = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js')).map((f) => 'js/' + f);
jsFiles.concat(['sw.js']).forEach((f) => scan(f, JS_BANNED));
['css/app.css'].forEach((f) => { scan(f, CSS_BANNED); checkGapFallback(f); });

if (problems.length) {
  console.error('Safari 12 compatibility problems:\n');
  problems.forEach((p) => console.error('  ' + p));
  console.error(`\n${problems.length} problem(s).`);
  process.exit(1);
}
console.log(`Safari 12 baseline OK — ${jsFiles.length + 2} files checked.`);
