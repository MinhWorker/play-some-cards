import { seededRng, testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { botMove } from './bot.js';
import type { BotLevel, State } from './model.js';

/** The state after a (X) and b take `moves` ([x, y]) in turn. */
const play = (moves: [number, number][]) => {
  const game = testGame(plugin, ['a', 'b']);
  for (const [x, y] of moves) game.send(game.state.turn, 'place', { x, y });
  return game.state;
};

const move = (state: State, player: string, level: BotLevel, seed = 1) =>
  botMove(state, player, seededRng(seed), level) ?? undefined;

/** Plays a whole game between two computers; returns the winners. */
function botGame(x: BotLevel, o: BotLevel, seed: number) {
  const game = testGame(plugin, ['a', 'b'], { seed });
  const rng = seededRng(seed);
  while (!game.result) {
    const player = game.state.turn;
    const cell = botMove(game.state, player, rng, player === 'a' ? x : o);
    if (cell === null) throw new Error('bot passed on its turn');
    game.send(player, 'place', cell);
  }
  return game.result.winners;
}

describe('caro bot', () => {
  it('waits for its turn and for a running game', () => {
    expect(move(play([]), 'b', 'hard')).toBeUndefined();
    const four = [2, 3, 4, 5].flatMap(
      (x) =>
        [
          [x, 4],
          [x, 6],
        ] as [number, number][],
    );
    expect(move(play([...four, [6, 4]]), 'b', 'hard')).toBeUndefined();
  });

  it('opens in the middle of the empty board', () => {
    expect(move(play([]), 'a', 'hard')).toEqual({ x: 4, y: 4 });
  });

  it('takes a win at every level', () => {
    // a: 2..5 on row 4, b: 2..5 on row 6 (both ends of a's four are free), a to play.
    const state = play(
      [2, 3, 4, 5].flatMap(
        (x) =>
          [
            [x, 4],
            [x, 6],
          ] as [number, number][],
      ),
    );
    for (const level of ['easy', 'normal', 'hard'] as const) {
      expect([
        { x: 1, y: 4 },
        { x: 6, y: 4 },
      ]).toContainEqual(move(state, 'a', level));
    }
  });

  it('blocks from normal up', () => {
    // a: 2..5 on row 4 with 1 taken by b: b must take 6.
    const state = play([
      [2, 4],
      [1, 4],
      [3, 4],
      [7, 7],
      [4, 4],
      [7, 1],
      [5, 4],
    ]);
    for (const level of ['normal', 'hard'] as const) {
      for (const seed of [1, 2, 3]) expect(move(state, 'b', level, seed)).toEqual({ x: 6, y: 4 });
    }
  });

  it('beats easy and always plays legal moves, also on a grown board', () => {
    for (let seed = 1; seed <= 5; seed++) {
      expect(botGame('hard', 'easy', seed)).toEqual(['a']);
      botGame('normal', 'hard', seed);
    }
  });
});
