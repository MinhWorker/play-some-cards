/** Helpers for the square grid, shared by the rules, the bot and the board scene. */
import type { Cell, Mark } from './model.js';

/** Right, down, down-right, down-left. */
export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 1],
] as const;
type Direction = (typeof DIRECTIONS)[number];

/** Side length of a square board. */
export const sideOf = (board: Cell[]) => Math.round(Math.sqrt(board.length));

/**
 * Walks from `cell` one way (`sign` 1 or -1): `run` = `mark`s right after it, `open` = the cell
 * after them is free, `room` = cells up to the other player's mark or the edge.
 */
function walk(board: Cell[], cell: number, mark: Mark, [dx, dy]: Direction, sign: 1 | -1) {
  const size = sideOf(board);
  let x = (cell % size) + dx * sign;
  let y = Math.floor(cell / size) + dy * sign;
  const at = () => (x >= 0 && y >= 0 && x < size && y < size ? board[y * size + x] : undefined);
  const step = () => {
    x += dx * sign;
    y += dy * sign;
  };
  let run = 0;
  for (; at() === mark; step()) run++;
  const open = at() === null;
  let room = run;
  for (; at() !== undefined && at() !== otherMark(mark); step()) room++;
  return { run, open, room };
}

/**
 * If `mark` stood on `cell`: its run through `cell` along `direction`, how many of the run's two
 * ends are free (0-2), and the room it has to grow (a run that can't reach `win` is dead).
 */
export function runAt(board: Cell[], cell: number, mark: Mark, direction: Direction) {
  const a = walk(board, cell, mark, direction, 1);
  const b = walk(board, cell, mark, direction, -1);
  return {
    length: 1 + a.run + b.run,
    open: Number(a.open) + Number(b.open),
    room: 1 + a.room + b.room,
  };
}

/** The cells of the first run of `win` equal marks, or `null` if there is none. */
export function winningLine(board: Cell[], win: number): [number, ...number[]] | null {
  const size = sideOf(board);
  for (let cell = 0; cell < board.length; cell++) {
    const mark = board[cell];
    if (!mark) continue;
    const x = cell % size;
    const y = Math.floor(cell / size);
    for (const [dx, dy] of DIRECTIONS) {
      const line: [number, ...number[]] = [cell];
      for (let step = 1; step < win; step++) {
        const nx = x + dx * step;
        const ny = y + dy * step;
        if (nx < 0 || ny < 0 || nx >= size || ny >= size || board[ny * size + nx] !== mark) break;
        line.push(ny * size + nx);
      }
      if (line.length === win) return line;
    }
  }
  return null;
}

/** Indexes of the free cells. */
export function emptyCells(board: Cell[]) {
  return board.flatMap((cell, i) => (cell === null ? [i] : []));
}

/** The board after `mark` takes `cell` (a new array). */
export function place(board: Cell[], cell: number, mark: Mark) {
  const next = board.slice();
  next[cell] = mark;
  return next;
}

export const otherMark = (mark: Mark): Mark => (mark === 'X' ? 'O' : 'X');
