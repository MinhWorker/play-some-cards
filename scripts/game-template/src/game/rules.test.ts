import { moveError, playMoves } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';

const adds = (...values: number[]) =>
  values.map((add, i) => ({ player: i % 2 ? 'b' : 'a', move: { add } }));

describe('__ID__', () => {
  it('starts at 0 with the first player', () => {
    const { state } = playMoves(plugin, ['a', 'b'], []);
    expect(state).toMatchObject({ total: 0, turn: 'a' });
  });

  it('rejects moves out of turn and past the target', () => {
    const { state } = playMoves(plugin, ['a', 'b'], adds(3, 3, 3, 3, 3, 3));
    expect(moveError(plugin, state, 'b', { add: 1 })).toBe('Chưa tới lượt bạn');
    expect(moveError(plugin, state, 'a', { add: 4 })).toBe('wrong shape');
  });

  it('whoever reaches 21 wins', () => {
    const { result } = playMoves(plugin, ['a', 'b'], adds(3, 3, 3, 3, 3, 3, 3));
    expect(result).toEqual({ winners: ['a'] });
  });
});
