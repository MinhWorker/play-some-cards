import type { GameResult, PlayerId } from '../game.js';

/** Someone in the room. */
export interface Seat {
  id: PlayerId;
  name: string;
  connected: boolean;
  /** Played by the computer. */
  bot?: boolean;
  /** The account's picture (see `GameScene.avatar`). */
  avatar?: string;
  /** The ring drawn around `avatar`. */
  frame?: string;
  /** Left the room during this game (games that go on without them keep the seat). */
  left?: boolean;
}

/** What the app hands the running game screen (a `GameView` turns it into `ctx`). */
export interface BoardProps<View = unknown, Options = unknown> {
  /** The game's `view` for this player (the public view for spectators). */
  view: View;
  /** This player. A spectator's `me` is not in `players`. */
  me: PlayerId;
  /** Seated players, in seat order (during a game: everyone seated when it began). */
  players: Seat[];
  /** The room's host (starts games, may change the options between games). */
  hostId: PlayerId | null;
  /** Set once the game is over. */
  result: GameResult | null;
  /** Wins per seat and draws over all games in this room. */
  score: { wins: number[]; draws: number };
  /** Counts games started in the room: a new number means a new game. */
  round: number;
  /** The last move of this game (who, what), `null` before the first. `seq` goes up by one. */
  last: { seq: number; player: PlayerId; move: unknown } | null;
  /**
   * The room's options, from the game's setup scene (`undefined` if it has none). The host can
   * change them between games with `changeOptions`; the next game's `onStart` gets the new ones.
   */
  options: Options;
  /** The game's timer (`ctx.setTimer`): which, how long, and how much was left when sent. */
  timer: { event: string; ms: number; left: number } | null;
  /** How long this game has lasted when sent (`running` until it ends); `null`: no game. */
  played: { ms: number; running: boolean } | null;
  /** The room controls this viewer may use now (for a board that draws its own, `hud`). */
  room: RoomControls;
}

/**
 * What this viewer may do with the room right now. A board that draws the room's controls
 * itself (`hud` in client.ts) shows a control only while it is allowed here.
 */
export interface RoomControls {
  /** The host, after a game: start the next one (`newGame()`). */
  newGame: boolean;
  /** The host, between games, in a game with a setup screen: change the options (`customize()`). */
  customize: boolean;
  /** A spectator, between games, while a seat is free: sit down (`takeSeat()`). */
  sit: boolean;
  /** Spectators watching now. */
  watchers: number;
}

/** A room control the board asks the app for (`BOARD_ROOM`). */
export type RoomAction = 'leave' | 'home' | 'settings' | 'new-game' | 'customize' | 'sit';

/** Events between the app and the running game screen (on `game.events`). */
export const BOARD_PROPS = 'board:props';
export const BOARD_MOVE = 'board:move';
export const BOARD_OPTIONS = 'board:options';
export const BOARD_ROOM = 'board:room';
