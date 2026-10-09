import { defineClient } from '@xomdao/sdk/client';
import { CoCaNguaBackground } from './scenes/CoCaNguaBackground.js';
import { CoCaNguaView } from './scenes/CoCaNguaView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({
  scene: CoCaNguaView,
  setup: Setup,
  background: CoCaNguaBackground,
  showsPlayers: true,
});
