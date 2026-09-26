/**
 * The computer player's brain: which cell to mark. CaroGame.bot calls it in rooms against the
 * computer.
 */
import { type PlayerId, pick } from '@psc/sdk';
import {
  DIRECTIONS,
  emptyCells,
  isOver,
  otherMark,
  place,
  runAt,
  sideOf,
  winningLine,
} from './board.js';
import type { BotLevel, Cell, Mark, State } from './model.js';

/**
 * `easy` plays near the pieces at random but never misses a win, `normal` also blocks your
 * winning move and builds its own lines, `hard` weighs every cell carefully (and on 3×3 plays
 * perfectly: it never loses).
 */
export function botMove(
  state: State,
  player: PlayerId,
  rng: () => number,
  level: BotLevel,
): number | null {
  if (isOver(state.board, state.win) || state.turn !== player) return null;
  const { board, win } = state;
  const me: Mark = player === state.players[0] ? 'X' : 'O';

  const winNow = finishingCell(board, me, win);
  if (winNow !== undefined) return winNow;
  if (level === 'easy') return pick(rng, candidates(board, 1));

  const block = finishingCell(board, otherMark(me), win);
  if (block !== undefined) return block;
  if (level === 'hard' && state.size === 3) return perfectCell(board, me, rng);

  // Score every candidate: my attack plus how much it spoils the opponent's lines.
  const scored = candidates(board, 2).map((cell) => ({
    cell,
    score: potential(board, cell, me, win) + potential(board, cell, otherMark(me), win) * 0.9,
  }));
  scored.sort((a, b) => b.score - a.score);
  // `normal` sometimes takes the second or third best move.
  const top =
    level === 'hard' ? scored.filter((s) => s.score === scored[0]?.score) : scored.slice(0, 3);
  return pick(rng, top).cell;
}

/** A free cell that completes `win` in a row for `mark`, if any. */
function finishingCell(board: Cell[], mark: Mark, win: number) {
  return emptyCells(board).find((cell) => winningLine(place(board, cell, mark), win) !== null);
}

/** Free cells within `reach` of a piece (the center on an empty board). */
function candidates(board: Cell[], reach: number) {
  const size = sideOf(board);
  const free = emptyCells(board);
  if (free.length === board.length) return [Math.floor(board.length / 2)];
  const near = free.filter((cell) =>
    board.some((mark, other) => {
      if (!mark) return false;
      const dx = Math.abs((cell % size) - (other % size));
      const dy = Math.abs(Math.floor(cell / size) - Math.floor(other / size));
      return dx <= reach && dy <= reach;
    }),
  );
  return near.length ? near : free;
}

/**
 * How much a mark on `cell` is worth to `mark`: every direction adds more for longer runs, more
 * with both ends free, nothing for runs that can't grow to `win`.
 */
function potential(board: Cell[], cell: number, mark: Mark, win: number) {
  let total = 0;
  for (const direction of DIRECTIONS) {
    const { length, open, room } = runAt(board, cell, mark, direction);
    if (room < win || open === 0) continue;
    total += (open === 2 ? 4 : 1) * 6 ** Math.min(length, win);
  }
  return total;
}

/** 3×3 only: the best cell by searching every game to the end (a random one among equals). */
function perfectCell(board: Cell[], me: Mark, rng: () => number) {
  const scored = emptyCells(board).map((cell) => ({
    cell,
    score: minimax(place(board, cell, me), otherMark(me), me),
  }));
  const best = Math.max(...scored.map((s) => s.score));
  return pick(
    rng,
    scored.filter((s) => s.score === best),
  ).cell;
}

/** Scores already worked out, by board + turn + me (there are only a few thousand boards). */
const scoreCache = new Map<string, number>();

/**
 * How good the board is for `me` with `turn` to play, assuming both sides play perfectly:
 * positive = `me` wins (sooner is higher), negative = `me` loses, 0 = draw.
 */
function minimax(board: Cell[], turn: Mark, me: Mark): number {
  const key = `${board.map((c) => c ?? '-').join('')}${turn}${me}`;
  let score = scoreCache.get(key);
  if (score === undefined) {
    score = search(board, turn, me);
    scoreCache.set(key, score);
  }
  return score;
}

function search(board: Cell[], turn: Mark, me: Mark): number {
  const line = winningLine(board, 3);
  const free = emptyCells(board);
  if (line) return (board[line[0]] === me ? 1 : -1) * (free.length + 1);
  if (free.length === 0) return 0;
  const scores = free.map((cell) => minimax(place(board, cell, turn), otherMark(turn), me));
  return turn === me ? Math.max(...scores) : Math.min(...scores);
}
