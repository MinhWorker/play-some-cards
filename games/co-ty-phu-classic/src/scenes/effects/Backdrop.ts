import type Phaser from 'phaser';

let nextId = 0;

/**
 * Behind a floating panel (the rent table, the trade offer): everything drawn below `depth` is
 * captured, blurred and darkened, and taps on it don't reach the board.
 */
export class Backdrop {
  private readonly capture: Phaser.GameObjects.CaptureFrame;
  private readonly blurred: Phaser.GameObjects.Image;
  private readonly shade: Phaser.GameObjects.Rectangle;
  visible = false;

  constructor(
    private readonly scene: Phaser.Scene,
    depth: number,
    onTap?: () => void,
  ) {
    const key = `co-ty-phu-classic.backdrop.${nextId++}`;
    this.capture = scene.add.captureFrame(key).setDepth(depth).setVisible(false);
    this.blurred = scene.add
      .image(0, 0, key)
      .setOrigin(0)
      .setDepth(depth + 0.01);
    this.blurred.enableFilters().filters?.internal.addBlur(1, 2, 2, 1.4, 0xffffff, 6);
    this.shade = scene.add
      .rectangle(0, 0, 10, 10, 0x1d140c, 0.45)
      .setOrigin(0)
      .setDepth(depth + 0.02)
      .setInteractive()
      .on('pointerup', () => onTap?.());
    this.hide();
  }

  show() {
    const camera = this.scene.cameras.main;
    // What the camera shows, in world units (its origin is the top-left corner).
    const x = camera.scrollX;
    const y = camera.scrollY;
    const width = camera.width / camera.zoom;
    const height = camera.height / camera.zoom;
    this.visible = true;
    camera.setForceComposite(true);
    this.capture.setVisible(true);
    this.blurred.setVisible(true).setPosition(x, y).setDisplaySize(width, height);
    this.shade.setVisible(true).setPosition(x, y).setSize(width, height);
    this.shade.input?.hitArea.setTo(0, 0, width, height);
  }

  hide() {
    this.visible = false;
    this.scene.cameras.main.setForceComposite(false);
    this.capture.setVisible(false);
    this.blurred.setVisible(false);
    this.shade.setVisible(false);
  }
}
