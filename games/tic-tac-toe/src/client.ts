/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * `setup` is the room settings screen ("Tạo phòng", "Tuỳ chỉnh"); `scene` is the game.
 */
import { defineClient } from '@psc/sdk/client';
import { CaroView } from './scenes/CaroView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({ setup: Setup, scene: CaroView });
