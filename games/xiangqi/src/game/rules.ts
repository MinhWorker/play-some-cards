/**
 * How pieces move (WXF rules): pure functions on a board, shared by the game, the computer
 * player and the screen (which shows the legal moves of a picked piece).
 */
import { type Cell, COLS, type Kind, type Move, type Piece, ROWS, type Side } from './model.js';

/** A board from 10 rows of 9 letters ('.' = empty), Black's back rank first. */
export const boardOf = (...rows: string[]): Cell[] =>
  [...rows.join('')].map((c) => (c === '.' ? null : c));

/** Red on rows 7–9, Black on rows 0–2 (see model.ts). */
export const START = boardOf(
  'rnbakabnr',
  '.........',
  '.c.....c.',
  'p.p.p.p.p',
  '.........',
  '.........',
  'P.P.P.P.P',
  '.C.....C.',
  '.........',
  'RNBAKABNR',
);

export const square = (row: number, col: number) => row * COLS + col;
export const rowOf = (sq: number) => Math.floor(sq / COLS);
export const colOf = (sq: number) => sq % COLS;
export const sideOf = (piece: Piece): Side => (piece === piece.toUpperCase() ? 'r' : 'b');
export const kindOf = (piece: Piece) => piece.toLowerCase() as Kind;
export const other = (side: Side): Side => (side === 'r' ? 'b' : 'r');
export const pieceOf = (side: Side, kind: Kind): Piece =>
  side === 'r' ? kind.toUpperCase() : kind;

const inBoard = (row: number, col: number) => row >= 0 && row < ROWS && col >= 0 && col < COLS;
const inPalace = (side: Side, row: number, col: number) =>
  col >= 3 && col <= 5 && (side === 'r' ? row >= 7 && row <= 9 : row >= 0 && row <= 2);
const ownHalf = (side: Side, row: number) => (side === 'r' ? row >= 5 : row <= 4);
/** A soldier on this row has crossed the river (it may now step sideways). */
export const crossed = (side: Side, row: number) => !ownHalf(side, row);

const ORTHO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
] as const;
const DIAG = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;
/** A horse's jumps; its leg (the point that blocks it) is one step along the long side. */
const HORSE = [
  [-2, -1],
  [-2, 1],
  [2, -1],
  [2, 1],
  [-1, -2],
  [1, -2],
  [-1, 2],
  [1, 2],
] as const;

/** Where the piece on `from` may go by its own rule, without looking at checks. */
export function pseudoTargets(board: Cell[], from: number): number[] {
  const piece = board[from];
  if (!piece) return [];
  const side = sideOf(piece);
  const row = rowOf(from);
  const col = colOf(from);
  const out: number[] = [];
  /** Empty or an enemy piece: a target. */
  const open = (r: number, c: number) => {
    const target = board[square(r, c)];
    return !target || sideOf(target) !== side;
  };
  const step = (r: number, c: number, ok = true) => {
    if (ok && inBoard(r, c) && open(r, c)) out.push(square(r, c));
  };

  switch (kindOf(piece)) {
    case 'k':
      for (const [dr, dc] of ORTHO) step(row + dr, col + dc, inPalace(side, row + dr, col + dc));
      break;
    case 'a':
      for (const [dr, dc] of DIAG) step(row + dr, col + dc, inPalace(side, row + dr, col + dc));
      break;
    case 'b':
      for (const [dr, dc] of DIAG) {
        const [r, c] = [row + 2 * dr, col + 2 * dc];
        const eye = inBoard(r, c) && !board[square(row + dr, col + dc)];
        step(r, c, eye && ownHalf(side, r));
      }
      break;
    case 'n':
      for (const [dr, dc] of HORSE) {
        const leg = square(
          row + (Math.abs(dr) === 2 ? dr / 2 : 0),
          col + (Math.abs(dc) === 2 ? dc / 2 : 0),
        );
        step(row + dr, col + dc, inBoard(row + dr, col + dc) && !board[leg]);
      }
      break;
    case 'r':
      for (const [dr, dc] of ORTHO) {
        for (let r = row + dr, c = col + dc; inBoard(r, c); r += dr, c += dc) {
          step(r, c);
          if (board[square(r, c)]) break;
        }
      }
      break;
    case 'c':
      for (const [dr, dc] of ORTHO) {
        let screen = false;
        for (let r = row + dr, c = col + dc; inBoard(r, c); r += dr, c += dc) {
          const target = board[square(r, c)];
          if (!screen) {
            if (!target) out.push(square(r, c));
            else screen = true;
          } else if (target) {
            // The first piece past the screen: take it if it is an enemy, then stop.
            if (sideOf(target) !== side) out.push(square(r, c));
            break;
          }
        }
      }
      break;
    case 'p': {
      step(row + (side === 'r' ? -1 : 1), col);
      if (crossed(side, row)) {
        step(row, col - 1);
        step(row, col + 1);
      }
      break;
    }
  }
  return out;
}

/** The board after a move (the piece on `to`, if any, is taken). */
export function play(board: Cell[], { from, to }: Move): Cell[] {
  const next = board.slice();
  next[to] = next[from] ?? null;
  next[from] = null;
  return next;
}

export const generalOf = (board: Cell[], side: Side) => board.indexOf(pieceOf(side, 'k'));

/**
 * Whether a piece of `by` could take on `sq` now (by its own rule, ignoring checks). Looks
 * outward from `sq` instead of generating every move: this runs for every move searched.
 */
export function attacked(board: Cell[], sq: number, by: Side): boolean {
  const row = rowOf(sq);
  const col = colOf(sq);
  const is = (r: number, c: number, kind: Kind) =>
    inBoard(r, c) && board[square(r, c)] === pieceOf(by, kind);
  // Chariots (first piece on a line) and cannons (second piece).
  for (const [dr, dc] of ORTHO) {
    let seen = 0;
    for (let r = row + dr, c = col + dc; inBoard(r, c); r += dr, c += dc) {
      if (!board[square(r, c)]) continue;
      if (seen === 0 && is(r, c, 'r')) return true;
      if (seen === 1 && is(r, c, 'c')) return true;
      if (++seen === 2) break;
    }
  }
  // A horse at sq + (dr, dc) jumps back by (-dr, -dc); its leg is next to it towards sq.
  for (const [dr, dc] of HORSE) {
    const [r, c] = [row + dr, col + dc];
    if (!is(r, c, 'n')) continue;
    const leg = square(
      r - (Math.abs(dr) === 2 ? dr / 2 : 0),
      c - (Math.abs(dc) === 2 ? dc / 2 : 0),
    );
    if (!board[leg]) return true;
  }
  // Soldiers step forward (Red up, Black down), and sideways once across the river.
  const back = by === 'r' ? 1 : -1;
  if (is(row + back, col, 'p')) return true;
  if (crossed(by, row) && (is(row, col - 1, 'p') || is(row, col + 1, 'p'))) return true;
  if (inPalace(by, row, col)) {
    for (const [dr, dc] of ORTHO) if (is(row + dr, col + dc, 'k')) return true;
    for (const [dr, dc] of DIAG) if (is(row + dr, col + dc, 'a')) return true;
  }
  if (ownHalf(by, row)) {
    for (const [dr, dc] of DIAG) {
      if (is(row + 2 * dr, col + 2 * dc, 'b') && !board[square(row + dr, col + dc)]) return true;
    }
  }
  return false;
}

/** The two generals face each other on a file with nothing between them. */
export function generalsFace(board: Cell[]): boolean {
  const red = generalOf(board, 'r');
  const black = generalOf(board, 'b');
  if (red < 0 || black < 0 || colOf(red) !== colOf(black)) return false;
  for (let sq = black + COLS; sq < red; sq += COLS) if (board[sq]) return false;
  return true;
}

/** `side`'s general is attacked (the generals facing each other counts). */
export function inCheck(board: Cell[], side: Side): boolean {
  const general = generalOf(board, side);
  if (general < 0) return true;
  return generalsFace(board) || attacked(board, general, other(side));
}

/** Where the piece on `from` may legally go: its own rule, and its side not left in check. */
export function legalTargets(board: Cell[], from: number): number[] {
  const piece = board[from];
  if (!piece) return [];
  const side = sideOf(piece);
  return pseudoTargets(board, from).filter((to) => !inCheck(play(board, { from, to }), side));
}

/** Every legal move of `side`. */
export function legalMoves(board: Cell[], side: Side): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < board.length; from++) {
    const piece = board[from];
    if (!piece || sideOf(piece) !== side) continue;
    for (const to of legalTargets(board, from)) moves.push({ from, to });
  }
  return moves;
}

/** Whether `side` has any legal move (stops at the first one). */
export function canMove(board: Cell[], side: Side): boolean {
  for (let from = 0; from < board.length; from++) {
    const piece = board[from];
    if (!piece || sideOf(piece) !== side) continue;
    for (const to of pseudoTargets(board, from)) {
      if (!inCheck(play(board, { from, to }), side)) return true;
    }
  }
  return false;
}

/** Pieces that can cross the river and attack: chariots, horses, cannons and soldiers. */
export const ATTACKERS: readonly Kind[] = ['r', 'n', 'c', 'p'];

/** Neither side has a piece that could ever give mate (only generals, advisors, elephants). */
export function noAttackers(board: Cell[]): boolean {
  return board.every((piece) => !piece || !ATTACKERS.includes(kindOf(piece)));
}

/** The board and the side to move as text: equal keys mean the same position. */
export const positionKey = (board: Cell[], turn: Side) =>
  `${board.map((c) => c ?? '.').join('')}${turn}`;
