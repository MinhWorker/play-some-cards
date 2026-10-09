import { GameBackgroundScene } from '@xomdao/sdk/client';
import type Phaser from 'phaser';

/** A quiet city after dusk: layered buildings, drifting haze and warm window lights. */
export class CityBackground extends GameBackgroundScene {
  private sky!: Phaser.GameObjects.Graphics;
  private city!: Phaser.GameObjects.Graphics;
  private windowLights: Phaser.GameObjects.Graphics[] = [];
  private clouds: { shape: Phaser.GameObjects.Graphics; speed: number }[] = [];
  private elapsed = 0;

  protected onCreate() {
    this.elapsed = 0;
    this.sky = this.add.graphics();
    this.clouds = Array.from({ length: 5 }, (_, i) => {
      const shape = this.add.graphics().fillStyle(0x9ac9cc, 0.07);
      shape.fillEllipse(0, 0, 230, 38);
      shape.fillEllipse(-55, -12, 120, 45);
      shape.fillEllipse(45, -16, 140, 52);
      return { shape, speed: 5 + i * 2 };
    });
    this.city = this.add.graphics();
    this.windowLights = Array.from({ length: 4 }, () => this.add.graphics());
  }

  protected onLayout() {
    const { left, right, top, bottom } = this.bleed;
    const width = right - left;
    const height = bottom - top;
    this.sky.clear();
    // Thin overlapping bands form a gradient without a generated texture or extra assets.
    for (let i = 0; i < 80; i++) {
      const t = i / 79;
      const color =
        (Math.round(16 + 25 * t) << 16) | (Math.round(38 + 48 * t) << 8) | Math.round(57 + 41 * t);
      this.sky.fillStyle(color).fillRect(left, top + (i * height) / 80, width, height / 80 + 1);
    }
    const moonX = left + width * 0.82;
    const moonY = top + height * 0.19;
    this.sky.fillStyle(0xffe7b1, 0.04).fillCircle(moonX, moonY, 75);
    this.sky.fillStyle(0xffe7b1, 0.07).fillCircle(moonX, moonY, 48);
    this.sky.fillStyle(0xffedc9, 0.75).fillCircle(moonX, moonY, 26);
    for (let i = 0; i < 36; i++) {
      this.sky
        .fillStyle(0xd0e8e5, 0.2 + (i % 3) * 0.1)
        .fillCircle(
          left + ((i * 137.3) % width),
          top + ((i * 53.7) % (height * 0.52)),
          i % 3 === 0 ? 1.5 : 1,
        );
    }
    this.clouds.forEach(({ shape }, i) => {
      shape.setPosition(left + ((i + 0.5) * width) / this.clouds.length, top + 95 + i * 61);
    });
    this.city.clear();
    for (const light of this.windowLights) light.clear().fillStyle(0xffd891);
    const horizon = bottom - height * 0.06;
    for (let layer = 0; layer < 2; layer++) {
      const step = layer ? 102 : 75;
      const base = horizon + layer * 30;
      for (let i = 0, x = left - step; x < right + step; i++, x += step) {
        const w = step - 8;
        const h = 80 + ((i * 47 + layer * 83) % (layer ? 180 : 140));
        const y = base - h;
        this.city.fillStyle(layer ? 0x16383e : 0x315960).fillRoundedRect(x, y, w, h, 5);
        this.city.fillStyle(layer ? 0x20454a : 0x3b656b).fillRect(x + w - 12, y + 5, 12, h - 5);
        this.city.fillStyle(0x6e9290, layer ? 0.18 : 0.12).fillRect(x + 5, y, w - 10, 3);
        if (i % 3 === 0) {
          this.city
            .fillStyle(layer ? 0x16383e : 0x315960)
            .fillRect(x + w * 0.4, y - 15, w * 0.2, 15);
        }
        if (!layer) continue;
        for (let row = 0; row < Math.floor((h - 22) / 22); row++) {
          for (let col = 0; col < 4; col++) {
            if ((i * 7 + row * 3 + col) % 5 < 2) continue;
            this.windowLights[(i + row + col) % this.windowLights.length]?.fillRoundedRect(
              x + 12 + col * 18,
              y + 16 + row * 22,
              7,
              10,
              1,
            );
          }
        }
      }
    }
    this.city.fillStyle(0x123239).fillRect(left, horizon + 30, width, bottom - horizon);
  }

  protected override onUpdate(delta: number) {
    // Tab restoration must not fling the decorative clouds across the entire screen.
    const seconds = Math.min(delta, 100) / 1000;
    this.elapsed += seconds;
    for (const { shape, speed } of this.clouds) {
      shape.x += seconds * speed;
      if (shape.x - 150 > this.bleed.right) shape.x = this.bleed.left - 150;
    }
    this.windowLights.forEach((light, i) => {
      light.setAlpha(0.25 + 0.12 * Math.sin(this.elapsed * 0.6 + i * 1.7));
    });
  }
}
