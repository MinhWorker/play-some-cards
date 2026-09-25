import { definePlugin } from '@psc/sdk';
import { rules } from './rules.js';

export default definePlugin({
  meta: {
    id: '__ID__',
    name: '__NAME__',
    minPlayers: 2,
    maxPlayers: 4,
    // Locked in production until you change this to 'ready'.
    status: 'wip',
    portal: { image: 'island' },
  },
  rules,
});
