import type Phaser from 'phaser';
import { PLAYER_PANEL } from '../board/boardGeometry.js';
import { planePoint } from '../board/boardPlane.js';

let nextId = 0;

/** Quiet jade-and-gold lattice etched into the player panel, leaving its inlays untouched. */
export class PlayerPanelPattern {
  private readonly image: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    private readonly width: number,
    private readonly height: number,
    private readonly offset: { x: number; y: number },
    canvasWidth: number,
    canvasHeight: number,
  ) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const g = canvas.getContext('2d')!;
    const point = (u: number, v: number) => {
      const p = planePoint(u, v);
      return { x: p.x * width - offset.x, y: p.y * height - offset.y };
    };
    const path = (vertices: readonly (readonly [number, number])[]) => {
      g.beginPath();
      vertices.forEach(([u, v], index) => {
        const p = point(u, v);
        if (index === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      });
      g.closePath();
    };
    const rectangle = (u0: number, v0: number, u1: number, v1: number) =>
      path([
        [u0, v0],
        [u1, v0],
        [u1, v1],
        [u0, v1],
      ]);
    g.save();
    rectangle(0.185, 0.185, 0.815, 0.398);
    g.clip();
    const wash = g.createLinearGradient(0, 0, canvas.width, canvas.height);
    wash.addColorStop(0, 'rgba(37,91,77,0.13)');
    wash.addColorStop(0.5, 'rgba(37,91,77,0.06)');
    wash.addColorStop(1, 'rgba(37,91,77,0.15)');
    g.fillStyle = wash;
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.lineWidth = 1.2;
    for (let v = 0.18; v < 0.44; v += 0.046) {
      for (let u = 0.18; u < 0.86; u += 0.046) {
        g.strokeStyle = 'rgba(45,91,76,0.15)';
        path([
          [u, v - 0.023],
          [u + 0.023, v],
          [u, v + 0.023],
          [u - 0.023, v],
        ]);
        g.stroke();
        g.strokeStyle = 'rgba(157,111,40,0.24)';
        path([
          [u, v - 0.006],
          [u + 0.006, v],
          [u, v + 0.006],
          [u - 0.006, v],
        ]);
        g.stroke();
      }
    }
    g.strokeStyle = 'rgba(155,108,34,0.45)';
    g.lineWidth = 2;
    rectangle(0.191, 0.191, 0.809, 0.391);
    g.stroke();
    g.lineWidth = 0.8;
    rectangle(0.196, 0.196, 0.804, 0.386);
    g.stroke();
    g.restore();
    // Preserve the avatar/seat wells, dividing inlay and clock groove baked into the board.
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000000';
    for (const well of [PLAYER_PANEL.avatar, ...PLAYER_PANEL.seats]) {
      const radius = well.r * 1.18;
      path(
        Array.from({ length: 64 }, (_, i) => {
          const angle = (i * Math.PI) / 32;
          return [well.u + Math.cos(angle) * radius, well.v + Math.sin(angle) * radius] as const;
        }),
      );
      g.fill();
    }
    const { u0, u1, v, h } = PLAYER_PANEL.bar;
    rectangle(u0 - 0.012, v - h, u1 + 0.012, v + h);
    g.fill();
    const rule = PLAYER_PANEL.rule;
    rectangle(rule.u - 0.003, rule.v0, rule.u + 0.003, rule.v1);
    g.fill();
    const key = `co-ty-phu-classic.panel-pattern.${nextId++}`;
    scene.textures.addCanvas(key, canvas);
    this.image = scene.add.image(0, 0, key).setOrigin(0).setDepth(5);
    scene.events.once('shutdown', () => {
      this.image.destroy();
      scene.textures.remove(key);
    });
  }

  layout({ left, top, size, imageH }: { left: number; top: number; size: number; imageH: number }) {
    this.image
      .setPosition(
        left + (this.offset.x / this.width) * size,
        top + (this.offset.y / this.height) * imageH,
      )
      .setDisplaySize(
        (this.image.width / this.width) * size,
        (this.image.height / this.height) * imageH,
      );
  }
}
