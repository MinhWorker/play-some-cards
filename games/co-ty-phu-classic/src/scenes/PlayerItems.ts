import type { GameScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import type { Deck } from '../game/cards.js';

export type PlayerInventory = { freeCards: Deck[]; jailed: boolean; jailRolls: number };

/** Only the two existing jail tickets and the existing jail status. */
export class PlayerItems {
  private icons: Phaser.GameObjects.Graphics;
  private counts: Phaser.GameObjects.Text[];

  constructor(scene: GameScene) {
    this.icons = scene.add.graphics().setDepth(9);
    this.counts = Array.from({ length: 4 }, () =>
      scene.add
        .text(0, 0, '', {
          fontFamily: 'Arial',
          fontSize: '10px',
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(10)
        .setVisible(false),
    );
  }

  draw(inventory: PlayerInventory[], x: number, top: number, rowHeight: number) {
    const g = this.icons;
    g.clear();
    this.counts.forEach((count) => {
      count.setVisible(false);
    });
    inventory.forEach((player, seat) => {
      const baseY = top + 13 + seat * (rowHeight + 8);
      let row = 0;
      for (const deck of player.freeCards) {
        const y = baseY + row++ * 25;
        g.fillStyle(deck === 'chance' ? 0xffe1a0 : 0xc2e4d5).fillRoundedRect(
          x - 10,
          y - 9,
          20,
          18,
          3,
        );
        g.lineStyle(1.5, 0x415c59).strokeRoundedRect(x - 10, y - 9, 20, 18, 3);
        g.lineStyle(1, 0x415c59)
          .lineBetween(x - 5, y - 4, x - 5, y + 4)
          .lineBetween(x + 5, y - 4, x + 5, y + 4)
          .lineBetween(x - 5, y + 4, x + 5, y + 4);
        g.lineStyle(2, 0x415c59).lineBetween(x, y - 4, x, y + 4);
      }
      if (player.jailed) {
        const y = baseY + row * 25;
        g.fillStyle(0xe7e4dd).fillRoundedRect(x - 10, y - 9, 20, 18, 3);
        g.lineStyle(1.5, 0x415c59).strokeRoundedRect(x - 10, y - 9, 20, 18, 3);
        for (const offset of [-5, 0, 5]) g.lineBetween(x + offset, y - 6, x + offset, y + 6);
        g.fillStyle(0xb66b4e).fillCircle(x + 9, y + 8, 6);
        this.counts[seat]
          ?.setVisible(true)
          .setPosition(x + 9, y + 8)
          .setText(`${Math.max(0, 3 - player.jailRolls)}`);
      }
    });
  }
}
