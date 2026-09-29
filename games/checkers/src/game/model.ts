/**
 * The game's data: what a room remembers (State), what screens see (View) and the room's options.
 * Read this file first; everything else works on these.
 *
 * The board is `size` × `size` squares stored row by row from the top as one string:
 * square = row * size + col. Pieces stand on the dark squares only ((row + col) odd): 'w' a white
 * man, 'W' a white king, 'b' a black man, 'B' a black king, '.' empty. The side that moves first
 * starts on the bottom rows and its men move up.
 */
import type { PlayerId } from '@psc/sdk';
import { z } from 'zod';

export type Side = 'w' | 'b';

/**
 * `english`: 8 × 8, Black first, men move and take forward only, kings step one square, any
 * capture sequence may be chosen. `international`: 10 × 10, White first, men take backwards
 * too, kings fly, the sequence taking the most pieces is required.
 */
export type Variant = 'english' | 'international';

export interface Rules {
  size: number;
  /** Rows of men each side starts with. */
  rows: number;
  first: Side;
  /** Men may take backwards. */
  menTakeBack: boolean;
  /** Kings move and take any distance along a diagonal. */
  flyingKings: boolean;
  /** The sequence taking the most pieces must be played. */
  mostCaptures: boolean;
  /** A man reaching the far row mid-capture is crowned there and stops. */
  crownStops: boolean;
  /** Plies without a capture or a man moving that end the game in a draw. */
  quietLimit: number;
}

export const RULES: Record<Variant, Rules> = {
  english: {
    size: 8,
    rows: 3,
    first: 'b',
    menTakeBack: false,
    flyingKings: false,
    mostCaptures: false,
    crownStops: true,
    quietLimit: 80,
  },
  international: {
    size: 10,
    rows: 4,
    first: 'w',
    menTakeBack: true,
    flyingKings: true,
    mostCaptures: true,
    crownStops: false,
    quietLimit: 50,
  },
};

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
  variant: Variant;
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

/** What screens get: the state without the repetition bookkeeping. */
export type View = Omit<State, 'history'>;

/**
 * Room options, all on one setup form (scenes/Setup.ts). `optionsSchema.parse({})` gives the
 * defaults: two friends, 8 × 8, the room's creator moves first.
 */
export const optionsSchema = z.object({
  opponent: z.enum(['human', 'bot']).default('human'),
  level: z.enum(['easy', 'normal', 'hard']).default('normal'),
  variant: z.enum(['english', 'international']).default('english'),
  /** The second seat moves first instead of the first. */
  swap: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export type BotLevel = Options['level'];
