import type Phaser from 'phaser';

type Bounds = { x: number; y: number; w: number; h: number };

/** A short-lived, non-interactive tile preview; it never blocks board input. */
export class TileTooltip {
  private panel: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private detail: Phaser.GameObjects.Text;
  private expiresAt = 0;

  constructor(scene: Phaser.Scene) {
    this.panel = scene.add.graphics().setDepth(30);
    const style = {
      fontFamily: '"Baloo 2"',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#493a28',
    };
    this.title = scene.add.text(0, 0, '', style).setDepth(31);
    this.detail = scene.add
      .text(0, 0, '', { ...style, fontSize: '20px', color: '#70583b' })
      .setDepth(31);
    this.hide();
  }

  show(
    name: string,
    text: string,
    tile: Bounds,
    screen: { width: number; height: number; top: number },
  ) {
    const width = Math.min(210, screen.width - 32);
    this.title
      .setVisible(true)
      .setText(name)
      .setWordWrapWidth(width - 32, true);
    this.detail
      .setVisible(true)
      .setText(text)
      .setWordWrapWidth(width - 32, true);
    const height = this.title.height + this.detail.height + 38;
    const x = Math.max(16, Math.min(screen.width - width - 16, tile.x + tile.w / 2 - width / 2));
    const above = tile.y - height - 10;
    const y = Math.max(
      screen.top + 8,
      Math.min(screen.height - height - 12, above >= screen.top + 8 ? above : tile.y + tile.h + 10),
    );
    this.title.setPosition(x + 16, y + 12);
    this.detail.setPosition(x + 16, y + 18 + this.title.height);
    this.panel.clear().setVisible(true);
    this.panel.fillStyle(0x3d2818, 0.25).fillRoundedRect(x + 3, y + 4, width, height, 12);
    this.panel.fillStyle(0xfff8e5).fillRoundedRect(x, y, width, height, 12);
    this.panel.lineStyle(2, 0xd2a14c).strokeRoundedRect(x, y, width, height, 12);
    this.expiresAt = Date.now() + 2000;
  }

  update() {
    if (this.expiresAt && Date.now() >= this.expiresAt) {
      this.hide();
      return true;
    }
    return false;
  }

  hide() {
    this.panel.clear().setVisible(false);
    this.title.setVisible(false);
    this.detail.setVisible(false);
    this.expiresAt = 0;
  }
}
