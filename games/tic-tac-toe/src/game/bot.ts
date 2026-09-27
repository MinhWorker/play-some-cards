/**
 * The computer player's brain: which cell to mark. CaroGame.bot calls it in rooms against the
 * computer.
 */
import { type PlayerId, pick } from '@psc/sdk';
import { at, DIRECTIONS, emptyCells, isOver, otherMark, points, runAt, winsAt } from './board.js';
import { type Board, type BotLevel, type Mark, type Point, type State, WIN } from './model.js';

/**
 * `easy` plays near the pieces at random but never misses a win, `normal` also blocks your
 * winning move and builds its own lines, `hard` always takes the best-weighed cell.
 */
export function botMove(
  state: State,
  player: PlayerId,
  rng: () => number,
  level: BotLevel,
): Point | null {
  if (isOver(state.board) || state.turn !== player) return null;
  const { board } = state;
  const me: Mark = player === state.players[0] ? 'X' : 'O';

  const winNow = finishingCell(board, me);
  if (winNow) return winNow;
  if (level === 'easy') return pick(rng, candidates(board, 1));

  const block = finishingCell(board, otherMark(me));
  if (block) return block;

  // Score every candidate: my attack plus how much it spoils the opponent's lines.
  const scored = candidates(board, 2).map((cell) => ({
    cell,
    score: potential(board, cell, me) + potential(board, cell, otherMark(me)) * 0.9,
  }));
  scored.sort((a, b) => b.score - a.score);
  // `normal` sometimes takes the second or third best move.
  const top =
    level === 'hard' ? scored.filter((s) => s.score === scored[0]?.score) : scored.slice(0, 3);
  return pick(rng, top).cell;
}

/** A free cell that makes WIN in a row for `mark`, if any. */
function finishingCell(board: Board, mark: Mark) {
  return emptyCells(board).find((cell) => winsAt(board, cell, mark));
}

/** Free cells within `reach` of a piece (the center on an empty board). */
function candidates(board: Board, reach: number) {
  const free = emptyCells(board);
  const taken = points(board).filter((p) => at(board, p));
  if (!taken.length) {
    return [{ x: board.left + (board.cols >> 1), y: board.top + (board.rows >> 1) }];
  }
  const near = free.filter((cell) =>
    taken.some((p) => Math.abs(cell.x - p.x) <= reach && Math.abs(cell.y - p.y) <= reach),
  );
  return near.length ? near : free;
}

/**
 * How much a mark on `cell` is worth to `mark`: every direction adds more for longer runs, more
 * with both ends free, nothing for runs that can't grow to WIN.
 */
function potential(board: Board, cell: Point, mark: Mark) {
  let total = 0;
  for (const direction of DIRECTIONS) {
    const { length, open, room } = runAt(board, cell, mark, direction);
    if (room < WIN || open === 0) continue;
    total += (open === 2 ? 4 : 1) * 6 ** Math.min(length, WIN);
  }
  return total;
}
