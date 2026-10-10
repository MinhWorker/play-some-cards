/**
 * Bài Cào (ba cây) for 2–6: each round one player deals ("cái"), the others bet against the
 * dealer, everyone gets three cards, and the hand with more points (the last digit of the sum)
 * wins. The most points after all the rounds wins the game.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options (computer players).
 */
import { definePlugin } from '@xomdao/sdk';
import { BaiCaoGame } from './game/BaiCaoGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'bai-cao',
    name: 'Bài Cào',
    minPlayers: 2,
    maxPlayers: 6,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
    genre: 'bai',
    tagline: 'Ba lá bài, ai nhiều nút hơn thì thắng.',
    duration: { min: 2, max: 5 },
  },
  game: new BaiCaoGame(),
  room: {
    options: optionsSchema,
    bots: (options) => options.bots,
    withBots: (options, count) => ({ ...options, bots: count }),
  },
});
