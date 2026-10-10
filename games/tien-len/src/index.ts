/**
 * Tiến Lên, southern rules: 2–4 players, 13 cards each, the first to empty their hand wins.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options (computer players).
 */
import { definePlugin } from '@xomdao/sdk';
import { optionsSchema, WIN_COINS } from './game/model.js';
import { TienLenGame } from './game/TienLenGame.js';

export default definePlugin({
  meta: {
    id: 'tien-len',
    name: 'Tiến Lên',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
    genre: 'bai',
    tagline: 'Đánh hết bài trên tay trước mọi người.',
    duration: { min: 5, max: 15 },
    rewardCap: { 'core:coin': WIN_COINS },
    achievements: [
      { id: 'chop', name: 'Chặt heo', stat: 'chop', at: 1, xp: 30, reward: { 'core:coin': 30 } },
      {
        id: 'ten-wins',
        name: 'Mười ván Tiến Lên thắng',
        stat: 'won',
        at: 10,
        xp: 80,
        reward: { 'core:coin': 100 },
      },
    ],
  },
  game: new TienLenGame(),
  room: {
    options: optionsSchema,
    bots: (options) => options.bots,
    withBots: (options, count) => ({ ...options, bots: count }),
  },
});
