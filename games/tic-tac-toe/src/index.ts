/**
 * Caro, the example game: copy its layout for your own. Tour and life cycle: README.md.
 *
 * Server entry: what the app needs to know about the game: its meta, its logic (a `Game` turned
 * into rules) and its room options. It loads on the server, so it only imports game/.
 */
import { definePlugin, gameRules } from '@psc/sdk';
import { CaroGame } from './game/CaroGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'tic-tac-toe',
    name: 'Caro',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
  },
  rules: gameRules(new CaroGame()),
  room: {
    options: optionsSchema,
    // Against the computer you are X (you start) and the computer takes the other seat.
    bots: (options) => (options.opponent === 'bot' ? 1 : 0),
  },
});
