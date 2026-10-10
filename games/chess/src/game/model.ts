/**
 * The game's data: what a room remembers (State), what screens see (View) and the room's options.
 * Read this file first; everything else works on these.
 *
 * The board is 8 × 8 squares, stored row by row from Black's side: square = row * 8 + col,
 * row 0 is rank 8 (Black's back rank), row 7 is rank 1 (White's), col 0 is file a. A piece is one
 * letter, upper case for White and lower case for Black (the letters of FEN).
 */
import type { PlayerId } from '@xomdao/sdk';
import { z } from 'zod';

export type Side = 'w' | 'b';
/** King, queen, rook, bishop, knight, pawn. */
export type Kind = 'k' | 'q' | 'r' | 'b' | 'n' | 'p';
/** What a pawn may become on the last rank. */
export type Promotion = 'q' | 'r' | 'b' | 'n';
/** A piece: its kind's letter, upper case for White (`Q`), lower case for Black (`q`). */
export type Piece = string;
export type Cell = Piece | null;

export const SIZE = 8;
export const SQUARES = SIZE * SIZE;

/** Plies without a capture or a pawn move that end the game in a draw: 50 moves each. */
export const QUIET_LIMIT = 100;

export interface Move {
  from: number;
  to: number;
  /** Required when a pawn reaches the last rank. */
  promotion?: Promotion;
}

/**
 * Everything the rules need to know about a position: the board, the side to move, the castling
 * still allowed (a subset of `KQkq`, like FEN) and the square a pawn may take en passant.
 */
export interface Position {
  board: Cell[];
  turn: Side;
  castling: string;
  ep: number | null;
}

/** Why a game ended. */
export type EndReason =
  /** In check with no legal move: that side loses. */
  | 'checkmate'
  /** No legal move while not in check: a draw. */
  | 'stalemate'
  | 'resign'
  | 'left'
  /** The same position came up a third time: a draw. */
  | 'repetition'
  /** QUIET_LIMIT plies without a capture or a pawn move: a draw. */
  | 'move-limit'
  /** Neither side has enough pieces left to mate: a draw. */
  | 'material'
  | 'agreement';

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State extends Position {
  /** players[0] plays White (moves first), players[1] Black. */
  players: [PlayerId, PlayerId];
  /** The last move, the piece it took and whether it was castling or en passant. */
  last: (Move & { captured: Piece | null; castle: boolean; enPassant: boolean }) | null;
  /** The side to move is in check. */
  check: boolean;
  /** Pieces taken so far, in order. */
  captured: Piece[];
  /** Plies played. */
  plies: number;
  /** Plies since the last capture or pawn move. */
  quiet: number;
  /** Position keys since the last capture or pawn move, the current one last (server only). */
  history: string[];
  /** A side offered a draw and the other hasn't answered yet. */
  drawOffer: Side | null;
  /** How the game ended; the winner, or `null` for a draw. */
  end: { reason: EndReason; winner: Side | null } | null;
}

/**
 * What screens get: the state without the repetition bookkeeping, plus the legal moves of the
 * player who sees it when it is their turn (empty otherwise), so a screen need not know the rules.
 */
export type View = Omit<State, 'history'> & { moves: Move[] };

/**
 * Room options, all on one setup form (scenes/Setup.ts). `optionsSchema.parse({})` gives the
 * defaults: two friends, the room's creator plays White.
 */
export const optionsSchema = z.object({
  opponent: z.enum(['human', 'bot']).default('human'),
  level: z.enum(['easy', 'normal', 'hard']).default('normal'),
  /** The second seat plays White (moves first) instead of the first. */
  swap: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export type BotLevel = Options['level'];
