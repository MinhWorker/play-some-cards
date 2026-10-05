import { GameBackgroundScene } from '@psc/sdk/client';
import type Phaser from 'phaser';

/** Quiet woven teal beneath the top-down wood board, including the screen's safe-area bleed. */
export class GoBackground extends GameBackgroundScene {
  private cloth!: Phaser.GameObjects.Image;

  protected onCreate() {
    this.cloth = this.image(0, 0, 'cloth');
  }

  protected onLayout() {
    const { left, right, top, bottom } = this.bleed;
    this.cloth
      .setPosition((left + right) / 2, (top + bottom) / 2)
      .setDisplaySize(right - left, bottom - top);
  }
}
