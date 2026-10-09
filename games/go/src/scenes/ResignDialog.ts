/**
 * The white flag, and the dialog it opens: "Đầu hàng?" with a button to give up and one to play
 * on. A dimmed backdrop over the whole screen swallows taps (a tap on it plays on), so a stray
 * touch can't end the game.
 */
import { type Button, FONT, type GameScene } from '@xomdao/sdk/client';
import type Phaser from 'phaser';

const DEPTH = 30;

/** A white flag on its pole, centered on (0, 0) and `size` tall, into `g`. */
export function drawFlag(g: Phaser.GameObjects.Graphics, size: number) {
  const s = size / 100;
  const pole = { x: -30 * s, top: -44 * s, bottom: 44 * s };
  g.clear();
  g.lineStyle(Math.max(2, 7 * s), 0x3a2414, 1);
  g.lineBetween(pole.x, pole.top, pole.x, pole.bottom);
  g.fillStyle(0xe5bd72, 1).fillCircle(pole.x, pole.top - 2 * s, 6 * s);
  // The cloth ripples once along its top and bottom edges.
  const cloth = [
    { x: pole.x, y: pole.top + 2 * s },
    { x: -6 * s, y: pole.top - 6 * s },
    { x: 16 * s, y: pole.top + 6 * s },
    { x: 38 * s, y: pole.top - 2 * s },
    { x: 38 * s, y: 2 * s },
    { x: 16 * s, y: 10 * s },
    { x: -6 * s, y: -2 * s },
    { x: pole.x, y: 6 * s },
  ];
  g.fillStyle(0x1b120a, 0.35).fillPoints(
    cloth.map((p) => ({ x: p.x + 3 * s, y: p.y + 4 * s })) as Phaser.Math.Vector2[],
    true,
  );
  g.fillStyle(0xfbf7ee, 1).fillPoints(cloth as Phaser.Math.Vector2[], true);
  g.lineStyle(Math.max(1, 2.5 * s), 0x3a2414, 0.9).strokePoints(
    cloth as Phaser.Math.Vector2[],
    true,
  );
}

/** `button.setSize`, and its tap area made to match (it keeps its first size otherwise). */
export function fitButton(button: Button, width: number, height: number) {
  button.setSize(width, height);
  button.container.input?.hitArea.setTo(0, 0, width, height);
  return button;
}

export class ResignDialog {
  private backdrop: Phaser.GameObjects.Rectangle;
  private panel: Phaser.GameObjects.Graphics;
  private flag: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;

  /** `confirm` gives up, `cancel` plays on; both are made by the view (`this.button`). */
  constructor(
    scene: GameScene,
    readonly confirm: Button,
    readonly cancel: Button,
    onCancel: () => void,
  ) {
    this.backdrop = scene.add
      .rectangle(0, 0, 10, 10, 0x061412, 0.62)
      .setOrigin(0)
      .setDepth(DEPTH)
      .setInteractive()
      .on('pointerup', onCancel);
    this.panel = scene.add.graphics().setDepth(DEPTH);
    this.flag = scene.add.graphics().setDepth(DEPTH);
    const text = (color: string, weight: string) =>
      scene.add
        .text(0, 0, '', { fontFamily: FONT, fontStyle: weight, color, align: 'center' })
        .setOrigin(0.5)
        .setDepth(DEPTH);
    this.title = text('#ffe7a4', '800').setText('Đầu hàng?');
    this.body = text('#fff5dc', '600').setText('Bạn sẽ thua ván này.');
    for (const button of [confirm, cancel]) button.container.setDepth(DEPTH + 1);
    this.hide();
  }

  get shown() {
    return this.backdrop.visible;
  }

  /**
   * Lays the dialog out in the middle of `area` (the board), the backdrop over the whole frame
   * and what the screen shows beyond it (`bleed`).
   */
  layout(
    area: { x: number; y: number; width: number },
    frame: { width: number; height: number; hud: number },
    bleed: { left: number; top: number; right: number; bottom: number },
  ) {
    this.backdrop
      .setPosition(-bleed.left, -bleed.top)
      .setSize(frame.width + bleed.left + bleed.right, frame.height + bleed.top + bleed.bottom);
    this.backdrop.input?.hitArea.setTo(0, 0, this.backdrop.width, this.backdrop.height);
    const scale = Math.min(frame.hud, (area.width * 0.92) / 460);
    const x = (n: number) => n * scale;
    const w = x(460);
    const h = x(330);
    const top = area.y - h / 2;
    this.panel
      .clear()
      .setPosition(area.x, area.y)
      .fillStyle(0x000000, 0.35)
      .fillRoundedRect(-w / 2 + x(6), -h / 2 + x(10), w, h, x(24))
      .fillStyle(0x123f36)
      .fillRoundedRect(-w / 2, -h / 2, w, h, x(24))
      .lineStyle(x(2), 0xd9b46c)
      .strokeRoundedRect(-w / 2 + x(3), -h / 2 + x(3), w - x(6), h - x(6), x(22));
    drawFlag(this.flag, x(76));
    this.flag.setPosition(area.x, top + x(62));
    this.title.setFontSize(x(42)).setPosition(area.x, top + x(140));
    this.body.setFontSize(x(26)).setPosition(area.x, top + x(190));
    const bw = x(190);
    const bh = Math.max(56, x(76));
    const by = top + h - x(24) - bh / 2;
    fitButton(this.cancel, bw, bh).setPosition(area.x - x(104), by);
    fitButton(this.confirm, bw, bh).setPosition(area.x + x(104), by);
  }

  show() {
    this.setVisible(true);
  }

  hide() {
    this.setVisible(false);
  }

  private setVisible(shown: boolean) {
    for (const o of [this.backdrop, this.panel, this.flag, this.title, this.body]) {
      o.setVisible(shown);
    }
    this.confirm.container.setVisible(shown);
    this.cancel.container.setVisible(shown);
  }
}
