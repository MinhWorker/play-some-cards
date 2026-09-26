import Phaser from 'phaser';
import { clientHost } from './host.js';

/**
 * What every scene a game ships shares: its own `assets/` by file name and text helpers.
 * Games extend `BoardScene` (the board) or `RoomSetupScene` (its "Tạo phòng" screen).
 */
export abstract class GameScene extends Phaser.Scene {
  private warned = new Set<string>();

  /** The game id. The app adds the board as `<id>` and the setup screen as `<id>:setup`. */
  get gameId() {
    return this.scene.key.split(':')[0] ?? '';
  }

  preload() {
    const { images, sounds } = clientHost().assets(this.gameId);
    for (const [name, url] of Object.entries(images)) {
      const key = `${this.gameId}/${name}`;
      if (!this.textures.exists(key)) this.load.image(key, url);
    }
    // `music*` files are the game's background music: the app streams one, no need to preload.
    for (const [name, url] of Object.entries(sounds)) {
      if (!name.startsWith('music')) clientHost().loadSound(url);
    }
  }

  /** Texture key of `assets/<name>.*`, for `setTexture()` and other Phaser calls. */
  protected texture(name: string) {
    const key = `${this.gameId}/${name}`;
    if (!this.textures.exists(key))
      this.warnOnce(`No image "${name}" in games/${this.gameId}/assets/`);
    return key;
  }

  /** Adds `assets/<name>.webp|png` as an image. */
  protected image(x: number, y: number, name: string) {
    return this.add.image(x, y, this.texture(name));
  }

  /** Plays `assets/<name>.wav|mp3` on the effects channel (follows the player's volume). */
  protected sfx(name: string) {
    const url = clientHost().assets(this.gameId).sounds[name];
    if (url) clientHost().playSound(url);
    else this.warnOnce(`No sound "${name}" in games/${this.gameId}/assets/`);
  }

  /**
   * Sets `text` so it is at most `maxWidth` wide. With `minFontSize`, the font first shrinks
   * (down to that size); whatever still doesn't fit is cut short with "…". Set the full font
   * size before calling it.
   */
  protected fitText(
    obj: Phaser.GameObjects.Text,
    text: string,
    maxWidth: number,
    minFontSize?: number,
  ) {
    obj.setText(text);
    if (minFontSize && obj.width > maxWidth) {
      // Scale down in proportion, then step down (the outline doesn't shrink in proportion).
      let size = Number.parseFloat(String(obj.style.fontSize));
      size = Math.max(minFontSize, Math.floor((size * maxWidth) / obj.width));
      obj.setFontSize(size);
      while (obj.width > maxWidth && size > minFontSize) obj.setFontSize(--size);
    }
    let chars = [...text];
    while (obj.width > maxWidth && chars.length > 1) {
      chars = chars.slice(0, -1);
      obj.setText(`${chars.join('').trimEnd()}…`);
    }
    return obj;
  }

  private warnOnce(message: string) {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    console.warn(message);
  }
}
