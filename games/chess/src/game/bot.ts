/**
 * The computer player: a small alpha-beta search over material and a few positional nudges,
 * with a short look at captures past its depth so it doesn't leave pieces hanging.
 * ChessGame.bot calls it in rooms against the computer.
 */
import type { BotLevel, Kind, Move, Position, Side } from './model.js';
import {
  captureOf,
  colOf,
  inCheck,
  kindOf,
  legalMoves,
  play,
  pseudoMoves,
  rowOf,
  sideOf,
} from './rules.js';

const VALUE: Record<Kind, number> = { k: 0, q: 900, r: 500, b: 330, n: 320, p: 100 };
const MATE = 100_000;

/** How deep each level looks (plies), how far it follows captures and how much noise blurs it. */
const LEVELS: Record<BotLevel, { depth: number; captures: number; noise: number }> = {
  easy: { depth: 1, captures: 0, noise: 120 },
  normal: { depth: 2, captures: 2, noise: 30 },
  hard: { depth: 3, captures: 4, noise: 6 },
};

/** The position from `side`'s point of view: its pieces minus the other side's. */
export function evaluate({ board }: Position, side: Side): number {
  let score = 0;
  for (let sq = 0; sq < board.length; sq++) {
    const piece = board[sq];
    if (!piece) continue;
    const owner = sideOf(piece);
    const kind = kindOf(piece);
    const row = rowOf(sq);
    const col = colOf(sq);
    // Distance from the four middle squares (0 in the middle, 6 in a corner).
    const off = Math.abs(3.5 - row) + Math.abs(3.5 - col) - 1;
    let value = VALUE[kind];
    if (kind === 'n' || kind === 'b') value += 12 - off * 4;
    if (kind === 'q') value += 4 - off;
    if (kind === 'p') {
      // Pawns gain as they advance, more in the middle files.
      const advanced = owner === 'w' ? 6 - row : row - 1;
      value += advanced * (col >= 2 && col <= 5 ? 8 : 4);
    }
    if (kind === 'k') {
      // Kings stay home behind their pawns until the board empties.
      const home = owner === 'w' ? 7 - row : row;
      value -= home * 12;
    }
    score += owner === side ? value : -value;
  }
  return score;
}

/** Captures first (most valuable victim, cheapest attacker), then promotions. */
function ordered(pos: Position, moves: Move[]): Move[] {
  const gain = (m: Move) => {
    const victim = captureOf(pos, m);
    const attacker = pos.board[m.from];
    const take = victim ? VALUE[kindOf(victim)] * 10 - VALUE[kindOf(attacker ?? 'p')] : 0;
    return take + (m.promotion ? VALUE[m.promotion] : 0);
  };
  return moves.sort((a, b) => gain(b) - gain(a));
}

/** Past the depth: stand pat, or take something if it pays (up to `left` more captures). */
function captures(pos: Position, alpha: number, beta: number, left: number): number {
  const stand = evaluate(pos, pos.turn);
  if (left === 0 || stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  const moves: Move[] = [];
  for (let from = 0; from < pos.board.length; from++) {
    const piece = pos.board[from];
    if (!piece || sideOf(piece) !== pos.turn) continue;
    for (const m of pseudoMoves(pos, from)) if (captureOf(pos, m)) moves.push(m);
  }
  for (const move of ordered(pos, moves)) {
    const next = play(pos, move);
    if (inCheck(next.board, pos.turn)) continue;
    const score = -captures(next, -beta, -alpha, left - 1);
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function search(pos: Position, depth: number, alpha: number, beta: number, tail: number): number {
  if (depth === 0) return captures(pos, alpha, beta, tail);
  const moves = legalMoves(pos);
  // Mated loses (sooner is worse); stalemate is a draw.
  if (!moves.length) return inCheck(pos.board, pos.turn) ? -MATE - depth : 0;
  let best = -Infinity;
  for (const move of ordered(pos, moves)) {
    const score = -search(play(pos, move), depth - 1, -beta, -alpha, tail);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/** The computer's move for the side to move, or `null` if it has none. */
export function botMove(pos: Position, rng: () => number, level: BotLevel): Move | null {
  const { depth, captures: tail, noise } = LEVELS[level];
  const moves = ordered(pos, legalMoves(pos));
  let best: Move | null = null;
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = play(pos, move);
    // Only a move within `noise` of the best so far can still win: search it that closely.
    const floor = bestScore - noise;
    let score = -search(next, depth - 1, -Infinity, -floor, tail);
    // A mate is never blurred away; everything else gets a little noise so games differ.
    if (Math.abs(score) < MATE / 2) score += rng() * noise;
    if (score > bestScore) {
      bestScore = score;
      best = move;
    }
  }
  return best;
}
