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

it('gives separated streets the complete-set effect while only joining touching edges', () => {
  const deeds = BOARD.map(() => ({ owner: null as number | null, houses: 0, mortgaged: false }));
  deeds[6]!.owner = 1;
  deeds[8]!.owner = 1;
  let frames = monopolyFrames(deeds).filter((frame) => frame.group === 'xanh-nhat');
  expect(frames.map((frame) => [frame.squares, frame.ownedCount])).toEqual([
    [[6], 2],
    [[8], 2],
    [[9], 0],
  ]);
  deeds[9]!.owner = 1;
  frames = monopolyFrames(deeds).filter((frame) => frame.group === 'xanh-nhat');
  expect(frames.map((frame) => [frame.squares, frame.ownedCount])).toEqual([
    [[6], 3],
    [[8, 9], 3],
  ]);
  deeds[9]!.owner = 2;
  frames = monopolyFrames(deeds).filter((frame) => frame.group === 'xanh-nhat');
  expect(frames.map((frame) => [frame.squares, frame.ownedCount])).toEqual([
    [[6], 2],
    [[8], 2],
    [[9], 1],
  ]);
});
