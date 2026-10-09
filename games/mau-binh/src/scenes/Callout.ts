/**
 * Big words that pop up over the table ("Chặt heo!", "Về nhất!", "Vòng 2"): they spring in,
 * hold, then float up and fade.
 */
import { FRAME, type Frame, type GameScene, hudScale, titleStyle } from '@xomdao/sdk/client';
import type Phaser from 'phaser';

export interface CalloutStyle {
  /** Font size before the HUD scale. */
  size?: number;
  color?: string;
  /** How long it stays before floating away (ms). */
  hold?: number;
  /** Called when it is gone. */
  onDone?: () => void;
}

export function callout(
  scene: GameScene,
  text: string,
  x: number,
  y: number,
  { size = 44, color = '#ffe066', hold = 650, onDone }: CalloutStyle = {},
) {
  const hud = hudScale();
  // The color goes in the style: each change after creation redraws the text.
  const label = scene.add
    .text(x, y, text, { ...titleStyle(size * hud), color })
    .setOrigin(0.5)
    .setDepth(900)
    .setScale(0.2)
    .setAlpha(0);
  // Keep it inside the frame (design units) however long the words are.
  const maxWidth = (scene.registry.get(FRAME) as Frame).view.width - 24;
  if (label.width > maxWidth) label.setFontSize((size * hud * maxWidth) / label.width);
  scene.runtime.run(async (fx) => {
    fx.defer(() => label.destroy());
    await fx.tween({ targets: label, scale: 1.18, alpha: 1, duration: 200, ease: 'Back.easeOut' });
    await fx.tween({ targets: label, scale: 1, duration: 110, ease: 'Quad.easeOut' });
    await fx.wait(hold);
    await fx.tween({
      targets: label,
      y: y - 36 * hud,
      alpha: 0,
      duration: 380,
      ease: 'Quad.easeIn',
    });
    fx.checkpoint();
    onDone?.();
  });
  return label;
}
