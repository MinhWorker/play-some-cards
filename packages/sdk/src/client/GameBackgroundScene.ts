import type Phaser from 'phaser';
import { GameScene } from './GameScene.js';

/**
 * Optional decorative scene behind a game's board, registered as `<id>:background`.
 * Select it with `defineClient({ scene, background: MyBackground })`. Setup screens keep
 * the app background. It has no room state or input; use view/bleed and the game's assets.
 * onCreate resets fields on each opening, onLayout follows the frame, onUpdate animates.
 * Its scene runtime survives round changes/resync and is disposed when the board closes.
 *
 * `this.tiled('cloth')` (in onCreate) covers the screen and its bleed with a seamless tile from
 * `assets/`, one texel per canvas pixel at every pixel density, and keeps it so on resize.
 */
export abstract class GameBackgroundScene extends GameScene {
  private tiles: Phaser.GameObjects.TileSprite[] = [];

  protected abstract onCreate(): void;
  protected abstract onLayout(): void;
  protected onUpdate(_delta: number): void {}

  /** A seamless `assets/<name>` tile filling the screen and its bleed, sharp at any zoom. */
  protected tiled(name: string) {
    const tile = this.add.tileSprite(0, 0, 1, 1, this.texture(name)).setOrigin(0);
    this.tiles.push(tile);
    this.layoutTiles();
    return tile;
  }

  private layoutTiles() {
    const { left, right, top, bottom } = this.bleed;
    // The camera magnifies design units by its zoom: shrink the tile back to 1 texel per pixel.
    const scale = 1 / this.cameras.main.zoom;
    for (const tile of this.tiles)
      tile
        .setPosition(left, top)
        .setSize(right - left, bottom - top)
        .setTileScale(scale);
  }

  create() {
    this.tiles = [];
    this.startRuntime('scene');
    this.input.enabled = false;
    this.followFrame(() => {
      this.layoutTiles();
      this.onLayout();
    });
    this.onCreate();
    this.layoutTiles();
    this.onLayout();
    this.scene.sendToBack();
  }

  override update(_time: number, delta: number) {
    this.onUpdate(delta);
  }
}
