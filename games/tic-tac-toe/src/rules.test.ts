import { moveError, playMoves } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import plugin from './index.js';
import { winningLine } from './rules.js';

/** Players alternate, starting with a (X). */
const play = (cells: number[]) =>
  playMoves(
    plugin,
    ['a', 'b'],
    cells.map((cell, i) => ({ player: i % 2 ? 'b' : 'a', move: { cell } })),
  );

describe('tic-tac-toe', () => {
  it('starts with player a (X)', () => {
    expect(play([]).state.turn).toBe('a');
  });

  it('rejects moves out of turn', () => {
    expect(moveError(plugin, play([]).state, 'b', { cell: 0 })).toBe('Chưa tới lượt bạn');
  });

  it('rejects taken cells', () => {
    expect(moveError(plugin, play([4]).state, 'b', { cell: 4 })).toBe('Ô này đã có người đánh');
  });

  it('rejects cells off the board', () => {
    expect(moveError(plugin, play([]).state, 'a', { cell: 9 })).toBe('wrong shape');
  });

  it('detects a win', () => {
    // a: 0,1,2  b: 3,4
    expect(play([0, 3, 1, 4, 2]).result).toEqual({ winners: ['a'] });
  });

  it('detects a draw', () => {
    expect(play([0, 1, 2, 4, 3, 5, 7, 6, 8]).result).toEqual({ winners: [] });
  });

  it('reports the winning line', () => {
    expect(winningLine(play([0, 3, 1, 4, 2]).state.board)).toEqual([0, 1, 2]);
    expect(winningLine(play([0, 1, 2, 4, 3, 5, 7, 6, 8]).state.board)).toBeNull();
  });
});
