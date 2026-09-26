/**
 * Browser entry: the table, the settings screen ("Tạo phòng", "Tuỳ chỉnh") and what a player is
 * asked when they leave mid-game.
 */
import { defineClient } from '@psc/sdk/client';
import { Setup } from './scenes/Setup.js';
import { TienLenView } from './scenes/TienLenView.js';

export default defineClient({
  scene: TienLenView,
  setup: Setup,
  leaveConfirm: {
    title: 'Bỏ cuộc giữa chừng?',
    message: 'Bạn rời bàn thì bị xử thua và xếp dưới mọi người. Cả bàn vẫn chơi tiếp.',
    stay: 'Đánh tiếp',
    leave: 'Bỏ cuộc, rời bàn',
  },
  // The table lists the players and shows the final standings itself.
  showsPlayers: true,
  showsResult: true,
});
