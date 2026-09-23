import Phaser from 'phaser';
import { islands } from '../../games';
import { titleStyle } from '../assets';
import { bridge } from '../bridge';

interface IslandView {
  container: Phaser.GameObjects.Container;
  gameId?: string;
}

/**
 * Home screen: one floating island per game (from `islands` in games/index.ts).
 * Clicking a playable island emits 'hub:select'; locked islands just wobble.
 */
export class HubScene extends Phaser.Scene {
  private views: IslandView[] = [];

  constructor() {
    super('hub');
  }

  create() {
    this.views = islands.map((island) => {
      const img = this.add.image(0, 0, island.image);
      const sign = this.add.image(0, img.height * 0.42, 'sign').setScale(0.9);
      const label = this.add
        .text(sign.x, sign.y + sign.displayHeight * 0.12, island.name, titleStyle(46))
        .setOrigin(0.5);
      const parts: Phaser.GameObjects.GameObject[] = [img, sign, label];
      if (!island.gameId) {
        img.setTint(0xb8c4d6);
        parts.push(this.add.image(0, -img.height * 0.05, 'lock').setScale(0.8));
      }
      // `float` bobs up and down; `container` is positioned by layout(). Keeping them separate
      // stops the bobbing tween from overriding the layout position on resize.
      const float = this.add.container(0, 0, parts);
      const container = this.add.container(0, 0, [float]);
      container.setData('float', float);
      container.setSize(img.width, img.height + sign.displayHeight);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', () => this.hover(container, 1.06));
      container.on('pointerout', () => this.hover(container, 1));
      container.on('pointerup', () => {
        if (island.gameId) bridge.emit('hub:select', island.gameId);
        else this.wobble(container);
      });
      return { container, gameId: island.gameId };
    });

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

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
    // Leave room for the React header (top) and join panel (bottom).
    const top = height * (portrait ? 0.18 : 0.2);
    const bottom = height * (portrait ? 0.8 : 0.78);
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

  private hover(container: Phaser.GameObjects.Container, factor: number) {
    const base = container.getData('baseScale') as number;
    this.tweens.add({ targets: container, scale: base * factor, duration: 150 });
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
