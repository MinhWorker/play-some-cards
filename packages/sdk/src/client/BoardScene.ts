import type { GameResult, PlayerId } from '../game.js';
import { GameScene } from './GameScene.js';

/** Someone in the room. */
export interface Seat {
  id: PlayerId;
  name: string;
  connected: boolean;
  /** Played by the computer. */
  bot?: boolean;
}

/** What a board scene draws from. */
export interface BoardProps<View = unknown, Options = unknown> {
  /** The game's `getView` output for this player (the public view for spectators). */
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
   * change them between games with `changeOptions`; the next game's `setup` gets the new ones.
   */
  options: Options;
}

/** Events between the app and the running board scene (on `game.events`). */
export const BOARD_PROPS = 'board:props';
export const BOARD_MOVE = 'board:move';
export const BOARD_OPTIONS = 'board:options';

/**
 * Base class for every game's board. Implement `build` (create objects once) and `draw`
 * (update them from `this.props`; called on every state change and resize). Call
 * `this.sendMove(move)`; the server decides whether it is legal.
 *
 * Images and sounds come from the game's own `assets/` folder by file name:
 * `this.image(x, y, 'tile')` shows `assets/tile.webp`, `this.sfx('move')` plays `assets/move.wav`.
 * Files named `music*` (mp3) are the game's background music; the app plays a random one.
 */
export abstract class BoardScene<View, Move, Options = unknown> extends GameScene {
  protected props!: BoardProps<View, Options>;
  /** Options sent with `changeOptions` that the server hasn't sent back yet. */
  private pendingOptions: Options | null = null;

  create() {
    this.props = this.registry.get('board') as BoardProps<View, Options>;
    this.build();
    this.draw();
    const onProps = (props: BoardProps<View, Options>) => {
      this.props = props;
      if (JSON.stringify(props.options) === JSON.stringify(this.pendingOptions)) {
        this.pendingOptions = null;
      }
      this.draw();
    };
    const onResize = () => this.draw();
    this.game.events.on(BOARD_PROPS, onProps);
    this.scale.on('resize', onResize);
    this.registry.events.on('changedata-hudTop', onResize);
    this.events.once('shutdown', () => {
      this.game.events.off(BOARD_PROPS, onProps);
      this.scale.off('resize', onResize);
      this.registry.events.off('changedata-hudTop', onResize);
    });
  }

  protected abstract build(): void;
  protected abstract draw(): void;

  /** Sends a move to the server. */
  protected sendMove(move: Move) {
    this.game.events.emit(BOARD_MOVE, move);
  }

  /**
   * Host only, between games: new room options (checked by the plugin's `room.options`). They
   * come back in `props.options` and the next game starts with them. The computer's seats can't
   * change this way.
   */
  protected changeOptions(options: Options) {
    this.pendingOptions = options;
    this.game.events.emit(BOARD_OPTIONS, options);
    this.draw();
  }

  /**
   * The room's options, including a change just sent with `changeOptions` (so quick taps build
   * on each other and the board shows them at once). Use it rather than `props.options`.
   */
  protected get options(): Options {
    return this.pendingOptions ?? this.props.options;
  }

  /** Whether this player is the room's host. */
  protected get isHost() {
    return this.props.hostId === this.props.me;
  }

  /** A player's display name. */
  protected nameOf(id: PlayerId) {
    return this.props.players.find((p) => p.id === id)?.name ?? '?';
  }
}
