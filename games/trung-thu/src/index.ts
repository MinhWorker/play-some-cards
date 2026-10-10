/**
 * Câu cá Trung Thu, the sample event: shows how an event (`kind: 'event'`) declares its dates,
 * its reward tiers and its colour, and gives points (src/game/FishingGame.ts). Its dates are
 * Trung Thu 2026, so it stays hidden until someone moves them (or the server's clock: XOMDAO_NOW,
 * dev:clock).
 */
import { definePlugin, EVENT_POINTS } from '@xomdao/sdk';
import { FishingGame } from './game/FishingGame.js';
import { MAX_POINTS } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'trung-thu',
    name: 'Trung Thu: câu cá',
    minPlayers: 1,
    maxPlayers: 1,
    status: 'ready',
    portal: { image: 'island' },
    kind: 'event',
    genre: 'su-kien',
    tagline: 'Thả câu dưới trăng rằm, gom điểm nhận quà.',
    duration: { min: 1, max: 2 },
    rewardCap: { [EVENT_POINTS]: MAX_POINTS },
    achievements: [
      {
        id: 'golden-carp',
        name: 'Cá chép vàng',
        stat: 'golden-carp',
        at: 1,
        xp: 30,
        reward: { 'core:coin': 30 },
      },
    ],
    event: {
      opensAt: '2026-09-18T00:00:00+07:00',
      closesAt: '2026-10-04T00:00:00+07:00',
      color: '#B3261E',
      tiers: [
        { points: 10, reward: { 'core:coin': 50 } },
        { points: 25, reward: { 'core:coin': 100 } },
        { points: 50, reward: { 'core:coin': 200 } },
      ],
    },
  },
  game: new FishingGame(),
});
