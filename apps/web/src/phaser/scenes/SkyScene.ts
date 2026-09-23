import Phaser from 'phaser';

/** Always-on background: the sky image plus clouds drifting across. */
export class SkyScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Image;
  private clouds: { img: Phaser.GameObjects.Image; speed: number }[] = [];

  constructor() {
    super('sky');
  }

  create() {
    this.sky = this.add.image(0, 0, 'sky').setOrigin(0.5);
    for (let i = 0; i < 6; i++) {
      const img = this.add
        .image(0, 0, i % 2 ? 'cloud-b' : 'cloud-a')
        .setAlpha(Phaser.Math.FloatBetween(0.6, 0.95));
      this.clouds.push({ img, speed: Phaser.Math.FloatBetween(6, 18) });
    }
    this.scene.sendToBack();
    this.layout();
    this.scale.on('resize', this.layout, this);
  }

  private layout() {
    const { width, height } = this.scale;
    this.sky.setPosition(width / 2, height / 2);
    this.sky.setScale(Math.max(width / this.sky.width, height / this.sky.height));
    for (const { img } of this.clouds) {
      img.setScale((Math.min(width, height) / 900) * Phaser.Math.FloatBetween(0.5, 1));
      img.setPosition(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height));
    }
  }

  override update(_time: number, delta: number) {
    const { width } = this.scale;
    for (const { img, speed } of this.clouds) {
      img.x += (speed * delta) / 1000;
      if (img.x - img.displayWidth / 2 > width) img.x = -img.displayWidth / 2;
    }
  }
}
