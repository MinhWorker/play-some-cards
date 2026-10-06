import { describe, expect, it } from 'vitest';
import { RULES, type Rules, type Side } from './model.js';
import { boardOf, legalMoves, other, play, startBoard } from './rules.js';

const EN = RULES;

/** Moves counted to `depth` plies: the standard check that move generation is right. */
function perft(board: string, side: Side, rules: Rules, depth: number): number {
  const moves = legalMoves(board, side, rules);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(play(board, m, rules).board, other(side), rules, depth - 1);
  return n;
}

/** Square of (row, col) on an 8 × 8 board. */
const sq = (row: number, col: number, size = 8) => row * size + col;

describe('checkers moves', () => {
  it('sets out 12 men each on the standard 8 × 8 board', () => {
    expect([...startBoard(EN)].filter((c) => c === 'b')).toHaveLength(12);
    expect([...startBoard(EN)].filter((c) => c === 'w')).toHaveLength(12);
  });

  it('counts the known number of moves from the start, 8 × 8 (perft 1–6)', () => {
    const start = startBoard(EN);
    expect([1, 2, 3, 4, 5, 6].map((d) => perft(start, 'b', EN, d))).toEqual([
      7, 49, 302, 1469, 7361, 36768,
    ]);
  });

  it('makes taking compulsory, and follows a capture to its end (8 × 8)', () => {
    const board = boardOf(
      '........',
      '........',
      '...w....',
      '........',
      '.w......',
      'b.......',
      '........',
      '........',
    );
    const moves = legalMoves(board, 'b', EN);
    expect(moves).toEqual([
      { path: [sq(5, 0), sq(3, 2), sq(1, 4)], captures: [sq(4, 1), sq(2, 3)] },
    ]);
  });

  it('lets 8 × 8 men take forward only, and stops a man crowned mid-capture', () => {
    const back = boardOf(
      '........',
      '........',
      '........',
      '........',
      '........',
      '..b.....',
      '...w....',
      '........',
    );
    expect(legalMoves(back, 'b', EN).every((m) => !m.captures.length)).toBe(true);
    const crown = boardOf(
      '........',
      '..w.w...',
      '.b......',
      '........',
      '........',
      '........',
      '........',
      '........',
    );
    const moves = legalMoves(crown, 'b', EN);
    expect(moves).toEqual([{ path: [sq(2, 1), sq(0, 3)], captures: [sq(1, 2)] }]);
    expect(play(crown, moves[0] ?? { path: [], captures: [] }, EN)).toMatchObject({
      crowned: true,
    });
  });
  it('lets kings step and capture in both directions, without flying', () => {
    const board = boardOf(
      '........',
      '........',
      '........',
      '..B.....',
      '...w....',
      '........',
      '........',
      '........',
    );
    expect(legalMoves(board, 'b', EN)).toEqual([
      { path: [sq(3, 2), sq(5, 4)], captures: [sq(4, 3)] },
    ]);
    const empty = boardOf(
      '........',
      '........',
      '........',
      '..B.....',
      '........',
      '........',
      '........',
      '........',
    );
    expect(legalMoves(empty, 'b', EN).map((m) => m.path)).toEqual([
      [sq(3, 2), sq(2, 1)],
      [sq(3, 2), sq(2, 3)],
      [sq(3, 2), sq(4, 1)],
      [sq(3, 2), sq(4, 3)],
    ]);
  });
});
