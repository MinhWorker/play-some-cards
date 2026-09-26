import type { GameResult, PlayerId } from '../game.js';

/** Someone in the room. */
export interface Seat {
  id: PlayerId;
  name: string;
  connected: boolean;
  /** Played by the computer. */
  bot?: boolean;
}

/** What the app hands the running game screen (a `GameView` turns it into `ctx`). */
export interface BoardProps<View = unknown, Options = unknown> {
  /** The game's `view` for this player (the public view for spectators). */
  view: View;
  /** This player. A spectator's `me` is not in `players`. */
  me: PlayerId;
  /** Seated players, in seat order. */
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
}

/** Events between the app and the running game screen (on `game.events`). */
export const BOARD_PROPS = 'board:props';
export const BOARD_MOVE = 'board:move';
export const BOARD_OPTIONS = 'board:options';
