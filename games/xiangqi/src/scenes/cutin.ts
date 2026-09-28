/**
 * A Persona-style cut-in across the screen for a check ("CHIẾU TƯỚNG!") or a mate: a tilted
 * black band on a jagged red one slams in from the right, the checking piece slides in big on
 * the left, and the words pop in as ransom-note letters (each in its own box, colors and angles
 * mixed). It holds for a moment, then leaves to the left. About a second in all.
 */

import { FONT } from '@psc/sdk/client';
import type Phaser from 'phaser';

const RED = 0xd7141a;
const BLACK = 0x0b0b0b;
const WHITE = 0xffffff;

export interface CutInOptions {
  text: string;
  /** Image key of the piece giving check. */
  piece: string;
  /** The screen, and the HUD scale for the letters. */
  width: number;
  height: number;
  hud: number;
  depth: number;
}

/** Plays the cut-in; resolves once it has left the screen. */
export function cutIn(scene: Phaser.Scene, o: CutInOptions): Promise<void> {
  const { width, height } = o;
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(width, height) * 1.3;
  const band = Math.min(height * 0.34, 250 * o.hud);

  const flash = scene.add.rectangle(cx, cy, width, height, WHITE, 0.55).setDepth(o.depth + 1);
  const dim = scene.add.rectangle(cx, cy, width, height, BLACK, 0).setDepth(o.depth);
  const root = scene.add
    .container(cx + width * 1.2, cy)
    .setAngle(-8)
    .setDepth(o.depth);

  // The bands: red with torn edges behind, black in front with white rules along it.
  const g = scene.add.graphics();
  const torn = (y: number, dir: number) => {
    const points: { x: number; y: number }[] = [];
    for (let x = -reach / 2; x <= reach / 2; x += band * 0.22) {
      points.push({ x, y: y + dir * band * (0.04 + Math.random() * 0.1) });
    }
    return points;
  };
  const top = torn(-band * 0.62, -1);
  const bottom = torn(band * 0.62, 1).reverse();
  g.fillStyle(RED, 1).fillPoints([...top, ...bottom] as Phaser.Math.Vector2[], true);
  g.fillStyle(BLACK, 1).fillRect(-reach / 2, -band / 2, reach, band);
  g.fillStyle(WHITE, 1);
  g.fillRect(-reach / 2, -band / 2 + band * 0.05, reach, Math.max(2, band * 0.018));
  g.fillRect(-reach / 2, band / 2 - band * 0.07, reach, Math.max(2, band * 0.018));
  // Halftone dots growing toward the right end of the band.
  g.fillStyle(RED, 0.55);
  for (let x = width * 0.05; x < width * 0.55; x += band * 0.09) {
    const r = band * 0.012 + ((x - width * 0.05) / (width * 0.5)) * band * 0.03;
    for (let y = -band * 0.38; y <= band * 0.38; y += band * 0.09) g.fillCircle(x, y, r);
  }
  root.add(g);

  // Speed lines streaking left.
  const lines = Array.from({ length: 9 }, () => {
    const line = scene.add
      .rectangle(
        (Math.random() - 0.2) * width,
        (Math.random() - 0.5) * band * 0.8,
        width * (0.2 + Math.random() * 0.3),
        Math.max(1.5, band * 0.012),
        WHITE,
        0.25 + Math.random() * 0.3,
      )
      .setOrigin(0, 0.5);
    root.add(line);
    return line;
  });

  // The piece, big, with a red comic shadow behind it.
  const size = band * 1.3;
  const pieceX = -width * 0.27;
  const shadow = scene.add
    .image(pieceX - width * 0.3, band * 0.06, o.piece)
    .setDisplaySize(size, size)
    .setTint(RED)
    .setTintMode(1);
  const piece = scene.add
    .image(pieceX - width * 0.3, -band * 0.02, o.piece)
    .setDisplaySize(size, size)
    .setAngle(-14);
  root.add([shadow, piece]);

  // The words, ransom-note style.
  const letters = ransom(scene, o.text, band * 0.36);
  const span = letters.reduce((sum, l) => sum + l.width * 0.92, 0);
  let x = width * 0.1 - span / 2;
  for (const l of letters) {
    l.setPosition(x + l.width / 2, l.y)
      .setScale(2.4)
      .setAlpha(0);
    x += l.width * 0.92;
    root.add(l);
  }

  const tweens = scene.tweens;
  tweens.add({ targets: flash, alpha: 0, duration: 140, onComplete: () => flash.destroy() });
  tweens.add({ targets: dim, fillAlpha: 0.35, duration: 150 });
  tweens.add({ targets: root, x: cx, duration: 170, ease: 'Cubic.easeOut' });
  tweens.add({
    targets: [piece, shadow],
    x: pieceX,
    duration: 280,
    delay: 80,
    ease: 'Back.easeOut',
  });
  tweens.add({ targets: piece, angle: -4, duration: 900, delay: 80 });
  for (const line of lines) {
    tweens.add({ targets: line, x: line.x - width * 0.5, duration: 1000, ease: 'Linear' });
  }
  letters.forEach((l, i) => {
    tweens.add({
      targets: l,
      scale: 1,
      alpha: 1,
      duration: 130,
      delay: 130 + i * 40,
      ease: 'Back.easeOut',
    });
  });
  const hold = 130 + letters.length * 40 + 520;
  return new Promise((resolve) => {
    let over = false;
    const done = () => {
      if (over) return;
      over = true;
      scene.events.off('shutdown', done);
      root.destroy(true);
      dim.destroy();
      if (flash.active) flash.destroy();
      resolve();
    };
    tweens.add({
      targets: root,
      x: cx - width * 1.3,
      duration: 200,
      delay: hold,
      ease: 'Cubic.easeIn',
    });
    tweens.add({ targets: dim, fillAlpha: 0, duration: 200, delay: hold, onComplete: done });
    scene.events.once('shutdown', done);
  });
}

/** Each letter of `text` in its own tilted box: white on black, black on white or white on red. */
function ransom(scene: Phaser.Scene, text: string, size: number) {
  const looks = [
    { box: WHITE, text: '#0b0b0b' },
    { box: BLACK, text: '#ffffff', edge: WHITE },
    { box: RED, text: '#ffffff' },
  ];
  const out: Phaser.GameObjects.Container[] = [];
  let pick = Math.floor(Math.random() * looks.length);
  for (const ch of text) {
    if (ch === ' ') {
      const gap = scene.add.container(0, 0);
      gap.width = size * 0.35;
      out.push(gap);
      continue;
    }
    pick = (pick + 1 + Math.floor(Math.random() * 2)) % looks.length;
    const look = looks[pick] ?? looks[0];
    if (!look) continue;
    const big = ch === '!' ? 1 : 0.85 + Math.random() * 0.35;
    const label = scene.add
      .text(0, 0, ch, {
        fontFamily: FONT,
        fontStyle: '800',
        fontSize: `${Math.round(size * big)}px`,
        color: look.text,
      })
      .setOrigin(0.5);
    const w = label.width + size * 0.22;
    const h = label.height * 0.92;
    const box = scene.add.graphics();
    if ('edge' in look && look.edge !== undefined) {
      box.fillStyle(look.edge, 1).fillRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6);
    }
    box.fillStyle(look.box, 1).fillRect(-w / 2, -h / 2, w, h);
    const letter = scene.add.container(0, (Math.random() - 0.5) * size * 0.25, [box, label]);
    letter.setAngle((Math.random() - 0.5) * 22);
    letter.width = w;
    out.push(letter);
  }
  return out;
}
