import Phaser from 'phaser';
import { framedAvatar } from './avatar.js';
import { followFrame } from './followFrame.js';
import { currentFrame, FRAME, type Frame } from './frame.js';
import { clientHost } from './host.js';
import { SceneRuntime } from './runtime/SceneRuntime.js';
import { hudScale, titleStyle } from './text.js';

/** A scene's frame (a function, not a method: games name their own methods freely). */
function frameOf(scene: Phaser.Scene) {
  return (scene.registry.get(FRAME) as Frame | undefined) ?? currentFrame();
}

/** A game object Phaser can light (images, sprites, text, graphics…). */
type Lightable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Lighting;

/** Made by `this.litLayer()`: lit objects kept in one Layer. */
export interface LitLayer {
  layer: Phaser.GameObjects.Layer;
  /** Adds `child` to the layer with lighting on; returns it. */
  add<T extends Lightable>(child: T): T;
  /** Takes `child` out of the layer and turns its lighting off (add it to the scene yourself). */
  remove(child: Lightable): void;
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
 * `RoomSetupScene` (its "Tạo phòng" screen), or `GameBackgroundScene` (its optional backdrop).
 *
 * `assets/<name>.normal.webp` loads alongside image/atlas `<name>` as raw camera-space normals
 * (+X right, +Y up, +Z toward the viewer; flat = 128,128,255). Call `lighting()` in onCreate for
 * ambient + an upper-left key matching tools/blender/xomdao_bake; `lighting({ pointer: true })`
 * also adds a soft hover/drag light. It follows the frame and cleans up on scene shutdown.
 * `litLayer()` groups lit images/sprites into one Layer to keep draw calls low: `pieces.add(obj)`
 * lights it, `pieces.remove(obj)` unlights it, `pieces.layer.setDepth(d)` orders the layer with
 * the rest of the scene. Positions stay in scene units and depth sorts within the layer.
 * Images without normals use Phaser's flat normal. UI and board marks stay outside the layer.
 */
export abstract class GameScene extends Phaser.Scene {
  private warned = new Set<string>();
  /** Presentation flows and resources for this scene run. Available before game hooks. */
  runtime!: SceneRuntime;

  protected startRuntime(lifetime: 'round' | 'scene') {
    this.runtime?.dispose();
    this.runtime = new SceneRuntime(this, clientHost(), lifetime);
  }

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

  /** The game id. Scene keys are `<id>`, `<id>:setup` and `<id>:background`. */
  get gameId() {
    return this.scene.key.split(':')[0] ?? '';
  }

  preload() {
    const { images, normals, sounds, atlases } = clientHost().assets(this.gameId);
    for (const [name, url] of Object.entries(images)) {
      const key = `${this.gameId}/${name}`;
      if (this.textures.exists(key)) continue;
      const atlas = atlases[name];
      const normalMap = normals[name];
      if (atlas) this.load.atlas({ key, textureURL: url, atlasURL: atlas, normalMap });
      else this.load.image({ key, url, normalMap });
    }
    for (const [name, url] of Object.entries(clientHost().avatars())) {
      if (!this.textures.exists(`avatar/${name}`)) this.load.image(`avatar/${name}`, url);
    }
    for (const [name, url] of Object.entries(clientHost().frames())) {
      if (!this.textures.exists(`frame/${name}`)) this.load.image(`frame/${name}`, url);
    }
    // `music*` files are the game's background music: the app streams one, no need to preload.
    for (const [name, url] of Object.entries(sounds)) {
      if (!name.startsWith('music')) void clientHost().prepareSound(url);
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
   * Texture key of a player's picture in its frame: their account's avatar inside the frame they
   * picked, the robot for the computer. E.g. `this.add.image(x, y, this.avatar(player))`.
   */
  protected avatar(player: { avatar?: string; frame?: string; bot?: boolean }) {
    if (player.bot && this.textures.exists('avatar/bot')) return 'avatar/bot';
    const picture = this.textures.exists(`avatar/${player.avatar}`)
      ? `avatar/${player.avatar}`
      : 'avatar/boy';
    const ring = this.textures.exists(`frame/${player.frame}`)
      ? `frame/${player.frame}`
      : 'frame/gold';
    return framedAvatar(this.textures, picture, ring);
  }

  /** Adds `assets/<name>.webp|png` as an image; optional frame for an atlas. */
  protected image(x: number, y: number, name: string, frame?: string | number) {
    return this.add.image(x, y, this.texture(name), frame);
  }

  /**
   * An animation of every frame of atlas `assets/<name>` (image + same-name .json), in the
   * frames' name order (`hop-01`, `hop-02`…). Made once; await it inside a runtime flow:
   *   await fx.animate(horse, this.anim('horse-hop', { frameRate: 30 }))
   */
  protected anim(name: string, { frameRate = 24, repeat = 0 } = {}) {
    const key = this.texture(name);
    const existing = this.anims.get(key);
    if (existing && (existing.frameRate !== frameRate || existing.repeat !== repeat))
      throw new Error(`Conflicting animation configuration: ${key}`);
    if (!existing) {
      const frames = this.textures
        .get(key)
        .getFrameNames()
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((frame) => ({ key, frame }));
      this.anims.create({ key, frames, frameRate, repeat });
    }
    return key;
  }

  /** Plays `assets/<name>.wav|mp3` on the effects channel; resolves when playback starts. */
  protected sfx(name: string) {
    return this.playAsset(name, {});
  }

  /** Like `sfx`, for a short piece of music (a win): the background music dips while it plays. */
  protected jingle(name: string) {
    void this.playAsset(name, { duck: true });
  }

  private playAsset(name: string, options: { duck?: boolean }): Promise<void> {
    return this.runtime.audio.play(name, options).started.then(() => {});
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

  /** Ambient + upper-left key; optional soft pointer light. Call once in onCreate. */
  protected lighting({
    ambient = 0xb8b8b8,
    color = 0xfff3df,
    intensity = 0.55,
    pointer = false,
  } = {}) {
    this.lights.enable().setAmbientColor(ambient);
    const key = this.lights.addLight(0, 0, 1, color, intensity);
    const hover = pointer ? this.lights.addLight(0, 0, 240, 0xddeeff, 0, 120) : undefined;
    const layout = () => {
      const { width, height } = this.view;
      key.setPosition(width / 2 - height * 0.3, height * 0.1);
      key.setRadius(height * 3).setZ(height * 0.7);
    };
    layout();
    this.registry.events.on(`changedata-${FRAME}`, layout);
    const follow = (p: Phaser.Input.Pointer) => {
      const pos = p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      hover?.setPosition(pos.x, pos.y).setIntensity(0.22);
    };
    const hide = () => hover?.setIntensity(0);
    const release = (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) hide();
    };
    if (hover) {
      this.input.on(Phaser.Input.Events.POINTER_MOVE, follow);
      this.input.on(Phaser.Input.Events.POINTER_DOWN, follow);
      this.input.on(Phaser.Input.Events.POINTER_UP, release);
      this.input.on(Phaser.Input.Events.GAME_OUT, hide);
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off(`changedata-${FRAME}`, layout);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, follow);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, follow);
      this.input.off(Phaser.Input.Events.POINTER_UP, release);
      this.input.off(Phaser.Input.Events.GAME_OUT, hide);
    });
    return { key, pointer: hover };
  }

  /**
   * One Layer of lit images/sprites, kept together so lighting batches. `add` turns lighting on
   * and `remove` turns it off again; set the depth on `layer`. Requires lighting().
   */
  protected litLayer(): LitLayer {
    const layer = this.add.layer();
    return {
      layer,
      add: (child) => {
        layer.add(child.setLighting(true));
        return child;
      },
      remove: (child) => {
        layer.remove(child.setLighting(false));
      },
    };
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
