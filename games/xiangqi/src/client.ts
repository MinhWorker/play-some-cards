/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * `setup` is the room settings form ("Tạo phòng", "Tuỳ chỉnh"); `scene` is the board, which
 * shows the result itself (who won, and why).
 */
import { defineClient } from '@psc/sdk/client';
import { Setup } from './scenes/Setup.js';
import { XiangqiBackground } from './scenes/XiangqiBackground.js';
import { XiangqiView } from './scenes/XiangqiView.js';

export default defineClient({
  setup: Setup,
  scene: XiangqiView,
  background: XiangqiBackground,
  showsResult: true,
  showsPlayers: true,
});
