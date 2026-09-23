import type { PlayerId, PlayerInfo } from '@psc/shared';
import type { ComponentType } from 'react';
import { TicTacToeBoard } from './tic-tac-toe/Board';

/** Props every game board receives. `view` is whatever the game's `getView` returned. */
export interface BoardProps<View = unknown, Move = unknown> {
  view: View;
  me: PlayerId;
  players: PlayerInfo[];
  sendMove: (move: Move) => Promise<void>;
}

/**
 * Game id → board component. Add an entry here when you add a game in
 * packages/shared/src/registry.ts. See docs/adding-a-game.md.
 */
// biome-ignore lint/suspicious/noExplicitAny: each board has its own view/move types
export const boards: Record<string, ComponentType<BoardProps<any, any>>> = {
  'tic-tac-toe': TicTacToeBoard,
};
