/**
 * Mậu Binh: 2–4 players arrange 13 cards into three chi (5–5–3) in secret, then everyone's rows
 * are shown and compared chi by chi.
 *
 * Server entry: the game's meta, its logic (a `Game`) and its room options (computer players).
 */
import { definePlugin } from '@xomdao/sdk';
import { MauBinhGame } from './game/MauBinhGame.js';
import { optionsSchema } from './game/model.js';

export default definePlugin({
  meta: {
    id: 'mau-binh',
    name: 'Mậu Binh',
    minPlayers: 2,
    maxPlayers: 4,
    status: 'ready',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
    genre: 'bai',
    tagline: 'Xếp mười ba lá thành ba chi mạnh hơn đối thủ.',
    duration: { min: 5, max: 10 },
  },
  game: new MauBinhGame(),
  room: {
    options: optionsSchema,
    bots: (options) => options.bots,
    withBots: (options, count) => ({ ...options, bots: count }),
  },
});
