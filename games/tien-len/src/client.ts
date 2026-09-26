/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * Want a "Tạo phòng" screen (room options, playing the computer)? `npm run new -- setup tien-len`,
 * then add `setup` here.
 */
import { defineClient } from '@psc/sdk/client';
import { TienLenView } from './scenes/TienLenView.js';

export default defineClient({ scene: TienLenView });
