import Phaser from 'phaser';
import type { GameResult, PlayerId } from '../game.js';
import { clientHost } from './host.js';
import { hudScale } from './text.js';

/** Someone in the room. */
export interface Seat {
  id: PlayerId;
  name: string;
  connected: boolean;
}

/** What a board scene draws from. */
export interface BoardProps<View = unknown> {
  /** The game's `getView` output for this player (the public view for spectators). */
  view: View;
  /** This player. A spectator's `me` is not in `players`. */
  me: PlayerId;
  /** Seated players, in seat order. */
  players: Seat[];
  /** Set once the game is over. */
  result: GameResult | null;
  /** Wins per seat and draws over all games in this room. */
  score: { wins: number[]; draws: number };
}

/** Events between the app and the running board scene (on `game.events`). */
export const BOARD_PROPS = 'board:props';
export const BOARD_MOVE = 'board:move';

/**
 * Base class for every game's board. Implement `build` (create objects once) and `draw`
 * (update them from `this.props`; called on every state change and resize). Call
 * `this.sendMove(move)`; the server decides whether it is legal.
 *
 * Images and sounds come from the game's own `assets/` folder by file name:
 * `this.image(x, y, 'tile')` shows `assets/tile.webp`, `this.sfx('move')` plays `assets/move.wav`.
 */
export abstract class BoardScene<View, Move> extends Phaser.Scene {
  protected props!: BoardProps<View>;
  private warned = new Set<string>();

  /** The game id (the app adds the scene under it). */
  get gameId() {
    return this.scene.key;
  }

  preload() {
    const { images, sounds } = clientHost().assets(this.gameId);
    for (const [name, url] of Object.entries(images)) {
      const key = `${this.gameId}/${name}`;
      if (!this.textures.exists(key)) this.load.image(key, url);
    }
    for (const url of Object.values(sounds)) clientHost().loadSound(url);
  }

  create() {
    this.props = this.registry.get('board') as BoardProps<View>;
    this.build();
    this.draw();
    const onProps = (props: BoardProps<View>) => {
      this.props = props;
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

  /** Texture key of `assets/<name>.*`, for `setTexture()` and other Phaser calls. */
  protected texture(name: string) {
    const key = `${this.gameId}/${name}`;
    if (!this.textures.exists(key))
      this.warnOnce(`No image "${name}" in games/${this.gameId}/assets/`);
    return key;
  }

  /** Adds `assets/<name>.webp|png` as an image. */
  protected image(x: number, y: number, name: string) {
    return this.add.image(x, y, this.texture(name));
  }

  /** Plays `assets/<name>.wav|mp3` on the effects channel (follows the player's volume). */
  protected sfx(name: string) {
    const url = clientHost().assets(this.gameId).sounds[name];
    if (url) clientHost().playSound(url);
    else this.warnOnce(`No sound "${name}" in games/${this.gameId}/assets/`);
  }

  /**
   * Where the board may draw, leaving room for the room bar (top, its real height comes from
   * the registry key 'hudTop') and the result panel (bottom), plus a score row and a status
   * line above the board. Phones held sideways show the result panel on the right instead, so
   * the board keeps the full height.
   */
  protected boardArea() {
    const { width, height } = this.scale;
    const hud = hudScale();
    const sideways = width > height && height < 500;
    const top = ((this.registry.get('hudTop') as number | undefined) ?? 110 * hud) + 8 * hud;
    const bottom = sideways ? 12 : 140 * hud;
    const score = 50 * hud;
    const status = 56 * hud;
    const above = score + status;
    const size = Math.max(120, Math.min(width * 0.92, height - top - bottom - above));
    const cx = width / 2;
    const cy = top + above + (height - top - bottom - above) / 2;
    const statusY = cy - size / 2 - status / 2;
    return { size, cx, cy, hud, statusY, scoreY: statusY - status / 2 - score / 2 };
  }

  /** Sets `text`, cutting it short with "…" so it is at most `maxWidth` wide. */
  protected fitText(obj: Phaser.GameObjects.Text, text: string, maxWidth: number) {
    obj.setText(text);
    let chars = [...text];
    while (obj.width > maxWidth && chars.length > 1) {
      chars = chars.slice(0, -1);
      obj.setText(`${chars.join('').trimEnd()}…`);
    }
    return obj;
  }

  /** A player's display name. */
  protected nameOf(id: PlayerId) {
    return this.props.players.find((p) => p.id === id)?.name ?? '?';
  }

  private warnOnce(message: string) {
    if (this.warned.has(message)) return;
    this.warned.add(message);
    console.warn(message);
  }
}
