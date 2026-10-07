/**
 * A check ("CHIẾU TƯỚNG!") or mate ("CHIẾU BÍ!") announced like a Chinese ink painting: a paper
 * scroll unrolls between its two rollers, a pale ink wash sweeps across it, the checking piece
 * appears on the left, then the two words slam down one after the other in brush letters, each
 * jolting the scroll and splattering ink (a red seal lands with the second), and the scroll rolls
 * up again. About a second and a half in all.
 */

import { type FlowContext, type GameScene } from '@psc/sdk/client';

const PAPER = 0xf2e8d0;
const PAPER_EDGE = 0xcdb88e;
const INK = 0x16110d;
const ROLLER = 0x4a2a16;
const BRASS = 0xc9a24a;
const SEAL = 0xb3261e;
/**
 * Brush letters with every Vietnamese mark (Google Fonts, loaded by `loadBrushFont`); a serif
 * stands in until it has loaded or when offline.
 */
const BRUSH_FAMILY = 'Comforter Brush';
const BRUSH = `"${BRUSH_FAMILY}", "Noto Serif", Georgia, "Times New Roman", serif`;
const BRUSH_CSS = `https://fonts.googleapis.com/css2?family=${BRUSH_FAMILY.replace(/ /g, '+')}&display=swap`;

/** Starts loading the brush font, once per page (call it when the board is created). */
export function loadBrushFont() {
  if (typeof document === 'undefined' || document.querySelector(`link[href="${BRUSH_CSS}"]`)) {
    return;
  }
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = BRUSH_CSS;
  link.onload = () => void document.fonts.load(`64px "${BRUSH_FAMILY}"`, 'CHIẾU TƯỚNG BÍ!');
  document.head.append(link);
}
/** A font for the seal's character. */
const CJK = '"Noto Serif CJK SC", "Songti SC", "SimSun", "WenQuanYi Zen Hei", serif';

export interface CutInOptions {
  text: string;
  /** Image key of the piece giving check. */
  piece: string;
  frame: string;
  /** The screen, and the HUD scale for the scroll. */
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
  const w = Math.min(width * 0.86, 820 * k);
  const h = 210 * k;

  const dim = scene.add.rectangle(cx, cy, width, height, 0x120a05, 0).setDepth(o.depth);
  const root = scene.add.container(cx, cy).setDepth(o.depth);

  // The paper, with a few faint fibers; it unrolls from the middle.
  const paper = scene.add.graphics();
  paper.fillStyle(0x000000, 0.3).fillRect(-w / 2 + 4 * k, -h / 2 + 8 * k, w, h);
  paper.fillStyle(PAPER, 1).fillRect(-w / 2, -h / 2, w, h);
  paper.fillStyle(PAPER_EDGE, 0.5);
  paper.fillRect(-w / 2, -h / 2, w, 6 * k).fillRect(-w / 2, h / 2 - 6 * k, w, 6 * k);
  for (let i = 0; i < 26; i++) {
    const y = (Math.random() - 0.5) * h * 0.9;
    const x = (Math.random() - 0.5) * w;
    paper.lineStyle(1, PAPER_EDGE, 0.25).lineBetween(x, y, x + (20 + Math.random() * 60) * k, y);
  }
  paper.setScale(0.02, 1);

  // A pale ink wash swept across behind the words: a few thin layers of a dry brush, full where
  // it starts and tapering off in streaks.
  const wash = scene.add.graphics();
  const span = w * 0.62;
  const steps = 40;
  for (let layer = 0; layer < 4; layer++) {
    const top: { x: number; y: number }[] = [];
    const bottom: { x: number; y: number }[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = t * span;
      // Round where the brush lands, thinning out where it lifts.
      const land = Math.sqrt(Math.min(1, t * 10));
      const half = h * 0.3 * land * (1 - t ** 3 * 0.8) * (0.85 + layer * 0.06);
      top.push({ x, y: -half + (Math.random() - 0.5) * 7 * k });
      bottom.push({ x, y: half + (Math.random() - 0.5) * 7 * k });
    }
    wash
      .fillStyle(INK, 0.055)
      .fillPoints([...top, ...bottom.reverse()] as Phaser.Math.Vector2[], true);
  }
  // Bristle streaks, broken towards the end of the stroke.
  for (let i = 0; i < 14; i++) {
    const y = (Math.random() - 0.5) * h * 0.5;
    const from = Math.random() * span * 0.3;
    const to = span * (0.7 + Math.random() * 0.32);
    wash.lineStyle(Math.max(1, (1 + Math.random() * 2) * k), INK, 0.08 + Math.random() * 0.07);
    wash.lineBetween(from, y, to, y + (Math.random() - 0.5) * 6 * k);
  }
  const washBox = scene.add.container(-w * 0.2, 0, [wash]).setScale(0, 1);

  // The piece, on the left, with an ink shadow.
  const size = h * 0.66;
  const shadow = scene.add
    .image(-w * 0.36 + 5 * k, 8 * k, o.piece, o.frame)
    .setDisplaySize(size, size)
    .setTint(INK)
    .setTintMode(1)
    .setAlpha(0);
  const piece = scene.add
    .image(-w * 0.36, 0, o.piece, o.frame)
    .setDisplaySize(size, size)
    .setAlpha(0);

  // The words, one per slam: each starts big above the paper and lands in place.
  const words = o.text.split(' ').map((word) =>
    scene.add
      .text(0, 0, word, {
        fontFamily: BRUSH,
        fontSize: `${Math.round(104 * k)}px`,
        color: '#16110d',
      })
      .setOrigin(0.5)
      .setStroke('#16110d', Math.max(1, 2 * k)),
  );
  const gap = 40 * k;
  const total = words.reduce((sum, word) => sum + word.width, 0) + gap * (words.length - 1);
  const fit = Math.min(1, (w * 0.62) / total);
  let x = w * 0.08 - (total * fit) / 2;
  for (const word of words) {
    word
      .setPosition(x + (word.width * fit) / 2, 0)
      .setScale(fit * 2.6)
      .setAngle((Math.random() - 0.5) * 10)
      .setAlpha(0);
    x += (word.width + gap) * fit;
  }
  // Ink splattered by each slam, around its word.
  const splats = words.map((word) =>
    Array.from({ length: 9 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const reach = (0.5 + Math.random() * 0.4) * word.width * fit;
      const dot = scene.add
        .circle(
          word.x + Math.cos(angle) * reach,
          Math.sin(angle) * reach * 0.45,
          (1.5 + Math.random() * 4) * k,
          INK,
          0.75,
        )
        .setScale(0);
      return dot;
    }),
  );

  // The red seal, in the lower right corner of the scroll.
  const sealSize = 62 * k;
  const sealG = scene.add.graphics();
  sealG.fillStyle(SEAL, 1).fillRoundedRect(-sealSize / 2, -sealSize / 2, sealSize, sealSize, 6 * k);
  sealG
    .lineStyle(Math.max(1, 2.5 * k), PAPER, 0.9)
    .strokeRect(-sealSize * 0.38, -sealSize * 0.38, sealSize * 0.76, sealSize * 0.76);
  const sealChar = scene.add
    .text(0, 0, '將', {
      fontFamily: CJK,
      fontSize: `${Math.round(sealSize * 0.56)}px`,
      color: '#f8eadc',
    })
    .setOrigin(0.5);
  const seal = scene.add
    .container(w / 2 - sealSize * 0.9, h / 2 - sealSize * 0.75, [sealG, sealChar])
    .setAngle(-4)
    .setScale(2.2)
    .setAlpha(0);

  // The rollers at both ends: dark wood with brass caps, sliding apart as the paper unrolls.
  const rollers = [-1, 1].map((dir) => {
    const g = scene.add.graphics();
    const rh = h + 34 * k;
    g.fillStyle(ROLLER, 1).fillRoundedRect(-9 * k, -rh / 2, 18 * k, rh, 8 * k);
    g.fillStyle(0xffffff, 0.12).fillRect(-5 * k, -rh / 2 + 6 * k, 4 * k, rh - 12 * k);
    g.fillStyle(BRASS, 1);
    g.fillRoundedRect(-12 * k, -rh / 2 - 8 * k, 24 * k, 14 * k, 4 * k);
    g.fillRoundedRect(-12 * k, rh / 2 - 6 * k, 24 * k, 14 * k, 4 * k);
    const roller = scene.add.container(dir * 10 * k, 0, [g]);
    return { roller, open: dir * (w / 2 + 6 * k), shut: dir * 10 * k };
  });

  root.add([
    paper,
    washBox,
    shadow,
    piece,
    ...splats.flat(),
    ...words,
    seal,
    ...rollers.map((r) => r.roller),
  ]);

  fx.defer(() => {
    root.destroy(true);
    dim.destroy();
  });
  const unroll = 280;
  const hold = 560;
  /** When each word lands: the first once the scroll is open, the next a beat later. */
  const slams = words.map((_, i) => unroll + 140 + i * 320);
  const rollUp = (slams[slams.length - 1] ?? unroll) + 110 + hold;
  return fx.parallel(
    async (child) => {
      await child.tween({ targets: dim, fillAlpha: 0.45, duration: 180 });
      await child.wait(rollUp - 180);
      await child.tween({ targets: dim, fillAlpha: 0, duration: 300 });
    },
    // The scroll opens, then rolls up again: everything on it goes before the paper.
    async (child) => {
      await child.tween({ targets: paper, scaleX: 1, duration: unroll, ease: 'Cubic.easeOut' });
      await child.wait(rollUp - unroll);
      await child.tween({ targets: paper, scaleX: 0.02, duration: 260, ease: 'Cubic.easeIn' });
    },
    ...rollers.map(({ roller, open, shut }) => async (child: FlowContext) => {
      await child.tween({ targets: roller, x: open, duration: unroll, ease: 'Cubic.easeOut' });
      await child.wait(rollUp - unroll);
      await child.tween({ targets: roller, x: shut, duration: 260, ease: 'Cubic.easeIn' });
      await child.tween({ targets: roller, alpha: 0, duration: 120 });
    }),
    async (child) => {
      await child.tween({
        targets: washBox,
        scaleX: 1,
        delay: unroll - 40,
        duration: 260,
        ease: 'Sine.easeOut',
      });
    },
    async (child) => {
      await child.tween({ targets: piece, alpha: 1, delay: unroll, duration: 200 });
    },
    async (child) => {
      await child.tween({ targets: shadow, alpha: 0.35, delay: unroll, duration: 200 });
    },
    ...words.map((word, i) => async (child: FlowContext) => {
      await child.wait((slams[i] ?? 0) - 110);
      await child.tween({
        targets: word,
        scale: fit,
        angle: 0,
        alpha: 1,
        duration: 110,
        ease: 'Quad.easeIn',
      });
      // The thud: the scroll jolts, the word squashes, ink splatters around it.
      await child.parallel(
        async (c) => {
          await c.tween({ targets: root, y: cy + 6 * k, duration: 45, yoyo: true });
        },
        async (c) => {
          await c.tween({ targets: word, scaleY: fit * 0.9, duration: 45, yoyo: true });
        },
        ...(splats[i] ?? []).map((dot) => async (c: FlowContext) => {
          await c.tween({ targets: dot, scale: 1, duration: 90, ease: 'Back.easeOut' });
        }),
      );
    }),
    // The seal lands with the last word.
    async (child) => {
      await child.wait((slams[slams.length - 1] ?? 0) - 110);
      await child.tween({ targets: seal, scale: 1, alpha: 1, duration: 110, ease: 'Quad.easeIn' });
    },
    async (child) => {
      await child.wait(rollUp);
      await child.tween({
        targets: [washBox, shadow, piece, ...words, ...splats.flat(), seal],
        alpha: 0,
        duration: 140,
      });
    },
  );
}
