/**
 * Cờ Tướng (Xiangqi) for two, by the WXF 2018 rules: against a friend or the computer.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options. It loads on the
 * server, so it only imports game/ (scenes are in client.ts).
 */
import { definePlugin } from '@psc/sdk';
import { optionsSchema } from './game/model.js';
import { XiangqiGame } from './game/XiangqiGame.js';

export default definePlugin({
  meta: {
    id: 'xiangqi',
    name: 'Cờ Tướng',
    minPlayers: 2,
    maxPlayers: 2,
    // Locked in production until you change this to 'ready'.
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
  },
  game: new XiangqiGame(),
  room: {
    options: optionsSchema,
    // Against the computer it takes the second seat.
    bots: (options) => (options.opponent === 'bot' ? 1 : 0),
  },
});
