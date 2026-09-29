/**
 * Cờ Đam (draughts) for two: 8 × 8 English draughts or 10 × 10 international, against a friend
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
    // Locked in production until you change this to 'ready'.
    status: 'wip',
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
