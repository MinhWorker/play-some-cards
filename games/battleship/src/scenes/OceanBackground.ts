import { GameBackgroundScene } from '@xomdao/sdk/client';
import type Phaser from 'phaser';

/** A calm naval backdrop, extending beyond the safe frame. */
export class OceanBackground extends GameBackgroundScene {
  private ocean!: Phaser.GameObjects.Image;

  protected onCreate() {
    this.ocean = this.image(0, 0, 'ocean').setOrigin(0);
  }

  protected onLayout() {
    const { left, top, right, bottom } = this.bleed;
    this.ocean.setPosition(left, top).setDisplaySize(right - left, bottom - top);
  }
}
