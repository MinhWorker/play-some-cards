import { GameBackgroundScene } from '@xomdao/sdk/client';
import type Phaser from 'phaser';

/** A quiet pavilion behind the board, covering notches and the frame's extra screen area. */
export class XiangqiBackground extends GameBackgroundScene {
  private pavilion!: Phaser.GameObjects.Image;

  protected onCreate() {
    this.pavilion = this.image(0, 0, 'pavilion');
  }

  protected onLayout() {
    const { left, right, top, bottom } = this.bleed;
    // Cover without stretching the architecture when the frame or safe area changes.
    const scale = Math.max(
      (right - left) / this.pavilion.width,
      (bottom - top) / this.pavilion.height,
    );
    this.pavilion.setPosition((left + right) / 2, (top + bottom) / 2).setScale(scale);
  }
}
