import type { GameScene } from '@psc/sdk/client';
/**
 * A taken piece breaks into shards of itself. Each piece's image is cut once, the first time
 * it breaks, into jagged wedges around a point near its middle (an inner and an outer shard
 * per wedge). The shards fly apart, fall onto the table, bounce and fade.
 */
import type Phaser from 'phaser';
import { DISC } from './theme.js';

/** One shard: its texture, and where its middle sits from the image's center (image px). */
interface Shard {
  key: string;
  ox: number;
  oy: number;
}

/** Cutting patterns per piece image, so the same piece doesn't always break the same way. */
const PATTERNS = 2;
const WEDGES = 7;
const cache = new Map<string, Shard[][]>();

type Point = [number, number];

/** Cuts image `key` into shards (once per pattern) and returns one pattern at random. */
function shardsOf(scene: GameScene, key: string): Shard[] {
  let patterns = cache.get(key);
  if (!patterns?.every((p) => p.every((s) => scene.textures.exists(s.key)))) {
    patterns = Array.from({ length: PATTERNS }, (_, i) => cut(scene, key, `${key}.shard${i}`));
    cache.set(key, patterns);
  }
  return patterns[Math.floor(Math.random() * patterns.length)] ?? [];
}

function cut(scene: GameScene, key: string, prefix: string): Shard[] {
  const source = scene.textures.get(key).getSourceImage() as CanvasImageSource & {
    width: number;
    height: number;
  };
  const { width: w, height: h } = source;
  const disc = (w * DISC) / 2;
  const jitter = (n: number) => (Math.random() * 2 - 1) * n;
  const center: Point = [w / 2 + jitter(disc * 0.15), h / 2 + jitter(disc * 0.15)];
  const at = (angle: number, r: number): Point => [
    center[0] + Math.cos(angle) * r,
    center[1] + Math.sin(angle) * r,
  ];
  // Cracks from the middle out past the corners, with a kink in each; a ring crack halfway.
  const reach = Math.hypot(w, h);
  const angles = Array.from(
    { length: WEDGES },
    (_, i) => ((i + 0.5 + jitter(0.3)) / WEDGES) * Math.PI * 2,
  );
  const rays = angles.map((a) => {
    const ring = at(a + jitter(0.1), disc * (0.45 + jitter(0.12)));
    const kink = at(a + jitter(0.18), disc * (0.8 + jitter(0.1)));
    return { ring, kink, end: at(a, reach) };
  });
  const shards: Shard[] = [];
  rays.forEach((ray, i) => {
    const next = rays[(i + 1) % rays.length];
    if (!next) return;
    const a0 = angles[i] ?? 0;
    let a1 = angles[(i + 1) % angles.length] ?? 0;
    if (a1 < a0) a1 += Math.PI * 2;
    const mid = at((a0 + a1) / 2 + jitter(0.1), disc * (0.45 + jitter(0.1)));
    const inner: Point[] = [center, ray.ring, mid, next.ring];
    const outer: Point[] = [ray.ring, ray.kink, ray.end, at((a0 + a1) / 2, reach)];
    outer.push(next.end, next.kink, next.ring, mid);
    for (const poly of [inner, outer]) {
      const shard = draw(scene, source, poly, `${prefix}.${shards.length}`);
      if (shard) shards.push(shard);
    }
  });
  return shards;
}

/** Draws the part of `source` inside `poly` on its own canvas, with a pale edge on the cut. */
function draw(
  scene: GameScene,
  source: CanvasImageSource & { width: number; height: number },
  poly: Point[],
  key: string,
): Shard | null {
  const xs = poly.map(([x]) => x);
  const ys = poly.map(([, y]) => y);
  const x0 = Math.max(0, Math.floor(Math.min(...xs)));
  const y0 = Math.max(0, Math.floor(Math.min(...ys)));
  const x1 = Math.min(source.width, Math.ceil(Math.max(...xs)));
  const y1 = Math.min(source.height, Math.ceil(Math.max(...ys)));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const canvas = document.createElement('canvas');
  canvas.width = x1 - x0;
  canvas.height = y1 - y0;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.translate(-x0, -y0);
  g.beginPath();
  for (const [x, y] of poly) g.lineTo(x, y);
  g.closePath();
  g.save();
  g.clip();
  g.drawImage(source, 0, 0);
  g.restore();
  // Only on the jade itself (source-atop), not across the empty corners.
  g.globalCompositeOperation = 'source-atop';
  g.strokeStyle = 'rgba(255, 252, 235, 0.55)';
  g.lineWidth = source.width / 150;
  g.stroke();
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  return {
    key,
    ox: (x0 + x1) / 2 - source.width / 2,
    oy: (y0 + y1) / 2 - source.height / 2,
  };
}

export interface ShatterOptions {
  /** The broken piece's image key, where its image is drawn, and its size on screen. */
  key: string;
  x: number;
  y: number;
  size: number;
  /** How far it is turned (degrees): the shards start turned with it. */
  angle: number;
  /** Where the table is under it (screen y), and one column gap in px. */
  ground: number;
  gap: number;
  /** Which way the blow went (a unit vector on screen) and how hard it was (about 1). */
  dirX: number;
  dirY: number;
  power: number;
  depth: number;
}

/** Breaks a piece at (x, y): its shards fly off along the blow, bounce on the table and fade. */
export function shatter(scene: GameScene, o: ShatterOptions) {
  const source = scene.textures.get(o.key).getSourceImage() as { width: number };
  const scale = o.size / source.width;
  const life = 1000;
  const gravity = 11 * o.gap;
  const turn = (o.angle * Math.PI) / 180;
  const cos = Math.cos(turn);
  const sin = Math.sin(turn);
  const parts = shardsOf(scene, o.key).map((cutAt) => {
    const shard = {
      key: cutAt.key,
      ox: cutAt.ox * cos - cutAt.oy * sin,
      oy: cutAt.ox * sin + cutAt.oy * cos,
    };
    const sx = o.x + shard.ox * scale;
    const sy = o.y + shard.oy * scale;
    // Depth on the table: a shard's own spot under it, spread a little around the piece's.
    const gy = o.ground + shard.oy * scale * 0.35;
    const out = Math.hypot(shard.ox, shard.oy) || 1;
    const speed = (1.6 + Math.random() * 2) * o.gap * o.power;
    const image = scene.add
      .image(sx, sy, shard.key)
      .setScale(scale)
      .setAngle(o.angle)
      .setDepth(o.depth + Math.random() * 0.1);
    return {
      image,
      gx: sx,
      gy,
      h: Math.max(0, gy - sy),
      vx: (shard.ox / out) * speed + o.dirX * o.gap * 1.6 * o.power,
      vy: (shard.oy / out) * speed * 0.6 + o.dirY * o.gap * 1.6 * o.power,
      vh: (1.2 + Math.random() * 2) * o.gap * o.power,
      angle: o.angle,
      spin: (Math.random() * 2 - 1) * 720,
      bounces: 0,
    };
  });
  // Fixed small steps, so the shards fly the same on a slow device (just less smoothly).
  const tick = 1 / 120;
  let age = 0;
  let simulated = 0;
  const step = (delta: number) => {
    age += delta;
    for (; simulated < Math.min(age, life) / 1000; simulated += tick) {
      for (const p of parts) {
        if (p.bounces >= 3) continue;
        p.vh -= gravity * tick;
        p.h += p.vh * tick;
        p.gx += p.vx * tick;
        p.gy += p.vy * tick;
        p.angle += p.spin * tick;
        if (p.h <= 0 && p.vh < 0) {
          p.h = 0;
          p.vh = -p.vh * 0.3;
          p.vx *= 0.5;
          p.vy *= 0.5;
          p.spin *= 0.4;
          p.bounces++;
        }
      }
    }
    const fade = Math.min(1, Math.max(0, (life - age) / 350));
    for (const p of parts)
      p.image
        .setPosition(p.gx, p.gy - p.h)
        .setAngle(p.angle)
        .setAlpha(fade);
    return age >= life;
  };
  scene.runtime.run(async (fx) => {
    fx.defer(() => {
      for (const part of parts) part.image.destroy();
    });
    await fx.frame(step);
  });
}
