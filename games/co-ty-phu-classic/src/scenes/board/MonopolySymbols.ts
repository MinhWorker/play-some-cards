import type Phaser from 'phaser';
import { BOARD, groupSquares, type Property } from '../../game/model.js';
import { SurfaceMarks } from './SurfaceMarks.js';

export type MonopolyMark = { square: number; kind: 'moon' | 'sun'; along: number; lit: boolean };

/** Pairs connect successive same-owner members, including sets separated by special squares. */
export function monopolyMarks(properties: readonly Property[]): MonopolyMark[] {
  return BOARD.flatMap((cell, square) => {
    if (!cell.group) return [];
    const members = groupSquares(cell.group);
    if (square < 20) members.reverse();
    const index = members.indexOf(square);
    const owner = properties[square]?.owner;
    const owned =
      owner === null || owner === undefined
        ? []
        : members.filter((i) => properties[i]?.owner === owner);
    const rank = owned.indexOf(square);
    // In board reading order: [tile] moon -> sun [tile], rotated with the side.
    const marks: MonopolyMark[] = [];
    if (index > 0) marks.push({ square, kind: 'sun', along: 0.13, lit: rank > 0 });
    if (index < members.length - 1)
      marks.push({
        square,
        kind: 'moon',
        along: 0.87,
        lit: rank >= 0 && rank < owned.length - 1,
      });
    return marks;
  });
}

/** Small gold celestial seals read as ink on porcelain, without a border or floating halo. */
export class MonopolySymbols {
  readonly surface: SurfaceMarks;
  private marks: MonopolyMark[] = [];

  constructor(scene: Phaser.Scene) {
    this.surface = new SurfaceMarks(scene, 0.35);
  }

  layout(
    properties: readonly Property[],
    left: number,
    top: number,
    width: number,
    height: number,
  ) {
    this.surface.layout(left, top, width, height);
    this.marks = monopolyMarks(properties);
    for (const mark of this.marks) this.draw(mark);
  }

  private draw({ square, kind, along, lit }: MonopolyMark) {
    const depth = 0.46;
    const ink = lit ? 0xc88a21 : 0x55544e;
    const light = lit ? 0xffedac : 0x848175;
    const radius = 0.082;
    // Two short engraved strokes face the matching seal across the tile seam.
    const direction = kind === 'moon' ? 1 : -1;
    for (const offset of [-0.01, 0.01]) {
      this.surface.shape(
        square,
        along,
        depth,
        [
          { x: direction * 0.049, y: offset - 0.003 },
          { x: direction * 0.108, y: offset - 0.003 },
          { x: direction * 0.108, y: offset + 0.003 },
          { x: direction * 0.049, y: offset + 0.003 },
        ],
        ink,
      );
    }
    if (kind === 'sun') {
      for (let ray = 0; ray < 8; ray++) {
        const angle = (ray * Math.PI) / 4;
        const points = [
          {
            x: Math.cos(angle - 0.16) * radius * 0.78,
            y: Math.sin(angle - 0.16) * radius * 0.78 * 0.52,
          },
          { x: Math.cos(angle) * radius * 1.28, y: Math.sin(angle) * radius * 1.28 * 0.52 },
          {
            x: Math.cos(angle + 0.16) * radius * 0.78,
            y: Math.sin(angle + 0.16) * radius * 0.78 * 0.52,
          },
        ];
        this.surface.shape(square, along, depth, points, ink);
      }
      this.surface.circle(square, along, depth, radius * 0.72, ink);
      this.surface.circle(square, along, depth + 0.001, radius * 0.48, light);
    } else {
      const points = Array.from({ length: 25 }, (_, i) => {
        const angle = Math.PI / 3 + (i * Math.PI) / 18;
        return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius * 0.52 };
      });
      // Concave edge, from the upper tip back to the lower one.
      for (let i = 0; i <= 20; i++) {
        const t = i / 20;
        points.push({
          x: (0.5 - 3 * t * (1 - t)) * radius,
          y: (-Math.sqrt(3) / 2 + Math.sqrt(3) * t) * radius * 0.52,
        });
      }
      this.surface.shape(square, along, depth, points, ink);
      if (lit)
        this.surface.shape(
          square,
          along + 0.008,
          depth + 0.003,
          points.map(({ x, y }) => ({ x: x * 0.72, y: y * 0.72 })),
          light,
        );
    }
  }
}
