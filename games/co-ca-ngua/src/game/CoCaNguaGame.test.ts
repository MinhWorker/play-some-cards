import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';

/** Plays the amounts in turn: a, b, a, b… */
const race = (...amounts: number[]) => {
  const game = testGame(plugin, ['a', 'b']);
  for (const [i, amount] of amounts.entries()) game.send(i % 2 ? 'b' : 'a', 'add', { amount });
  return game;
};

describe('co-ca-ngua', () => {
  it('starts at 0 with the first player', () => {
    expect(race().state).toEqual({ total: 0, turn: 0 });
  });

  it('rejects moves out of turn and past the target', () => {
    const game = race(3, 3, 3, 3, 3, 3);
    expect(game.error('b', 'add', { amount: 1 })).toBe('Chưa tới lượt bạn');
    expect(game.error('a', 'add', { amount: 4 })).toBe('Nước đi không hợp lệ');
    expect(race(3, 3, 3, 3, 3, 3, 2).error('b', 'add', { amount: 3 })).toBe(
      'Không được vượt quá 21',
    );
  });

  it('whoever reaches 21 wins', () => {
    expect(race(3, 3, 3, 3, 3, 3, 3).result).toEqual({ winners: ['a'] });
  });
});
