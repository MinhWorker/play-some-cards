export const DICE_MOTIONS = ['tumble', 'arc', 'skipping', 'spiral'] as const;
export type DiceMotion = (typeof DICE_MOTIONS)[number];
export type Vec3 = readonly [number, number, number];

const AXES: Record<DiceMotion, readonly [Vec3, Vec3]> = {
  tumble: [
    [0.83, 0.48, 0.28],
    [-0.4, 0.85, 0.34],
  ],
  arc: [
    [1, 0.25, 0.12],
    [-0.85, 0.35, 0.15],
  ],
  skipping: [
    [0.3, 1, 0.2],
    [-0.25, 0.95, -0.2],
  ],
  spiral: [
    [0.35, 0.25, 1],
    [-0.35, 0.2, -1],
  ],
};

/** Offsets are in die-size units; every trajectory settles at exactly the same pose. */
export function dicePose(motion: DiceMotion, index: 0 | 1, progress: number) {
  const t = Math.max(0, Math.min(1, progress));
  const remaining = 1 - t;
  const side = index === 0 ? -1 : 1;
  const rawAxis = AXES[motion][index];
  const length = Math.hypot(...rawAxis);
  const axis: Vec3 = [rawAxis[0] / length, rawAxis[1] / length, rawAxis[2] / length];
  let x: number;
  let lift: number;
  let turns: number;
  switch (motion) {
    case 'arc':
      x = side * (2.7 * remaining - Math.sin(t * Math.PI) * remaining);
      lift = Math.sin(t * Math.PI) * 3.3 + remaining * 0.8;
      turns = index === 0 ? 2.8 : 3.4;
      break;
    case 'skipping':
      x = side * remaining * (2.2 + Math.sin(t * Math.PI * 4) * 0.65);
      lift = Math.abs(Math.sin(t * Math.PI * 5)) * remaining * 2 + remaining * 0.4;
      turns = index === 0 ? 4.6 : 4.1;
      break;
    case 'spiral':
      x = Math.sin(t * Math.PI * 3) * remaining * 1.1 + side * remaining * 1.5;
      lift = remaining * (1.8 + Math.sin(t * Math.PI * 3 + index * Math.PI) * 0.7);
      turns = index === 0 ? 4.2 : 4.8;
      break;
    default:
      x = side * 1.5 * remaining;
      lift = Math.abs(Math.sin(t * Math.PI * 3.3)) * remaining * 1.5 + remaining * 1.2;
      turns = index === 0 ? 3.35 : 3.7;
  }
  // Remove trigonometric rounding at the terminal frame, including the high-arc throw.
  if (t === 1) {
    x = 0;
    lift = 0;
  }
  return { x, lift, axis, spin: Math.PI * 2 * turns * remaining ** 2 };
}
