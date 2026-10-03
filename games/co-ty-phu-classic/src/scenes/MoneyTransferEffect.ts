import type Phaser from 'phaser';
import type { MoneyTransfer } from '../game/model.js';

type Point = { x: number; y: number };

/**
 * One transfer as a picture: a bill travelling between the two ends (the bank is a small
 * facade). The amount itself shows once, over the pawns (PawnCashEffect), and the notice line
 * says why: no other words here.
 */
export class MoneyTransferEffect {
  private graphics: Phaser.GameObjects.Graphics;
  private bill: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, moneyTexture: string) {
    this.graphics = scene.add.graphics().setDepth(13);
    this.bill = scene.add.image(0, 0, moneyTexture).setDepth(14).setDisplaySize(32, 26);
    this.hide();
  }

  draw(transfer: MoneyTransfer, from: Point, to: Point, progress: number) {
    this.graphics.clear().setVisible(true);
    this.bill.setVisible(progress < 1);
    // A simple bank facade stays legible at phone scale and uses the board's ink palette.
    const bank = transfer.from === null ? from : transfer.to === null ? to : null;
    if (bank) {
      this.graphics.fillStyle(0x68624d);
      this.graphics.fillTriangle(
        bank.x - 24,
        bank.y - 17,
        bank.x,
        bank.y - 31,
        bank.x + 24,
        bank.y - 17,
      );
      for (const offset of [-16, 0, 16])
        this.graphics.fillRect(bank.x + offset - 3, bank.y - 13, 6, 22);
      this.graphics.fillRoundedRect(bank.x - 25, bank.y + 12, 50, 6, 2);
    }
    this.graphics.lineStyle(2, 0xc69637, 0.65).lineBetween(from.x, from.y, to.x, to.y);
    for (const [seat, point] of [
      [transfer.from, from],
      [transfer.to, to],
    ] as const) {
      if (seat !== null)
        this.graphics
          .lineStyle(3, seat === transfer.from ? 0xbf6651 : 0x528357)
          .strokeCircle(point.x, point.y, 10);
    }
    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress - Math.sin(progress * Math.PI) * 35;
    this.bill.setPosition(x, y);
  }

  hide() {
    this.graphics.clear().setVisible(false);
    this.bill.setVisible(false);
  }
}
