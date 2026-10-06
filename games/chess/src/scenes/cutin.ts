/**
 * A check ("CHIẾU TƯỚNG!") or mate ("CHIẾU HẾT!") announced the English way, like a herald's
 * crest: a navy medallion ringed in gold with a laurel wreath drops in with the checking piece
 * on it, a crimson ribbon unfurls beneath it with the words in gold serif letters, gold glints
 * twinkle around, and the crest rises away. About a second and a half in all.
 */

import { type FlowContext, type GameScene } from '@psc/sdk/client';
import { DISC } from './theme.js';

const NAVY = 0x1b2a47;
const GOLD = 0xd8aa45;
const PALE_GOLD = 0xf6dc8e;
const IVORY = 0xf1e4c4;
const CRIMSON = 0x8e1b23;
const DEEP_CRIMSON = 0x5a0f15;
/** A serif with Vietnamese letters on every platform. */
const SERIF = 'Georgia, "Times New Roman", "Noto Serif", "DejaVu Serif", serif';

export interface CutInOptions {
  text: string;
  /** Image key of the piece giving check. */
  piece: string;
  /** The piece is Black's: it stands on an ivory field instead of a navy one. */
  dark: boolean;
  /** The screen, and the HUD scale for the crest. */
  width: number;
  height: number;
  hud: number;
  depth: number;
}

/** Plays the cut-in; resolves once it has left the screen. */
export function cutIn(scene: GameScene, fx: FlowContext, o: CutInOptions): Promise<void> {
  const { width, height } = o;
  const k = Math.min(o.hud, height / 560, width / 900);
  const cx = width / 2;
  const cy = height / 2;
  const radius = 88 * k;
  const ribbon = { width: 640 * k, height: 92 * k, y: radius + 40 * k };

  const dim = scene.add.rectangle(cx, cy, width, height, 0x070d18, 0).setDepth(o.depth);
  const root = scene.add.container(cx, cy - ribbon.y / 2).setDepth(o.depth);

  // The ribbon's tails: swallowtails folded behind the band, darker on the fold.
  const tails = [-1, 1].map((dir) => {
    const g = scene.add.graphics();
    const w = 150 * k;
    const h = ribbon.height * 0.86;
    const top = -h / 2 + 18 * k;
    g.fillStyle(CRIMSON, 1).fillPoints(
      [
        { x: 0, y: top },
        { x: dir * w, y: top },
        { x: dir * (w - 34 * k), y: top + h / 2 },
        { x: dir * w, y: top + h },
        { x: 0, y: top + h },
      ] as Phaser.Math.Vector2[],
      true,
    );
    g.fillStyle(DEEP_CRIMSON, 1).fillTriangle(
      0,
      top + h,
      dir * 34 * k,
      top + h,
      0,
      top + h - 18 * k,
    );
    g.lineStyle(Math.max(1.5, 2.5 * k), GOLD, 1).lineBetween(0, top + 6 * k, dir * w, top + 6 * k);
    g.lineBetween(0, top + h - 6 * k, dir * w, top + h - 6 * k);
    const tail = scene.add.container(0, ribbon.y, [g]);
    return { tail, dir, home: dir * (ribbon.width / 2 - 24 * k) };
  });

  // The band itself, gold-edged, and its words.
  const band = scene.add.graphics();
  const bw = ribbon.width;
  const bh = ribbon.height;
  band.fillStyle(CRIMSON, 1).fillRect(-bw / 2, -bh / 2, bw, bh);
  band.fillStyle(0xffffff, 0.08).fillRect(-bw / 2, -bh / 2, bw, bh * 0.4);
  band.fillStyle(GOLD, 1);
  band.fillRect(-bw / 2, -bh / 2 + 6 * k, bw, Math.max(1.5, 3 * k));
  band.fillRect(-bw / 2, bh / 2 - 6 * k - Math.max(1.5, 3 * k), bw, Math.max(1.5, 3 * k));
  const words = scene.add
    .text(0, 2 * k, o.text, {
      fontFamily: SERIF,
      fontStyle: 'bold',
      fontSize: `${Math.round(52 * k)}px`,
      color: '#f8e7b0',
    })
    .setOrigin(0.5)
    .setStroke('#3a0a0e', Math.max(2, 4 * k))
    .setShadow(0, 3 * k, '#000000', 4 * k, true, true)
    .setAlpha(0);
  words.setScale(Math.min(1, (bw - 60 * k) / words.width));
  const bandBox = scene.add.container(0, ribbon.y, [band, words]).setScale(0, 1);

  // The medallion: a laurel wreath around a gold-ringed navy disc, the piece on it.
  const medal = scene.add.graphics();
  medal.fillStyle(0x000000, 0.35).fillCircle(4 * k, 8 * k, radius + 6 * k);
  laurel(medal, radius + 14 * k, k);
  medal.fillStyle(GOLD, 1).fillCircle(0, 0, radius + 6 * k);
  medal.fillStyle(NAVY, 1).fillCircle(0, 0, radius - 2 * k);
  if (o.dark) medal.fillStyle(IVORY, 1).fillCircle(0, 0, radius - 12 * k);
  medal.lineStyle(Math.max(1, 2 * k), PALE_GOLD, 0.8).strokeCircle(0, 0, radius - 12 * k);
  const piece = scene.add
    .image(0, 6 * k, o.piece)
    .setDisplaySize((radius * 1.5) / DISC, (radius * 1.5) / DISC);
  const crest = scene.add.container(0, -height * 0.6, [medal, piece]).setAngle(-12);

  // Gold glints around the crest.
  const glints = Array.from({ length: 7 }, (_, i) => {
    const angle = -Math.PI * 0.9 + (i / 6) * Math.PI * 1.8 + (Math.random() - 0.5) * 0.3;
    const reach = radius + (40 + Math.random() * 60) * k;
    const star = scene.add.graphics();
    const s = (8 + Math.random() * 8) * k;
    star.fillStyle(PALE_GOLD, 1).fillPoints(
      [
        { x: 0, y: -s },
        { x: s * 0.22, y: -s * 0.22 },
        { x: s, y: 0 },
        { x: s * 0.22, y: s * 0.22 },
        { x: 0, y: s },
        { x: -s * 0.22, y: s * 0.22 },
        { x: -s, y: 0 },
        { x: -s * 0.22, y: -s * 0.22 },
      ] as Phaser.Math.Vector2[],
      true,
    );
    star.setPosition(Math.cos(angle) * reach * 1.6, Math.sin(angle) * reach * 0.9).setScale(0);
    return star;
  });

  root.add([...tails.map((t) => t.tail), bandBox, crest, ...glints]);

  fx.defer(() => {
    root.destroy(true);
    dim.destroy();
  });
  const hold = 900;
  return fx.parallel(
    async (child) => {
      await child.tween({ targets: dim, fillAlpha: 0.5, duration: 180 });
      await child.wait(hold);
      await child.tween({ targets: dim, fillAlpha: 0, duration: 260 });
    },
    async (child) => {
      await child.tween({ targets: crest, y: 0, angle: 0, duration: 340, ease: 'Back.easeOut' });
    },
    async (child) => {
      await child.tween({
        targets: bandBox,
        scaleX: 1,
        delay: 160,
        duration: 260,
        ease: 'Cubic.easeOut',
      });
    },
    ...tails.map(({ tail, home }) => async (child: FlowContext) => {
      await child.tween({
        targets: tail,
        x: home,
        delay: 300,
        duration: 220,
        ease: 'Back.easeOut',
      });
    }),
    async (child) => {
      await child.tween({ targets: words, alpha: 1, delay: 360, duration: 220 });
    },
    ...glints.map((star, i) => async (child: FlowContext) => {
      await child.tween({
        targets: star,
        scale: 1,
        angle: 90,
        delay: 380 + i * 70,
        duration: 260,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }),
    async (child) => {
      await child.wait(180 + hold);
      await child.tween({
        targets: root,
        y: root.y - 60 * k,
        alpha: 0,
        duration: 260,
        ease: 'Cubic.easeIn',
      });
    },
  );
}

/** Two laurel branches curving up either side of a circle of `r`, into `g`. */
function laurel(g: Phaser.GameObjects.Graphics, r: number, k: number) {
  const step = 0.27;
  for (const dir of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      // From the bottom of the circle up its side; each leaf points along the branch.
      const a = Math.PI / 2 - dir * (0.3 + i * step);
      const next = a - dir * step;
      const along = Math.atan2(Math.sin(next) - Math.sin(a), Math.cos(next) - Math.cos(a));
      for (const side of [-1, 1]) {
        const out = r + side * 7 * k;
        const x = Math.cos(a) * out;
        const y = Math.sin(a) * out;
        g.fillStyle(side > 0 ? GOLD : 0xb88a2e, 1);
        g.fillPoints(leaf(x, y, 22 * k, 9 * k, along + side * dir * 0.5), true);
      }
    }
  }
}

/** A pointed leaf centered on (x, y), `length` long and `width` wide, turned to `angle`. */
function leaf(x: number, y: number, length: number, width: number, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * Math.PI * 2;
    // An ellipse pinched at both tips.
    const u = (Math.cos(t) * length) / 2;
    const v = Math.sin(t) * (width / 2) * Math.abs(Math.sin(t)) ** 0.3;
    points.push({ x: x + u * cos - v * sin, y: y + u * sin + v * cos });
  }
  return points as Phaser.Math.Vector2[];
}
