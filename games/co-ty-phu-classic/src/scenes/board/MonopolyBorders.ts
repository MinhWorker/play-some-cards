import type Phaser from 'phaser';
import { BOARD, GROUP_COLORS, type Property } from '../../game/model.js';
import { BOARD_FACES } from './boardGeometry.js';
import { monopolyFrames } from './monopolyFrames.js';
import { MONOPOLY_FRAGMENT } from './monopolyShader.js';

type Point = { x: number; y: number };

/** Group outlines follow the projected board; shared edges disappear inside owned runs. */
export class MonopolyBorders {
  private shaders = new Map<string, Phaser.GameObjects.Shader>();
  private elapsed = 0;
  private frames: {
    squares: number[];
    points: Point[];
    color: number;
    count: number;
    ownedCount: number;
  }[] = [];
  constructor(private readonly scene: Phaser.Scene) {}

  layout(
    properties: readonly Property[],
    left: number,
    top: number,
    width: number,
    height: number,
  ) {
    this.frames = monopolyFrames(properties).map(({ squares, group, count, ownedCount }) => {
      const first = BOARD_FACES[squares[0]!]!;
      const last = BOARD_FACES[squares.at(-1)!]!;
      const square = squares[0]!;
      const corners =
        square < 10
          ? [last[0], first[1], first[2], last[3]]
          : square < 20
            ? [last[0], last[1], first[2], first[3]]
            : square < 30
              ? [first[0], last[1], last[2], first[3]]
              : [first[0], first[1], last[2], last[3]];
      const points = corners.map(([x, y]) => ({ x: left + x * width, y: top + y * height }));
      return { squares, points, count, ownedCount, color: GROUP_COLORS[group] };
    });
    const active = new Set<string>();
    for (const { squares, points, color, ownedCount } of this.frames) {
      const key = squares.join('-');
      active.add(key);
      let shader = this.shaders.get(key);
      if (!shader) {
        shader = this.scene.add
          .shader({
            name: `tycoon-monopoly-${key}`,
            shaderName: 'tycoon-monopoly-flow',
            fragmentSource: MONOPOLY_FRAGMENT,
            setupUniforms: (setUniform: (name: string, value: number) => void) =>
              setUniform('uTime', this.elapsed),
          })
          .setDepth(0.55);
        this.shaders.set(key, shader);
      }
      const padding = 0;
      const x = Math.min(...points.map((p) => p.x)) - padding;
      const y = Math.min(...points.map((p) => p.y)) - padding;
      const w = Math.max(...points.map((p) => p.x)) - x + padding;
      const h = Math.max(...points.map((p) => p.y)) - y + padding;
      shader
        .setPosition(x + w / 2, y + h / 2)
        .setSize(w, h)
        .setOrigin(0.5);
      for (const [index, name] of ['uA', 'uB', 'uC', 'uD'].entries()) {
        const p = points[index]!;
        shader.setUniform(name, [p.x - x, p.y - y]);
      }
      shader.setUniform('uSize', [w, h]);
      shader.setUniform('uColor', [
        ((color >> 16) & 255) / 255,
        ((color >> 8) & 255) / 255,
        (color & 255) / 255,
      ]);
      shader.setUniform('uStrength', ownedCount);
      shader.setUniform(
        'uPhase',
        Object.keys(GROUP_COLORS).indexOf(BOARD[squares[0]!]!.group!) * 0.8,
      );
    }
    for (const [key, shader] of this.shaders) {
      if (active.has(key)) continue;
      shader.destroy();
      this.shaders.delete(key);
    }
  }

  update(time: number) {
    this.elapsed = time / 1000;
  }
}
