/**
 * The game's data: what a room remembers (State), what screens see (View) and the room's options.
 * Read this file first; everything else works on these.
 *
 * The board is `size` × `size` intersections, stored row by row from the top as one string:
 * point = row * size + col, '.' empty, 'b' a black stone, 'w' a white stone.
 */
import type { PlayerId } from '@xomdao/sdk';
import { z } from 'zod';

export type Side = 'b' | 'w';
export type Cell = Side | '.';

/** Standard Go board: every room uses 19 × 19 intersections. */
export const BOARD_SIZE = 19;

/** Points White gets for playing second (area scoring, so no game ends in a tie). */
export const KOMI = 7.5;

/** Why a game ended: `score` when both passed and agreed on the dead stones. */
export type EndReason = 'score' | 'resign' | 'left';

/** The area count: stones plus surrounded empty points, and White's komi. */
export interface Score {
  b: number;
  w: number;
}

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State {
  size: typeof BOARD_SIZE;
  /** size × size points (see the top of this file). */
  board: string;
  /** players[0] plays Black (moves first), players[1] White. */
  players: [PlayerId, PlayerId];
  turn: Side;
  /** The last move: a point, or `null` for a pass, and the stones it took. */
  last: { side: Side; point: number | null; captured: number[] } | null;
  /** The point the side to move may not take back right now (a ko), or `null`. */
  ko: number | null;
  /** Stones each side has taken so far. */
  prisoners: Record<Side, number>;
  /** Passes in a row: two end the play and start counting. */
  passes: number;
  /** Stones played and passes so far. */
  plies: number;
  /**
   * `play`, then `scoring` after two passes: players mark the dead stones (a first guess is
   * already marked), both accept, and the count decides; or one of them resumes play.
   */
  phase: 'play' | 'scoring';
  /** Scoring: the stones marked dead. */
  dead: number[];
  /** Scoring: the server's first guess of the dead stones (the computer holds to it). */
  guess: number[];
  /** Scoring: sides that accepted the current marking. */
  accepted: Side[];
  /** Hashes of every position so far (server only): no move may bring one back. */
  history: number[];
  /** How the game ended: the winner and, when counted, the count. */
  end: { reason: EndReason; winner: Side; score: Score | null } | null;
}

/**
 * What screens get: the state without the position history, plus what a screen would otherwise
 * need the rules for: the points the player who sees it may play on their turn (empty
 * otherwise), and while counting (or after a count) the count with each point's owner.
 */
export type View = Omit<State, 'history'> & {
  moves: number[];
  count: (Score & { owner: string }) | null;
};

/**
 * Room options, all on one setup form (scenes/Setup.ts). `optionsSchema.parse({})` gives the
 * defaults: two friends on a 9 × 9 board, the room's creator plays Black.
 */
export const optionsSchema = z.object({
  opponent: z.enum(['human', 'bot']).default('human'),
  level: z.enum(['easy', 'normal', 'hard']).default('normal'),
  /** The second seat plays Black (moves first) instead of the first. */
  swap: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export type BotLevel = Options['level'];
