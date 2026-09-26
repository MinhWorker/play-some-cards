import { testGame } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { winningLine } from './board.js';
import type { Options } from './model.js';

/** A game between a (first seat) and b, playing `cells` in turn: whoever is X starts. */
function play(cells: number[], options: Partial<Options> = {}) {
  const game = testGame(plugin, ['a', 'b'], { options });
  for (const cell of cells) game.send(game.state.turn, 'place', { cell });
  return game;
}

describe('caro', () => {
  it('starts with a (X) on a 3×3 board', () => {
    const { state } = play([]);
    expect(state).toMatchObject({ turn: 'a', size: 3, win: 3, players: ['a', 'b'] });
    expect(state.board).toHaveLength(9);
  });

  it('rejects moves out of turn, on taken cells and off the board', () => {
    const game = play([4]);
    expect(game.error('a', 'place', { cell: 0 })).toBe('Chưa tới lượt bạn');
    expect(game.error('b', 'place', { cell: 4 })).toBe('Ô này đã có người đánh');
    expect(game.error('b', 'place', { cell: 9 })).toBe('Ô này không có trên bàn');
    expect(game.error('b', 'place', { cell: 81 })).toBe('Nước đi không hợp lệ');
  });

  it('detects a win and then refuses moves', () => {
    // a: 0,1,2  b: 3,4
    const game = play([0, 3, 1, 4, 2]);
    expect(game.result).toEqual({ winners: ['a'] });
    expect(winningLine(game.state.board, 3)).toEqual([0, 1, 2]);
    expect(game.error('b', 'place', { cell: 8 })).toBe('Ván đã kết thúc');
  });

  it('detects a draw', () => {
    const game = play([0, 1, 2, 4, 3, 5, 7, 6, 8]);
    expect(game.result).toEqual({ winners: [] });
    expect(winningLine(game.state.board, 3)).toBeNull();
  });

  it('needs 4 in a row on 6×6', () => {
    // a: 0,1,2 (3 in a row is not enough) then 3.  b: 6,7,8
    expect(play([0, 6, 1, 7, 2, 8], { size: 6 }).result).toBeNull();
    expect(play([0, 6, 1, 7, 2, 8, 3], { size: 6 }).result).toEqual({ winners: ['a'] });
  });

  it('needs 5 in a row on 9×9, diagonals too', () => {
    // a on the diagonal 0, 10, 20, 30, 40; b along the bottom row.
    const moves = [0, 80, 10, 79, 20, 78, 30, 77];
    expect(play(moves, { size: 9 }).result).toBeNull();
    const game = play([...moves, 40], { size: 9 });
    expect(game.result).toEqual({ winners: ['a'] });
    expect(winningLine(game.state.board, 5)).toEqual([0, 10, 20, 30, 40]);
  });

  it('lets the second seat play X after a swap', () => {
    expect(play([], { swap: true }).state).toMatchObject({ players: ['b', 'a'], turn: 'b' });
    expect(play([0, 3, 1, 4, 2], { swap: true }).result).toEqual({ winners: ['b'] });
  });

  it('asks the computer only in rooms against it', () => {
    expect(testGame(plugin, ['a', 'b']).bot('a')).toBeNull();
    const vsBot = testGame(plugin, ['a', 'b'], { options: { opponent: 'bot', level: 'hard' } });
    expect(vsBot.bot('b')).toBeNull(); // not its turn
    const move = vsBot.bot('a');
    expect(move).toMatchObject({ event: 'place' });
    vsBot.send('a', 'place', move?.payload as object); // a legal move
  });
});
