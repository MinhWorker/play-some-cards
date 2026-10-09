import { testGame } from '@xomdao/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { combosOf } from './bot.js';
import { comboOf } from './cards.js';

describe('computer player', () => {
  it('only lists real combinations', () => {
    const hand = [0, 1, 4, 5, 8, 9, 12, 20, 44, 45, 46, 47, 51];
    const combos = combosOf(hand);
    for (const cards of combos) expect(comboOf(cards)).not.toBeNull();
    expect(combos.some((c) => comboOf(c)?.kind === 'pairs')).toBe(true);
    expect(combos.some((c) => comboOf(c)?.kind === 'quad')).toBe(true);
  });

  it('finishes games at every level without a rejected move', () => {
    for (const level of ['easy', 'normal', 'hard'] as const) {
      for (const seed of [1, 2, 3, 4, 5]) {
        const players = ['a', 'b', 'c', 'd'];
        const game = testGame(plugin, players, { seed, options: { level, rounds: 1 } });
        game.fireTimer();
        for (let i = 0; i < 800 && !game.result; i++) {
          const id = players[game.state.turn] as string;
          const move = game.bot(id);
          expect(move).not.toBeNull();
          game.send(id, move?.event as string, move?.payload as object);
        }
        expect(game.result?.winners).toHaveLength(1);
      }
    }
  });

  it('does not play during the deal or out of turn', () => {
    const game = testGame(plugin, ['a', 'b']);
    // Not while the cards are being dealt, nor out of turn.
    expect(game.bot('a') ?? game.bot('b')).toBeNull();
    game.fireTimer();
    const waiting = game.state.turn === 0 ? 'b' : 'a';
    expect(game.bot(waiting)).toBeNull();
  });
});
