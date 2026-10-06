import { GameScene } from './GameScene.js';

/**
 * Optional decorative scene behind a game's board, registered as `<id>:background`.
 * Select it with `defineClient({ scene, background: MyBackground })`. Setup screens keep
 * the app background. It has no room state or input; use view/bleed and the game's assets.
 * onCreate resets fields on each opening, onLayout follows the frame, onUpdate animates.
 * Its scene runtime survives round changes/resync and is disposed when the board closes.
 */
export abstract class GameBackgroundScene extends GameScene {
  protected abstract onCreate(): void;
  protected abstract onLayout(): void;
  protected onUpdate(_delta: number): void {}

  create() {
    this.startRuntime('scene');
    this.input.enabled = false;
    this.onCreate();
    this.followFrame(() => this.onLayout());
    this.onLayout();
    this.scene.sendToBack();
  }

  override update(_time: number, delta: number) {
    this.onUpdate(delta);
  }
}
