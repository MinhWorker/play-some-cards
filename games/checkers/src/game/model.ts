/**
 * The game's data: what a room remembers (State), what screens see (View) and the room's options.
 * Read this file first; everything else works on these.
 *
 * The board is `size` × `size` squares stored row by row from the top as one string:
 * square = row * size + col. Pieces stand on the dark squares only ((row + col) odd): 'w' a white
 * man, 'W' a white king, 'b' a black man, 'B' a black king, '.' empty. The side that moves first
 * starts on the bottom rows and its men move up.
 */
import type { PlayerId } from '@xomdao/sdk';
import { z } from 'zod';

export type Side = 'w' | 'b';

/** The single board: simplified 8 × 8 draughts, Black moves first. */
export interface Rules {
  size: number;
  rows: number;
  first: Side;
  /** Plies without a capture or a man moving that end the game in a draw. */
  quietLimit: number;
}

export const RULES: Rules = { size: 8, rows: 3, first: 'b', quietLimit: 80 };

/** A move: the squares the piece stands on, from where it starts to where it ends, and the
 * squares of the pieces it takes. */
export interface Move {
  path: number[];
  captures: number[];
}

/** Why a game ended. */
export type EndReason =
  /** The side to move has no piece or no legal move: it loses. */
  | 'blocked'
  | 'resign'
  | 'left'
  /** The same position came up a third time: a draw. */
  | 'repetition'
  /** Rules.quietLimit plies without a capture or a man moving: a draw. */
  | 'move-limit'
  | 'agreement';

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State {
  board: string;
  /** players[0] plays the side that moves first, players[1] the other. */
  players: [PlayerId, PlayerId];
  turn: Side;
  /** The last move and the pieces it took (their letters, for the screen's animation). */
  last: (Move & { taken: string[]; crowned: boolean }) | null;
  /** Pieces each side has taken. */
  taken: Record<Side, number>;
  plies: number;
  /** Plies since the last capture or man move. */
  quiet: number;
  /** Positions (board + side to move) since the last capture or man move (server only). */
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
 * Room options, all on one setup form (godot/main.gd, room_setup). `optionsSchema.parse({})` gives the
 * defaults: two friends, 8 × 8, the room's creator moves first.
 */
export const optionsSchema = z.object({
  opponent: z.enum(['human', 'bot']).default('human'),
  level: z.enum(['easy', 'normal', 'hard']).default('normal'),
  /** The second seat moves first instead of the first. */
  swap: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export type BotLevel = Options['level'];
