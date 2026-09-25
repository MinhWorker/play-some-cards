import type { BoardProps } from '@psc/sdk/client';
import Phaser from 'phaser';

export type { BoardProps };

/** What the canvas should show. Set by React, read by Phaser. */
export type Stage =
  | { mode: 'hub' }
  | { mode: 'sky' }
  | ({ mode: 'board'; gameId: string } & BoardProps);

/**
 * The only link between React and Phaser.
 * React -> Phaser: 'stage' (Stage), 'hud:top' (bottom edge of the room bar, in px).
 * Phaser -> React: 'hub:select' (gameId), 'hub:locked', 'board:move' (move).
 * Board scenes (from games/) don't see this: PhaserStage passes their props and moves along.
 */
export const bridge = new Phaser.Events.EventEmitter();
