import { describe, expect, it } from 'vitest';
import type { Position } from './model.js';
import { chased, judgeRepetition, startsChase } from './referee.js';
import { boardOf, play, square } from './rules.js';

describe('chases', () => {
  const horse = (defended: boolean) =>
    boardOf(
      `${defended ? 'b' : '.'}...k....`,
      '.........',
      '..n......',
      '.........',
      '.........',
      'R........',
      '.........',
      '.........',
      '.........',
      '...K.....',
    );

  it('counts a new threat on an unprotected piece', () => {
    const before = horse(false);
    const after = play(before, { from: square(5, 0), to: square(5, 2) });
    expect(chased(after, 'r')).toEqual(new Set([square(2, 2)]));
    expect(startsChase(before, after, 'r')).toBe(true);
  });

  it('lets a chariot threaten a protected horse', () => {
    const before = horse(true);
    const after = play(before, { from: square(5, 0), to: square(5, 2) });
    expect(startsChase(before, after, 'r')).toBe(false);
  });

  it('counts a horse or cannon on a chariot even when it is protected', () => {
    const before = boardOf(
      'b...k....',
      '.........',
      '..r......',
      '.........',
      '.........',
      '.........',
      '....N....',
      '.........',
      '.........',
      '...K.....',
    );
    const after = play(before, { from: square(6, 4), to: square(4, 3) });
    expect(startsChase(before, after, 'r')).toBe(true);
  });

  it('never counts the general, nor a soldier still at home', () => {
    const b = boardOf(
      '...k.....',
      '.........',
      '.........',
      'p........',
      '.........',
      'R........',
      '........R',
      '.........',
      '....K...p',
      '....p....',
    );
    // Across the river (8,8) counts; (3,0) is at home; the general's (9,4) is his to take.
    expect(chased(b, 'r')).toEqual(new Set([square(8, 8)]));
  });
});

/**
 * A repetition: P (Red to move) → Q → R → S → P, three times over. Red's moves lead to Q and S,
 * Black's to R and P.
 */
function cycle(red: Partial<Position>, black: Partial<Position>): Position[] {
  const pos = (key: string, by: Partial<Position>) => ({ check: false, chase: false, ...by, key });
  const round = [pos('Qb', red), pos('Rr', black), pos('Sb', red), pos('Pr', black)];
  return [pos('Pr', {}), ...round, ...round];
}

describe('repetitions', () => {
  it('waits for the third time', () => {
    expect(judgeRepetition(cycle({}, {}).slice(0, 8))).toBeNull();
  });

  it('is a draw when nobody checks or chases', () => {
    expect(judgeRepetition(cycle({}, {}))).toEqual({ reason: 'repetition', loser: null });
  });

  it('makes the side that keeps checking lose', () => {
    expect(judgeRepetition(cycle({ check: true }, {}))).toEqual({
      reason: 'perpetual-check',
      loser: 'r',
    });
    // Checking against chasing: the checker must change.
    expect(judgeRepetition(cycle({ check: true }, { chase: true }))).toEqual({
      reason: 'perpetual-check',
      loser: 'r',
    });
  });

  it('makes the side that keeps chasing lose', () => {
    expect(judgeRepetition(cycle({}, { chase: true }))).toEqual({
      reason: 'perpetual-chase',
      loser: 'b',
    });
  });

  it('is a draw when both sides do the same', () => {
    const both = judgeRepetition(cycle({ check: true }, { check: true }));
    expect(both).toEqual({ reason: 'repetition', loser: null });
  });
});
