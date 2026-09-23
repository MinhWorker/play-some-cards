import type { AnyGameDefinition } from './game.js';
import { ticTacToe } from './games/tic-tac-toe/index.js';

/**
 * Every playable game. To add a game: create `src/games/<id>/index.ts`,
 * then add it here. See docs/adding-a-game.md.
 */
export const games: Record<string, AnyGameDefinition> = {
  [ticTacToe.id]: ticTacToe,
};

export function getGame(id: string): AnyGameDefinition | undefined {
  return games[id];
}

/** Lightweight info the web lobby can show without loading game logic. */
export const gameList = Object.values(games).map(({ id, name, minPlayers, maxPlayers }) => ({
  id,
  name,
  minPlayers,
  maxPlayers,
}));
