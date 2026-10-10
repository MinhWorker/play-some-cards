/**
 * Cờ Vua (chess) for two, by the FIDE Laws of Chess: against a friend or the computer.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options. It loads on the
 * server, so it only imports game/ (scenes are in client.ts).
 */
import { definePlugin } from '@xomdao/sdk';
import { ChessGame } from './game/ChessGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'chess',
    name: 'Cờ Vua',
    minPlayers: 2,
    maxPlayers: 2,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
    genre: 'co',
    tagline: 'Chiếu hết vua của đối phương.',
    duration: { min: 15, max: 40 },
  },
  game: new ChessGame(),
  room: {
    options: optionsSchema,
    // Against the computer it takes the second seat.
    bots: (options) => (options.opponent === 'bot' ? 1 : 0),
  },
});
