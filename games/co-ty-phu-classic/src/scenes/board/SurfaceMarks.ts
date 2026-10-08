import type Phaser from 'phaser';
import { BOARD_FACES } from './boardGeometry.js';

type Point = { x: number; y: number };

/** Ink geometry in a tile's short/long axes, projected inside its visible porcelain face. */
export class SurfaceMarks {
  readonly ink: Phaser.GameObjects.Graphics;
  private place = { left: 0, top: 0, width: 1, height: 1 };

  constructor(scene: Phaser.Scene, depth: number) {
    this.ink = scene.add.graphics().setDepth(depth);
  }

  layout(left: number, top: number, width: number, height: number) {
    this.place = { left, top, width, height };
    this.ink.clear();
  }

  point(square: number, along: number, depth: number): Point {
    const [a, b, c, d] = BOARD_FACES[square]!;
    const side = square > 10 && square < 20 ? 1 : square > 30 && square < 40 ? 3 : 0;
    const u = side === 1 ? depth : side === 3 ? 1 - depth : along;
    const v = side ? along : square < 10 ? 1 - depth : depth;
    const { left, top, width, height } = this.place;
    return {
      x:
        left +
        (a![0] * (1 - u) * (1 - v) + b![0] * u * (1 - v) + c![0] * u * v + d![0] * (1 - u) * v) *
          width,
      y:
        top +
        (a![1] * (1 - u) * (1 - v) + b![1] * u * (1 - v) + c![1] * u * v + d![1] * (1 - u) * v) *
          height,
    };
  }

  shape(
    square: number,
    along: number,
    depth: number,
    points: readonly Point[],
    color: number,
    alpha = 1,
  ) {
    const projected = points.map(({ x, y }) => this.point(square, along + x, depth + y));
    this.ink.fillStyle(color, alpha).beginPath();
    const first = projected[0]!;
    this.ink.moveTo(first.x, first.y);
    for (const point of projected.slice(1)) this.ink.lineTo(point.x, point.y);
    this.ink.closePath().fillPath();
  }

  circle(square: number, along: number, depth: number, radius: number, color: number, alpha = 1) {
    this.shape(
      square,
      along,
      depth,
      Array.from({ length: 32 }, (_, i) => {
        const angle = (i * Math.PI) / 16;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.52 };
      }),
      color,
      alpha,
    );
  }
}
