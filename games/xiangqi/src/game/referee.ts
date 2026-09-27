/**
 * Judging a repeated position the WXF way: a side that keeps checking or chasing through the
 * repetition loses; otherwise it is a draw. The game asks after every move.
 *
 * A move **chases** when it newly threatens to take an enemy piece that
 * - is not the general, nor a soldier still on its own side of the river,
 * - and is unprotected (it could not be taken back), or is a chariot threatened by a horse or
 *   a cannon (protected or not).
 * Generals and soldiers may threaten freely: their attacks never count as a chase.
 */
import type { Cell, EndReason, Position, Side } from './model.js';
import { crossed, inCheck, kindOf, other, play, pseudoTargets, rowOf, sideOf } from './rules.js';

/** How often a position must appear before the repetition is judged. */
export const REPEATS = 3;

/** Whether `side` could legally take on `sq`. */
function canTake(board: Cell[], sq: number, side: Side): boolean {
  for (let from = 0; from < board.length; from++) {
    const piece = board[from];
    if (!piece || sideOf(piece) !== side) continue;
    if (!pseudoTargets(board, from).includes(sq)) continue;
    if (!inCheck(play(board, { from, to: sq }), side)) return true;
  }
  return false;
}

/** The squares of enemy pieces that `by` is chasing on this board (see the top of the file). */
export function chased(board: Cell[], by: Side): Set<number> {
  const out = new Set<number>();
  const enemy = other(by);
  for (let from = 0; from < board.length; from++) {
    const attacker = board[from];
    if (!attacker || sideOf(attacker) !== by) continue;
    const a = kindOf(attacker);
    if (a === 'k' || a === 'p') continue;
    for (const to of pseudoTargets(board, from)) {
      const target = board[to];
      if (!target || out.has(to)) continue;
      const t = kindOf(target);
      if (t === 'k' || (t === 'p' && !crossed(enemy, rowOf(to)))) continue;
      const after = play(board, { from, to });
      if (inCheck(after, by)) continue;
      const bigger = t === 'r' && (a === 'n' || a === 'c');
      if (bigger || !canTake(after, to, enemy)) out.add(to);
    }
  }
  return out;
}

/** The move from `before` to `after` by `by` started a chase: a piece chased now that wasn't. */
export function startsChase(before: Cell[], after: Cell[], by: Side): boolean {
  const already = chased(before, by);
  for (const sq of chased(after, by)) if (!already.has(sq)) return true;
  return false;
}

/** What a side did through a repetition. */
type Conduct = 'check' | 'chase' | 'idle';

/**
 * The verdict once the current position (the last of `history`) has come back REPEATS times,
 * over every move since its first time: `null` while it hasn't. One side checking or chasing
 * on every move while the other did not loses (checking beats chasing: the checker loses);
 * anything else is a draw.
 */
export function judgeRepetition(
  history: Position[],
): { reason: EndReason; loser: Side | null } | null {
  const now = history[history.length - 1];
  if (!now) return null;
  const seen = history.filter((p) => p.key === now.key).length;
  if (seen < REPEATS) return null;
  const first = history.findIndex((p) => p.key === now.key);
  const span = history.slice(first + 1);
  const conduct = (side: Side): Conduct => {
    // The key ends with the side to move: the move leading there was the other side's.
    const moves = span.filter((p) => p.key.endsWith(other(side)));
    if (moves.length && moves.every((p) => p.check)) return 'check';
    if (moves.length && moves.every((p) => p.check || p.chase)) return 'chase';
    return 'idle';
  };
  const red = conduct('r');
  const black = conduct('b');
  if (red === black) return { reason: 'repetition', loser: null };
  const rank = { check: 2, chase: 1, idle: 0 };
  const loser: Side = rank[red] > rank[black] ? 'r' : 'b';
  const worst = loser === 'r' ? red : black;
  return { reason: worst === 'check' ? 'perpetual-check' : 'perpetual-chase', loser };
}
