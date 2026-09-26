/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * Want a "Tạo phòng" screen (room options, playing the computer)? `npm run new -- setup co-ca-ngua`,
 * then add `setup` here.
 */
import { defineClient } from '@psc/sdk/client';
import { CoCaNguaView } from './scenes/CoCaNguaView.js';

export default defineClient({ scene: CoCaNguaView });
