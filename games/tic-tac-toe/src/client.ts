/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * `setup` is optional; without it "Tạo phòng" creates the room right away.
 */
import { defineClient } from '@psc/sdk/client';
import { Board } from './scenes/Board.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({ setup: Setup, scene: Board });
