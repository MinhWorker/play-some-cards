/**
 * Browser entry: the table, the settings screen ("Tạo phòng", "Tuỳ chỉnh") and what a player is
 * asked when they leave mid-game.
 */
import { defineClient } from '@xomdao/sdk/client';
import { MauBinhView } from './scenes/MauBinhView.js';
import { Setup } from './scenes/Setup.js';

export default defineClient({
  scene: MauBinhView,
  setup: Setup,
  leaveConfirm: {
    title: 'Bỏ cuộc giữa chừng?',
    message: 'Bạn rời bàn thì thua vòng này như binh lủng và đứng cuối bảng. Cả bàn vẫn chơi tiếp.',
    stay: 'Chơi tiếp',
    leave: 'Bỏ cuộc, rời bàn',
  },
  // The table lists the players and shows the final standings itself.
  showsPlayers: true,
  showsResult: true,
});
