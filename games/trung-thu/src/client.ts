/** Browser entry: the Phaser screen of Câu cá Trung Thu (the Godot client uses godot/). */
import { defineClient } from '@xomdao/sdk/client';
import { FishingView } from './scenes/FishingView.js';

export default defineClient({ scene: FishingView });
