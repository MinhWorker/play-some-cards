import { seededRng, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { botMove } from './bot.js';
import type { BotLevel, Options, State } from './model.js';

/** The state after a (X) and b take `cells` in turn. */
const play = (cells: number[], size: Options['size'] = 3) => {
  const game = testGame(plugin, ['a', 'b'], { options: { size } });
  for (const cell of cells) game.send(game.state.turn, 'place', { cell });
  return game.state;
};

const move = (state: State, player: string, level: BotLevel, seed = 1) =>
  botMove(state, player, seededRng(seed), level) ?? undefined;

/** Plays a whole game between two computers; returns the winners. */
function botGame(x: BotLevel, o: BotLevel, seed: number, size: Options['size'] = 3) {
  const game = testGame(plugin, ['a', 'b'], { options: { size }, seed });
  const rng = seededRng(seed);
  while (!game.result) {
    const player = game.state.turn;
    const cell = botMove(game.state, player, rng, player === 'a' ? x : o);
    if (cell === null) throw new Error('bot passed on its turn');
    game.send(player, 'place', { cell });
  }
  return game.result.winners;
}

describe('caro bot', () => {
  it('waits for its turn and for a running game', () => {
    expect(move(play([]), 'b', 'hard')).toBeUndefined();
    expect(move(play([0, 3, 1, 4, 2]), 'b', 'hard')).toBeUndefined();
  });

  it('takes a win at every level', () => {
    // a: 0,1  b: 3,4, a to play: 2 wins.
    for (const level of ['easy', 'normal', 'hard'] as const) {
      expect(move(play([0, 3, 1, 4]), 'a', level)).toBe(2);
    }
  });

  it('blocks from normal up', () => {
    // a: 0,1 threatens 2; b must block.
    for (const level of ['normal', 'hard'] as const) {
      for (const seed of [1, 2, 3]) expect(move(play([0, 4, 1]), 'b', level, seed)).toBe(2);
    }
  });

  it('never loses on hard 3×3', () => {
    for (let seed = 1; seed <= 30; seed++) {
      expect(botGame('easy', 'hard', seed)).not.toEqual(['a']);
      expect(botGame('hard', 'normal', seed)).not.toEqual(['b']);
      expect(botGame('hard', 'hard', seed)).toEqual([]);
    }
  });

  it('opens in the middle of a big empty board', () => {
    expect(move(play([], 9), 'a', 'hard')).toBe(40);
  });

  it('wins and blocks on big boards', () => {
    // 6×6, a: 0,1,2 (needs 4), b: 30,31. a to play wins at 3.
    expect(move(play([0, 30, 1, 31, 2], 6), 'b', 'normal')).toBe(3);
    // 9×9, a has an open four 10,11,12,13 on row 1; b must block one end.
    const state = play([10, 70, 11, 71, 12, 72, 13], 9);
    expect([9, 14]).toContain(move(state, 'b', 'normal'));
  });

  it('beats easy on big boards and always plays legal moves', () => {
    for (const size of [6, 9] as const) {
      for (let seed = 1; seed <= 5; seed++) {
        expect(botGame('hard', 'easy', seed, size)).toEqual(['a']);
        botGame('normal', 'hard', seed, size);
      }
    }
  });
});
