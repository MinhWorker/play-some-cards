/**
 * Server entry: what the app needs to know about the game, and its logic (a `Game`). It loads on the server, so it only imports code from game/ (scenes are in client.ts).
 */
import { definePlugin } from '@xomdao/sdk';
import { CoTyPhuClassicGame } from './game/CoTyPhuClassicGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'co-ty-phu-classic',
    name: 'Cờ tỷ phú Classic',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
    genre: 'co',
    tagline: 'Mua đất, xây nhà, khiến đối thủ phá sản.',
    duration: { min: 30, max: 60 },
  },
  game: new CoTyPhuClassicGame(),
  room: {
    options: optionsSchema,
    bots: (options) => options.bots,
    withBots: (options, count) => ({ ...options, bots: count }),
  },
});
