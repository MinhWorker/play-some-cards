import { GameBackgroundScene } from '@xomdao/sdk/client';

/** Quiet midnight cloth: a small seamless POT tile over the whole screen, its bleed included. */
export class ChessBackground extends GameBackgroundScene {
  protected onCreate() {
    this.tiled('cloth');
  }

  /** The tile follows the frame by itself. */
  protected onLayout() {}
}
