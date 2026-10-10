/**
 * Match history: every finished game with at least one account at the table is kept on the
 * server (`apps/server/src/matches/`). A player sees their most recent ones on their profile.
 */

/** How many recent games `history:recent` returns. */
export const HISTORY_LIMIT = 20;
