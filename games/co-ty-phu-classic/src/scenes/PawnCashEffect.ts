import type Phaser from 'phaser';
import type { MoneyTransfer } from '../game/model.js';

type Point = { x: number; y: number };

/** Cash changes rise above the affected pawns during their payment beat. */
export class PawnCashEffect {
  private labels: Phaser.GameObjects.Text[];
  private seats: number[] = [];

  constructor(scene: Phaser.Scene) {
    this.labels = Array.from({ length: 4 }, () =>
      scene.add
        .text(0, 0, '', {
          fontFamily: '"Baloo 2"',
          fontSize: '28px',
          fontStyle: 'bold',
          stroke: '#fff8e5',
          strokeThickness: 3,
        })
        .setOrigin(0.5, 1)
        .setDepth(16)
        .setVisible(false),
    );
  }

  begin(transfer: MoneyTransfer) {
    this.hide();
    const changes = new Map<number, number>();
    for (const [seat, sign] of [
      [transfer.from, -1],
      [transfer.to, 1],
    ] as const) {
      if (seat !== null) changes.set(seat, (changes.get(seat) ?? 0) + sign * transfer.amount);
    }
    for (const [seat, amount] of changes) {
      const label = this.labels[seat];
      if (!amount || !label) continue;
      this.seats.push(seat);
      label
        .setText(`${amount > 0 ? '+' : '−'}${Math.abs(amount).toLocaleString('vi-VN')} ₫`)
        .setColor(amount > 0 ? '#238647' : '#c83e37')
        .setAlpha(1)
        .setVisible(true);
    }
  }

  draw(progress: number, anchors: Point[], screen: { width: number; top: number }) {
    const p = Math.max(0, Math.min(1, progress));
    const rise = 46 * (1 - (1 - p) ** 2);
    const alpha = 1 - Math.max(0, (p - 0.2) / 0.8);
    const positions = this.seats.map((seat) => ({
      ...(anchors[seat] ?? { x: screen.width / 2, y: screen.top + 80 }),
    }));
    // Keep payer and recipient amounts readable when both pawns occupy the same tile.
    if (positions.length === 2) {
      const [a, b] = positions as [Point, Point];
      const [first, second] = this.seats.map((seat) => this.labels[seat]!);
      const spacing = (first!.width + second!.width) / 2 + 8;
      if (Math.abs(a.y - b.y) < 40 && Math.abs(a.x - b.x) < spacing) {
        const center = (a.x + b.x) / 2;
        const direction = a.x <= b.x ? -1 : 1;
        a.x = center + (direction * spacing) / 2;
        b.x = center - (direction * spacing) / 2;
      }
    }
    this.seats.forEach((seat, i) => {
      const label = this.labels[seat]!;
      const point = positions[i]!;
      label
        .setAlpha(alpha)
        .setPosition(
          Math.max(label.width / 2 + 8, Math.min(screen.width - label.width / 2 - 8, point.x)),
          Math.max(screen.top + label.height + 8, point.y - rise),
        );
    });
  }

  hide() {
    this.seats = [];
    this.labels.forEach((label) => {
      label.setVisible(false);
    });
  }
}
