/**
 * The computer player: a small alpha-beta search over material and a few positional nudges.
 * XiangqiGame.bot calls it in rooms against the computer.
 */
import type { BotLevel, Cell, Kind, Move, Side } from './model.js';
import {
  colOf,
  crossed,
  inCheck,
  kindOf,
  legalMoves,
  other,
  play,
  rowOf,
  sideOf,
} from './rules.js';

const VALUE: Record<Kind, number> = { k: 0, a: 200, b: 200, n: 400, r: 900, c: 450, p: 100 };
const MATE = 100_000;

/** How deep each level looks (plies), and how much noise blurs its choice. */
const LEVELS: Record<BotLevel, { depth: number; noise: number }> = {
  easy: { depth: 1, noise: 250 },
  normal: { depth: 2, noise: 40 },
  hard: { depth: 3, noise: 8 },
};

/** The board from `side`'s point of view: its pieces minus the other side's. */
export function evaluate(board: Cell[], side: Side): number {
  let score = 0;
  for (let sq = 0; sq < board.length; sq++) {
    const piece = board[sq];
    if (!piece) continue;
    const owner = sideOf(piece);
    const kind = kindOf(piece);
    const row = rowOf(sq);
    let value = VALUE[kind];
    if (kind === 'p' && crossed(owner, row)) {
      // Across the river a soldier is worth twice as much, more as it nears the palace.
      const depth = owner === 'r' ? 4 - row : row - 5;
      value += 100 + depth * 10 - Math.abs(colOf(sq) - 4) * 5;
    }
    if (kind === 'n' || kind === 'r' || kind === 'c') value += 8 - Math.abs(colOf(sq) - 4) * 2;
    score += owner === side ? value : -value;
  }
  return score;
}

/** Captures first (most valuable victim), so alpha-beta cuts early. */
function ordered(board: Cell[], moves: Move[]): Move[] {
  const gain = (m: Move) => {
    const victim = board[m.to];
    return victim ? VALUE[kindOf(victim)] * 10 - VALUE[kindOf(board[m.from] ?? 'p')] : 0;
  };
  return moves.sort((a, b) => gain(b) - gain(a));
}

function search(board: Cell[], side: Side, depth: number, alpha: number, beta: number): number {
  if (depth === 0) return evaluate(board, side);
  const moves = legalMoves(board, side);
  // No legal move loses (sooner is worse).
  if (!moves.length) return -MATE - depth;
  let best = -Infinity;
  for (const move of ordered(board, moves)) {
    const score = -search(play(board, move), other(side), depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's move for `side`, or `null` if it has none. */
export function botMove(
  board: Cell[],
  side: Side,
  rng: () => number,
  level: BotLevel,
): Move | null {
  const { depth, noise } = LEVELS[level];
  const moves = ordered(board, legalMoves(board, side));
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = play(board, move);
    let score = -search(next, other(side), depth - 1, -Infinity, Infinity);
    // A mate is never blurred away; everything else gets a little noise so games differ.
    if (Math.abs(score) < MATE / 2) score += rng() * noise;
    // Giving check is a small plus: it keeps the pressure on.
    if (inCheck(next, other(side))) score += 5;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
