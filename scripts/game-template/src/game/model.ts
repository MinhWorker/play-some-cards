/**
 * The game's data: what a room remembers (State) and what a player sends (Move).
 * Starter game ("race to 21"): players take turns adding 1, 2 or 3 to a shared total; whoever
 * reaches exactly 21 wins. Replace it with your game.
 */
import type { PlayerId } from '@psc/sdk';
import { z } from 'zod';

export const TARGET = 21;

/** Everything about one game in progress. Kept on the server, never mutated. */
export interface State {
  players: PlayerId[];
  total: number;
  turn: PlayerId;
  winner: PlayerId | null;
}

/** A move. The server rejects any other shape before the rules run. */
export const moveSchema = z.object({ add: z.number().int().min(1).max(3) });
export type Move = z.infer<typeof moveSchema>;
