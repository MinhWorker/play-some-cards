import { moveError, playMoves } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from '../index.js';
import { winningLine } from './board.js';
import { type Options, optionsSchema } from './model.js';

/** Players alternate, starting with a (the first seat). */
const play = (cells: number[], options: Partial<Options> = {}) => {
  const opts = optionsSchema.parse(options);
  const first = opts.swap ? 'b' : 'a';
  const second = opts.swap ? 'a' : 'b';
  return playMoves(
    plugin,
    ['a', 'b'],
    cells.map((cell, i) => ({ player: i % 2 ? second : first, move: { cell } })),
    1,
    opts,
  );
};

describe('tic-tac-toe', () => {
  it('starts with player a (X) on a 3×3 board', () => {
    const { state } = play([]);
    expect(state).toMatchObject({ turn: 'a', size: 3, win: 3, players: ['a', 'b'] });
    expect(state.board).toHaveLength(9);
  });

  it('rejects moves out of turn', () => {
    expect(moveError(plugin, play([]).state, 'b', { cell: 0 })).toBe('Chưa tới lượt bạn');
  });

  it('rejects taken cells', () => {
    expect(moveError(plugin, play([4]).state, 'b', { cell: 4 })).toBe('Ô này đã có người đánh');
  });

  it('rejects cells off the board', () => {
    expect(moveError(plugin, play([]).state, 'a', { cell: 9 })).toBe('Ô này không có trên bàn');
    expect(moveError(plugin, play([]).state, 'a', { cell: 81 })).toBe('wrong shape');
  });

  it('detects a win', () => {
    // a: 0,1,2  b: 3,4
    expect(play([0, 3, 1, 4, 2]).result).toEqual({ winners: ['a'] });
  });

  it('detects a draw', () => {
    expect(play([0, 1, 2, 4, 3, 5, 7, 6, 8]).result).toEqual({ winners: [] });
  });

  it('reports the winning line', () => {
    expect(winningLine(play([0, 3, 1, 4, 2]).state.board, 3)).toEqual([0, 1, 2]);
    expect(winningLine(play([0, 1, 2, 4, 3, 5, 7, 6, 8]).state.board, 3)).toBeNull();
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
    const { state, result } = play([...moves, 40], { size: 9 });
    expect(result).toEqual({ winners: ['a'] });
    expect(winningLine(state.board, 5)).toEqual([0, 10, 20, 30, 40]);
  });

  it('lets the second seat play X after a swap', () => {
    const { state } = play([], { swap: true });
    expect(state).toMatchObject({ players: ['b', 'a'], turn: 'b' });
    expect(play([0, 3, 1, 4, 2], { swap: true }).result).toEqual({ winners: ['b'] });
  });
});
