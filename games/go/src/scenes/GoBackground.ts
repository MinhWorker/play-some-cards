import { GameBackgroundScene } from '@xomdao/sdk/client';

/** Quiet woven teal beneath the top-down wood board: a small seamless POT tile over the whole screen, its bleed included. */
export class GoBackground extends GameBackgroundScene {
  protected onCreate() {
    this.tiled('cloth');
  }

  /** The tile follows the frame by itself. */
  protected onLayout() {}
}
