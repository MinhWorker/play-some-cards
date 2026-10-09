import { definePlugin } from '@xomdao/sdk';
import { BomNguyenToGame } from './game/BomNguyenToGame.js';
import { optionsSchema } from './game/model.js';
export default definePlugin({
  meta: {
    id: 'bom-nguyen-to',
    name: 'Bom Nguyên Tố',
    minPlayers: 1,
    maxPlayers: 4,
    status: 'ready',
    portal: { image: 'island' },
  },
  game: new BomNguyenToGame(),
  room: {
    options: optionsSchema,
    bots: (options) => Math.min(options.bots, (options.mode === 'teams' ? 4 : options.total) - 1),
  },
});
