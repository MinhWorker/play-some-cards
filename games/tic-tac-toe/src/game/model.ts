/**
 * The game's data: what a room remembers (State) and the room's options (Options). Read this
 * file first; everything else works on these.
 */
import type { PlayerId } from '@psc/sdk';
import { z } from 'zod';

export type Mark = 'X' | 'O';
export type Cell = Mark | null;

/** Board sizes on offer, and how many marks in a row win on each. */
export const WIN_LENGTH = { 3: 3, 6: 4, 9: 5 } as const;
export type BoardSize = keyof typeof WIN_LENGTH;
export const SIZES = Object.keys(WIN_LENGTH).map(Number) as BoardSize[];

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State {
  /** Cells per side. */
  size: BoardSize;
  /** Marks in a row needed to win. */
  win: number;
  /** size × size cells, row by row (a 3×3 board: 0 1 2 / 3 4 5 / 6 7 8). */
  board: Cell[];
  /** players[0] is X (red, starts), players[1] is O (blue). */
  players: [PlayerId, PlayerId];
  turn: PlayerId;
}

/**
 * Room options. Picked on the setup screen (scenes/Setup.ts); the host can change `size` and
 * `swap` between games from the board. `optionsSchema.parse({})` gives the defaults.
 */
export const optionsSchema = z.object({
  opponent: z.enum(['human', 'bot']).default('human'),
  level: z.enum(['easy', 'normal', 'hard']).default('easy'),
  size: z.union([z.literal(3), z.literal(6), z.literal(9)]).default(3),
  /** The second seat plays X (red, starts) instead of the first. */
  swap: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export type BotLevel = Options['level'];
