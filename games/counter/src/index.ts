/**
 * Bấm Nút: the smallest example of the Game/View classes (see README.md). One or two players,
 * a button each, one shared number. No winner.
 *
 * Server entry: the game's meta and its logic (a `Game`).
 */
import { definePlugin } from '@psc/sdk';
import { CounterGame } from './game/CounterGame.js';

export default definePlugin({
  meta: {
    id: 'counter',
    name: 'Bấm Nút',
    minPlayers: 1,
    maxPlayers: 2,
    status: 'wip',
    portal: { image: 'island' },
  },
  game: new CounterGame(),
});
