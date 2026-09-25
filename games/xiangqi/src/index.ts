import { definePlugin } from '@psc/sdk';
import { rules } from './rules.js';

export default definePlugin({
  meta: {
    id: 'xiangqi',
    name: 'Cờ Tướng',
    minPlayers: 2,
    maxPlayers: 2,
    // Locked in production until you change this to 'ready'.
    status: 'wip',
    portal: { image: 'island' },
  },
  rules,
});
