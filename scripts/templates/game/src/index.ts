/**
 * Server entry: what the app needs to know about the game, and its logic (a `Game`). It loads on
 * the server, so it only imports code from game/ (the screens are in godot/).
 */
import { definePlugin } from '@xomdao/sdk';
import { __Name__Game, optionsSchema, WIN_COINS } from './game/__Name__Game.js';

export default definePlugin({
  meta: {
    id: '__ID__',
    name: '__NAME__',
    minPlayers: 2,
    maxPlayers: 4,
    // Locked in production until you change this to 'ready'.
    status: 'wip',
    // Its island on the old home map and its card art for now: assets/island.webp.
    portal: { image: 'island' },
    // Its island in the hub: an id from `genres` in packages/shared/src/catalog.ts.
    genre: '__GENRE__',
    // A one-line pitch for its game card and how many minutes one game takes.
    tagline: 'Cộng dồn tới 21 trước đối thủ.',
    duration: { min: 2, max: 5 },
    rewardCap: { 'core:coin': WIN_COINS },
  },
  game: new __Name__Game(),
  room: {
    options: optionsSchema,
    // The computer takes `bots` seats; quick match (CHƠI) fills empty seats with it.
    bots: (options) => options.bots,
    withBots: (options, count) => ({ ...options, bots: count }),
  },
});
