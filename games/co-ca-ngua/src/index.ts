import { definePlugin } from '@psc/sdk';
import { rules } from './rules.js';

export default definePlugin({
  meta: {
    id: 'co-ca-ngua',
    name: 'Cờ Cá Ngựa',
    minPlayers: 2,
    maxPlayers: 4,
    // Locked in production until you change this to 'ready'.
    status: 'wip',
    portal: { image: 'island' },
  },
  rules,
});
