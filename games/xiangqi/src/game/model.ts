/**
 * The game's data: what a room remembers (State), what screens see (View) and the room's options.
 * Read this file first; everything else works on these.
 *
 * The board is 9 files × 10 ranks of intersections, stored row by row from Black's side:
 * square = row * 9 + col, row 0 is Black's back rank, row 9 is Red's. A piece is one letter,
 * upper case for Red and lower case for Black (the letters of Xiangqi FEN).
 */
import type { PlayerId } from '@xomdao/sdk';
import { z } from 'zod';

export type Side = 'r' | 'b';
/** General, advisor, elephant, horse, chariot, cannon, soldier. */
export type Kind = 'k' | 'a' | 'b' | 'n' | 'r' | 'c' | 'p';
/** A piece: its kind's letter, upper case for Red (`R`), lower case for Black (`r`). */
export type Piece = string;
export type Cell = Piece | null;

export const COLS = 9;
export const ROWS = 10;
export const SQUARES = COLS * ROWS;

/** Plies without a capture that end the game in a draw: 60 moves each. */
export const QUIET_LIMIT = 120;

export interface Move {
  from: number;
  to: number;
}

/** Why a game ended. */
export type EndReason =
  /** In check with no legal move. */
  | 'checkmate'
  /** No legal move while not in check: that side loses too. */
  | 'stalemate'
  | 'resign'
  | 'left'
  /** Kept checking through a repetition while the other side did not: the checker loses. */
  | 'perpetual-check'
  /** Kept chasing a piece through a repetition while the other side did not: the chaser loses. */
  | 'perpetual-chase'
  /** The position came back a third time and nobody broke a rule: a draw. */
  | 'repetition'
  /** QUIET_LIMIT plies without a capture: a draw. */
  | 'move-limit'
  /** Neither side has a piece left that can cross the river: a draw. */
  | 'material'
  | 'agreement';

/** A position since the last capture, for judging repetitions. */
export interface Position {
  /** The board and the side to move, as text. */
  key: string;
  /** The move that led here gave check. */
  check: boolean;
  /** The move that led here started a chase (see referee.ts). */
  chase: boolean;
}

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State {
  /** 90 intersections (see the top of this file). */
  board: Cell[];
  /** players[0] plays Red (moves first), players[1] Black. */
  players: [PlayerId, PlayerId];
  turn: Side;
  /** The last move, and the piece it took. */
  last: (Move & { captured: Piece | null }) | null;
  /** The side to move is in check. */
  check: boolean;
  /** Pieces taken so far, in order. */
  captured: Piece[];
  /** Plies played. */
  plies: number;
  /** Plies since the last capture. */
  quiet: number;
  /** Positions since the last capture, the current one last (server only). */
  history: Position[];
  /** A side offered a draw and the other hasn't answered yet. */
  drawOffer: Side | null;
  /** How the game ended; the winner, or `null` for a draw. */
  end: { reason: EndReason; winner: Side | null } | null;
}

/** What screens get: the state without the repetition bookkeeping. */
export type View = Omit<State, 'history'>;

/**
 * Room options, all on one setup form (scenes/Setup.ts). `optionsSchema.parse({})` gives the
 * defaults: two friends, the room's creator plays Red.
 */
export const optionsSchema = z.object({
  opponent: z.enum(['human', 'bot']).default('human'),
  level: z.enum(['easy', 'normal', 'hard']).default('normal'),
  /** The second seat plays Red (moves first) instead of the first. */
  swap: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export type BotLevel = Options['level'];
