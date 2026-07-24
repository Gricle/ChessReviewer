// Renders the 1200×630 social share image (public/og.png) from a designed SVG.
// Run manually when the branding changes:  node scripts/genOgImage.mjs
// The PNG is committed, so CI/build never needs an image toolchain.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const site = JSON.parse(readFileSync(join(root, 'site.config.json'), 'utf8'));

const MARK =
  'M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z';

const chips = ['100% Free', 'No sign-up', 'Chess.com & Lichess', '10 languages'];
let chipX = 90;
const chipSvg = chips
  .map((label) => {
    const w = 34 + label.length * 13.5;
    const safe = label.replace(/&/g, '&amp;');
    const el = `<g transform="translate(${chipX} 468)">
      <rect width="${w}" height="52" rx="26" fill="#0b0918" stroke="#38e1d6" stroke-opacity="0.35"/>
      <text x="${w / 2}" y="33" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="600" fill="#7dd3fc">${safe}</text>
    </g>`;
    chipX += w + 18;
    return el;
  })
  .join('\n');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#08061a"/>
      <stop offset="0.55" stop-color="#0b0821"/>
      <stop offset="1" stop-color="#05040c"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.15" cy="0.9" r="0.9">
      <stop offset="0" stop-color="#38e1d6" stop-opacity="0.18"/>
      <stop offset="1" stop-color="#38e1d6" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="head" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#c7d2fe"/>
    </linearGradient>
    <pattern id="board" width="76" height="76" patternUnits="userSpaceOnUse">
      <rect width="38" height="38" fill="#ffffff" fill-opacity="0.02"/>
      <rect x="38" y="38" width="38" height="38" fill="#ffffff" fill-opacity="0.02"/>
    </pattern>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="720" width="480" height="630" fill="url(#board)"/>

  <!-- brand mark + wordmark -->
  <g transform="translate(90 74)">
    <g transform="scale(1.55)"><path d="${MARK}" fill="#863bff"/></g>
    <text x="92" y="34" font-family="IBM Plex Mono, Consolas, monospace" font-size="26" font-weight="700" letter-spacing="3" fill="#e2e8f0">CHESS REVIEWER</text>
    <text x="92" y="64" font-family="Segoe UI, Arial, sans-serif" font-size="20" fill="#64748b">${site.tagline}</text>
  </g>

  <!-- giant faded mark, right -->
  <g transform="translate(880 150) scale(7.2)" opacity="0.06"><path d="${MARK}" fill="#38e1d6"/></g>

  <!-- headline -->
  <text x="88" y="286" font-family="Segoe UI, Arial, sans-serif" font-size="82" font-weight="800" fill="url(#head)">Free Chess Game</text>
  <text x="88" y="374" font-family="Segoe UI, Arial, sans-serif" font-size="82" font-weight="800" fill="url(#head)">Analyzer &amp; Review</text>

  <!-- subhead -->
  <text x="90" y="426" font-family="Segoe UI, Arial, sans-serif" font-size="28" fill="#94a3b8">Every move from Brilliant to Blunder — Stockfish, right in your browser.</text>

  ${chipSvg}

  <rect x="0" y="626" width="1200" height="4" fill="#38e1d6"/>
</svg>`;

const png = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' },
}).render().asPng();

writeFileSync(join(root, 'public', 'og.png'), png);
console.log('[genOgImage] wrote public/og.png (1200×630)');
