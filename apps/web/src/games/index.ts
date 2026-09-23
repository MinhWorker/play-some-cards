import type Phaser from 'phaser';
import type { ImageKey } from '../phaser/assets';
import { TicTacToeScene } from './tic-tac-toe/TicTacToeScene';

/**
 * Game id -> Phaser scene class that draws its board. The scene key must equal the game id.
 * Add an entry when you add a game in packages/shared/src/registry.ts (docs/adding-a-game.md).
 */
export const boardScenes: Record<string, new () => Phaser.Scene> = {
  'tic-tac-toe': TicTacToeScene,
};

/**
 * Islands on the home map, in display order. Islands without `gameId` are shown locked
 * ("coming soon"); give one a `gameId` when that game is ready.
 */
export const islands: { name: string; image: ImageKey; gameId?: string }[] = [
  { name: 'Caro 3×3', image: 'island-caro', gameId: 'tic-tac-toe' },
  { name: 'Tiến Lên', image: 'island-cards' },
  { name: 'Cờ Cá Ngựa', image: 'island-dice' },
  { name: 'Cờ Tướng', image: 'island-chess' },
];
