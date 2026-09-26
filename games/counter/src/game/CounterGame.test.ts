import { playMoves } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';

const press = (player: string) => ({ player, move: { event: 'press' } });

describe('counter', () => {
  it('starts at 0', () => {
    expect(playMoves(plugin, ['a', 'b'], []).state.state).toEqual({ count: 0, presses: [0, 0] });
  });

  it('counts every press, per seat too', () => {
    const { state, result } = playMoves(plugin, ['a', 'b'], [press('a'), press('a'), press('b')]);
    expect(state.state).toEqual({ count: 3, presses: [2, 1] });
    expect(result).toBeNull();
  });

  it('works alone', () => {
    expect(playMoves(plugin, ['a'], [press('a')]).state.state).toEqual({ count: 1, presses: [1] });
  });

  it('refuses unknown events and strangers', () => {
    const { state } = playMoves(plugin, ['a', 'b'], []);
    expect(plugin.rules.validateMove(state, { event: 'jump' }, 'a')).toBe('Nước đi không hợp lệ');
    expect(plugin.rules.validateMove(state, { event: 'press' }, 'zed')).toBe(
      'Bạn không ngồi ở bàn này',
    );
  });
});
