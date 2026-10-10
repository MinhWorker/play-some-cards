/**
 * Server entry of an event: its meta (dates, reward tiers, colour) and its logic. It loads on
 * the server, so it only imports code from game/ (the screens are in godot/).
 */
import { definePlugin, EVENT_POINTS } from '@xomdao/sdk';
import { __Name__Game, MAX_POINTS } from './game/__Name__Game.js';

export default definePlugin({
  meta: {
    id: '__ID__',
    name: '__NAME__',
    minPlayers: 1,
    maxPlayers: 1,
    // Locked in production until you change this to 'ready'.
    status: 'wip',
    // Its card art for now: assets/island.webp.
    portal: { image: 'island' },
    kind: 'event',
    genre: 'su-kien',
    tagline: 'Hái lộc đầu mùa, gom điểm nhận quà.',
    duration: { min: 1, max: 2 },
    rewardCap: { [EVENT_POINTS]: MAX_POINTS },
    event: {
      // Shown from opensAt until just before closesAt (Vietnam time).
      opensAt: '__OPENS__T00:00:00+07:00',
      closesAt: '__CLOSES__T00:00:00+07:00',
      // The colour of its detail board.
      color: '#2E7D32',
      // Points to reach, and what each tier pays once.
      tiers: [
        { points: 10, reward: { 'core:coin': 30 } },
        { points: 25, reward: { 'core:coin': 80 } },
        { points: 50, reward: { 'core:coin': 150 } },
      ],
    },
  },
  game: new __Name__Game(),
});
