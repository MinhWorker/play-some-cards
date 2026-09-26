/**
 * Server entry: what the app needs to know about the game. It loads on the server, so it only
 * imports pure code from game/ (scenes are in client.ts). Tour and life cycle: README.md.
 */
import { definePlugin } from '@psc/sdk';
import { rules } from './game/rules.js';

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
  },
  rules,
});
