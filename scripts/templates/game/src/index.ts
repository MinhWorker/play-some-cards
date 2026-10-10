/**
 * Server entry: what the app needs to know about the game, and its logic (a `Game`). It loads on the server, so it only imports code from game/ (scenes are in client.ts).
 */
import { definePlugin } from '@xomdao/sdk';
import { __Name__Game } from './game/__Name__Game.js';

export default definePlugin({
  meta: {
    id: '__ID__',
    name: '__NAME__',
    minPlayers: 2,
    maxPlayers: 4,
    // Locked in production until you change this to 'ready'.
    status: 'wip',
    // Its island on the home map: assets/island.webp.
    portal: { image: 'island' },
    // A one-line pitch for its game card and how many minutes one game takes. Add
    // `genre: 'co'` (an id from `genres` in packages/shared/src/catalog.ts) to put it in the hub.
    tagline: 'Cộng dồn tới 21 trước đối thủ.',
    duration: { min: 2, max: 5 },
  },
  game: new __Name__Game(),
});
