/**
 * How pieces move, for simplified 8 × 8 draughts: pure functions on a board, shared by
 * the game, the computer player and the screen (which shows where a picked piece may go).
 */
import type { Move, Rules, Side } from './model.js';

export const other = (side: Side): Side => (side === 'w' ? 'b' : 'w');
export const sideOf = (piece: string): Side => (piece.toLowerCase() === 'w' ? 'w' : 'b');
export const isKing = (piece: string) => piece === 'W' || piece === 'B';
export const rowOf = (size: number, sq: number) => Math.floor(sq / size);
export const colOf = (size: number, sq: number) => sq % size;
export const isDark = (size: number, sq: number) => (rowOf(size, sq) + colOf(size, sq)) % 2 === 1;

/** The row direction a side's men move in (the first side starts at the bottom). */
export const forward = (side: Side, rules: Rules) => (side === rules.first ? -1 : 1);
/** The row where a side's men are crowned. */
export const crownRow = (side: Side, rules: Rules) => (side === rules.first ? 0 : rules.size - 1);

/** The opening position: each side's men on the dark squares of its first rows. */
export function startBoard(rules: Rules): string {
  const { size } = rules;
  let board = '';
  for (let sq = 0; sq < size * size; sq++) {
    const row = rowOf(size, sq);
    if (!isDark(size, sq)) board += '.';
    else if (row < rules.rows) board += other(rules.first);
    else if (row >= size - rules.rows) board += rules.first;
    else board += '.';
  }
  return board;
}

/** A board from rows of text (tests). */
export const boardOf = (...rows: string[]) => rows.join('');

const DIAGONALS = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
] as const;

/**
 * Every capture sequence of the piece on `from`, followed to its end (no further capture
 * possible). Taken pieces stay on the board until the move ends: they block, and none is
 * taken twice.
 */
function capturesFrom(cells: string[], from: number, rules: Rules, out: Move[]) {
  const { size } = rules;
  const piece = cells[from] ?? '.';
  const side = sideOf(piece);
  const inside = (r: number, c: number) => r >= 0 && r < size && c >= 0 && c < size;
  const empty = (sq: number) => sq === from || cells[sq] === '.';
  const enemy = (sq: number, taken: number[]) =>
    cells[sq] !== '.' && sq !== from && sideOf(cells[sq] ?? '.') !== side && !taken.includes(sq);

  const follow = (at: number, king: boolean, path: number[], taken: number[]) => {
    const row = rowOf(size, at);
    const col = colOf(size, at);
    let more = false;
    for (const [dr, dc] of DIAGONALS) {
      if (!king && dr !== forward(side, rules)) continue;
      let r = row + dr;
      let c = col + dc;
      // A flying king reaches the first occupied square along this diagonal.
      while (king && inside(r, c) && empty(r * size + c)) {
        r += dr;
        c += dc;
      }
      if (!inside(r, c)) continue;
      const over = r * size + c;
      if (!enemy(over, taken)) continue;
      r += dr;
      c += dc;
      // Men land immediately behind the enemy; kings may choose any clear square beyond it.
      while (inside(r, c) && empty(r * size + c)) {
        const land = r * size + c;
        more = true;
        const crowned = !king && r === crownRow(side, rules);
        if (crowned) out.push({ path: [...path, land], captures: [...taken, over] });
        else follow(land, king, [...path, land], [...taken, over]);
        if (!king) break;
        r += dr;
        c += dc;
      }
    }
    if (!more && taken.length) out.push({ path, captures: taken });
  };
  follow(from, isKing(piece), [from], []);
}

/** The plain (non-capturing) moves of the piece on `from`. */
function stepsFrom(cells: string[], from: number, rules: Rules, out: Move[]) {
  const { size } = rules;
  const piece = cells[from] ?? '.';
  const side = sideOf(piece);
  const king = isKing(piece);
  const row = rowOf(size, from);
  const col = colOf(size, from);
  for (const [dr, dc] of DIAGONALS) {
    if (!king && dr !== forward(side, rules)) continue;
    let r = row + dr;
    let c = col + dc;
    while (r >= 0 && r < size && c >= 0 && c < size) {
      const to = r * size + c;
      if (cells[to] !== '.') break;
      out.push({ path: [from, to], captures: [] });
      if (!king) break;
      r += dr;
      c += dc;
    }
  }
}

/**
 * Every legal move of `side`: captures and plain moves are both optional choices.
 */
export function legalMoves(board: string, side: Side, rules: Rules): Move[] {
  const cells = [...board];
  const captures: Move[] = [];
  for (let sq = 0; sq < cells.length; sq++) {
    if (cells[sq] !== '.' && sideOf(cells[sq] ?? '.') === side)
      capturesFrom(cells, sq, rules, captures);
  }
  // The same path and the same pieces taken is the same move (a king can reach it twice).
  const seen = new Set<string>();
  const uniqueCaptures = captures.filter((m) => {
    const key = `${m.path.join(',')}|${[...m.captures].sort((a, b) => a - b).join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const steps: Move[] = [];
  for (let sq = 0; sq < cells.length; sq++) {
    if (cells[sq] !== '.' && sideOf(cells[sq] ?? '.') === side) stepsFrom(cells, sq, rules, steps);
  }
  return [...uniqueCaptures, ...steps];
}

/** The board after a move: the piece at the path's end, the taken pieces gone, a man crowned
 * if it ends on the far row. */
export function play(board: string, move: Move, rules: Rules) {
  const cells = [...board];
  const from = move.path[0] ?? 0;
  const to = move.path[move.path.length - 1] ?? from;
  const piece = cells[from] ?? '.';
  const taken = move.captures.map((sq) => cells[sq] ?? '.');
  for (const sq of move.captures) cells[sq] = '.';
  cells[from] = '.';
  const side = sideOf(piece);
  const crowned = !isKing(piece) && rowOf(rules.size, to) === crownRow(side, rules);
  cells[to] = crowned ? piece.toUpperCase() : piece;
  return { board: cells.join(''), taken, crowned };
}

/** Whether two moves are the same (the path decides; captures follow from it). */
export const sameMove = (a: Move, b: { path: number[] }) =>
  a.path.length === b.path.length && a.path.every((sq, i) => sq === b.path[i]);

/** The board and the side to move as text: equal keys mean the same position. */
export const positionKey = (board: string, turn: Side) => `${board}${turn}`;
