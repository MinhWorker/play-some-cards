import Phaser from 'phaser';
import { followFrame } from './followFrame.js';
import { currentFrame, FRAME, type Frame } from './frame.js';
import { clientHost } from './host.js';
import { hudScale, titleStyle } from './text.js';

/** A scene's frame (a function, not a method: games name their own methods freely). */
function frameOf(scene: Phaser.Scene) {
  return (scene.registry.get(FRAME) as Frame | undefined) ?? currentFrame();
}

/** A button made by `this.button()`: an optional image with a label, reacting to taps. */
export interface Button {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  /** The background, a nine-slice of the image (see `slice` in `button()`). */
  image?: Phaser.GameObjects.NineSlice;
  setPosition(x: number, y: number): Button;
  /** Width and height (the image's corners keep their shape; the label shrinks to fit). */
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

  /**
   * The frame in design units (720 tall, 960 to 1600 wide; docs/ui-guide.md): lay the scene out
   * in it. The camera shows it at the screen's size and pixel density.
   */
  protected get view() {
    return frameOf(this).view;
  }

  /**
   * How far the screen reaches beyond the frame, in design units (`left`/`top` are ≤ 0): draw
   * full-screen backgrounds out to these edges. Only the frame is sure to be seen.
   */
  protected get bleed() {
    return frameOf(this).bleed;
  }

  /**
   * Points the camera at the frame and keeps text sharp; `onChange` runs when the frame changes
   * (the window was resized or turned). GameView and RoomSetupScene call it for you.
   */
  protected followFrame(onChange?: () => void) {
    followFrame(this, onChange);
  }

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
   * A tappable button: `image` (from `assets/`) with a label on top, or just the label. Lights up
   * on hover. Sounds like the app's buttons (hover with a mouse, click on tap), or plays `sound`
   * (from `assets/`) on tap instead. `hoverSound: false` keeps it quiet on hover (for buttons the
   * mouse passes over all the time).
   *
   * The image is a nine-slice: at any size its corners keep their shape and only the middle
   * stretches. `slice` is how far in from each edge the corners reach, in the image's pixels
   * (one number for all four, or `[left, right, top, bottom]`). By default a corner is half the
   * image's shorter side, which suits a pill or a rounded box.
   */
  protected button(
    text: string,
    onTap: () => void,
    {
      image,
      slice,
      sound,
      hoverSound = true,
      size = 32,
    }: {
      image?: string;
      slice?: number | [left: number, right: number, top: number, bottom: number];
      sound?: string;
      hoverSound?: boolean;
      size?: number;
    } = {},
  ): Button {
    const bg = image ? this.nineSlice(image, slice) : undefined;
    // The image's own size: the corners are drawn at `scale` of it, never squashed.
    const source = bg ? { width: bg.width, height: bg.height } : undefined;
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
        if (bg && source) {
          // As big as the height allows, unless the corners wouldn't fit across the width.
          const scale = Math.min(
            height / source.height,
            width / (bg.leftWidth + bg.rightWidth + 1),
          );
          bg.setSize(width / scale, height / scale).setScale(scale);
        }
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
    const { width, height } = source ?? label;
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

  /** `assets/<name>` as a nine-slice at its own size (see `slice` in `button()`). */
  private nineSlice(name: string, slice?: number | [number, number, number, number]) {
    const key = this.texture(name);
    const frame = this.textures.getFrame(key);
    const width = frame?.width ?? 2;
    const height = frame?.height ?? 2;
    const half = Math.max(1, Math.floor(Math.min(width, height) / 2) - 1);
    const [left, right, top, bottom] =
      typeof slice === 'number'
        ? [slice, slice, slice, slice]
        : (slice ?? [half, half, half, half]);
    return this.add.nineslice(0, 0, key, undefined, width, height, left, right, top, bottom);
  }

  /**
   * Where a board game draws on the frame (docs/ui-guide.md): a square board as tall as it fits
   * under the room bar (`top`; its real height comes from the registry key 'hudTop', in design
   * units), in the middle, and a column on each side of it (`left`, `right`: middle and width)
   * for the players, score, status line and buttons.
   */
  protected boardArea() {
    const { width, height } = this.view;
    const hud = hudScale();
    const margin = 16;
    const top = ((this.registry.get('hudTop') as number | undefined) ?? 110 * hud) + 8 * hud;
    const availH = height - top - margin;
    const size = Math.max(120, Math.min(width - 2 * 150 * hud, availH));
    const columnW = (width - size) / 2 - 2 * margin;
    return {
      size,
      cx: width / 2,
      cy: top + availH / 2,
      top,
      hud,
      left: { x: margin + columnW / 2, width: columnW },
      right: { x: width - margin - columnW / 2, width: columnW },
    };
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
