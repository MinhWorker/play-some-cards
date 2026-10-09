/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * The board draws the whole HUD itself (`hud`): its own leave, settings and new-game buttons.
 */
import { defineClient } from '@xomdao/sdk/client';
import { BomNguyenToView } from './scenes/BomNguyenToView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({
  scene: BomNguyenToView,
  setup: Setup,
  background: false,
  showsPlayers: true,
  showsResult: true,
  hud: { nav: true, settings: true, result: true },
});
