import Phaser from 'phaser';
import { Title } from '@/phaser/objects/Title';

/**
 * Always-on background: the sky image, the game title (home map only, set through the
 * registry key 'showTitle' by HubScene) and clouds drifting across in front of both.
 */
export class SkyScene extends Phaser.Scene {
  private sky!: Phaser.GameObjects.Image;
  private clouds: { img: Phaser.GameObjects.Image; speed: number }[] = [];
  private title!: Title;

  constructor() {
    super('sky');
  }

  create() {
    this.sky = this.add.image(0, 0, 'sky').setOrigin(0.5);
    this.title = this.add.existing(new Title(this));
    this.showTitle(this.registry.get('showTitle') === true, false);
    this.registry.events.on('changedata-showTitle', (_: unknown, show: boolean) =>
      this.showTitle(show, true),
    );
    for (let i = 0; i < 6; i++) {
      const img = this.add
        .image(0, 0, i % 2 ? 'cloud-b' : 'cloud-a')
        .setAlpha(Phaser.Math.FloatBetween(0.6, 0.95));
      this.clouds.push({ img, speed: Phaser.Math.FloatBetween(6, 18) });
    }
    this.scene.sendToBack();
    // Parallax: the sky and clouds drift a little when the home map's strip scrolls.
    let lastScroll = 0;
    this.registry.events.on('changedata-hubScroll', (_: unknown, scroll: number) => {
      for (const { img } of this.clouds) img.x -= (scroll - lastScroll) * 0.12;
      lastScroll = scroll;
      this.placeSky(scroll);
    });
    this.layout();
    this.scale.on('resize', this.layout, this);
  }

  private showTitle(show: boolean, animate: boolean) {
    this.tweens.killTweensOf(this.title);
    if (!animate) this.title.setAlpha(show ? 1 : 0);
    else this.tweens.add({ targets: this.title, alpha: show ? 1 : 0, duration: 300 });
  }

  private layout() {
    const { width, height } = this.scale;
    // 10% larger than the screen, so the parallax shift never shows an edge.
    this.sky.setScale(Math.max(width / this.sky.width, height / this.sky.height) * 1.1);
    this.placeSky((this.registry.get('hubScroll') as number | undefined) ?? 0);

    // Title centered at the top. On portrait phones it sits below the profile/speaker row.
    const portrait = height > width;
    // Phones held sideways get a smaller title, leaving height for the islands.
    const short = !portrait && height < 500;
    const titleScale = Math.min(
      1,
      (width * (portrait ? 0.86 : short ? 0.3 : 0.5)) / this.title.span,
    );
    const birdsTop = portrait ? 76 : 6;
    this.title.setScale(titleScale).setPosition(width / 2, birdsTop - this.title.top * titleScale);
    this.registry.set('titleBottom', this.title.y + this.title.bottom * titleScale);

    const base = Math.min(width, height) / 900;
    this.clouds.forEach(({ img }, i) => {
      // The first two clouds drift across the title so it peeks out from behind them.
      if (i < 2) {
        // Lighter and smaller than the rest, so the title still reads through them.
        img.setScale(base * Phaser.Math.FloatBetween(0.4, 0.5)).setAlpha(0.55);
        img.setPosition(Phaser.Math.Between(0, width), this.title.y + (i ? -20 : 25) * titleScale);
      } else {
        img.setScale(base * Phaser.Math.FloatBetween(0.5, 1));
        img.setPosition(Phaser.Math.Between(0, width), Phaser.Math.Between(0, height));
      }
    });
  }

  private placeSky(scroll: number) {
    const { width, height } = this.scale;
    const room = (this.sky.displayWidth - width) / 2;
    this.sky.setPosition(width / 2 + Phaser.Math.Clamp(-scroll * 0.03, -room, room), height / 2);
  }

  override update(_time: number, delta: number) {
    const { width } = this.scale;
    for (const { img, speed } of this.clouds) {
      img.x += (speed * delta) / 1000;
      if (img.x - img.displayWidth / 2 > width) img.x = -img.displayWidth / 2;
    }
  }
}
