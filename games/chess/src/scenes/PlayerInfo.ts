import { FONT, type GameScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import type { Side } from '../game/model.js';
import { DISC, SIDES } from './theme.js';

interface PlayerData {
  name: string;
  side: Side;
  wins: number;
  captured: number;
  active: boolean;
}

export const PLAYER_HEIGHT = 142;

/** One seat's identity and match totals, anchored to its end of the board. */
export class PlayerInfo {
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private king: Phaser.GameObjects.Image;
  private name: Phaser.GameObjects.Text;
  private side: Phaser.GameObjects.Text;
  private labels: Phaser.GameObjects.Text[];
  private values: Phaser.GameObjects.Text[];

  constructor(
    scene: GameScene,
    private texture: string,
    private frames: Record<Side, string>,
    private fit: (
      label: Phaser.GameObjects.Text,
      value: string,
      width: number,
      minSize: number,
    ) => unknown,
  ) {
    const text = (color: string, weight = '600') =>
      scene.add.text(0, 0, '', { fontFamily: FONT, fontStyle: weight, color }).setOrigin(0, 0.5);
    this.bg = scene.add.graphics();
    this.king = scene.add.image(0, 0, texture, frames.w).setOrigin(0.5, 0.62);
    this.name = text('#fff4df', '700');
    this.side = text('#c6d5df');
    this.labels = [text('#a6bbc9'), text('#a6bbc9')];
    this.values = [text('#fff4df', '700'), text('#fff4df', '700')];
    for (const value of this.values) value.setOrigin(1, 0.5);
    this.container = scene.add
      .container(0, 0, [this.bg, this.king, this.name, this.side, ...this.labels, ...this.values])
      .setDepth(5);
  }

  draw(data: PlayerData, x: number, y: number, width: number, hud: number) {
    const height = PLAYER_HEIGHT * hud;
    const pad = Math.min(16 * hud, width * 0.09);
    this.container.setPosition(x - width / 2, y);
    this.bg
      .clear()
      .fillStyle(data.active ? 0x1b3a50 : 0x122c40, 0.94)
      .fillRoundedRect(0, 0, width, height, 12 * hud)
      .lineStyle(1, 0xb3c9d7, 0.18)
      .strokeRoundedRect(0, 0, width, height, 12 * hud);
    if (data.active)
      this.bg
        .fillStyle(0xd9a441)
        .fillRoundedRect(0, 18 * hud, 3 * hud, height - 36 * hud, 1.5 * hud);
    this.name.setFontSize(28 * hud).setPosition(pad, 23 * hud);
    this.fit(this.name, data.name, width - 2 * pad, 22 * hud);
    const icon = 36 * hud;
    this.king
      .setTexture(this.texture, this.frames[data.side])
      .setDisplaySize(icon / DISC, icon / DISC)
      .setPosition(pad + icon / 2, 63 * hud);
    this.side
      .setText(SIDES[data.side].name)
      .setFontSize(25 * hud)
      .setPosition(pad + icon + 8 * hud, 61 * hud);
    this.bg.lineStyle(1, 0xb3c9d7, 0.16).lineBetween(pad, 83 * hud, width - pad, 83 * hud);
    ['Thắng', 'Đã ăn'].forEach((label, i) => {
      const rowY = (101 + i * 25) * hud;
      this.labels[i]
        ?.setText(label)
        .setFontSize(24 * hud)
        .setPosition(pad, rowY);
      this.values[i]
        ?.setText(String(i ? data.captured : data.wins))
        .setFontSize(28 * hud)
        .setPosition(width - pad, rowY);
    });
  }
}
