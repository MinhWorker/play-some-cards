/**
 * Browser entry: the screens players see, loaded only when someone opens the game.
 * Want a "Tạo phòng" screen (room options, playing the computer)? Add `setup`, see
 * games/tic-tac-toe.
 */
import { defineClient } from '@psc/sdk/client';
import { Board } from './scenes/Board.js';

export default defineClient({ scene: Board });
