/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * `setup` is the room settings form ("Tạo phòng", "Tuỳ chỉnh"); `scene` is the board.
 */
import { defineClient } from '@psc/sdk/client';
import { ChessBackground } from './scenes/ChessBackground.js';
import { ChessView } from './scenes/ChessView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({
  setup: Setup,
  scene: ChessView,
  background: ChessBackground,
  showsResult: true,
});
