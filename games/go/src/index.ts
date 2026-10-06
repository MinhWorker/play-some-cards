/**
 * Cờ Vây (Go) for two, by Chinese rules (area scoring, komi 7.5) on the standard
 * 19 × 19 board: against a friend or the computer.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options. It loads on the
 * server, so it only imports game/ (scenes are in client.ts).
 */
import { definePlugin } from '@psc/sdk';
import { GoGame } from './game/GoGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'go',
    name: 'Cờ Vây',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
  },
  game: new GoGame(),
  room: {
    options: optionsSchema,
    // Against the computer it takes the second seat.
    bots: (options) => (options.opponent === 'bot' ? 1 : 0),
  },
});
