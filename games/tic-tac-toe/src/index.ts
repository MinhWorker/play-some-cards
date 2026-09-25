import { definePlugin } from '@psc/sdk';
import { rules } from './rules.js';

export default definePlugin({
  meta: {
    id: 'tic-tac-toe',
    name: 'Caro 3×3',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'ready',
    portal: { image: 'island' },
  },
  rules,
});
