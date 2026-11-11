// Copies the self-hosted fonts into /fonts and renders the PNG app icons from
// icons/icon.svg using the locally installed Chromium (via Playwright).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

const FONTS = [
  '@fontsource-variable/fraunces/files/fraunces-latin-opsz-normal.woff2',
  '@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2',
  '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2',
  'country-flag-emoji-polyfill/dist/TwemojiCountryFlags.woff2',
];
fs.mkdirSync(path.join(ROOT, 'fonts'), { recursive: true });
for (const f of FONTS) {
  const src = require.resolve(f);
  fs.copyFileSync(src, path.join(ROOT, 'fonts', path.basename(f)));
  console.log('✓ fonts/' + path.basename(f));
}

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.log('• Playwright not installed — skipping PNG icon rendering (fonts copied).');
  process.exit(0);
}
const svg = fs.readFileSync(path.join(ROOT, 'icons', 'icon.svg'), 'utf8');
// Maskable variant: full-bleed square, artwork shrunk into the 80% safe zone.
const maskable = svg
  .replace('rx="116"', 'rx="0"')
  .replace(/(<rect[^>]*\/>)([\s\S]*)(<\/svg>)/, '$1<g transform="translate(256 256) scale(0.78) translate(-256 -244)">$2</g>$3');

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(markup, size, out) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(ROOT, 'icons', out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('✓ icons/' + out);
}
await render(svg, 192, 'icon-192.png');
await render(svg, 512, 'icon-512.png');
await render(maskable, 512, 'icon-maskable-512.png');
await render(maskable, 180, 'apple-touch-icon.png');
await browser.close();
