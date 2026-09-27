/** Helpers for the growing board, shared by CaroGame, the bot and CaroView. */
import {
  type Board,
  type Cell,
  GROW,
  MAX_SIDE,
  type Mark,
  type Point,
  START_SIDE,
  WIN,
} from './model.js';

/** Right, down, down-right, down-left. */
export const DIRECTIONS = [
  [1, 0],
  [0, 1],
  [1, 1],
  [-1, 1],
] as const;
type Direction = (typeof DIRECTIONS)[number];

/** An empty START_SIDE × START_SIDE board. */
export function newBoard(): Board {
  const side = START_SIDE;
  return { left: 0, top: 0, cols: side, rows: side, cells: Array(side * side).fill(null) };
}

export function inside(board: Board, { x, y }: Point) {
  const col = x - board.left;
  const row = y - board.top;
  return col >= 0 && row >= 0 && col < board.cols && row < board.rows;
}

/** The mark on `p`, `null` if it is free, `undefined` off the board. */
export function at(board: Board, p: Point): Cell | undefined {
  if (!inside(board, p)) return undefined;
  return board.cells[(p.y - board.top) * board.cols + (p.x - board.left)];
}

/** Every cell of the board, row by row. */
export function points(board: Board): Point[] {
  return Array.from({ length: board.cols * board.rows }, (_, i) => ({
    x: board.left + (i % board.cols),
    y: board.top + Math.floor(i / board.cols),
  }));
}

/** The free cells. */
export function emptyCells(board: Board) {
  return points(board).filter((p) => at(board, p) === null);
}

/** "x,y", to key maps and sets by cell. */
export const keyOf = ({ x, y }: Point) => `${x},${y}`;

/** The board after `mark` takes `p` (a new board). */
export function place(board: Board, p: Point, mark: Mark): Board {
  const cells = board.cells.slice();
  cells[(p.y - board.top) * board.cols + (p.x - board.left)] = mark;
  return { ...board, cells };
}

/**
 * The board after a mark on `p`: every edge `p` stands on gets GROW more rows or columns on
 * that side, as long as the board stays within MAX_SIDE (a corner grows both ways).
 */
export function grow(board: Board, p: Point): Board {
  const more = (side: number) => (side + GROW <= MAX_SIDE ? GROW : 0);
  const left = p.x === board.left ? more(board.cols) : 0;
  const right = p.x === board.left + board.cols - 1 ? more(board.cols) : 0;
  const up = p.y === board.top ? more(board.rows) : 0;
  const down = p.y === board.top + board.rows - 1 ? more(board.rows) : 0;
  if (!left && !right && !up && !down) return board;
  const next: Board = {
    left: board.left - left,
    top: board.top - up,
    cols: board.cols + left + right,
    rows: board.rows + up + down,
    cells: [],
  };
  next.cells = points(next).map((q) => at(board, q) ?? null);
  return next;
}

/**
 * Walks from `p` one way (`sign` 1 or -1): `run` = `mark`s right after it, `open` = the cell
 * after them is free, `room` = cells up to the other player's mark or the edge.
 */
function walk(board: Board, p: Point, mark: Mark, [dx, dy]: Direction, sign: 1 | -1) {
  const q = { x: p.x + dx * sign, y: p.y + dy * sign };
  const cell = () => at(board, q);
  const step = () => {
    q.x += dx * sign;
    q.y += dy * sign;
  };
  let run = 0;
  for (; cell() === mark; step()) run++;
  const open = cell() === null;
  let room = run;
  for (; cell() !== undefined && cell() !== otherMark(mark); step()) room++;
  return { run, open, room };
}

/**
 * If `mark` stood on `p`: its run through `p` along `direction`, how many of the run's two
 * ends are free (0-2), and the room it has to grow (a run that can't reach WIN is dead).
 */
export function runAt(board: Board, p: Point, mark: Mark, direction: Direction) {
  const a = walk(board, p, mark, direction, 1);
  const b = walk(board, p, mark, direction, -1);
  return {
    length: 1 + a.run + b.run,
    open: Number(a.open) + Number(b.open),
    room: 1 + a.room + b.room,
  };
}

/** Whether `mark` on `p` would make WIN (or more) in a row. */
export function winsAt(board: Board, p: Point, mark: Mark) {
  return DIRECTIONS.some((d) => runAt(board, p, mark, d).length >= WIN);
}

/** The first WIN cells in a row with the same mark, or `null` if there are none. */
export function winningLine(board: Board): Point[] | null {
  for (const p of points(board)) {
    const mark = at(board, p);
    if (!mark) continue;
    for (const [dx, dy] of DIRECTIONS) {
      const line = Array.from({ length: WIN }, (_, i) => ({ x: p.x + dx * i, y: p.y + dy * i }));
      if (line.every((q) => at(board, q) === mark)) return line;
    }
  }
  return null;
}

/**
 * Nobody can win any more: the board can't grow (MAX_SIDE both ways) and every WIN cells in a
 * row on it already hold both marks. A full board is the extreme case.
 */
export function isDraw(board: Board) {
  if (board.cols < MAX_SIDE || board.rows < MAX_SIDE) return false;
  for (const p of points(board)) {
    for (const [dx, dy] of DIRECTIONS) {
      const line = Array.from({ length: WIN }, (_, i) =>
        at(board, { x: p.x + dx * i, y: p.y + dy * i }),
      );
      if (line.includes(undefined)) continue;
      if (!line.includes('X') || !line.includes('O')) return false;
    }
  }
  return true;
}

/** Someone has WIN in a row, or nobody can get it any more. */
export function isOver(board: Board) {
  return winningLine(board) !== null || isDraw(board);
}

export const otherMark = (mark: Mark): Mark => (mark === 'X' ? 'O' : 'X');
