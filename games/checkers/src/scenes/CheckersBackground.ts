import { GameBackgroundScene } from '@psc/sdk/client';
import type Phaser from 'phaser';

/** Quiet midnight cloth; a small POT tile covers the screen and its safe-area bleed. */
export class CheckersBackground extends GameBackgroundScene {
  private cloth!: Phaser.GameObjects.TileSprite;

  protected onCreate() {
    this.cloth = this.add.tileSprite(0, 0, 1, 1, this.texture('cloth')).setOrigin(0);
  }

  protected onLayout() {
    const { left, right, top, bottom } = this.bleed;
    this.cloth.setPosition(left, top).setSize(right - left, bottom - top);
  }
}
