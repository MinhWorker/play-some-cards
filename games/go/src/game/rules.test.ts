import { seededRng } from '@psc/sdk';
import { describe, expect, it } from 'vitest';
import { KOMI } from './model.js';
import {
  boardOf,
  guessDead,
  isEye,
  koAfter,
  place,
  point,
  score,
  starPoints,
  toCells,
} from './rules.js';

describe('go stones', () => {
  it('takes a stone left without liberties', () => {
    const { size, board } = boardOf(
      '.b...', //
      'bw...',
      '.b...',
      '.....',
      '.....',
    );
    const played = place(board, size, point(size, 1, 2), 'b');
    expect(played?.captured).toEqual([point(size, 1, 1)]);
    expect(played?.board[point(size, 1, 1)]).toBe('.');
  });

  it('takes a whole chain at once, along the edge', () => {
    const { size, board } = boardOf(
      'ww.b.', //
      'bbb..',
      '.....',
      '.....',
      '.....',
    );
    const played = place(board, size, point(size, 0, 2), 'b');
    expect(played?.captured.sort()).toEqual([0, 1]);
  });

  it('refuses suicide, but not a move that takes stones first', () => {
    const { size, board } = boardOf(
      '.b...', //
      'b....',
      '.....',
      '.....',
      '.....',
    );
    expect(place(board, size, 0, 'w')).toBeNull();
    expect(place(board, size, 1, 'w')).toBeNull(); // taken
    const ko = boardOf(
      '.bw..', //
      'bw...',
      '.....',
      '.....',
      '.....',
    );
    // White at 0 has no liberty of its own, but it takes the black stone at 1.
    expect(place(ko.board, ko.size, 0, 'w')?.captured).toEqual([1]);
  });

  it('knows a ko: a lone stone that took one stone and has one liberty', () => {
    const { size, board } = boardOf(
      '.bw..', //
      'bw.w.',
      '.bw..',
      '.....',
      '.....',
    );
    const at = point(size, 1, 2);
    const played = place(board, size, at, 'b');
    expect(played?.captured).toEqual([point(size, 1, 1)]);
    expect(koAfter(played?.board ?? '', size, at, played?.captured ?? [])).toBe(point(size, 1, 1));
    // Taking two stones is never a ko.
    expect(koAfter(board, size, at, [1, 2])).toBeNull();
  });

  it('tells an eye from a false eye', () => {
    const { size, board } = boardOf(
      '.b...', //
      'b.b..',
      '.b...',
      '.....',
      '.....',
    );
    expect(isEye(toCells(board), size, point(size, 1, 1), 1)).toBe(true);
    expect(isEye(toCells(board), size, 0, 1)).toBe(true);
    const cut = boardOf(
      'wb...', //
      'b.b..',
      'wbw..',
      '.....',
      '.....',
    );
    expect(isEye(toCells(cut.board), cut.size, point(cut.size, 1, 1), 1)).toBe(false);
  });

  it('counts area: stones and surrounded points, komi for White', () => {
    const { size, board } = boardOf(
      '..bw.', //
      '..bw.',
      '..bw.',
      '..bw.',
      '..bw.',
    );
    const { b, w, owner } = score(board, size, [], KOMI);
    expect(b).toBe(15);
    expect(w).toBe(10 + KOMI);
    expect(owner[0]).toBe('b');
    expect(owner[4]).toBe('w');
  });

  it('counts dead stones as the other side’s points', () => {
    const { size, board } = boardOf(
      '..bw.', //
      '..bw.',
      'w.bw.',
      '..bw.',
      '..bw.',
    );
    expect(score(board, size, [], KOMI).b).toBe(5); // the white stone spoils Black's area
    expect(score(board, size, [point(size, 2, 0)], KOMI).b).toBe(15);
  });

  it('guesses that a lone stone deep in the other side’s area is dead', () => {
    const { size, board } = boardOf(
      '...b.w...',
      '...b.w...',
      '.w.b.w...',
      '...b.w...',
      '...b.w.b.',
      '...b.w...',
      '...b.w...',
      '...b.w...',
      '...b.w...',
    );
    const dead = guessDead(board, size, 'b', seededRng(7));
    expect(dead).toEqual([point(size, 2, 1), point(size, 4, 7)]);
  });

  it('puts the star points where boards have them', () => {
    expect(starPoints(9)).toHaveLength(5);
    expect(starPoints(19)).toHaveLength(9);
    expect(starPoints(19)).toContain(point(19, 3, 3));
  });
});
