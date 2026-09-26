import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';

describe('counter', () => {
  it('starts at 0', () => {
    expect(testGame(plugin, ['a', 'b']).state).toEqual({ count: 0, presses: [0, 0] });
  });

  it('counts every press, per seat too', () => {
    const game = testGame(plugin, ['a', 'b'])
      .send('a', 'press')
      .send('a', 'press')
      .send('b', 'press');
    expect(game.state).toEqual({ count: 3, presses: [2, 1] });
    expect(game.result).toBeNull();
  });

  it('works alone', () => {
    expect(testGame(plugin, ['a']).send('a', 'press').state).toEqual({ count: 1, presses: [1] });
  });

  it('refuses unknown events and strangers', () => {
    const game = testGame(plugin, ['a', 'b']);
    expect(game.error('a', 'jump')).toBe('Nước đi không hợp lệ');
    expect(game.error('zed', 'press')).toBe('Bạn không ngồi ở bàn này');
  });
});
