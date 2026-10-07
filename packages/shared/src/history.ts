/**
 * Match history: every finished game with at least one account at the table is kept on the
 * server (`apps/server/src/matches/`). A player sees their most recent ones on their profile.
 */

/** How many recent games `history:recent` returns. */
export const HISTORY_LIMIT = 20;

/** Someone who sat at the table, as they were when the game began. */
export interface MatchPlayer {
  name: string;
  avatar?: string;
  frame?: string;
  bot: boolean;
  won: boolean;
  /** Left during the game (games that go on without them). */
  left: boolean;
  /** The player asking for their history. */
  me: boolean;
}

/** One finished game, seen by one of its players. */
export interface MatchRecord {
  id: string;
  gameId: string;
  /** How it ended for the player asking. */
  outcome: 'win' | 'loss' | 'draw';
  /** Epoch milliseconds. */
  startedAt: number;
  endedAt: number;
  /** In seat order. */
  players: MatchPlayer[];
}
