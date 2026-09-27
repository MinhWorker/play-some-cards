import { describe, expect, it } from 'vitest';
import type { Cell, Side } from './model.js';
import {
  boardOf,
  canMove,
  inCheck,
  legalMoves,
  legalTargets,
  play,
  pseudoTargets,
  START,
  square,
} from './rules.js';

const board = boardOf;

/** Moves counted to `depth` plies: the standard check that move generation is right. */
function perft(b: Cell[], side: Side, depth: number): number {
  if (depth === 0) return 1;
  let n = 0;
  for (const m of legalMoves(b, side)) n += perft(play(b, m), side === 'r' ? 'b' : 'r', depth - 1);
  return n;
}

const sq = square;
const sorted = (a: number[]) => [...a].sort((x, y) => x - y);

describe('xiangqi moves', () => {
  it('counts the known number of moves from the start (perft 1–3)', () => {
    expect(perft(START, 'r', 1)).toBe(44);
    expect(perft(START, 'r', 2)).toBe(1920);
    expect(perft(START, 'r', 3)).toBe(79666);
  });

  it('blocks a horse by its leg and an elephant by its eye', () => {
    // Red horse at (9,1) with its forward leg (8,1) taken: only the sideways jump remains.
    const b = board(
      '....k....',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.P...P...',
      '.N..K.B..',
    );
    expect(pseudoTargets(b, sq(9, 1))).toEqual([sq(8, 3)]);
    // The elephant at (9,6): its eye (8,5) is taken, (8,7) is free.
    expect(pseudoTargets(b, sq(9, 6))).toEqual([sq(7, 8)]);
  });

  it('keeps elephants home and advisors and generals in the palace', () => {
    const b = board(
      '...k.....',
      '.........',
      '.........',
      '.........',
      '.........',
      '..B......',
      '.........',
      '.........',
      '.........',
      '...AK....',
    );
    // From (5,2) it could only cross the river upwards: just the two moves back.
    expect(sorted(pseudoTargets(b, sq(5, 2)))).toEqual([sq(7, 0), sq(7, 4)]);
    expect(pseudoTargets(b, sq(9, 3))).toEqual([sq(8, 4)]);
    expect(sorted(pseudoTargets(b, sq(9, 4)))).toEqual([sq(8, 4), sq(9, 5)]);
  });

  it('lets a cannon take only over exactly one piece', () => {
    const b = board(
      '....k....',
      '.........',
      '.........',
      '....r....',
      '.........',
      '....p....',
      '.........',
      '....C....',
      '.........',
      '...K.....',
    );
    const targets = pseudoTargets(b, sq(7, 4));
    expect(targets).toContain(sq(6, 4)); // a quiet step
    expect(targets).not.toContain(sq(5, 4)); // the screen itself
    expect(targets).toContain(sq(3, 4)); // over the screen
    expect(targets).not.toContain(sq(0, 4)); // two pieces between
  });

  it('moves soldiers sideways only across the river', () => {
    const b = board(
      '....k....',
      '.........',
      '.........',
      '.........',
      '......P..',
      '.........',
      '..P......',
      '.........',
      '.........',
      '...K.....',
    );
    expect(pseudoTargets(b, sq(6, 2))).toEqual([sq(5, 2)]);
    expect(sorted(pseudoTargets(b, sq(4, 6)))).toEqual([sq(3, 6), sq(4, 5), sq(4, 7)]);
  });

  it('never lets the generals face each other', () => {
    const b = board(
      '....k....',
      '.........',
      '.........',
      '.........',
      '....R....',
      '.........',
      '.........',
      '.........',
      '.........',
      '....K....',
    );
    // The chariot is all that stands between the generals: it may not leave the file.
    expect(legalTargets(b, sq(4, 4)).every((t) => t % 9 === 4)).toBe(true);
    const open = board(
      '....k....',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '...K.....',
    );
    expect(legalTargets(open, sq(9, 3))).not.toContain(sq(9, 4));
    expect(inCheck(play(open, { from: sq(9, 3), to: sq(9, 4) }), 'r')).toBe(true);
  });

  it('knows a mate from a stalemate', () => {
    const mate = board(
      'R...k....',
      '........R',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '...K.....',
    );
    expect(inCheck(mate, 'b')).toBe(true);
    expect(canMove(mate, 'b')).toBe(false);
    const stuck = board(
      '....k....',
      '.........',
      '....P....',
      '.........',
      '.........',
      '...R.R...',
      '.........',
      '.........',
      '.........',
      '....K....',
    );
    expect(inCheck(stuck, 'b')).toBe(false);
    expect(canMove(stuck, 'b')).toBe(false);
  });
});
