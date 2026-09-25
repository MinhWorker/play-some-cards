import type { GameResult, PlayerId, PlayerInfo, RoomScore } from '@psc/shared';
import Phaser from 'phaser';

/** Data a board scene needs to draw the current game. */
export interface BoardProps<View = unknown> {
  view: View;
  me: PlayerId;
  players: PlayerInfo[];
  /** Set once the game is over. */
  result: GameResult | null;
  /** Wins per seat and draws over all games in this room. */
  score: RoomScore;
}

/** What the canvas should show. Set by React, read by Phaser. */
export type Stage =
  | { mode: 'hub' }
  | { mode: 'sky' }
  | ({ mode: 'board'; gameId: string } & BoardProps);

/**
 * The only link between React and Phaser.
 * React -> Phaser: 'stage' (Stage), 'hud:top' (bottom edge of the room bar, in px).
 * Phaser -> React: 'hub:select' (gameId), 'board:move' (move).
 */
export const bridge = new Phaser.Events.EventEmitter();
