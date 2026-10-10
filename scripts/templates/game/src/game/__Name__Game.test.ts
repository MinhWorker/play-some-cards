import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { TARGET, WIN_COINS } from './__Name__Game.js';

/** Plays the amounts in turn: a, b, a, b… */
const race = (...amounts: number[]) => {
  const game = testGame(plugin, ['a', 'b']);
  for (const [i, amount] of amounts.entries()) game.send(i % 2 ? 'b' : 'a', 'add', { amount });
  return game;
};

describe('__ID__', () => {
  it('starts at 0 with the first player', () => {
    expect(race().state).toEqual({ total: 0, turn: 0 });
  });

  it('rejects moves out of turn and past the target', () => {
    const game = race(3, 3, 3, 3, 3, 3);
    expect(game.error('b', 'add', { amount: 1 })).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'add', { amount: 4 })).toBe('Nước đi không hợp lệ');
    expect(race(3, 3, 3, 3, 3, 3, 2).error('b', 'add', { amount: 3 })).toBe(
      `Không được vượt quá ${TARGET}`,
    );
  });

  it('whoever reaches 21 wins, and gets the coins', () => {
    expect(race(3, 3, 3, 3, 3, 3, 3).result).toEqual({
      winners: ['a'],
      rewards: [{ player: 'a', resource: 'core:coin', amount: WIN_COINS }],
    });
  });

  it('the computer plays its turns and reaches 21 when it can', () => {
    const game = testGame(plugin, ['a', 'm'], { bots: ['m'], options: { bots: 1 } });
    expect(game.bot('m')).toBeNull();
    for (let i = 0; i < 30 && !game.result; i++) {
      if (game.state.turn === 0) game.send('a', 'add', { amount: 1 });
      else {
        const move = game.bot('m');
        game.send('m', 'add', move?.payload as { amount: number });
      }
    }
    expect(game.result?.winners).toHaveLength(1);
    expect(game.state.total).toBe(TARGET);
  });
});
