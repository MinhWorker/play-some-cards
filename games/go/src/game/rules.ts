/**
 * How stones play (Chinese rules: area scoring, no suicide, positional superko): pure functions
 * shared by the game, the computer player and the screen.
 *
 * The heavy work (captures, playouts) runs on `Cells`, a byte per point (0 empty, 1 black,
 * 2 white); the state keeps the board as a string (model.ts).
 */
import type { Cell, Score, Side } from './model.js';

export type Cells = Uint8Array;
const EMPTY = 0;
export const colorOf = (side: Side) => (side === 'b' ? 1 : 2);
export const other = (side: Side): Side => (side === 'b' ? 'w' : 'b');
const CHARS = ['.', 'b', 'w'] as const;

export const emptyBoard = (size: number) => '.'.repeat(size * size);
export const toCells = (board: string): Cells =>
  Uint8Array.from(board, (c) => (c === 'b' ? 1 : c === 'w' ? 2 : 0));
export const fromCells = (cells: Cells) => Array.from(cells, (c) => CHARS[c]).join('');

/** A board from rows of '.', 'b' and 'w' (tests), top row first. */
export const boardOf = (...rows: string[]) => ({ size: rows.length, board: rows.join('') });

export const point = (size: number, row: number, col: number) => row * size + col;
export const rowOf = (size: number, p: number) => Math.floor(p / size);
export const colOf = (size: number, p: number) => p % size;

const adjacency = new Map<number, number[][]>();
/** The points next to each point (2 to 4 of them), per board size. */
export function neighbors(size: number): number[][] {
  let adj = adjacency.get(size);
  if (!adj) {
    adj = [];
    for (let p = 0; p < size * size; p++) {
      const row = rowOf(size, p);
      const col = colOf(size, p);
      const next: number[] = [];
      if (row > 0) next.push(p - size);
      if (row < size - 1) next.push(p + size);
      if (col > 0) next.push(p - 1);
      if (col < size - 1) next.push(p + 1);
      adj.push(next);
    }
    adjacency.set(size, adj);
  }
  return adj;
}

/** The chain of stones through `p` and its liberties (empty points next to it). */
export function groupOf(cells: Cells, size: number, p: number) {
  const adj = neighbors(size);
  const color = cells[p];
  const seen = new Uint8Array(cells.length);
  const stones = [p];
  const liberties: number[] = [];
  seen[p] = 1;
  for (let i = 0; i < stones.length; i++) {
    for (const q of adj[stones[i] ?? 0] ?? []) {
      if (seen[q]) continue;
      if (cells[q] === color) {
        seen[q] = 1;
        stones.push(q);
      } else if (cells[q] === EMPTY) {
        seen[q] = 1;
        liberties.push(q);
      }
    }
  }
  return { stones, liberties };
}

/** Whether the chain through `p` has a liberty (stops at the first one). */
function breathes(cells: Cells, size: number, p: number): boolean {
  const adj = neighbors(size);
  const color = cells[p];
  const seen = new Uint8Array(cells.length);
  const stack = [p];
  seen[p] = 1;
  while (stack.length) {
    for (const q of adj[stack.pop() ?? 0] ?? []) {
      if (cells[q] === EMPTY) return true;
      if (!seen[q] && cells[q] === color) {
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  return false;
}

/** Whether the chain through `p` has at least two liberties (stops once it finds them). */
function twoLiberties(cells: Cells, size: number, p: number): boolean {
  const adj = neighbors(size);
  const color = cells[p];
  const seen = new Uint8Array(cells.length);
  const stack = [p];
  seen[p] = 1;
  let first = -1;
  while (stack.length) {
    for (const q of adj[stack.pop() ?? 0] ?? []) {
      if (seen[q]) continue;
      if (cells[q] === EMPTY) {
        if (first >= 0 && q !== first) return true;
        first = q;
      } else if (cells[q] === color) {
        seen[q] = 1;
        stack.push(q);
      }
    }
  }
  return false;
}

/**
 * Plays `color` on `p` in place: takes the enemy chains left without liberties and returns
 * their stones. Returns `null` (and leaves the cells as they were) if `p` is taken or the move
 * would be suicide.
 */
export function playCells(cells: Cells, size: number, p: number, color: number): number[] | null {
  if (cells[p] !== EMPTY) return null;
  const adj = neighbors(size);
  cells[p] = color;
  const captured: number[] = [];
  for (const q of adj[p] ?? []) {
    if (cells[q] === EMPTY || cells[q] === color || breathes(cells, size, q)) continue;
    for (const s of groupOf(cells, size, q).stones) {
      cells[s] = EMPTY;
      captured.push(s);
    }
  }
  if (!captured.length && !breathes(cells, size, p)) {
    cells[p] = EMPTY;
    return null;
  }
  return captured;
}

/** The board after `side` plays `p`, and the stones taken; `null` if taken or suicide. */
export function place(board: string, size: number, p: number, side: Side) {
  const cells = toCells(board);
  const captured = playCells(cells, size, p, colorOf(side));
  return captured && { board: fromCells(cells), captured };
}

/**
 * The ko point after a move: when a lone stone took exactly one stone and now has that point
 * as its only liberty, the other side may not take straight back there.
 */
export function koAfter(board: string, size: number, p: number, captured: number[]): number | null {
  if (captured.length !== 1) return null;
  const { stones, liberties } = groupOf(toCells(board), size, p);
  return stones.length === 1 && liberties.length === 1 ? (captured[0] ?? null) : null;
}

/** A 53-bit hash of a position (FNV-1a twice), for the superko rule. */
export function hashOf(board: string): number {
  let a = 0x811c9dc5;
  let b = 0x01000193;
  for (let i = 0; i < board.length; i++) {
    const c = board.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ (c + i), 0x5bd1e995) >>> 0;
  }
  return a * 2 ** 21 + (b >>> 11);
}

/**
 * Whether `p` is an eye of `color`: every neighbor is its stone, and the diagonals don't let
 * the other side cut in (none on the edge, at most one in the middle).
 */
export function isEye(cells: Cells, size: number, p: number, color: number): boolean {
  if (cells[p] !== EMPTY) return false;
  for (const q of neighbors(size)[p] ?? []) if (cells[q] !== color) return false;
  const row = rowOf(size, p);
  const col = colOf(size, p);
  let bad = 0;
  let edge = 0;
  for (const [dr, dc] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= size || c < 0 || c >= size) edge = 1;
    else if (cells[point(size, r, c)] !== color && cells[point(size, r, c)] !== EMPTY) bad++;
  }
  return bad + edge < 2;
}

/**
 * Who owns each point: its stone's side, or for an empty point the side whose stones alone
 * surround its empty region ('.' when both or neither touch it).
 */
export function owners(cells: Cells, size: number): Cell[] {
  const adj = neighbors(size);
  const out: Cell[] = Array.from(cells, (c) => CHARS[c] as Cell);
  const seen = new Uint8Array(cells.length);
  for (let p = 0; p < cells.length; p++) {
    if (cells[p] !== EMPTY || seen[p]) continue;
    const region = [p];
    seen[p] = 1;
    let touches = 0;
    for (let i = 0; i < region.length; i++) {
      for (const q of adj[region[i] ?? 0] ?? []) {
        const c = cells[q] ?? 0;
        if (c === EMPTY) {
          if (!seen[q]) {
            seen[q] = 1;
            region.push(q);
          }
        } else touches |= c;
      }
    }
    const owner: Cell = touches === 1 ? 'b' : touches === 2 ? 'w' : '.';
    for (const q of region) out[q] = owner;
  }
  return out;
}

/**
 * The area count once the `dead` stones are taken off: each side's stones plus the empty points
 * only it surrounds, White adding `komi`. `owner` says who each point counted for.
 */
export function score(board: string, size: number, dead: number[], komi: number) {
  const cells = toCells(board);
  for (const p of dead) cells[p] = EMPTY;
  const owner = owners(cells, size);
  const total: Score = { b: 0, w: komi };
  for (const o of owner) if (o !== '.') total[o]++;
  return { ...total, owner };
}

/** The stones of every chain touching `points` (each chain once). */
export function chainsOf(board: string, size: number, points: number[]): number[] {
  const cells = toCells(board);
  const out = new Set<number>();
  for (const p of points) {
    if (cells[p] === EMPTY || out.has(p)) continue;
    for (const s of groupOf(cells, size, p).stones) out.add(s);
  }
  return [...out].sort((x, y) => x - y);
}

/**
 * A random game to the end from `cells` (changed in place), `color` to move: random moves that
 * fill no eye of their own and walk into no atari, until both sides pass or the board has seen
 * `limit` moves.
 */
function playout(cells: Cells, size: number, color: number, rng: () => number, limit: number) {
  const empties: number[] = [];
  let passes = 0;
  for (let move = 0; move < limit && passes < 2; move++) {
    empties.length = 0;
    for (let p = 0; p < cells.length; p++) if (cells[p] === EMPTY) empties.push(p);
    let played = false;
    while (empties.length) {
      const i = Math.floor(rng() * empties.length);
      const p = empties[i] ?? 0;
      empties[i] = empties[empties.length - 1] ?? 0;
      empties.pop();
      if (isEye(cells, size, p, color)) continue;
      const captured = playCells(cells, size, p, color);
      if (!captured) continue;
      // Walking into atari without taking anything only feeds the other side: take it back.
      if (!captured.length && !twoLiberties(cells, size, p)) {
        cells[p] = EMPTY;
        continue;
      }
      played = true;
      break;
    }
    passes = played ? 0 : passes + 1;
    color = 3 - color;
  }
}

/**
 * Who is likely to own each point in the end, from `runs` random games played out from here:
 * +1 always Black's, −1 always White's, 0 either or neither.
 */
export function ownership(
  board: string,
  size: number,
  turn: Side,
  rng: () => number,
  runs: number,
): Float64Array {
  const start = toCells(board);
  const own = new Float64Array(start.length);
  for (let run = 0; run < runs; run++) {
    const cells = start.slice();
    playout(cells, size, colorOf(turn), rng, size * size * 3);
    owners(cells, size).forEach((o, p) => {
      own[p] = (own[p] ?? 0) + (o === 'b' ? 1 : o === 'w' ? -1 : 0);
    });
  }
  return own.map((v) => v / runs);
}

/**
 * A first guess of the dead stones once both passed: a chain is dead when the other side ends
 * up owning its points in most random games played out from here.
 */
export function guessDead(board: string, size: number, turn: Side, rng: () => number): number[] {
  const own = ownership(board, size, turn, rng, size <= 9 ? 160 : size <= 13 ? 80 : 40);
  const cells = toCells(board);
  const dead: number[] = [];
  const seen = new Uint8Array(cells.length);
  for (let p = 0; p < cells.length; p++) {
    if (cells[p] === EMPTY || seen[p]) continue;
    const { stones } = groupOf(cells, size, p);
    for (const s of stones) seen[s] = 1;
    // Black's stones lean to +1, White's to −1: a chain owned mostly by the other side is dead.
    const sign = cells[p] === 1 ? 1 : -1;
    const lean = stones.reduce((sum, s) => sum + (own[s] ?? 0), 0) / stones.length;
    if (lean * sign < -0.2) dead.push(...stones);
  }
  return dead.sort((x, y) => x - y);
}

/** Star points (hoshi) drawn on the board. */
export function starPoints(size: number): number[] {
  const edge = size < 13 ? 2 : 3;
  const lines = size < 13 ? [edge, size - 1 - edge] : [edge, (size - 1) / 2, size - 1 - edge];
  const out = lines.flatMap((r) => lines.map((c) => point(size, r, c)));
  // 9 × 9 also has its middle point.
  if (size < 13) out.push(point(size, (size - 1) / 2, (size - 1) / 2));
  return out;
}
