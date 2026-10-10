/**
 * Server entry: what the app needs to know about the game, and its logic (a `Game`). It loads on the server, so it only imports code from game/ (scenes are in client.ts).
 */
import { definePlugin } from '@xomdao/sdk';
import { CoCaNguaGame } from './game/CoCaNguaGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'co-ca-ngua',
    name: 'Cờ Cá Ngựa',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
    genre: 'co',
    tagline: 'Gieo xúc xắc, đưa cả bốn ngựa về chuồng trước.',
    duration: { min: 20, max: 40 },
  },
  game: new CoCaNguaGame(),
  room: {
    options: optionsSchema,
    bots: (options) => options.bots,
    withBots: (options, count) => ({ ...options, bots: count }),
  },
});
