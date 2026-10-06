import { describe, expect, it } from 'vitest';
import type { Position } from './model.js';
import {
  fromFen,
  inCheck,
  insufficientMaterial,
  legalMoves,
  legalTargets,
  nameOf,
  play,
  positionKey,
  START,
  squareOf,
} from './rules.js';

/** Moves counted to `depth` plies: the standard check that move generation is right. */
function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(play(pos, m), depth - 1);
  return n;
}

/** The position after moves written as "e2e4" (and "e7e8q" for a promotion). */
function after(pos: Position, ...moves: string[]): Position {
  return moves.reduce((p, text) => {
    const from = squareOf(text.slice(0, 2));
    const to = squareOf(text.slice(2, 4));
    const promotion = text[4] as 'q' | 'r' | 'b' | 'n' | undefined;
    const legal = legalMoves(p).find(
      (m) => m.from === from && m.to === to && m.promotion === promotion,
    );
    if (!legal) throw new Error(`${text} is not legal`);
    return play(p, legal);
  }, pos);
}

const targets = (pos: Position, from: string) =>
  legalTargets(pos, squareOf(from)).map(nameOf).sort();

describe('chess moves', () => {
  it('counts the known number of moves from the start (perft 1–3)', () => {
    expect(perft(START, 1)).toBe(20);
    expect(perft(START, 2)).toBe(400);
    expect(perft(START, 3)).toBe(8902);
  });

  it('counts "Kiwipete": castling, en passant, promotions and pins (perft 1–2)', () => {
    const pos = fromFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -');
    expect(perft(pos, 1)).toBe(48);
    expect(perft(pos, 2)).toBe(2039);
  });

  it('counts an endgame with en passant pins and checks (perft 1–3)', () => {
    const pos = fromFen('8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - -');
    expect(perft(pos, 1)).toBe(14);
    expect(perft(pos, 2)).toBe(191);
    expect(perft(pos, 3)).toBe(2812);
  });

  it('counts promotions with checks (perft 1–2)', () => {
    const pos = fromFen('r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq -');
    expect(perft(pos, 1)).toBe(6);
    expect(perft(pos, 2)).toBe(264);
  });

  it('castles both ways, moving the rook too, and not through an attacked square', () => {
    const pos = fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -');
    expect(targets(pos, 'e1')).toEqual(['c1', 'd1', 'd2', 'e2', 'f1', 'f2', 'g1']);
    const short = after(pos, 'e1g1');
    expect(short.board[squareOf('f1')]).toBe('R');
    expect(short.board[squareOf('h1')]).toBeNull();
    expect(short.castling).toBe('kq');
    // A black rook on f8 covers f1: no short castle.
    const covered = fromFen('r3kr2/8/8/8/8/8/8/R3K2R w KQq -');
    expect(targets(covered, 'e1')).not.toContain('g1');
    expect(targets(covered, 'e1')).toContain('c1');
  });

  it('loses a castling right when its rook moves or is taken', () => {
    const pos = fromFen('r3k2r/8/8/8/8/8/8/R3K2R w KQkq -');
    expect(after(pos, 'a1a8').castling).toBe('Kk');
  });

  it('takes en passant only right after the two-square step', () => {
    const pos = after(START, 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    expect(targets(pos, 'e5')).toEqual(['d6', 'e6']);
    const taken = after(pos, 'e5d6');
    expect(taken.board[squareOf('d5')]).toBeNull();
    const late = after(pos, 'h2h3', 'h7h6');
    expect(targets(late, 'e5')).toEqual(['e6']);
  });

  it('promotes to any of four pieces', () => {
    const pos = fromFen('8/4P3/8/8/8/8/k7/4K3 w - -');
    const promotions = legalMoves(pos).filter((m) => m.promotion);
    expect(promotions.map((m) => m.promotion).sort()).toEqual(['b', 'n', 'q', 'r']);
    expect(after(pos, 'e7e8n').board[squareOf('e8')]).toBe('N');
  });

  it('never leaves its own king in check', () => {
    // The e2 knight is pinned by the rook on e8.
    const pos = fromFen('4r1k1/8/8/8/8/8/4N3/4K3 w - -');
    expect(targets(pos, 'e2')).toEqual([]);
    expect(inCheck(after(pos, 'e1d1').board, 'w')).toBe(false);
  });

  it('knows when nobody can mate', () => {
    expect(insufficientMaterial(fromFen('8/8/4k3/8/8/3K4/8/8 w - -').board)).toBe(true);
    expect(insufficientMaterial(fromFen('8/8/4k3/8/8/3KN3/8/8 w - -').board)).toBe(true);
    // Bishops on squares of one color.
    expect(insufficientMaterial(fromFen('8/8/2b1k3/8/8/3K1B2/8/8 w - -').board)).toBe(true);
    expect(insufficientMaterial(fromFen('8/8/3bk3/8/8/3K1B2/8/8 w - -').board)).toBe(false);
    expect(insufficientMaterial(fromFen('8/8/4k3/8/8/3KNN2/8/8 w - -').board)).toBe(false);
    expect(insufficientMaterial(fromFen('8/8/4k3/8/8/3KP3/8/8 w - -').board)).toBe(false);
  });

  it('counts en passant in a position only when it can be played', () => {
    const open = after(START, 'e2e4', 'a7a6', 'e4e5', 'd7d5');
    expect(positionKey(open)).toMatch(/ d6$/);
    const closed = after(START, 'e2e4');
    expect(positionKey(closed)).toMatch(/ -$/);
  });
});
