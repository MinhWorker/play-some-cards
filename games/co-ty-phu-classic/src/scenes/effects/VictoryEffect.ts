import { FONT, type GameScene, type ViewContext } from '@xomdao/sdk/client';
import type Phaser from 'phaser';
import type { View } from '../../game/model.js';
import { assetValue } from '../../game/rules.js';

/** A scoped celebration above the board, with the winner's final net assets. */
export class VictoryEffect {
  private shown = false;
  private objects: Phaser.GameObjects.GameObject[] = [];
  constructor(
    private readonly scene: GameScene,
    private readonly pawns: readonly string[],
  ) {}

  play(ctx: ViewContext<View>, view: { width: number; height: number }, animate = true) {
    const winner = ctx.state.winner;
    if (winner === null || this.shown) return;
    this.shown = true;
    const { width, height } = view;
    const cx = width / 2;
    const cy = height * 0.52;
    const shade = this.scene.add.graphics().setDepth(60);
    shade.fillStyle(0x102034, 0.84).fillRect(0, 0, width, height);
    const sparks = this.scene.add.graphics().setDepth(61);
    const pawn = this.scene.add
      .image(cx, cy, this.pawns[winner]!)
      .setDepth(62)
      .setOrigin(0.5, 0.85)
      .setDisplaySize(30, 42);
    const title = this.scene.add
      .text(cx, height * 0.17, `${ctx.players[winner]!.name} chiến thắng!`, {
        fontFamily: FONT,
        fontSize: '42px',
        fontStyle: 'bold',
        color: '#ffe4a0',
        align: 'center',
        wordWrap: { width: width - 80 },
      })
      .setOrigin(0.5)
      .setDepth(63);
    const amount = this.scene.add
      .text(cx, height * 0.72, 'Tổng tài sản\n0 ₫', {
        fontFamily: FONT,
        fontSize: '34px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(63);
    const total = Math.max(0, assetValue(ctx.state, winner));
    this.objects = [shade, sparks, pawn, title, amount];
    if (!animate) {
      pawn.setDisplaySize(132, 183);
      amount.setText(`Tổng tài sản\n${Math.round(total).toLocaleString('vi-VN')} ₫`);
      return;
    }
    this.scene.runtime.run(
      async (fx) => {
        const counter = { value: 0 };
        const fireworkClock = { elapsed: 0 };
        await fx.parallel(
          async (zoom) => {
            await zoom.tween({
              targets: pawn,
              displayWidth: 132,
              displayHeight: 183,
              duration: 600,
              ease: 'Back.Out',
            });
            await zoom.tween({
              targets: pawn,
              y: cy - 52,
              angle: -8,
              duration: 280,
              yoyo: true,
              repeat: 7,
              ease: 'Sine.InOut',
            });
            await zoom.tween({ targets: pawn, angle: 0, duration: 150 });
          },
          async (count) => {
            await count.tween({
              targets: counter,
              value: total,
              duration: 2600,
              ease: 'Cubic.Out',
              onUpdate: () =>
                amount.setText(
                  `Tổng tài sản\n${Math.round(counter.value).toLocaleString('vi-VN')} ₫`,
                ),
            });
          },
          async (fireworks) => {
            await fireworks.tween({
              targets: fireworkClock,
              elapsed: 6200,
              duration: 6200,
              onUpdate: () => {
                sparks.clear();
                for (let burst = 0; burst < 8; burst++) {
                  const age = (fireworkClock.elapsed - burst * 480) % 2100;
                  if (age < 0 || age > 1500) continue;
                  const x = width * (0.15 + ((burst * 37) % 70) / 100);
                  const y = height * (0.18 + ((burst * 17) % 35) / 100);
                  const colors = [0xffd36b, 0xff8177, 0x82c9ff, 0xa5edaa];
                  if (age < 300) {
                    const rocketY = height - ((height - y) * age) / 300;
                    sparks.lineStyle(2, 0xffefbd).lineBetween(x, rocketY, x, rocketY + 24);
                    continue;
                  }
                  const t = (age - 300) / 1200;
                  for (let ray = 0; ray < 24; ray++) {
                    const angle = (ray * Math.PI) / 12;
                    const radius = 115 * t;
                    const px = x + Math.cos(angle) * radius;
                    const py = y + Math.sin(angle) * radius + 50 * t * t;
                    sparks
                      .lineStyle(2, colors[burst % 4]!, 1 - t)
                      .lineBetween(px, py, px - Math.cos(angle) * 10, py - Math.sin(angle) * 10);
                  }
                }
              },
            });
            sparks.clear();
          },
        );
        fx.checkpoint();
        amount.setText(`Tổng tài sản\n${Math.round(total).toLocaleString('vi-VN')} ₫`);
      },
      { lane: 'victory' },
    );
  }

  reset() {
    this.scene.runtime.cancelLane('victory');
    this.objects.forEach((object) => {
      object.destroy();
    });
    this.objects = [];
    this.shown = false;
  }
}
