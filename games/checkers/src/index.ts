/**
 * Cờ Đam (draughts) for two: standard 8 × 8 English draughts, against a friend
 * or the computer.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options. It loads on the
 * server, so it only imports game/ (scenes are in client.ts).
 */
import { definePlugin } from '@psc/sdk';
import { CheckersGame } from './game/CheckersGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'checkers',
    name: 'Cờ Đam',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
  },
  game: new CheckersGame(),
  room: {
    options: optionsSchema,
    // Against the computer it takes the second seat.
    bots: (options) => (options.opponent === 'bot' ? 1 : 0),
  },
});
