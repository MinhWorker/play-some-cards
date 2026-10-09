/**
 * Tiến Lên, southern rules: 2–4 players, 13 cards each, the first to empty their hand wins.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options (computer players).
 */
import { definePlugin } from '@xomdao/sdk';
import { optionsSchema } from './game/model.js';
import { TienLenGame } from './game/TienLenGame.js';

export default definePlugin({
  meta: {
    id: 'tien-len',
    name: 'Tiến Lên',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
  },
  game: new TienLenGame(),
  room: { options: optionsSchema, bots: (options) => options.bots },
});
