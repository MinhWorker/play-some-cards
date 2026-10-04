import type { FlowContext } from '@psc/sdk/client';
import type Phaser from 'phaser';

/** Two steel doors over the entire camera, owned by the pawn's scoped jail journey. */
export class JailGateEffect {
  readonly doors: Phaser.GameObjects.Graphics[];
  visible = false;
  closure = 0;
  stage: 'hidden' | 'closing' | 'recoil' | 'settling' | 'fading' = 'hidden';
  private left = 0;
  private top = 0;
  private halfWidth = 0;

  constructor(private readonly scene: Phaser.Scene) {
    this.doors = [0, 1].map(() => scene.add.graphics().setDepth(50).setVisible(false));
  }

  private layout() {
    const camera = this.scene.cameras.main;
    this.left = camera.scrollX;
    this.top = camera.scrollY;
    this.halfWidth = camera.width / camera.zoom / 2;
    const height = camera.height / camera.zoom;
    // Bake the geometry once per journey. Only transforms and alpha change during playback.
    this.doors.forEach((door, side) => {
      door.clear();
      const steel = (x: number, y: number, width: number, length: number) => {
        door.fillStyle(0x10161d, 0.6).fillRect(x + 4, y + 5, width + 3, length);
        door.fillStyle(0x25323c).fillRect(x, y, width, length);
        door.fillStyle(0x687d8a).fillRect(x + 2, y, Math.max(2, width * 0.3), length);
        door.fillStyle(0xb0bcc3, 0.7).fillRect(x + 2, y, 2, length);
        door.fillStyle(0x151f28).fillRect(x + width - 3, y, 3, length);
      };
      const bars = Math.max(5, Math.round(this.halfWidth / 54));
      for (let i = 1; i < bars; i++) steel((i * this.halfWidth) / bars - 6, 0, 12, height);
      steel(0, 0, 18, height);
      steel(this.halfWidth - 18, 0, 18, height);
      for (const y of [0, height * 0.22, height * 0.78, height - 24]) {
        steel(0, y, this.halfWidth, 24);
        for (let i = 0; i <= bars; i++) {
          const x = Math.min(this.halfWidth - 9, Math.max(9, (i * this.halfWidth) / bars));
          door.fillStyle(0x15202a).fillCircle(x, y + 12, 4);
          door.fillStyle(0x9aaab4).fillCircle(x - 1, y + 11, 2);
        }
      }
      // The two meeting edges carry a heavy latch at the centre of the screen.
      const latchX = side === 0 ? this.halfWidth - 34 : 0;
      steel(latchX, height / 2 - 28, 34, 56);
      door.fillStyle(0x121a22).fillCircle(latchX + 17, height / 2, 5);
    });
    this.place();
  }

  private place() {
    const gap = this.halfWidth * (1 - this.closure);
    this.doors[0]!.setPosition(this.left - gap, this.top);
    this.doors[1]!.setPosition(this.left + this.halfWidth + gap, this.top);
  }

  async play(fx: FlowContext) {
    fx.checkpoint();
    fx.defer(() => this.hide());
    this.closure = 0;
    this.layout();
    this.visible = true;
    this.doors.forEach((door) => {
      door.setAlpha(1).setVisible(true);
    });
    this.stage = 'closing';
    await fx.tween({
      targets: this,
      closure: 1,
      duration: 240,
      ease: 'Cubic.In',
      onUpdate: () => this.place(),
    });
    fx.checkpoint();
    this.stage = 'recoil';
    await fx.tween({
      targets: this,
      closure: 0.965,
      duration: 85,
      ease: 'Quad.Out',
      onUpdate: () => this.place(),
    });
    fx.checkpoint();
    this.stage = 'settling';
    await fx.tween({
      targets: this,
      closure: 1,
      duration: 100,
      ease: 'Quad.In',
      onUpdate: () => this.place(),
    });
    await fx.wait(80);
    fx.checkpoint();
    this.stage = 'fading';
    await fx.tween({ targets: this.doors, alpha: 0, duration: 260, ease: 'Sine.Out' });
  }

  hide() {
    this.visible = false;
    this.stage = 'hidden';
    this.doors.forEach((door) => {
      door.setVisible(false);
    });
  }
}
