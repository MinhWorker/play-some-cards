import type { BoardProps } from '@psc/sdk/client';
import Phaser from 'phaser';

export type { BoardProps };

/** What the canvas should show. Set by React, read by Phaser. */
export type Stage =
  | { mode: 'hub' }
  | { mode: 'sky' }
  /** The game's own settings screen (`setup` in its client.ts); `current` when editing a room. */
  | { mode: 'setup'; instance: string; gameId: string; current: unknown }
  | ({ mode: 'board'; instance: string; gameId: string } & BoardProps);

/**
 * The only link between React and Phaser.
 * React -> Phaser: 'stage' (Stage), 'hud:top' (bottom edge of the room bar, in px; `null` when
 * the board draws its own, `hud.nav`), 'hud:gap' (the free middle of the room bar's row: left,
 * right, top, bottom in px), 'ui:dialog' (true/false: an app dialog opened/closed over the board;
 * the board gets no keys meanwhile, see `useDialogKeys`).
 * Phaser -> React: 'hub:select' (gameId), 'hub:locked', 'board:move' (move), 'board:options',
 * 'board:room' (a RoomAction from a board that draws its own room controls), 'setup:submit'
 * (room options), 'setup:cancel'.
 * Game scenes (from games/) don't see this: PhaserStage passes their props and events along.
 */
export const bridge = new Phaser.Events.EventEmitter();
