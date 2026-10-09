/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * `setup` is the room settings form ("Tạo phòng", "Tuỳ chỉnh"); `scene` is the board.
 */
import { defineClient } from '@xomdao/sdk/client';
import { GoBackground } from './scenes/GoBackground.js';
import { GoView } from './scenes/GoView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({
  setup: Setup,
  scene: GoView,
  background: GoBackground,
  showsPlayers: true,
  showsResult: true,
});
