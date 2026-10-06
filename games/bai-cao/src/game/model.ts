/**
 * The game's data: what a room remembers (State), what screens see (View) and the room's options.
 * Read this file first; everything else works on these.
 *
 * A game is `rounds` rounds. Each round one seat is the dealer ("cái", in turn round the table);
 * the others bet, everyone gets three cards and turns them over, and each player's hand is
 * compared with the dealer's: the stronger hand wins the bet. Points carry over from round to
 * round; the most points at the end wins. Arrays are indexed by seat (`ctx.players` order).
 */
import { z } from 'zod';
import type { Card } from './cards.js';

/** The bets a player may place. */
export const BETS = [5, 10, 20] as const;
/** The bet of a player who didn't choose in time. */
export const DEFAULT_BET = 5;

/** How long each part of a round lasts, in ms. */
export const TIMES = { bet: 15_000, reveal: 20_000, showdown: 5_000 } as const;

export interface Result {
  seat: number;
  /** Points won (+) or lost (−) this round; the dealer's is the sum against everyone. */
  delta: number;
}

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State {
  /** 1-based. */
  round: number;
  rounds: number;
  /** `bet`: players bet; `reveal`: cards dealt, players turn them over; `showdown`: counted. */
  phase: 'bet' | 'reveal' | 'showdown';
  dealer: number;
  points: number[];
  /** This round's bets (`null`: not yet, or the dealer). */
  bets: (number | null)[];
  /** Three cards per seat while the round is dealt, `[]` before (secret until revealed). */
  hands: Card[][];
  revealed: boolean[];
  /** Seats that left the room: they sit out the rest of the game. */
  gone: number[];
  /** The last showdown's results (`null` before one, or after a round was called off). */
  results: Result[] | null;
}

/** What screens get: other players' cards only once they are turned over. */
export interface View extends Omit<State, 'hands'> {
  /** A seat's cards, or `null` while they are face down to this viewer. */
  hands: (Card[] | null)[];
}

/**
 * Room options (scenes/Setup.ts). `optionsSchema.parse({})` gives the defaults: no computer
 * players, 10 rounds.
 */
export const optionsSchema = z.object({
  bots: z.number().int().min(0).max(5).default(0),
  rounds: z.union([z.literal(5), z.literal(10), z.literal(20)]).default(10),
});
export type Options = z.infer<typeof optionsSchema>;
