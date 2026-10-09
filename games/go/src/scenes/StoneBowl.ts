/** Separate rendered bowl/lid props with persistent, count-driven stone piles. */
import type { GameScene } from '@xomdao/sdk/client';
import type Phaser from 'phaser';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export class StoneBowl {
  readonly bowl: Phaser.GameObjects.Container;
  readonly lid: Phaser.GameObjects.Container;
  private bowlArt: Phaser.GameObjects.Image;
  private lidArt: Phaser.GameObjects.Image;
  private bowlShadow: Phaser.GameObjects.Graphics;
  private lidShadow: Phaser.GameObjects.Graphics;
  private reserve: Phaser.GameObjects.Image[] = [];
  private prisoners: Phaser.GameObjects.Image[] = [];
  private remaining = 0;
  private captured = 0;
  private diameter = 150;
  private lidDiameter = 120;
  private home = { x: 0, y: 0 };

  constructor(
    private scene: GameScene,
    private keys: { bowl: string; lid: string; own: string; other: string },
  ) {
    this.bowlArt = scene.add.image(0, 0, keys.bowl);
    this.lidArt = scene.add.image(0, 0, keys.lid);
    this.bowlShadow = scene.add.graphics();
    this.lidShadow = scene.add.graphics();
    this.bowl = scene.add.container(0, 0, [this.bowlShadow, this.bowlArt]).setDepth(5);
    this.lid = scene.add.container(0, 0, [this.lidShadow, this.lidArt]).setDepth(6);
    this.reserve = Array.from({ length: 181 }, (_, i) => {
      const stone = scene.add
        .image(0, 0, keys.own)
        .setAngle((i * 47) % 360)
        .setVisible(false);
      this.bowl.add(stone);
      return stone;
    });
  }

  private point(index: number, diameter: number) {
    const layer = Math.floor(index / 37);
    const slot = index % 37;
    const angle = slot * GOLDEN_ANGLE + layer * 0.71;
    const radius = Math.sqrt((slot + 0.5) / 37) * diameter * 0.285;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  layout(at: { x: number; y: number; lidX: number; lidY: number; diameter: number }) {
    this.scene.runtime.cancelTweens(this.bowl);
    this.scene.runtime.cancelTweens(this.lid);
    this.diameter = at.diameter;
    this.lidDiameter = at.diameter * 0.82;
    this.home = { x: at.lidX, y: at.lidY };
    this.bowl.setPosition(at.x, at.y).setAngle(0).setScale(1);
    this.lid.setPosition(at.lidX, at.lidY).setAngle(0).setScale(1);
    this.bowlArt.setDisplaySize(at.diameter, at.diameter);
    this.lidArt.setDisplaySize(this.lidDiameter, this.lidDiameter);
    for (const [shadow, diameter] of [
      [this.bowlShadow, this.diameter],
      [this.lidShadow, this.lidDiameter],
    ] as const) {
      shadow.clear();
      for (let i = 8; i > 0; i--)
        shadow
          .fillStyle(0x071b19, 0.06)
          .fillCircle(diameter * 0.035, diameter * 0.05, diameter * (0.38 + i * 0.008));
    }
    this.arrange(this.reserve, this.diameter, this.remaining);
    this.arrange(this.prisoners, this.lidDiameter, this.captured);
  }

  private arrange(images: Phaser.GameObjects.Image[], diameter: number, count: number) {
    images.forEach((image, i) => {
      const at = this.point(i, diameter);
      this.scene.runtime.cancelTweens(image);
      image
        .setPosition(at.x, at.y)
        .setDisplaySize(diameter * 0.13, diameter * 0.13)
        .setVisible(i < count)
        .setAlpha(1);
    });
  }

  sync(remaining: number, captured: number, animate = true) {
    remaining = Math.max(0, Math.min(181, remaining));
    // Dense captures stack naturally; bound sprites without changing the reported count.
    const visibleCaptures = Math.min(181, captured);
    while (this.prisoners.length < visibleCaptures) {
      const image = this.scene.add.image(0, 0, this.keys.other).setVisible(false);
      this.prisoners.push(image);
      this.lid.add(image);
    }
    if (!animate) {
      this.remaining = remaining;
      this.captured = visibleCaptures;
      this.arrange(this.reserve, this.diameter, remaining);
      this.arrange(this.prisoners, this.lidDiameter, visibleCaptures);
      return;
    }
    if (remaining !== this.remaining) {
      this.reserve.forEach((image, i) => {
        if (i >= remaining && i < this.remaining) {
          this.scene.runtime.cancelTweens(image);
          this.scene.runtime.tween({
            targets: image,
            alpha: 0,
            duration: 160,
            onComplete: () => image.setVisible(false),
          });
        } else if (i < remaining) image.setVisible(true).setAlpha(1);
      });
      this.scene.runtime.cancelTweens(this.bowl);
      this.bowl.setAngle(0);
      this.scene.runtime.tween({
        targets: this.bowl,
        angle: 1.2,
        duration: 90,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
    if (visibleCaptures > this.captured) {
      for (let i = this.captured; i < visibleCaptures; i++) {
        const image = this.prisoners[i];
        if (!image) continue;
        const at = this.point(i, this.lidDiameter);
        image
          .setPosition(at.x, at.y)
          .setDisplaySize(this.lidDiameter * 0.13, this.lidDiameter * 0.13)
          .setVisible(true)
          .setAlpha(0);
        this.scene.runtime.tween({
          targets: image,
          alpha: 1,
          delay: 380 + (i - this.captured) * 28,
          duration: 90,
        });
      }
      this.scene.runtime.cancelTweens(this.lid);
      this.lid.setPosition(this.home.x, this.home.y).setScale(1).setAngle(0);
      this.scene.runtime.tween({
        targets: this.lid,
        angle: -2,
        delay: 350,
        duration: 90,
        yoyo: true,
        ease: 'Sine.easeInOut',
      });
    }
    this.remaining = remaining;
    this.captured = visibleCaptures;
  }

  captureXY(index: number) {
    const point = this.point(Math.min(180, index), this.lidDiameter);
    return { x: this.home.x + point.x, y: this.home.y + point.y, size: this.lidDiameter * 0.13 };
  }

  open() {
    this.scene.runtime.cancelTweens(this.lid);
    this.lid.setPosition(this.bowl.x, this.bowl.y).setAngle(-18).setScale(1.15);
    this.scene.runtime.tween({
      targets: this.lid,
      x: this.home.x,
      y: this.home.y,
      angle: 0,
      scale: 1,
      duration: 480,
      ease: 'Cubic.easeInOut',
    });
  }
}
