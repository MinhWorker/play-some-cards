import type { BoardProps } from '@psc/sdk/client';
import Phaser from 'phaser';

export type { BoardProps };

/** What the canvas should show. Set by React, read by Phaser. */
export type Stage =
  | { mode: 'hub' }
  | { mode: 'sky' }
  /** The game's own settings screen (`setup` in its client.ts); `current` when editing a room. */
  | { mode: 'setup'; gameId: string; current: unknown }
  | ({ mode: 'board'; gameId: string } & BoardProps);

/**
 * The only link between React and Phaser.
 * React -> Phaser: 'stage' (Stage), 'hud:top' (bottom edge of the room bar, in px).
 * Phaser -> React: 'hub:select' (gameId), 'hub:locked', 'board:move' (move), 'board:options',
 * 'setup:submit' (room options), 'setup:cancel'.
 * Game scenes (from games/) don't see this: PhaserStage passes their props and events along.
 */
export const bridge = new Phaser.Events.EventEmitter();
