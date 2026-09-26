/**
 * Server entry: what the app needs to know about the game, and its logic (a `Game`). It loads on the server, so it only imports code from game/ (scenes are in client.ts).
 */
import { definePlugin } from '@psc/sdk';
import { XiangqiGame } from './game/XiangqiGame.js';

export default definePlugin({
  meta: {
    id: 'xiangqi',
    name: 'Cờ Tướng',
    minPlayers: 2,
    maxPlayers: 2,
    // Locked in production until you change this to 'ready'.
    status: 'wip',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
  },
  game: new XiangqiGame(),
});
