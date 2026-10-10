/**
 * Small vector effects for Bom Nguyên Tố, packed as the `cartoon-fx` JSON atlas: crate
 * splinters, dust, dash streaks, the freeze shell, dizzy stars, skill bursts and victory confetti.
 * Characters, bombs, blasts and items are Codex art packed by pack-sprites.py.
 * Run from the repository root: node games/bom-nguyen-to/sources/bake-effects.mjs
 */
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import fs from 'node:fs/promises';
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import path from 'node:path';
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import { fileURLToPath } from 'node:url';
// biome-ignore lint/style/noRestrictedImports: Offline asset tooling, outside game source.
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'assets');
const SIZE = 160;
const OUTLINE = '#73535f';
const CREAM = '#fff8e7';
const PALETTES = {
  fire: { body: '#ffb397', dark: '#ee877c', light: '#ffe0bd', accent: '#ffd074' },
  water: { body: '#a1dff0', dark: '#79bedf', light: '#ddf5ff', accent: '#9bbfea' },
  lightning: { body: '#ccb8f4', dark: '#ad91de', light: '#eee4ff', accent: '#fff0a2' },
  ice: { body: '#bfeaf0', dark: '#91c9db', light: '#e8fcff', accent: '#ffda9a' },
  wind: { body: '#b4e7c1', dark: '#85c8a4', light: '#e5f8d7', accent: '#e6efa5' },
};
const EFFECTS = {
  ...Object.fromEntries(Object.keys(PALETTES).map((element) => [`skill-${element}`, 8])),
  'crate-break': 8,
  stun: 8,
  dust: 6,
  dash: 8,
  freeze: 8,
  victory: 12,
};

const n = (value) => Math.round(value * 100) / 100;
const ellipse = (x, y, rx, ry, fill, stroke = OUTLINE, width = 4) =>
  `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const circle = (x, y, radius, fill, stroke = OUTLINE, width = 4) =>
  ellipse(x, y, radius, radius, fill, stroke, width);
const shape = (d, fill, stroke = OUTLINE, width = 4) =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const star = (x, y, radius, fill, width = 2) => {
  const points = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const r = i % 2 ? radius * 0.35 : radius;
    return `${n(x + Math.cos(a) * r)},${n(y + Math.sin(a) * r)}`;
  }).join(' ');
  return `<polygon points="${points}" fill="${fill}" stroke="${OUTLINE}" stroke-width="${width}"/>`;
};
const svg = (content) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 160 160"><g stroke-linecap="round" stroke-linejoin="round">${content}</g></svg>`;

function emblem(element, x, y, size, color = PALETTES[element].dark, stroke = OUTLINE, width = 2) {
  const s = size / 16;
  let content = '';
  if (element === 'fire')
    content = shape(
      'M0 8 C-12 5 -9 -4 -4 -8 C-4 -2 2 -4 0 -14 C12 -5 12 3 5 8 C3 10 -2 10 0 8Z',
      color,
      stroke,
      width,
    );
  if (element === 'water')
    content = shape(
      'M0 -13 C-4 -6 -10 -1 -10 4 C-10 15 10 15 10 4 C10 -1 4 -6 0 -13Z',
      color,
      stroke,
      width,
    );
  if (element === 'lightning')
    content = shape('M1 -14 -10 3 -2 3 -5 15 11 -5 3 -5 7 -14Z', color, stroke, width);
  if (element === 'ice')
    content = ['M0 -13V13', 'M-12 -7 12 7', 'M-12 7 12 -7', 'M-4 -9 0 -5 4 -9', 'M-4 9 0 5 4 9']
      .map((d) => shape(d, 'none', color, 3))
      .join('');
  if (element === 'wind')
    content = shape(
      'M-12 0 Q1 -14 11 -5 Q18 4 5 3 M-11 6 Q0 1 11 8 M-8 -7 Q-2 -13 5 -10',
      'none',
      color,
      3,
    );
  return `<g transform="translate(${x} ${y}) scale(${s})">${content}</g>`;
}

function burst(element, frame, skill = false) {
  const p = PALETTES[element];
  const t = frame / 7;
  let s = '';
  const r = 12 + t * (skill ? 50 : 56);
  const strength = Math.sin(Math.PI * Math.min(0.98, t + 0.1));
  if (frame < 6) {
    s += ellipse(80, 87, r * 0.92, r * 0.64, p.light, p.dark, 3);
    for (let i = 0; i < 6; i++) {
      const a = ((i / 6) * 2 + t * 0.3) * Math.PI;
      const x = 80 + Math.cos(a) * r * 0.74;
      const y = 87 + Math.sin(a) * r * 0.57;
      s += circle(x, y, (10 + (i % 2) * 5) * strength, p.body, p.dark, 2);
    }
    s += ellipse(80 - r * 0.17, 84 - r * 0.12, r * 0.34, r * 0.24, CREAM, 'none', 0);
    s += emblem(element, 80, 85, 11 + strength * 9, p.dark, 'none', 0);
  }
  for (let i = 0; i < 6; i++) {
    const a = ((i / 6) * 2 + t * 0.3) * Math.PI;
    const x = 80 + Math.cos(a) * (r + t * 5);
    const y = 87 + Math.sin(a) * (r * 0.67 + t * 6);
    if (element === 'water')
      s += ellipse(x, y, 4 + strength * 2, 6 + strength * 2, p.body, p.dark, 1.5);
    else if (element === 'ice') s += emblem(element, x, y, 4 + strength * 6, p.dark, 'none', 0);
    else if (element === 'wind')
      s += shape(
        `M${x - 5} ${y + 5} Q${x - 8} ${y - 9} ${x + 8} ${y - 6} Q${x + 9} ${y + 7} ${x - 5} ${y + 5}Z`,
        p.body,
        p.dark,
        1.5,
      );
    else s += star(x, y, 4 + strength * 6, p.accent, 1.5);
  }
  return svg(s);
}

function effect(name, frame) {
  if (name.startsWith('skill-')) return burst(name.slice(6), frame, true);
  const t = frame / (EFFECTS[name] - 1);
  let s = '';
  if (name === 'crate-break') {
    if (frame < 2)
      s +=
        shape('M41 58 H119 V124 H41Z', '#f6cfa0', OUTLINE, 4) +
        shape('M47 67 112 117 M113 68 48 116', 'none', '#b88773', 6);
    for (let i = 0; i < 7; i++) {
      const a = ((i / 7) * 2 - 0.2) * Math.PI;
      const x = 80 + Math.cos(a) * t * 57;
      const y = 98 + Math.sin(a) * t * 38 + t * t * 26;
      const len = 12 * (1 - t * 0.65);
      s += shape(
        `M${x - len} ${y - 3} l${len * 1.4} -${len * 0.5} ${len * 0.7} 8 -${len * 1.7} 4Z`,
        i % 2 ? '#f7d8b2' : '#e9b88f',
        '#b88773',
        2,
      );
    }
    if (frame < 5) s += circle(75, 99, 11 + frame * 5, CREAM, 'none', 0);
  }
  if (name === 'stun') {
    // Dizzy stars circling over a stunned character's head.
    for (let i = 0; i < 3; i++) {
      const a = ((i / 3) * 2 + t * 2) * Math.PI;
      const x = 80 + Math.cos(a) * 34;
      const y = 52 + Math.sin(a) * 11;
      s += star(x, y, 9 - (Math.sin(a) + 1) * 1.5, i % 2 ? '#fff1aa' : '#ffd36b', 1.5);
    }
    s += ellipse(80, 52, 36, 12, 'none', '#ffe9a855', 2);
  }
  if (name === 'dust') {
    for (let i = 0; i < 5; i++)
      s += circle(
        80 + (i - 2) * (8 + t * 17),
        121 - t * 21 + Math.sin(i) * 5,
        (8 + (i % 2) * 4) * (1 - t),
        '#fff5d9',
        'none',
        0,
      );
  }
  if (name === 'dash') {
    for (let i = 0; i < 4; i++) {
      const x = 33 + i * 24 + t * 11;
      const y = 80 + (i % 2) * 12;
      s += shape(
        `M${x - 17} ${y + 18} Q${x + 9} ${y + 17} ${x + 13} ${y - 13} M${x - 11} ${y + 25} Q${x + 20} ${y + 21} ${x + 20} ${y - 2}`,
        'none',
        i % 2 ? '#b7e6d5' : '#f8eeae',
        Math.max(1, 5 - t * 4),
      );
    }
  }
  if (name === 'freeze') {
    s += shape(
      'M35 56 49 32 113 35 131 58 133 116 114 140 46 140 28 111Z',
      '#b5eaff32',
      '#8fcbe0',
      3,
    );
    s += shape(
      'M35 56 65 69 49 32 M65 69 62 125 46 140 M131 58 108 77 113 35 M108 77 114 140',
      'none',
      '#f4fdff',
      2,
    );
    s += emblem('ice', 50 + (frame % 4) * 20, 54 + (frame % 3) * 18, 10, '#effcff', 'none', 0);
  }
  if (name === 'victory') {
    const colors = ['#ffd19b', '#b3e7d0', '#cdbbf0', '#ffc1ca', '#9edbef'];
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * Math.PI * 2;
      const x = 80 + Math.cos(a) * (12 + t * 58);
      const y = 84 + Math.sin(a) * (12 + t * 43) + t * t * 18;
      if (i % 3 === 0) s += star(x, y, 7 - t * 2, colors[i % 5], 1.2);
      else
        s += shape(
          `M${x - 3} ${y - 5} l7 ${i % 2 ? -2 : 2} -1 8 -7 -2Z`,
          colors[i % 5],
          OUTLINE,
          1,
        );
    }
  }
  return svg(s);
}

async function raster(content) {
  return sharp(Buffer.from(content)).png().toBuffer();
}

async function pack(name, frames) {
  const width = 1024;
  const gutter = 2;
  const atlas = {};
  const tiles = [];
  const composites = [];
  for (const frame of frames) {
    const png = await raster(frame.svg);
    const pixels = await sharp(png).ensureAlpha().raw().toBuffer();
    let left = SIZE;
    let top = SIZE;
    let right = -1;
    let bottom = -1;
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        if (!pixels[(y * SIZE + x) * 4 + 3]) continue;
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
    // Transparent edge pixels protect filtering; full source bounds preserve the ground anchor.
    left = right < 0 ? 0 : Math.max(0, left - 2);
    top = bottom < 0 ? 0 : Math.max(0, top - 2);
    right = right < 0 ? 0 : Math.min(SIZE - 1, right + 2);
    bottom = bottom < 0 ? 0 : Math.min(SIZE - 1, bottom + 2);
    const w = right - left + 1;
    const h = bottom - top + 1;
    tiles.push({ name: frame.name, left, top, w, h, png });
  }
  // Height-sorted shelf packing avoids wasting the large transparent corners of each pose.
  const shelves = [];
  let height = 0;
  for (const tile of [...tiles].sort((a, b) => b.h - a.h || b.w - a.w)) {
    const packedW = tile.w + gutter * 2;
    const packedH = tile.h + gutter * 2;
    const fits = shelves.filter((shelf) => shelf.h >= packedH && shelf.x + packedW <= width);
    let shelf = fits.sort((a, b) => width - a.x - packedW - (width - b.x - packedW))[0];
    if (!shelf) {
      shelf = { x: 0, y: height, h: packedH };
      shelves.push(shelf);
      height += packedH;
    }
    tile.x = shelf.x + gutter;
    tile.y = shelf.y + gutter;
    shelf.x += packedW;
  }
  for (const tile of tiles) {
    const cropped = await sharp(tile.png)
      .extract({ left: tile.left, top: tile.top, width: tile.w, height: tile.h })
      .png()
      .toBuffer();
    composites.push({ input: cropped, left: tile.x, top: tile.y });
    atlas[tile.name] = {
      frame: { x: tile.x, y: tile.y, w: tile.w, h: tile.h },
      rotated: false,
      trimmed: true,
      spriteSourceSize: { x: tile.left, y: tile.top, w: tile.w, h: tile.h },
      sourceSize: { w: SIZE, h: SIZE },
    };
  }
  await sharp({ create: { width, height, channels: 4, background: '#00000000' } })
    .composite(composites)
    .webp({ quality: 94, alphaQuality: 100, effort: 6 })
    .toFile(path.join(assets, `${name}.webp`));
  await fs.writeFile(
    path.join(assets, `${name}.json`),
    `${JSON.stringify(
      {
        frames: atlas,
        meta: {
          app: 'Bom Nguyên Tố original vector bake',
          version: '1',
          image: `${name}.webp`,
          format: 'RGBA8888',
          size: { w: width, h: height },
          scale: '1',
        },
      },
      null,
      2,
    )}\n`,
  );
  console.log(`${name}: ${frames.length} frames · ${width}×${height}`);
}

const effects = [];
for (const [name, count] of Object.entries(EFFECTS))
  for (let i = 0; i < count; i++)
    effects.push({ name: `${name}-${String(i).padStart(2, '0')}`, svg: effect(name, i) });
await pack('cartoon-fx', effects);
