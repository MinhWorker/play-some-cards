import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { horsePoint } from './board.js';

describe('horse-race board coordinates', () => {
  const state = testGame(plugin, ['a', 'b', 'c', 'd']).state;

  it('has one closed, adjacent 52-square track with no duplicate coordinates', () => {
    const points = Array.from({ length: 52 }, (_, position) => horsePoint(state, 0, 0, position));
    expect(new Set(points.map((p) => p.join(','))).size).toBe(52);
    for (const [i, point] of points.entries()) {
      const next = points[(i + 1) % points.length] ?? [];
      expect(
        Math.max(
          Math.abs((point[0] ?? 0) - (next[0] ?? 0)),
          Math.abs((point[1] ?? 0) - (next[1] ?? 0)),
        ),
      ).toBe(1);
    }
  });

  it('aligns each gate with its numbered stable without skipping a board square', () => {
    const gates = [
      [0, 7],
      [7, 0],
      [14, 7],
      [7, 14],
    ];
    const entries = [
      [1, 7],
      [7, 1],
      [13, 7],
      [7, 13],
    ];
    for (let seat = 0; seat < 4; seat++) {
      expect(horsePoint(state, seat, 0, 51)).toEqual(gates[seat]);
      expect(horsePoint(state, seat, 0, 52)).toEqual(entries[seat]);
    }
  });
});
