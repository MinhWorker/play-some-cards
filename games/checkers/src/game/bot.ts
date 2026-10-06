/**
 * The computer player: an alpha-beta search over material (kings worth about three men), men
 * pushing forward, holding the back row and the middle. Captures pending at the end of the
 * search are played out, so it never stops looking in the middle of an exchange.
 * CheckersGame.bot calls it in rooms against the computer.
 */
import type { BotLevel, Move, Rules, Side } from './model.js';
import { colOf, crownRow, isKing, legalMoves, other, play, rowOf, sideOf } from './rules.js';

const MAN = 100;
const KING = 300;
const WIN = 100_000;

/** How deep each level looks (plies) and how much noise blurs its choice. */
const LEVELS: Record<BotLevel, { depth: number; noise: number }> = {
  easy: { depth: 2, noise: 60 },
  normal: { depth: 4, noise: 15 },
  hard: { depth: 7, noise: 3 },
};

/** The board from `side`'s point of view. */
export function evaluate(board: string, side: Side, rules: Rules): number {
  const { size } = rules;
  let score = 0;
  for (let sq = 0; sq < board.length; sq++) {
    const piece = board[sq] ?? '.';
    if (piece === '.') continue;
    const owner = sideOf(piece);
    const row = rowOf(size, sq);
    const col = colOf(size, sq);
    let value: number;
    if (isKing(piece)) {
      // Kings like the middle, where they reach the most squares.
      value = KING - Math.abs(col - (size - 1) / 2) * 3 - Math.abs(row - (size - 1) / 2) * 3;
    } else {
      // Rows still to go before crowning; the back row guards against enemy kings.
      const togo = Math.abs(row - crownRow(owner, rules));
      value = MAN + (size - 1 - togo) * 4;
      if (togo === size - 1) value += 6;
      if (col === 0 || col === size - 1) value -= 3;
    }
    score += owner === side ? value : -value;
  }
  return score;
}

function search(
  board: string,
  side: Side,
  rules: Rules,
  depth: number,
  alpha: number,
  beta: number,
): number {
  const moves = legalMoves(board, side, rules);
  if (!moves.length) return -WIN - depth;
  // Past the depth only captures go on (they are forced anyway).
  if (depth <= 0 && (!moves[0]?.captures.length || depth < -6)) return evaluate(board, side, rules);
  let best = -Infinity;
  for (const move of ordered(moves)) {
    const next = play(board, move, rules).board;
    const score = -search(next, other(side), rules, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** Bigger captures first, so alpha-beta cuts early. */
const ordered = (moves: Move[]) => moves.sort((a, b) => b.captures.length - a.captures.length);

/** The computer's move for `side`, or `null` if it has none. */
export function botMove(
  board: string,
  side: Side,
  rules: Rules,
  rng: () => number,
  level: BotLevel,
): Move | null {
  const moves = ordered(legalMoves(board, side, rules));
  if (moves.length <= 1) return moves[0] ?? null;
  const { noise } = LEVELS[level];
  const depth = LEVELS[level].depth;
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = play(board, move, rules).board;
    // Only a move within `noise` of the best so far can still win: search it that closely.
    const floor = bestScore - noise;
    let score = -search(next, other(side), rules, depth - 1, -Infinity, -floor);
    // A forced win is never blurred away; everything else gets a little noise.
    if (Math.abs(score) < WIN / 2) score += rng() * noise;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
