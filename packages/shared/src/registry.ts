import type { AnyGameDefinition } from './game.js';
import { plugins } from './generated/games.js';

/**
 * Every game in games/*, found by scripts/gen-plugins.mjs (it writes generated/games.ts on
 * install and before every build). There is nothing to register by hand.
 */
export const games: Record<string, AnyGameDefinition> = Object.fromEntries(
  plugins.map(({ meta, rules, room }) => [meta.id, { ...rules, ...meta, room }]),
);

export function getGame(id: string): AnyGameDefinition | undefined {
  return games[id];
}

/** Lightweight info the web lobby can show without loading game logic. */
export const gameList = Object.values(games).map(
  ({ id, name, minPlayers, maxPlayers, status }) => ({
    id,
    name,
    minPlayers,
    maxPlayers,
    status,
  }),
);
