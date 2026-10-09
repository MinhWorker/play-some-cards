/** Victory announcement over the board, with the official count and match statistics. */
import { FONT, type GameScene } from '@xomdao/sdk/client';
import type Phaser from 'phaser';

export interface ResultData {
  title: string;
  winner: string;
  stone: string;
  reason: string;
  count: [string, string] | null;
  rows: [string, string][];
}

export class ResultPanel {
  readonly container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private stone: Phaser.GameObjects.Image;
  private title: Phaser.GameObjects.Text;
  private winner: Phaser.GameObjects.Text;
  private reason: Phaser.GameObjects.Text;
  private counts: Phaser.GameObjects.Text[];
  private rows: Phaser.GameObjects.Text[] = [];

  constructor(private scene: GameScene) {
    this.background = scene.add.graphics();
    const text = (color: string, weight = '700') =>
      scene.add
        .text(0, 0, '', { fontFamily: FONT, fontStyle: weight, color, align: 'center' })
        .setOrigin(0.5);
    this.stone = scene.add.image(0, 0, '__WHITE');
    this.title = text('#ffe7a4', '800');
    this.winner = text('#fff5dc');
    this.reason = text('#59432c');
    this.counts = [text('#3d3021'), text('#3d3021')];
    this.container = scene.add
      .container(0, 0, [
        this.background,
        this.stone,
        this.title,
        this.winner,
        this.reason,
        ...this.counts,
      ])
      .setDepth(20)
      .setVisible(false);
  }

  get shown() {
    return this.container.visible;
  }

  show(
    data: ResultData,
    at: { x: number; y: number; width: number; height: number; hud: number },
    pop: boolean,
  ) {
    // Fit the complete announcement inside the board even on the narrow tablet frame.
    const height = data.count ? 480 : 400;
    const scale = Math.min(at.hud, (at.width * 0.9) / 500, (at.height * 0.9) / height);
    const w = 500 * scale;
    const h = height * scale;
    const x = (n: number) => n * scale;
    const y = (n: number) => -h / 2 + x(n);
    const g = this.background.clear();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + x(6), -h / 2 + x(10), w, h, x(24));
    g.fillStyle(0x123f36).fillRoundedRect(-w / 2, -h / 2, w, h, x(24));
    g.fillStyle(0xfaf0d9).fillRoundedRect(-w / 2 + x(6), y(188), w - x(12), x(height - 194), x(18));
    g.lineStyle(x(2), 0xd9b46c).strokeRoundedRect(
      -w / 2 + x(3),
      -h / 2 + x(3),
      w - x(6),
      h - x(6),
      x(22),
    );
    g.fillStyle(0xe4be73, 0.14).fillCircle(0, y(48), x(40));
    g.lineStyle(x(2), 0xe4be73, 0.75).strokeCircle(0, y(48), x(40));
    this.stone.setTexture(data.stone).setDisplaySize(x(64), x(64)).setPosition(0, y(48));
    this.title.setText(data.title).setFontSize(x(48)).setPosition(0, y(117));
    this.winner.setText(data.winner).setFontSize(x(28)).setPosition(0, y(162));
    // Account names may be longer than the announcement's width.
    this.winner.setScale(Math.min(1, (w - x(48)) / this.winner.width));
    this.reason
      .setText(data.reason)
      .setFontSize(x(26))
      .setWordWrapWidth(w - x(56))
      .setPosition(0, y(224));
    this.counts.forEach((label, i) => {
      label.setVisible(Boolean(data.count));
      if (data.count) {
        label
          .setText(`${i === 0 ? 'Đen' : 'Trắng'}\n${data.count[i]} điểm`)
          .setFontSize(x(30))
          .setPosition(x(i === 0 ? -116 : 116), y(293));
      }
    });
    for (const row of this.rows) row.destroy();
    const top = data.count ? 365 : 280;
    this.rows = data.rows.flatMap(([label, value], i) => {
      const rowY = top + i * 34;
      g.lineStyle(x(1), 0x6c5030, 0.15).lineBetween(x(-216), y(rowY - 17), x(216), y(rowY - 17));
      const style = { fontFamily: FONT, fontSize: `${24 * scale}px`, color: '#59432c' };
      return [
        this.scene.add.text(x(-212), y(rowY), label, style).setOrigin(0, 0.5),
        this.scene.add
          .text(x(212), y(rowY), value, { ...style, fontStyle: '800' })
          .setOrigin(1, 0.5),
      ];
    });
    this.container.add(this.rows);
    this.scene.runtime.cancelTweens(this.container);
    this.container.setPosition(at.x, at.y).setVisible(true);
    if (pop) {
      this.container.setScale(0.85).setAlpha(0);
      this.scene.runtime.tween({
        targets: this.container,
        scale: 1,
        alpha: 1,
        duration: 240,
        ease: 'Back.easeOut',
      });
    } else {
      this.container.setScale(1).setAlpha(1);
    }
  }

  hide() {
    this.scene.runtime.cancelTweens(this.container);
    this.container.setVisible(false);
  }
}
