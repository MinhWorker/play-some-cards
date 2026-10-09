/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * `setup` is the room settings form ("Tạo phòng", "Tuỳ chỉnh"); `scene` is the two seas.
 */
import { defineClient } from '@xomdao/sdk/client';
import { BattleshipView } from './scenes/BattleshipView.js';
import { OceanBackground } from './scenes/OceanBackground.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({ setup: Setup, scene: BattleshipView, background: OceanBackground });
