/**
 * Caro, the example game: copy its layout for your own. Tour and life cycle: README.md.
 *
 * Server entry: what the app needs to know about the game. It loads on the server, so it only
 * imports pure code from game/ (scenes are in client.ts).
 */
import { definePlugin } from '@psc/sdk';
import { bot } from './game/bot.js';
import { optionsSchema } from './game/model.js';
import { rules } from './game/rules.js';

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
  rules: { ...rules, bot },
  room: {
    options: optionsSchema,
    // Against the computer you are X (you start) and the computer takes the other seat.
    bots: (options) => (options.opponent === 'bot' ? 1 : 0),
  },
});
