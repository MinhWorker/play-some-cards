import { describe, expect, it } from 'vitest';
import { RULES, type Rules, type Side } from './model.js';
import { boardOf, legalMoves, other, play, startBoard } from './rules.js';

const EN = RULES.english;
const INT = RULES.international;

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
  it('sets out 12 men each on 8 × 8 and 20 each on 10 × 10', () => {
    expect([...startBoard(EN)].filter((c) => c === 'b')).toHaveLength(12);
    expect([...startBoard(EN)].filter((c) => c === 'w')).toHaveLength(12);
    expect([...startBoard(INT)].filter((c) => c === 'w')).toHaveLength(20);
  });

  it('counts the known number of moves from the start, 8 × 8 (perft 1–6)', () => {
    const start = startBoard(EN);
    expect([1, 2, 3, 4, 5, 6].map((d) => perft(start, 'b', EN, d))).toEqual([
      7, 49, 302, 1469, 7361, 36768,
    ]);
  });

  it('counts the known number of moves from the start, 10 × 10 (perft 1–5)', () => {
    const start = startBoard(INT);
    expect([1, 2, 3, 4, 5].map((d) => perft(start, 'w', INT, d))).toEqual([
      9, 81, 658, 4265, 27117,
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

  it('lets 10 × 10 kings fly and requires the longest capture', () => {
    const s = (row: number, col: number) => sq(row, col, 10);
    const board = boardOf(
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '..........',
      '...b......',
      '..........',
      '.b...b....',
      'W.........',
    );
    const moves = legalMoves(board, 'w', INT);
    // The king takes the man next to it, lands on (7, 2), takes (6, 3) and may land on any
    // square beyond it; the lone man on (8, 5) is out of reach, so every move takes two.
    expect(moves.every((m) => m.captures.length === 2)).toBe(true);
    expect(moves.map((m) => m.path[m.path.length - 1]).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual(
      [s(0, 9), s(1, 8), s(2, 7), s(3, 6), s(4, 5), s(5, 4)].sort((a, b) => a - b),
    );
  });
});
