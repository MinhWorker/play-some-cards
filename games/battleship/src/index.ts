/**
 * Bắn Tàu (Battleship) for two: each hides a fleet of five ships on a 10 × 10 sea, then they
 * take turns firing at the other sea until one fleet is sunk. Against a friend or the computer.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options. It loads on the
 * server, so it only imports game/ (scenes are in client.ts).
 */
import { definePlugin } from '@psc/sdk';
import { BattleshipGame } from './game/BattleshipGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'battleship',
    name: 'Bắn Tàu',
    minPlayers: 2,
    maxPlayers: 2,
    // Locked in production until you change this to 'ready'.
    status: 'wip',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
  },
  game: new BattleshipGame(),
  room: {
    options: optionsSchema,
    // Against the computer it takes the second seat.
    bots: (options) => (options.opponent === 'bot' ? 1 : 0),
  },
});
