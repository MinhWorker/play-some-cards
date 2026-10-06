/**
 * The computer player: it weighs every legal point by a few rules of thumb (take stones, save
 * its own chains in atari, never walk into atari, threaten the other side's chains, take the
 * third and fourth lines early, stay near the stones) with some noise per level. It never fills
 * its own eyes, and passes once nothing is worth playing. GoGame.bot calls it.
 */
import type { BotLevel, Side } from './model.js';
import {
  colOf,
  colorOf,
  fromCells,
  groupOf,
  hashOf,
  isEye,
  neighbors,
  owners,
  ownership,
  playCells,
  rowOf,
  toCells,
} from './rules.js';

/** How much noise blurs each level's choice (the rules of thumb are worth 5 to 100s). */
const NOISE: Record<BotLevel, number> = { easy: 30, normal: 10, hard: 3 };

/** Below this, a move isn't worth making when the other side just passed. */
const WORTH = 6;

export interface BotPosition {
  board: string;
  size: number;
  turn: Side;
  ko: number | null;
  /** The other side's last move was a pass. */
  passed: boolean;
  plies: number;
  /** Hashes of every position so far (a move may not bring one back). */
  history: readonly number[];
}

/** How good playing `p` looks, or `null` when it is illegal or fills its own eye. */
function weigh(pos: BotPosition, p: number, settled: boolean, opening: boolean): number | null {
  const { size } = pos;
  const color = colorOf(pos.turn);
  const enemy = 3 - color;
  const cells = toCells(pos.board);
  if (p === pos.ko || isEye(cells, size, p, color)) return null;
  const adj = neighbors(size)[p] ?? [];
  // Before: the chains next to p and their liberties.
  const before = adj
    .filter((q) => cells[q] !== 0)
    .map((q) => ({ q, color: cells[q], ...groupOf(cells, size, q) }));
  const after = cells.slice();
  const captured = playCells(after, size, p, color);
  if (!captured) return null;
  if (pos.history.includes(hashOf(fromCells(after)))) return null;

  let value = captured.length * 40;
  const own = groupOf(after, size, p);
  const libs = own.liberties.length;
  // Saving a chain of its own that was in atari.
  for (const chain of before) {
    if (chain.color === color && chain.liberties.length === 1 && libs >= 2) {
      value += 30 * chain.stones.length;
    }
  }
  // Walking into atari (or a single liberty that just gets taken) is bad.
  if (libs === 1 && !captured.length) value -= 25 * own.stones.length + 10;
  else if (libs === 2) value -= 4;
  // Threatening the other side's chains: atari, or fewer liberties.
  const hit = new Set<number>();
  for (const chain of before) {
    if (chain.color !== enemy || hit.has(chain.stones[0] ?? -1)) continue;
    hit.add(chain.stones[0] ?? -1);
    const left = chain.liberties.length - 1;
    if (left === 1) value += 12 * chain.stones.length;
    else if (left === 2) value += 3;
  }
  // Shape: the third and fourth lines early, never the first line without a reason.
  const line = Math.min(
    rowOf(size, p),
    colOf(size, p),
    size - 1 - rowOf(size, p),
    size - 1 - colOf(size, p),
  );
  if (line === 0) value -= 10;
  else if (line === 1) value -= opening ? 6 : 1;
  else if (opening && (line === 2 || line === 3)) value += 8;
  // Inside an area one side surely owns there is little left to gain.
  if (settled) value -= 12;
  // Room to grow: empty points around it.
  value += adj.filter((q) => after[q] === 0).length;
  // Stay in touch with the game (except in the opening, where the board is open).
  if (!opening) {
    let near = false;
    for (const q of adj) if (cells[q] !== 0) near = true;
    for (const q of adj) for (const r of neighbors(size)[q] ?? []) if (cells[r] !== 0) near = true;
    if (near) value += 4;
  }
  return value;
}

/** The computer's point to play, or `null` to pass. */
export function botMove(pos: BotPosition, rng: () => number, level: BotLevel): number | null {
  let best: number | null = null;
  let bestValue = -Infinity;
  let bestRaw = -Infinity;
  // Points random games say one side surely owns: little left to gain there.
  const runs = pos.size <= 9 ? 48 : pos.size <= 13 ? 24 : 12;
  const own = ownership(pos.board, pos.size, pos.turn, rng, runs);
  // Sure in random games, or leaning one way inside an area only that side's stones surround.
  const region = owners(toCells(pos.board), pos.size);
  const settled = (p: number) => {
    const lean = own[p] ?? 0;
    if (Math.abs(lean) > 0.5) return true;
    return Math.abs(lean) > 0.25 && region[p] === (lean > 0 ? 'b' : 'w');
  };
  // The opening lasts while the board holds few stones.
  const stones = [...pos.board].filter((c) => c !== '.').length;
  const opening = stones < pos.size * 1.5;
  for (let p = 0; p < pos.size * pos.size; p++) {
    if (pos.board[p] !== '.') continue;
    const raw = weigh(pos, p, settled(p), opening);
    if (raw === null) continue;
    const value = raw + rng() * NOISE[level];
    if (value > bestValue) {
      bestValue = value;
      bestRaw = raw;
      best = p;
    }
  }
  if (best === null) return null;
  // Nothing worth a stone: pass when the other side passed, or when every move hurts.
  if (bestRaw < 0) return null;
  if (pos.passed && bestRaw < WORTH) return null;
  // A game that has gone on this long is settled.
  if (pos.plies > pos.size * pos.size * 2) return null;
  return best;
}
