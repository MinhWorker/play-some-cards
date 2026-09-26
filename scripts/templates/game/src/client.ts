/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * Want a "Tạo phòng" screen (room options, playing the computer)? `npm run new -- setup __ID__`,
 * then add `setup` here.
 */
import { defineClient } from '@psc/sdk/client';
import { __Name__View } from './scenes/__Name__View.js';

export default defineClient({ scene: __Name__View });
