import { GameBackgroundScene } from '@psc/sdk/client';

export class CoCaNguaBackground extends GameBackgroundScene {
  protected onCreate() {
    this.tiled('cloth');
  }
  protected onLayout() {}
}
