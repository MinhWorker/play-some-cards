import { describe, expect, it } from 'vitest';
import { RULES, type Rules, type Side } from './model.js';
import { boardOf, legalMoves, other, play, startBoard } from './rules.js';

const SIMPLE = RULES;

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
    expect([...startBoard(SIMPLE)].filter((c) => c === 'b')).toHaveLength(12);
    expect([...startBoard(SIMPLE)].filter((c) => c === 'w')).toHaveLength(12);
  });

  it('has seven opening moves and seven replies to each', () => {
    const start = startBoard(SIMPLE);
    expect([1, 2].map((d) => perft(start, 'b', SIMPLE, d))).toEqual([7, 49]);
  });

  it('follows a chosen capture to its end (8 × 8)', () => {
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
    const moves = legalMoves(board, 'b', SIMPLE);
    expect(moves).toEqual([
      { path: [sq(5, 0), sq(3, 2), sq(1, 4)], captures: [sq(4, 1), sq(2, 3)] },
    ]);
  });

  it('lets a player pick any capture, not only the one taking the most', () => {
    const board = boardOf(
      '........',
      '........',
      '.....w..',
      '........',
      '.w.w....',
      '..b.....',
      '........',
      '........',
    );
    expect(legalMoves(board, 'b', SIMPLE)).toEqual([
      { path: [sq(5, 2), sq(3, 0)], captures: [sq(4, 1)] },
      { path: [sq(5, 2), sq(3, 4), sq(1, 6)], captures: [sq(4, 3), sq(2, 5)] },
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
    expect(legalMoves(back, 'b', SIMPLE).every((m) => !m.captures.length)).toBe(true);
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
    const moves = legalMoves(crown, 'b', SIMPLE);
    expect(moves).toContainEqual({ path: [sq(2, 1), sq(0, 3)], captures: [sq(1, 2)] });
    expect(play(crown, moves[0] ?? { path: [], captures: [] }, SIMPLE)).toMatchObject({
      crowned: true,
    });
  });
  it('lets kings move and capture along entire diagonals in both directions', () => {
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
    expect(legalMoves(board, 'b', SIMPLE).filter((m) => m.captures.length)).toEqual([
      { path: [sq(3, 2), sq(5, 4)], captures: [sq(4, 3)] },
      { path: [sq(3, 2), sq(6, 5)], captures: [sq(4, 3)] },
      { path: [sq(3, 2), sq(7, 6)], captures: [sq(4, 3)] },
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
    expect(legalMoves(empty, 'b', SIMPLE).map((m) => m.path)).toEqual([
      [sq(3, 2), sq(2, 1)],
      [sq(3, 2), sq(1, 0)],
      [sq(3, 2), sq(2, 3)],
      [sq(3, 2), sq(1, 4)],
      [sq(3, 2), sq(0, 5)],
      [sq(3, 2), sq(4, 1)],
      [sq(3, 2), sq(5, 0)],
      [sq(3, 2), sq(4, 3)],
      [sq(3, 2), sq(5, 4)],
      [sq(3, 2), sq(6, 5)],
      [sq(3, 2), sq(7, 6)],
    ]);
  });

  it.each(['b', 'w'] as const)(
    'allows %s to decline a capture with the same or another piece',
    (side) => {
      const cells = Array(64).fill('.');
      const row = side === 'b' ? 5 : 2;
      const nextRow = side === 'b' ? 4 : 3;
      const landRow = side === 'b' ? 3 : 4;
      const col = side === 'b' ? 2 : 3;
      cells[sq(row, col)] = side;
      cells[sq(nextRow, col - 1)] = other(side);
      cells[sq(row, col + 4)] = side;
      const moves = legalMoves(cells.join(''), side, SIMPLE);
      expect(moves).toContainEqual({
        path: [sq(row, col), sq(landRow, col - 2)],
        captures: [sq(nextRow, col - 1)],
      });
      expect(moves).toContainEqual({ path: [sq(row, col), sq(nextRow, col + 1)], captures: [] });
      expect(moves).toContainEqual({
        path: [sq(row, col + 4), sq(nextRow, col + 3)],
        captures: [],
      });
    },
  );

  it('lets either king capture a distant enemy, with any clear landing beyond it', () => {
    for (const side of ['b', 'w'] as const) {
      const cells = Array(64).fill('.');
      cells[sq(7, 0)] = side.toUpperCase();
      cells[sq(3, 4)] = other(side);
      const board = cells.join('');
      const moves = legalMoves(board, side, SIMPLE);
      expect(moves.filter((m) => m.captures.length)).toEqual(
        [1, 2, 3].map((distance) => ({
          path: [sq(7, 0), sq(3 - distance, 4 + distance)],
          captures: [sq(3, 4)],
        })),
      );
      const move = moves.find((m) => m.path[1] === sq(0, 7));
      expect(move).toBeDefined();
      const result = play(board, move ?? { path: [], captures: [] }, SIMPLE);
      expect(result.board[sq(0, 7)]).toBe(side.toUpperCase());
      expect(result.board[sq(3, 4)]).toBe('.');
      expect(result.taken).toEqual([other(side)]);
    }
  });

  it('blocks kings at friendly pieces and prevents jumping two adjacent enemies', () => {
    for (const blockers of ['bb', 'ww', 'wb']) {
      const cells = Array(64).fill('.');
      cells[sq(7, 0)] = 'B';
      cells[sq(4, 3)] = blockers[0];
      cells[sq(3, 4)] = blockers[1];
      expect(legalMoves(cells.join(''), 'b', SIMPLE).filter((m) => m.path[0] === sq(7, 0))).toEqual(
        [
          { path: [sq(7, 0), sq(6, 1)], captures: [] },
          { path: [sq(7, 0), sq(5, 2)], captures: [] },
        ],
      );
    }
  });

  it('follows flying-king captures without crossing or taking the same enemy twice', () => {
    const cells = Array(64).fill('.');
    cells[sq(5, 0)] = 'B';
    cells[sq(3, 2)] = 'w';
    cells[sq(3, 4)] = 'w';
    const moves = legalMoves(cells.join(''), 'b', SIMPLE).filter((m) => m.captures.length);
    expect(moves).toContainEqual({
      path: [sq(5, 0), sq(2, 3), sq(4, 5)],
      captures: [sq(3, 2), sq(3, 4)],
    });
    expect(moves.some((m) => m.path.length === 2 && m.path[1] === sq(2, 3))).toBe(false);
    for (const move of moves) {
      expect(new Set(move.captures).size).toBe(move.captures.length);
      expect(move.captures.length).toBeLessThanOrEqual(2);
    }
  });
});
