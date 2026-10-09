/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * `setup` is the room settings form ("Tạo phòng", "Tuỳ chỉnh"); `scene` is the board.
 */
import { defineClient } from '@xomdao/sdk/client';
import { CheckersBackground } from './scenes/CheckersBackground.js';
import { CheckersView } from './scenes/CheckersView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({
  setup: Setup,
  scene: CheckersView,
  background: CheckersBackground,
  showsResult: true,
});
