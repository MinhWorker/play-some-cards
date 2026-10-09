/**
 * The game's data: what a room remembers (State) and the room's options (Options). Read this
 * file first; everything else works on these.
 */
import type { PlayerId } from '@xomdao/sdk';
import { z } from 'zod';

export type Mark = 'X' | 'O';
export type Cell = Mark | null;

/** Marks in a row that win. */
export const WIN = 5;
/** Cells per side of a new board. */
export const START_SIDE = 9;
/** Rows or columns a mark on an edge adds on that side. */
export const GROW = 3;
/** The board grows no wider and no taller than this (a 15×15 board at most). */
export const MAX_SIDE = 15;

/** A cell by its coordinates: x to the right, y down; (0, 0) is the new board's top-left cell. */
export interface Point {
  x: number;
  y: number;
}

/** The board as it is now: a rectangle of cells that grows as marks reach its edges. */
export interface Board {
  /** Coordinates of the top-left cell: 0, 0 on a new board, negative once it grew left or up. */
  left: number;
  top: number;
  cols: number;
  rows: number;
  /** rows × cols cells, row by row. */
  cells: Cell[];
}

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State {
  board: Board;
  /** players[0] is X (red, starts), players[1] is O (blue). */
  players: [PlayerId, PlayerId];
  turn: PlayerId;
}

/**
 * Room options. Picked on the setup screen (scenes/Setup.ts); the host can change `swap`
 * between games from the board. `optionsSchema.parse({})` gives the defaults.
 */
export const optionsSchema = z.object({
  opponent: z.enum(['human', 'bot']).default('human'),
  level: z.enum(['easy', 'normal', 'hard']).default('easy'),
  /** The second seat plays X (red, starts) instead of the first. */
  swap: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export type BotLevel = Options['level'];
