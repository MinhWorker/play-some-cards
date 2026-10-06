/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * `setup` is the room settings form ("Tạo phòng", "Tuỳ chỉnh"); `scene` is the table, which
 * shows the points and who won itself.
 */
import { defineClient } from '@psc/sdk/client';
import { BaiCaoView } from './scenes/BaiCaoView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({
  setup: Setup,
  scene: BaiCaoView,
  background: false,
  showsPlayers: true,
});
