// Draws the table's sedge mat (chiếu cói) in code: games/tien-len/assets/mat.webp, a tile that
// repeats seamlessly both ways. Rows of round sedge strands run across, each spliced from a few
// stalks of slightly different straw colors, pinched where the jute warp threads hold them.
//   node scripts/mat-texture.mjs
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const SIZE = 512;
/** Strand height and warp spacing in pixels; both divide SIZE, so the tile wraps. */
const STRAND = 16;
const WARP = 32;

// A seeded random source: the same mat every run.
let seed = 20260928;
const random = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

/** Smooth noise along x that wraps at SIZE: `points` random values, cosine-blended. */
function wrapNoise(points) {
  const values = Array.from({ length: points }, () => random());
  return (x) => {
    const t = (x / SIZE) * points;
    const i = Math.floor(t);
    const f = (1 - Math.cos((t - i) * Math.PI)) / 2;
    const a = values[i % points];
    const b = values[(i + 1) % points];
    return a + (b - a) * f;
  };
}

// Straw colors of the stalks: pale gold, a little green, a little brown.
const STRAWS = [
  [224, 194, 128],
  [219, 187, 118],
  [227, 199, 134],
  [214, 186, 120],
  [216, 190, 126],
  [210, 179, 112],
];

const rows = SIZE / STRAND;
const strands = Array.from({ length: rows }, () => {
  // Where one stalk ends and the next begins along this row (wrapping), and their colors.
  const splices = Array.from({ length: 1 + Math.floor(random() * 3) }, () =>
    Math.floor(random() * SIZE),
  ).sort((a, b) => a - b);
  const colors = splices.map(() => STRAWS[Math.floor(random() * STRAWS.length)]);
  return {
    splices,
    colors,
    tone: wrapNoise(6),
    fiber: Array.from({ length: STRAND }, () => wrapNoise(24)),
  };
});

/** How far a splice blends one stalk into the next (the ends overlap), in pixels. */
const BLEND = 18;

/** The color of a row's stalk at x: the stalk that covers it, fading into the next at splices. */
function stalkColor(row, x) {
  const { splices, colors } = row;
  const n = splices.length;
  let k = n - 1;
  for (let i = 0; i < n; i++) if (x >= splices[i]) k = i;
  const next = (k + 1) % n;
  // Distance to the next splice, wrapping around the tile.
  const d = (splices[next] - x + SIZE) % SIZE || SIZE;
  if (n === 1 || d > BLEND) return colors[k];
  const t = 1 - d / BLEND;
  return colors[k].map((c, i) => c + (colors[next][i] - c) * t * 0.5);
}

const px = Buffer.alloc(SIZE * SIZE * 3);
for (let y = 0; y < SIZE; y++) {
  const row = strands[Math.floor(y / STRAND)];
  const v = (y % STRAND) / (STRAND - 1); // 0 top edge .. 1 bottom edge of the strand
  // Round strand: light along its middle, darker toward the seams, lit a little from above.
  const round = Math.sin(Math.PI * (0.08 + v * 0.84)) ** 0.7;
  const shade = 0.66 + 0.4 * round - 0.08 * v;
  const fiber = row.fiber[y % STRAND];
  for (let x = 0; x < SIZE; x++) {
    const [r, g, b] = stalkColor(row, x);
    // The warp pinches the strand: a dark crease, a small highlight just after it.
    const w = x % WARP;
    const pinch = [0.84, 0.91, 0.97, 1.02, 1.03, 1.02][w] ?? 1;
    const grain = 0.94 + 0.1 * fiber(x) + 0.05 * (row.tone(x) - 0.5);
    const k = shade * pinch * grain;
    const i = (y * SIZE + x) * 3;
    px[i] = Math.min(255, r * k);
    px[i + 1] = Math.min(255, g * k);
    px[i + 2] = Math.min(255, b * k);
  }
}

const out = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'games',
  'tien-len',
  'assets',
  'mat.webp',
);
await sharp(px, { raw: { width: SIZE, height: SIZE, channels: 3 } })
  .webp({ quality: 88 })
  .toFile(out);
console.log(`✓ ${out}`);
