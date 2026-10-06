import { GameBackgroundScene } from '@psc/sdk/client';
import type Phaser from 'phaser';

/** Quiet midnight cloth; the whole screen, including its safe-area bleed, is covered. */
export class CheckersBackground extends GameBackgroundScene {
  private cloth!: Phaser.GameObjects.Image;

  protected onCreate() {
    this.cloth = this.image(0, 0, 'cloth');
  }

  protected onLayout() {
    const { left, right, top, bottom } = this.bleed;
    const scale = Math.max((right - left) / this.cloth.width, (bottom - top) / this.cloth.height);
    this.cloth.setPosition((left + right) / 2, (top + bottom) / 2).setScale(scale);
  }
}
