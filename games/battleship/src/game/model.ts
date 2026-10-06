/**
 * The game's data: what a room remembers (State), what screens see (View) and the room's options.
 * Read this file first; everything else works on these.
 *
 * Each player has a sea of 10 × 10 cells, stored row by row from the top: cell = row * 10 + col.
 * A ship is the cells it covers. Seats are 0 and 1 (`players[seat]`); seat 0 fires first.
 */
import type { PlayerId } from '@psc/sdk';
import { z } from 'zod';

export const SIZE = 10;
export const CELLS = SIZE * SIZE;

/** The fleet, longest first. */
export const FLEET = [5, 4, 3, 3, 2] as const;
export const SHIP_NAMES: Record<number, string> = {
  5: 'Tàu sân bay',
  4: 'Thiết giáp hạm',
  3: 'Tuần dương hạm',
  2: 'Khu trục hạm',
};

export type Seat = 0 | 1;

export interface Ship {
  /** The cells it covers, in order along its length. */
  cells: number[];
}

/** Why a game ended. */
export type EndReason = 'sunk' | 'resign' | 'left';

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State {
  /** players[0] fires first. */
  players: [PlayerId, PlayerId];
  /** `setup`: both arrange their fleets and say they are ready; then `battle`. */
  phase: 'setup' | 'battle';
  /** Each seat's own fleet (secret until a ship sinks). */
  fleets: [Ship[], Ship[]];
  ready: [boolean, boolean];
  /** shots[seat]: the cells that seat fired at, in the other seat's sea. */
  shots: [number[], number[]];
  turn: Seat;
  /** The last shot: who fired, where, and whether it hit or sank a ship (its cells). */
  last: { by: Seat; cell: number; hit: boolean; sunk: number[] | null } | null;
  end: { reason: EndReason; winner: Seat } | null;
}

/** One sea as a screen may see it. */
export interface Waters {
  /** Every ship for its owner; only the sunk ones for anyone else. */
  ships: Ship[];
  /** The other seat's shots here, and whether each hit. */
  shots: { cell: number; hit: boolean }[];
  /** Ships of this fleet sunk so far, by length (anyone may know which are gone). */
  sunk: number[];
}

/** What screens get: no fleet but your own, and the shots with their results. */
export interface View extends Omit<State, 'fleets' | 'shots'> {
  /** waters[seat]: that seat's own sea. */
  waters: [Waters, Waters];
}

/**
 * Room options, all on one setup form (scenes/Setup.ts). `optionsSchema.parse({})` gives the
 * defaults: two friends, ships may not touch, a hit earns another shot, the room's creator
 * fires first.
 */
export const optionsSchema = z.object({
  opponent: z.enum(['human', 'bot']).default('human'),
  level: z.enum(['easy', 'normal', 'hard']).default('normal'),
  /** Ships keep a cell of water between them, diagonals included. */
  spacing: z.boolean().default(true),
  /** A hit earns another shot. */
  bonus: z.boolean().default(true),
  /** The second seat fires first. */
  swap: z.boolean().default(false),
});
export type Options = z.infer<typeof optionsSchema>;
export type BotLevel = Options['level'];
