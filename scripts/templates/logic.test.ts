import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import { __Name__Game } from './__Name__Game.js';

describe('__Name__Game', () => {
  it('starts', () => {
    expect(testGame(new __Name__Game(), ['a', 'b']).state).toEqual({ plays: 0 });
  });

  it('counts plays', () => {
    const game = testGame(new __Name__Game(), ['a', 'b']).send('a', 'play').send('b', 'play');
    expect(game.state.plays).toBe(2);
    expect(game.result).toBeNull();
  });
});
