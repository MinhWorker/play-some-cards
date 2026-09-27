import Phaser from 'phaser';
import { clientHost } from './host.js';
import { hudScale, titleStyle } from './text.js';

/** A button made by `this.button()`: an optional image with a label, reacting to taps. */
export interface Button {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  image?: Phaser.GameObjects.Image;
  setPosition(x: number, y: number): Button;
  /** Width and height (the image is stretched to it; the label shrinks to fit). */
  setSize(width: number, height: number): Button;
  /** A disabled button is greyed out and ignores taps. */
  setEnabled(enabled: boolean): Button;
  setText(text: string): Button;
}

/**
 * What every scene a game ships shares: its own `assets/` by file name, text helpers and a few
 * ready-made objects (`label`, `button`, `sprite`). Games extend `GameView` (the screen),
 * or `RoomSetupScene` (its "Tạo phòng" screen).
 */
export abstract class GameScene extends Phaser.Scene {
  private warned = new Set<string>();

  /** The game id. The app adds the board as `<id>` and the setup screen as `<id>:setup`. */
  get gameId() {
    return this.scene.key.split(':')[0] ?? '';
  }

  preload() {
    const { images, sounds, atlases } = clientHost().assets(this.gameId);
    for (const [name, url] of Object.entries(images)) {
      const key = `${this.gameId}/${name}`;
      if (this.textures.exists(key)) continue;
      const atlas = atlases[name];
      if (atlas) this.load.atlas(key, url, atlas);
      else this.load.image(key, url);
    }
    for (const [name, url] of Object.entries(clientHost().avatars())) {
      if (!this.textures.exists(`avatar/${name}`)) this.load.image(`avatar/${name}`, url);
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

  /**
   * Texture key of a player's picture (round, in a golden frame): their account's avatar, the
   * robot for the computer. E.g. `this.add.image(x, y, this.avatar(player))`.
   */
  protected avatar(player: { avatar?: string; bot?: boolean }) {
    const name = player.bot ? 'bot' : (player.avatar ?? 'boy');
    const key = `avatar/${name}`;
    return this.textures.exists(key) ? key : 'avatar/boy';
  }

  /** Adds `assets/<name>.webp|png` as an image. */
  protected image(x: number, y: number, name: string) {
    return this.add.image(x, y, this.texture(name));
  }

  /**
   * An animation of every frame of atlas `assets/<name>` (image + same-name .json), in the
   * frames' name order (`hop-01`, `hop-02`…). Made once; returns its key for `sprite.play()`:
   *   this.sprite('horse-hop').play(this.anim('horse-hop', { frameRate: 30 }))
   */
  protected anim(name: string, { frameRate = 24, repeat = 0 } = {}) {
    const key = this.texture(name);
    if (!this.anims.exists(key)) {
      const frames = this.textures
        .get(key)
        .getFrameNames()
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((frame) => ({ key, frame }));
      this.anims.create({ key, frames, frameRate, repeat });
    }
    return key;
  }

  /** Plays `assets/<name>.wav|mp3` on the effects channel (follows the player's volume). */
  protected sfx(name: string) {
    const url = clientHost().assets(this.gameId).sounds[name];
    if (url) clientHost().playSound(url);
    else this.warnOnce(`No sound "${name}" in games/${this.gameId}/assets/`);
  }

  // ── Ready-made objects (Phaser objects underneath; use Phaser for anything else) ────────

  /** Game-style text (white, dark outline, the app's font), centered on its position. */
  protected label(text: string, { size = 32, color }: { size?: number; color?: string } = {}) {
    const obj = this.add.text(0, 0, text, titleStyle(size * hudScale())).setOrigin(0.5);
    if (color) obj.setColor(color);
    return obj;
  }

  /** An image from the game's `assets/` by file name, centered on its position. */
  protected sprite(name: string) {
    return this.image(0, 0, name);
  }

  /**
   * A tappable button: `image` (from `assets/`, stretched to the size) with a label on top, or
   * just the label. Lights up on hover. Sounds like the app's buttons (hover with a mouse, click
   * on tap), or plays `sound` (from `assets/`) on tap instead. `hoverSound: false` keeps it quiet
   * on hover (for buttons the mouse passes over all the time).
   */
  protected button(
    text: string,
    onTap: () => void,
    {
      image,
      sound,
      hoverSound = true,
      size = 32,
    }: { image?: string; sound?: string; hoverSound?: boolean; size?: number } = {},
  ): Button {
    const bg = image ? this.image(0, 0, image) : undefined;
    const label = this.label(text, { size });
    const container = this.add.container(0, 0, bg ? [bg, label] : [label]);
    let enabled = true;
    let fontSize = size * hudScale();
    const button: Button = {
      container,
      label,
      image: bg,
      setPosition: (x, y) => {
        container.setPosition(x, y);
        return button;
      },
      setSize: (width, height) => {
        bg?.setDisplaySize(width, height);
        container.setSize(width, height);
        // Text on an image fills 40% of its height; a text-only button keeps its size.
        fontSize = bg ? Math.min(size * hudScale(), height * 0.4) : size * hudScale();
        label.setFontSize(fontSize);
        this.fitText(label, label.text, width * 0.9, fontSize * 0.5);
        return button;
      },
      setEnabled: (value) => {
        enabled = value;
        container.setAlpha(value ? 1 : 0.45);
        return button;
      },
      setText: (value) => {
        label.setFontSize(fontSize);
        this.fitText(
          label,
          value,
          (container.width || Number.POSITIVE_INFINITY) * 0.9,
          fontSize * 0.5,
        );
        return button;
      },
    };
    const { width, height } = bg ?? label;
    button.setSize(width, height);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', (pointer: Phaser.Input.Pointer) => {
      if (!enabled) return;
      bg?.setTint(0xfff1b8);
      if (hoverSound && !pointer.wasTouch) clientHost().playUiSound('hover');
    });
    container.on('pointerout', () => bg?.clearTint());
    container.on('pointerup', () => {
      if (!enabled) return;
      bg?.clearTint();
      if (sound) this.sfx(sound);
      else clientHost().playUiSound('click');
      onTap();
    });
    return button;
  }

  /**
   * Where the board may draw, leaving room for the room bar (top, its real height comes from
   * the registry key 'hudTop') and the result panel (bottom), plus a score row and a status
   * line above the board. Phones held sideways show the result panel on the right instead, so
   * the board keeps the full height.
   */
  protected boardArea() {
    const { width, height } = this.scale;
    const hud = hudScale();
    const sideways = width > height && height < 500;
    const top = ((this.registry.get('hudTop') as number | undefined) ?? 110 * hud) + 8 * hud;
    const bottom = sideways ? 12 : 140 * hud;
    const score = 50 * hud;
    const status = 56 * hud;
    const above = score + status;
    const size = Math.max(120, Math.min(width * 0.92, height - top - bottom - above));
    const cx = width / 2;
    const cy = top + above + (height - top - bottom - above) / 2;
    const statusY = cy - size / 2 - status / 2;
    return { size, cx, cy, hud, statusY, scoreY: statusY - status / 2 - score / 2 };
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
