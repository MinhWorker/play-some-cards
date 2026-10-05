import { describe, expect, it } from 'vitest';
import { DICE_MOTIONS, dicePose } from './diceMotion.js';

describe('dice motion trajectories', () => {
  for (const motion of DICE_MOTIONS) {
    it(`${motion} lands exactly, with finite positions and a normalized spin axis`, () => {
      for (const index of [0, 1] as const) {
        for (let frame = 0; frame <= 120; frame++) {
          const pose = dicePose(motion, index, frame / 120);
          expect(Number.isFinite(pose.x + pose.lift + pose.spin)).toBe(true);
          expect(pose.lift).toBeGreaterThanOrEqual(0);
          expect(Math.hypot(...pose.axis)).toBeCloseTo(1, 10);
        }
        const landed = dicePose(motion, index, 1);
        expect([landed.x, landed.lift, landed.spin]).toEqual([0, 0, 0]);
        expect(dicePose(motion, index, 2)).toEqual(landed);
      }
    });
  }

  it('adds three distinct paths to the original tumble', () => {
    const trajectories = DICE_MOTIONS.map((motion) =>
      [0.2, 0.5, 0.8].map((t) => {
        const { x, lift } = dicePose(motion, 0, t);
        return [x, lift];
      }),
    );
    expect(new Set(trajectories.map((path) => JSON.stringify(path))).size).toBe(4);
  });

  it('keeps the spiraling dice apart instead of crossing through each other', () => {
    for (let frame = 0; frame <= 120; frame++) {
      const left = -1.3 + dicePose('spiral', 0, frame / 120).x;
      const right = 1.3 + dicePose('spiral', 1, frame / 120).x;
      expect(right - left).toBeGreaterThanOrEqual(2.6);
    }
  });
});
