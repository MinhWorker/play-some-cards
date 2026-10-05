/**
 * Browser entry: the board and the room options screen.
 */
import { defineClient } from '@psc/sdk/client';
import { CityBackground } from './scenes/CityBackground.js';
import { CoTyPhuClassicView } from './scenes/CoTyPhuClassicView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({
  scene: CoTyPhuClassicView,
  background: CityBackground,
  setup: Setup,
  showsPlayers: true,
});
