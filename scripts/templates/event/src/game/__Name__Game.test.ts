import { EVENT_POINTS, testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { MAX_POINTS, PICKS } from './__Name__Game.js';

describe('__ID__', () => {
  it('gives the picked points to the event when the picks run out', () => {
    const game = testGame(plugin, ['a']);
    for (let i = 0; i < PICKS; i++) game.send('a', 'pick', {});
    const points = game.state.picked.reduce((sum, p) => sum + p, 0);
    expect(game.state.picked.every((p) => p >= 1 && p <= 3)).toBe(true);
    expect(points).toBeLessThanOrEqual(MAX_POINTS);
    expect(game.result).toEqual({
      winners: ['a'],
      rewards: [{ player: 'a', resource: EVENT_POINTS, amount: points }],
    });
  });

  it('plays the same picks for the same seed', () => {
    const play = () => {
      const game = testGame(plugin, ['a'], { seed: 7 });
      for (let i = 0; i < PICKS; i++) game.send('a', 'pick', {});
      return game.state.picked;
    };
    expect(play()).toEqual(play());
  });
});
