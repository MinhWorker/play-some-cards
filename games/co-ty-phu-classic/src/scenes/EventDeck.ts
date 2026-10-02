import type { FlowContext, GameScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import type { Deck } from '../game/cards.js';

const INK = 0x415c59;

/** Printed stacks and one scoped draw, before the authoritative card is revealed. */
export class EventDeck {
  private stacks: Phaser.GameObjects.Container[];
  private width = 68;
  private center = { x: 0, y: 0 };
  active: Deck | null = null;

  constructor(private readonly scene: GameScene) {
    this.stacks = ['?', '+'].map((symbol) => {
      const stack = scene.add.container(0, 0).setDepth(0.1).setAlpha(0.6);
      const lines = scene.add.graphics();
      for (const offset of [8, 4]) {
        lines.lineStyle(2, INK, 0.85).strokeRoundedRect(offset - 30, -offset - 42, 60, 84, 6);
      }
      this.back(lines, 0, 0, symbol);
      stack.add(lines);
      return stack;
    });
  }

  private back(g: Phaser.GameObjects.Graphics, x: number, y: number, symbol: string) {
    g.lineStyle(2, INK, 0.85).strokeRoundedRect(x - 30, y - 42, 60, 84, 6);
    g.lineStyle(1, INK, 0.65).strokeRoundedRect(x - 24, y - 36, 48, 72, 4);
    for (let line = -24; line <= 24; line += 8) {
      g.lineBetween(x - 19, y + line, x - 9, y + line + 8);
      g.lineBetween(x + 9, y + line - 8, x + 19, y + line);
    }
    if (symbol === '+') {
      g.lineStyle(3, INK)
        .lineBetween(x - 6, y, x + 6, y)
        .lineBetween(x, y - 6, x, y + 6);
    } else {
      g.lineStyle(3, INK)
        .beginPath()
        .arc(x, y - 5, 7, Math.PI, Math.PI * 2)
        .strokePath();
      g.lineBetween(x + 7, y - 5, x, y + 3).lineBetween(x, y + 3, x, y + 6);
      g.fillStyle(INK).fillCircle(x, y + 12, 2);
    }
  }

  layout(left: number, top: number, size: number, imageH: number) {
    this.width = size * 0.06;
    this.center = { x: left + size / 2, y: top + imageH * 0.47 };
    this.stacks.forEach((stack, index) => {
      stack
        .setPosition(left + size * (index === 0 ? 0.33 : 0.67), top + imageH * 0.655)
        .setScale(this.width / 60, (this.width / 60) * 0.72)
        .setAngle(index === 0 ? -12 : 12);
    });
  }

  show(visible: boolean) {
    this.stacks.forEach((stack) => {
      stack.setVisible(visible);
    });
  }

  async draw(fx: FlowContext, deck: Deck) {
    const stack = this.stacks[deck === 'chance' ? 0 : 1]!;
    const card = this.scene.add.container(stack.x, stack.y).setDepth(6);
    const back = this.scene.add.graphics();
    this.back(back, 0, 0, deck === 'chance' ? '?' : '+');
    const face = this.scene.add.graphics().setVisible(false);
    face.lineStyle(2, INK).strokeRoundedRect(-30, -42, 60, 84, 6);
    face.lineStyle(2, INK);
    for (let ray = 0; ray < 8; ray++) {
      const angle = (ray * Math.PI) / 4;
      face.lineBetween(
        Math.cos(angle) * 9,
        Math.sin(angle) * 9,
        Math.cos(angle) * 18,
        Math.sin(angle) * 18,
      );
    }
    card.add([back, face]).setScale(stack.scaleX, stack.scaleY).setAngle(stack.angle);
    this.active = deck;
    fx.defer(() => {
      card.destroy();
      this.active = null;
    });
    await fx.sound('tycoon-card');
    fx.checkpoint();
    await fx.tween({
      targets: card,
      x: stack.x - this.width * 0.16,
      angle: stack.angle - 6,
      duration: 160,
      yoyo: true,
    });
    await fx.tween({
      targets: card,
      x: this.center.x,
      y: this.center.y,
      angle: 18,
      duration: 420,
      ease: 'Cubic.easeOut',
    });
    await fx.sound('tycoon-card-flip');
    await fx.tween({ targets: card, scaleX: 0, angle: 0, duration: 170, ease: 'Sine.easeIn' });
    fx.checkpoint();
    back.setVisible(false);
    face.setVisible(true);
    await fx.tween({ targets: card, scaleX: stack.scaleX, duration: 170, ease: 'Sine.easeOut' });
    await fx.tween({ targets: card, alpha: 0, y: this.center.y - 12, duration: 220 });
  }
}
