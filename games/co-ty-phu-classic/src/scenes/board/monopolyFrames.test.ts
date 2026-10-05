import { expect, it } from 'vitest';
import { BOARD } from '../../game/model.js';
import { monopolyFrames } from './monopolyFrames.js';

it('merges only contiguous same-owner tiles inside one color set', () => {
  const deeds = BOARD.map(() => ({ owner: null as number | null, houses: 0, mortgaged: false }));
  deeds[1]!.owner = 0;
  deeds[2]!.owner = 0;
  deeds[3]!.owner = 1;
  expect(
    monopolyFrames(deeds)
      .slice(0, 2)
      .map((f) => f.squares),
  ).toEqual([[1, 2], [3]]);
  deeds[3]!.owner = 0;
  expect(monopolyFrames(deeds)[0]!.count).toBe(3);
  deeds[2]!.owner = null;
  expect(
    monopolyFrames(deeds)
      .slice(0, 3)
      .map((f) => f.squares),
  ).toEqual([[1], [2], [3]]);
});
