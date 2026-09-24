import { describe, expect, it } from 'vitest';
import { ticTacToe, winningLine } from './index.js';

const rng = () => 0;

function play(cells: number[]) {
  let state = ticTacToe.setup(['a', 'b'], rng);
  for (const cell of cells) {
    const error = ticTacToe.validateMove(state, { cell }, state.turn);
    if (error) throw new Error(error);
    state = ticTacToe.applyMove(state, { cell }, state.turn, rng);
  }
  return state;
}

describe('tic-tac-toe', () => {
  it('starts with player a (X)', () => {
    expect(play([]).turn).toBe('a');
  });

  it('rejects moves out of turn', () => {
    const state = play([]);
    expect(ticTacToe.validateMove(state, { cell: 0 }, 'b')).toBe('Chưa tới lượt bạn');
  });

  it('rejects taken cells', () => {
    const state = play([4]);
    expect(ticTacToe.validateMove(state, { cell: 4 }, 'b')).toBe('Ô này đã có người đánh');
  });

  it('detects a win', () => {
    // a: 0,1,2  b: 3,4
    expect(ticTacToe.getResult(play([0, 3, 1, 4, 2]))).toEqual({ winners: ['a'] });
  });

  it('detects a draw', () => {
    expect(ticTacToe.getResult(play([0, 1, 2, 4, 3, 5, 7, 6, 8]))).toEqual({ winners: [] });
  });

  it('reports the winning line', () => {
    expect(winningLine(play([0, 3, 1, 4, 2]).board)).toEqual([0, 1, 2]);
    expect(winningLine(play([0, 1, 2, 4, 3, 5, 7, 6, 8]).board)).toBeNull();
  });
});
