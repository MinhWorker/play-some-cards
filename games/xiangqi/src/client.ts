/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * Want a "Tạo phòng" screen (room options, playing the computer)? `npm run new -- setup xiangqi`,
 * then add `setup` here.
 */
import { defineClient } from '@psc/sdk/client';
import { XiangqiView } from './scenes/XiangqiView.js';

export default defineClient({ scene: XiangqiView });
