import { FRAME, type Frame, followFrame } from '@psc/sdk/client';
import Phaser from 'phaser';
import { Title } from '@/phaser/objects/Title';

/** The title's width in design units. */
const TITLE_WIDTH = 540;
/** A cloud's width at full size in design units (drawn at 50–100% of it). */
const CLOUD_WIDTH = { 'cloud-a': 512, 'cloud-b': 384 };

/**
 * Always-on background: the sky image, the game title (home map only, set through the
 * registry key 'showTitle' by HubScene) and clouds drifting across in front of both. In design
 * units like every scene, but it covers the whole screen (the frame's bleed), notch included.
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
      this.clouds.push({ img, speed: Phaser.Math.FloatBetween(10, 28) });
    }
    this.scene.sendToBack();
    // Parallax: the sky and clouds drift a little when the home map's strip scrolls.
    let lastScroll = 0;
    this.registry.events.on('changedata-hubScroll', (_: unknown, scroll: number) => {
      for (const { img } of this.clouds) img.x -= (scroll - lastScroll) * 0.12;
      lastScroll = scroll;
      this.placeSky(scroll);
    });
    followFrame(this, () => this.layout());
    this.layout();
  }

  private get frame() {
    return this.registry.get(FRAME) as Frame;
  }

  private showTitle(show: boolean, animate: boolean) {
    this.tweens.killTweensOf(this.title);
    if (!animate) this.title.setAlpha(show ? 1 : 0);
    else this.tweens.add({ targets: this.title, alpha: show ? 1 : 0, duration: 300 });
  }

  private layout() {
    const { view, bleed } = this.frame;
    const screenW = bleed.right - bleed.left;
    const screenH = bleed.bottom - bleed.top;
    // 10% larger than the screen, so the parallax shift never shows an edge.
    this.sky.setScale(Math.max(screenW / this.sky.width, screenH / this.sky.height) * 1.1);
    this.placeSky((this.registry.get('hubScroll') as number | undefined) ?? 0);

    // Title centered at the top of the frame, between the profile and the settings button.
    const titleScale = TITLE_WIDTH / this.title.span;
    this.title.setScale(titleScale).setPosition(view.width / 2, 12 - this.title.top * titleScale);
    this.registry.set('titleBottom', this.title.y + this.title.bottom * titleScale);

    this.clouds.forEach(({ img }, i) => {
      // Its texture's size doesn't matter: art exported bigger stays the same size on screen.
      const full = CLOUD_WIDTH[img.texture.key as keyof typeof CLOUD_WIDTH] / img.width;
      // The first two clouds drift across the title so it peeks out from behind them.
      if (i < 2) {
        // Lighter and smaller than the rest, so the title still reads through them.
        img.setScale(full * Phaser.Math.FloatBetween(0.4, 0.5)).setAlpha(0.55);
        img.setPosition(
          Phaser.Math.Between(bleed.left, bleed.right),
          this.title.y + (i ? -20 : 25) * titleScale,
        );
      } else {
        img.setScale(full * Phaser.Math.FloatBetween(0.5, 1));
        img.setPosition(
          Phaser.Math.Between(bleed.left, bleed.right),
          Phaser.Math.Between(bleed.top, bleed.bottom),
        );
      }
    });
  }

  private placeSky(scroll: number) {
    const { bleed } = this.frame;
    const room = (this.sky.displayWidth - (bleed.right - bleed.left)) / 2;
    this.sky.setPosition(
      (bleed.left + bleed.right) / 2 + Phaser.Math.Clamp(-scroll * 0.03, -room, room),
      (bleed.top + bleed.bottom) / 2,
    );
  }

  override update(_time: number, delta: number) {
    const { bleed } = this.frame;
    for (const { img, speed } of this.clouds) {
      img.x += (speed * delta) / 1000;
      if (img.x - img.displayWidth / 2 > bleed.right) img.x = bleed.left - img.displayWidth / 2;
    }
  }
}
