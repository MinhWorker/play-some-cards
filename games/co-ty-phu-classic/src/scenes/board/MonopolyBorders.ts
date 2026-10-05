import type Phaser from 'phaser';
import { BOARD, GROUP_COLORS, type Property } from '../../game/model.js';
import { BOARD_CELLS } from './boardGeometry.js';
import { monopolyFrames } from './monopolyFrames.js';

type Point = { x: number; y: number };

/** Group outlines follow the projected board; shared edges disappear inside owned runs. */
export class MonopolyBorders {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private frames: { points: Point[]; color: number; count: number }[] = [];
  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(0.3);
  }

  layout(
    properties: readonly Property[],
    left: number,
    top: number,
    width: number,
    height: number,
  ) {
    this.frames = monopolyFrames(properties).map(({ squares, count }) => {
      const points = squares.flatMap((square) =>
        BOARD_CELLS[square]!.map(([x, y]) => ({ x: left + x * width, y: top + y * height })),
      );
      return { points: hull(points), count, color: GROUP_COLORS[BOARD[squares[0]!]!.group!] };
    });
    this.update(0);
  }

  update(time: number) {
    const g = this.graphics.clear();
    for (const { points, color, count } of this.frames) {
      const first = points[0];
      if (!first) continue;
      const pulse = 0.65 + 0.35 * Math.sin(time / 170);
      for (const [width, alpha] of count === 3
        ? [
            [13, 0.12 * pulse],
            [8, 0.3 * pulse],
            [3, 1],
          ]
        : count === 2
          ? [
              [7, 0.14],
              [3, 0.9],
            ]
          : [[2, 0.65]]) {
        g.lineStyle(width!, color, alpha!);
        g.beginPath().moveTo(first.x, first.y);
        for (const point of points.slice(1)) g.lineTo(point.x, point.y);
        g.closePath().strokePath();
      }
      if (count !== 3) continue;
      g.lineStyle(1, 0xffedc4, 0.75).beginPath().moveTo(first.x, first.y);
      for (const point of points.slice(1)) g.lineTo(point.x, point.y);
      g.closePath().strokePath();
      // Small tongues flicker along the perimeter, with hot white cores and colored tails.
      points.forEach((from, edge) => {
        const to = points[(edge + 1) % points.length]!;
        const length = Math.hypot(to.x - from.x, to.y - from.y);
        const sparks = Math.max(2, Math.floor(length / 13));
        for (let i = 0; i < sparks; i++) {
          const t = (i / sparks + time / 4800) % 1;
          const x = from.x + (to.x - from.x) * t;
          const y = from.y + (to.y - from.y) * t;
          const flame = 3 + 5 * (0.5 + 0.5 * Math.sin(time / 110 + i * 3 + edge));
          g.lineStyle(3, color, 0.7).lineBetween(x, y, x + Math.sin(i) * 2, y - flame);
          g.fillStyle(0xfff4ce, 0.7).fillCircle(x, y, 1.2);
        }
      });
    }
  }
}

/** Convex outline of consecutive rectangular tiles after perspective projection. */
function hull(points: Point[]) {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (a: Point, b: Point, c: Point) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const half = (list: Point[]) => {
    const result: Point[] = [];
    for (const p of list) {
      while (result.length > 1 && cross(result[result.length - 2]!, result.at(-1)!, p) <= 0)
        result.pop();
      result.push(p);
    }
    return result.slice(0, -1);
  };
  return [...half(sorted), ...half(sorted.reverse())];
}
