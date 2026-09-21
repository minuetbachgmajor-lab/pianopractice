/* Renders the app icon to PNG at the sizes iOS and the manifest want.
 * Run: node tools/make-icons.js   (needs Playwright + Chromium) */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SIZES = [180, 192, 512];
const OUT = path.join(__dirname, '..', 'icons');

function svg(size) {
  const s = size;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff8fbc"/>
      <stop offset="1" stop-color="#7b61d6"/>
    </linearGradient>
    <linearGradient id="star" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff0b8"/>
      <stop offset="1" stop-color="#ffc846"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="114" fill="url(#bg)"/>
  <!-- three white keys, one per perfect pass -->
  <g>
    <rect x="96"  y="196" width="96" height="220" rx="18" fill="#ffffff"/>
    <rect x="208" y="196" width="96" height="220" rx="18" fill="#ffffff"/>
    <rect x="320" y="196" width="96" height="220" rx="18" fill="#ffffff"/>
    <rect x="172" y="196" width="46" height="132" rx="12" fill="#3a2a55"/>
    <rect x="294" y="196" width="46" height="132" rx="12" fill="#3a2a55"/>
  </g>
  <path fill="url(#star)" stroke="#ffffff" stroke-width="10" stroke-linejoin="round"
        d="M256 44l40 82 90 13-65 64 15 90-80-42-80 42 15-90-65-64 90-13z"/>
</svg>`;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  for (const size of SIZES) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<html><body style="margin:0">${svg(size)}</body></html>`,
      { waitUntil: 'load' }
    );
    const file = path.join(OUT, `icon-${size}.png`);
    await page.screenshot({ path: file, omitBackground: true });
    await page.close();
    console.log('wrote', path.relative(process.cwd(), file));
  }
  await browser.close();
})();
