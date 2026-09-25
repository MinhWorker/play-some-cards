import Phaser from 'phaser';
import { portals } from '@/games';
import { playSfx } from '@/lib/sound';
import { titleStyle } from '@/phaser/assets';
import { bridge } from '@/phaser/bridge';

interface IslandView {
  container: Phaser.GameObjects.Container;
  gameId?: string;
}

/**
 * Home screen: one floating island per game (every folder in games/, see `portals`).
 * Clicking a playable island emits 'hub:select'; locked ones (work in progress) just wobble.
 */
export class HubScene extends Phaser.Scene {
  private views: IslandView[] = [];

  constructor() {
    super('hub');
  }

  create() {
    this.views = portals.map((island) => {
      const open = !island.locked;
      const img = this.add.image(0, 0, island.texture);
      const sign = this.add.image(0, img.height * 0.42, 'sign').setScale(0.9);
      const label = this.add
        .text(sign.x, sign.y + sign.displayHeight * 0.12, island.name, titleStyle(46))
        .setOrigin(0.5);
      // Magic light orbs hide where the sign's ropes end (they don't meet the island art).
      const ropeTop = sign.y - sign.displayHeight / 2;
      const orbs = [-0.35, 0.35].map((f) =>
        this.add.image(sign.x + sign.displayWidth * f, ropeTop, 'orb').setDisplaySize(72, 72),
      );
      const parts: Phaser.GameObjects.GameObject[] = [img, sign, ...orbs, label];
      let glow: Phaser.Filters.Glow | undefined;
      if (open) {
        // Hover highlight: a warm glow around the island, toggled in hover().
        glow = img.enableFilters().filters?.internal.addGlow(0xfff1a8, 5, 0, 1.4, false, 12, 14);
        if (glow) glow.active = false;
      } else {
        // Locked ("coming soon"): island and sign in black and white; the gold lock stays.
        for (const part of [img, sign, ...orbs]) {
          part.enableFilters().filters?.internal.addColorMatrix().colorMatrix.grayscale();
        }
        parts.push(this.add.image(0, -img.height * 0.05, 'lock').setScale(0.8));
      }
      // `float` bobs up and down; `container` is positioned by layout(). Keeping them separate
      // stops the bobbing tween from overriding the layout position on resize.
      const float = this.add.container(0, 0, parts);
      const container = this.add.container(0, 0, [float]);
      container.setData('float', float);
      container.setSize(img.width, img.height + sign.displayHeight);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', (pointer: Phaser.Input.Pointer) => {
        // Mouse only: on touch screens "over" fires on every tap.
        if (!pointer.wasTouch) playSfx('island-hover');
      });
      container.on('pointerover', () => this.hover(container, true, open ? { sign, glow } : null));
      container.on('pointerout', () => this.hover(container, false, open ? { sign, glow } : null));
      container.on('pointerup', () => {
        playSfx('island-click');
        if (open) bridge.emit('hub:select', island.gameId);
        else this.wobble(container);
      });
      // Orbs pulse softly, out of sync with each other.
      orbs.forEach((orb, j) => {
        this.tweens.add({
          targets: orb,
          scale: orb.scale * 1.15,
          alpha: 0.8,
          duration: 900 + j * 200,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        });
      });
      return { container, gameId: island.gameId };
    });

    this.registry.set('showTitle', true);
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.registry.events.on('changedata-titleBottom', this.layout, this);
    this.events.once('shutdown', () => {
      this.registry.set('showTitle', false);
      this.scale.off('resize', this.layout, this);
      this.registry.events.off('changedata-titleBottom', this.layout, this);
    });

    // Gentle floating motion, each island slightly out of sync.
    this.views.forEach(({ container }, i) => {
      this.tweens.add({
        targets: container.getData('float'),
        y: `+=${10 + i * 2}`,
        duration: 1800 + i * 250,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    });
  }

  /** Landscape: islands spread across the screen. Portrait: a zigzag column. */
  private layout() {
    const { width, height } = this.scale;
    const portrait = height > width;
    // Leave room for the title (drawn by SkyScene, which reports its bottom edge).
    const titleBottom = (this.registry.get('titleBottom') as number | undefined) ?? height * 0.2;
    const top = Math.max(titleBottom, height * 0.12);
    const bottom = height * (portrait ? 0.95 : 0.92);
    const n = this.views.length;
    const cols = portrait ? 2 : Math.min(n, 4);
    const rows = Math.ceil(n / cols);
    const cellW = width / cols;
    const cellH = (bottom - top) / rows;
    const baseScale = Math.min(cellW / 640, cellH / 760) * 0.95;

    this.views.forEach(({ container }, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      // Offset every other row/column so it reads as a map rather than a grid.
      const zig = portrait ? (row % 2 ? cellW * 0.08 : -cellW * 0.08) : 0;
      const stagger = !portrait && col % 2 ? cellH * 0.12 : 0;
      container.setPosition(cellW * (col + 0.5) + zig, top + cellH * (row + 0.5) + stagger);
      container.setScale(baseScale);
      container.setData('baseScale', baseScale);
    });
  }

  /** Grows the island; playable ones also swap to the bright sign and glow. */
  private hover(
    container: Phaser.GameObjects.Container,
    on: boolean,
    highlight: { sign: Phaser.GameObjects.Image; glow?: Phaser.Filters.Glow } | null,
  ) {
    const base = container.getData('baseScale') as number;
    const factor = on ? (highlight ? 1.08 : 1.03) : 1;
    this.tweens.add({ targets: container, scale: base * factor, duration: 150 });
    if (!highlight) return;
    highlight.sign.setTexture(on ? 'sign-hover' : 'sign');
    if (highlight.glow) highlight.glow.active = on;
  }

  private wobble(container: Phaser.GameObjects.Container) {
    this.tweens.add({
      targets: container,
      angle: { from: -4, to: 4 },
      duration: 70,
      yoyo: true,
      repeat: 2,
      onComplete: () => container.setAngle(0),
    });
    bridge.emit('hub:locked');
  }
}
