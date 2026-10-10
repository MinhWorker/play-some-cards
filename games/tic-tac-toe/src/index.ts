/**
 * Caro, the example game: copy its layout for your own. Tour and life cycle: README.md.
 *
 * Server entry: what the app needs to know about the game: its meta, its logic (a `Game`) and
 * its room options. It loads on the server, so it only imports game/.
 */
import { definePlugin } from '@xomdao/sdk';
import { CaroGame } from './game/CaroGame.js';
import { optionsSchema, WIN_COINS } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'tic-tac-toe',
    name: 'Caro',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
    genre: 'co',
    tagline: 'Xếp năm quân liền hàng trước đối thủ.',
    duration: { min: 5, max: 15 },
    rewardCap: { 'core:coin': WIN_COINS },
  },
  game: new CaroGame(),
  room: {
    options: optionsSchema,
    // Against the computer you are X (you start) and the computer takes the other seat.
    bots: (options) => (options.opponent === 'bot' ? 1 : 0),
  },
});
