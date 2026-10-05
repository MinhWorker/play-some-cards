import type Phaser from 'phaser';

type Vec3 = readonly [number, number, number];
type Point = { x: number; y: number };
type Face = { value: number; center: Vec3; normal: Vec3; u: Vec3; v: Vec3 };

const FACES: readonly Face[] = [
  { value: 1, center: [0, 0, 1], normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { value: 6, center: [0, 0, -1], normal: [0, 0, -1], u: [1, 0, 0], v: [0, -1, 0] },
  { value: 2, center: [0, -1, 0], normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { value: 5, center: [0, 1, 0], normal: [0, 1, 0], u: [-1, 0, 0], v: [0, 0, 1] },
  { value: 3, center: [1, 0, 0], normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { value: 4, center: [-1, 0, 0], normal: [-1, 0, 0], u: [0, -1, 0], v: [0, 0, 1] },
];

const PIPS: Record<number, readonly (readonly [number, number])[]> = {
  1: [[0, 0]],
  2: [
    [-0.52, -0.52],
    [0.52, 0.52],
  ],
  3: [
    [-0.52, -0.52],
    [0, 0],
    [0.52, 0.52],
  ],
  4: [
    [-0.52, -0.52],
    [0.52, -0.52],
    [-0.52, 0.52],
    [0.52, 0.52],
  ],
  5: [
    [-0.52, -0.52],
    [0.52, -0.52],
    [0, 0],
    [-0.52, 0.52],
    [0.52, 0.52],
  ],
  6: [
    [-0.52, -0.52],
    [0.52, -0.52],
    [-0.52, 0],
    [0.52, 0],
    [-0.52, 0.52],
    [0.52, 0.52],
  ],
};

const VIEW: Vec3 = [0.21, -0.56, 0.8];
const RIGHT: Vec3 = [0.936, 0.351, 0];
const UP: Vec3 = [-0.281, 0.749, 0.6];
const SPIN_AXES: readonly Vec3[] = [
  [0.83, 0.48, 0.28],
  [-0.4, 0.85, 0.34],
];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];

function rotate(p: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const cross: Vec3 = [
    axis[1] * p[2] - axis[2] * p[1],
    axis[2] * p[0] - axis[0] * p[2],
    axis[0] * p[1] - axis[1] * p[0],
  ];
  return add(add(scale(p, c), scale(cross, s)), scale(axis, dot(axis, p) * (1 - c)));
}

function targetRotation(p: Vec3, value: number): Vec3 {
  switch (value) {
    case 2:
      return rotate(p, [1, 0, 0], -Math.PI / 2);
    case 3:
      return rotate(p, [0, 1, 0], -Math.PI / 2);
    case 4:
      return rotate(p, [0, 1, 0], Math.PI / 2);
    case 5:
      return rotate(p, [1, 0, 0], Math.PI / 2);
    case 6:
      return rotate(p, [1, 0, 0], Math.PI);
    default:
      return p;
  }
}

function color(level: number) {
  const light = Math.round(Math.max(0, Math.min(255, 255 * level)));
  const green = Math.round(Math.max(0, Math.min(255, 245 * level)));
  const blue = Math.round(Math.max(0, Math.min(255, 222 * level)));
  return (light << 16) | (green << 8) | blue;
}

/** Two geometrically rotating cubes. The server's dice values determine the final top faces. */
export class Dice3D {
  static readonly rollDuration = 1080;
  readonly graphics: Phaser.GameObjects.Graphics;
  values: [number, number] = [1, 1];
  settled = false;
  private elapsed = Infinity;
  private cx = 0;
  private cy = 0;
  private size = 25;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setDepth(20).setVisible(false);
  }

  get visible() {
    return this.graphics.visible;
  }

  get alpha() {
    return this.graphics.alpha;
  }

  setPosition(x: number, y: number, tile: number) {
    this.cx = x;
    this.cy = y;
    this.size = Math.max(18, Math.min(34, tile * 0.55));
    if (this.visible) this.render();
  }

  roll(a: number, b: number) {
    this.values = [a, b];
    this.elapsed = 0;
    this.settled = false;
    this.graphics.setVisible(true).setAlpha(1);
    this.render();
  }

  showIdle() {
    this.values = [1, 1];
    this.elapsed = Dice3D.rollDuration;
    this.settled = true;
    this.graphics.setVisible(true).setAlpha(1);
    this.render();
  }

  hide() {
    this.elapsed = Infinity;
    this.settled = false;
    this.graphics.setVisible(false).clear();
  }

  update(delta: number) {
    if (!this.visible) return;
    this.elapsed += delta;
    this.settled = this.elapsed >= Dice3D.rollDuration;
    this.render();
  }

  private polygon(points: readonly Point[], fill: number, border?: number) {
    const graphics = this.graphics;
    graphics.fillStyle(fill);
    graphics.beginPath();
    graphics.moveTo(points[0]!.x, points[0]!.y);
    for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
    graphics.closePath();
    graphics.fillPath();
    if (border !== undefined) {
      graphics.lineStyle(Math.max(1, this.size * 0.065), border, 0.8);
      graphics.strokePath();
    }
  }

  private drawCube(index: number, value: number, progress: number) {
    const size = this.size;
    const landing = Math.min(1, progress);
    const spin = Math.PI * 2 * (index === 0 ? 3.35 : 3.7) * (1 - landing) ** 2;
    const axis = SPIN_AXES[index]!;
    const yaw = index === 0 ? -0.18 : 0.2;
    const orient = (point: Vec3) =>
      rotate(rotate(targetRotation(point, value), [0, 0, 1], yaw), axis, spin);
    const centerX = this.cx + (index === 0 ? -1.3 : 1.3) * size;
    const travel = (1 - landing) * (index === 0 ? -1.5 : 1.5) * size;
    const bounce = Math.abs(Math.sin(landing * Math.PI * 3.3)) * (1 - landing) * size * 1.5;
    const centerY = this.cy - bounce - (1 - landing) * size * 1.2;
    const project = (point: Vec3): Point => {
      const rotated = orient(point);
      return {
        x: centerX + travel + dot(rotated, RIGHT) * size,
        y: centerY - dot(rotated, UP) * size,
      };
    };

    const faces = FACES.flatMap((face) => {
      const normal = orient(face.normal);
      if (dot(normal, VIEW) <= 0.015) return [];
      return [{ face, normal, depth: dot(orient(face.center), VIEW) }];
    }).sort((a, b) => a.depth - b.depth);
    for (const { face, normal } of faces) {
      const onFace = (u: number, v: number): Vec3 =>
        add(add(face.center, scale(face.u, u)), scale(face.v, v));
      const corners = [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const;
      const outer = corners.map(([u, v]) => project(onFace(u, v)));
      const inner = corners.map(([u, v]) => project(onFace(u * 0.91, v * 0.91)));
      const light = 0.76 + 0.18 * Math.max(0, dot(normal, [-0.4, -0.3, 0.86]));
      this.polygon(outer, 0xb38953, 0x8a5d30);
      this.polygon(inner, color(light));
      for (const [u, v] of PIPS[face.value]!) {
        const pip = Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * Math.PI * 2;
          return project(onFace(u + Math.cos(angle) * 0.13, v + Math.sin(angle) * 0.13));
        });
        this.polygon(pip, 0x473323);
      }
    }
  }

  private render() {
    const graphics = this.graphics;
    graphics.clear();
    const progress = Math.min(1, this.elapsed / Dice3D.rollDuration);
    for (let index = 0; index < 2; index++) {
      const x = this.cx + (index === 0 ? -1.3 : 1.3) * this.size;
      graphics.fillStyle(0x644424, 0.2 * progress);
      graphics.fillEllipse(x, this.cy + this.size * 0.68, this.size * 2.3, this.size * 0.65);
      this.drawCube(index, this.values[index]!, progress);
    }
  }
}
