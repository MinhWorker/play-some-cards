// Original vector tokens, rasterized at 3x their largest display size.
// Run from the repository root: node games/bai-cao/sources/render_tokens.mjs
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import { mkdir } from 'node:fs/promises';
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import sharp from 'sharp';

const out = new URL('../assets/', import.meta.url);
await mkdir(out, { recursive: true });
for (const [name, color, mark] of [
  ['chip-5', '#278a72', '5'],
  ['chip-10', '#b53b42', '10'],
  ['chip-20', '#bc822c', '20'],
  ['dealer', '#bc822c', 'CÁI'],
]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="288" height="288" viewBox="0 0 96 96">
  <defs><linearGradient id="edge" x2="0" y2="1"><stop stop-color="#ffefb7"/><stop offset="1" stop-color="#8c591d"/></linearGradient>
  <radialGradient id="face" cx="35%" cy="25%" r="80%"><stop stop-color="${color}"/><stop offset="1" stop-color="#352619"/></radialGradient></defs>
  <ellipse cx="48" cy="52" rx="43" ry="42" fill="#20170f" opacity=".25"/>
  <circle cx="48" cy="48" r="42" fill="url(#edge)"/>
  <circle cx="48" cy="46" r="38" fill="${color}" stroke="#ffe6a0" stroke-width="2"/>
  <circle cx="48" cy="46" r="34" fill="none" stroke="#fff1c7" stroke-width="5" stroke-dasharray="10 16"/>
  <circle cx="48" cy="46" r="27" fill="url(#face)" stroke="#fbd892" stroke-width="1.5"/>
  <text x="48" y="${name === 'dealer' ? 52 : 57}" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-size="${name === 'dealer' ? 18 : 30}" font-weight="bold" fill="#fff0c8">${mark}</text>
  </svg>`;
  await sharp(Buffer.from(svg))
    .webp({ quality: 95 })
    .toFile(new URL(`${name}.webp`, out).pathname);
}
