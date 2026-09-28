/**
 * A game's screen as a class with lifecycle hooks, the browser half of `Game`
 * (from `@psc/sdk`). The app calls the hooks; you draw with the helpers from `GameScene` or with Phaser
 * directly (`this.add`, `this.tweens`, … still work).
 *
 *   onCreate(ctx)          once, when the screen opens: make your objects
 *   onLayout(ctx)          after onCreate and whenever the frame changes: place them
 *   onStart(ctx)           a new game began
 *   on<Event>(ctx, event)  someone's event was played (`press` → onPress): animate it
 *   onState(ctx)           the state changed (after any of the above): show it
 *   onEnd(ctx)             the game is over (`ctx.result`)
 *   onUpdate(ctx, dt)      every frame (browser only; the server has no frames)
 *
 * `ctx` (also `this.ctx`) has everything: the state as you may see it, who you are, the players,
 * host, score, options, result, the game's timer (`ctx.timer`, for a countdown).
 *
 * The app keeps one instance per game and restarts it for every room (and after "Tuỳ chỉnh"):
 * Phaser destroys the objects when it stops, but fields keep their values. Reset any field that
 * holds objects or remembers what is drawn in `onCreate`, not in its initializer.
 */
import { hookName } from '../engine.js';
import type { GameResult, PlayerId } from '../game.js';
import { GameScene } from './GameScene.js';
import { BOARD_MOVE, BOARD_OPTIONS, BOARD_PROPS, type BoardProps } from './props.js';
import { hudScale } from './text.js';

/** Someone at the table, as a screen sees them. */
export interface ViewSeat {
  id: PlayerId;
  name: string;
  seat: number;
  bot: boolean;
  connected: boolean;
  /** Their picture: draw it with `this.avatar(seat)`. */
  avatar?: string;
  /** Left the room during this game. */
  left: boolean;
}

/** What every view hook gets. */
export interface ViewContext<View, Options = unknown> {
  /** The game's state as this screen may see it (the game's `view`). */
  state: View;
  /** Who is looking: their seat, or `null` for a spectator. */
  me: ViewSeat | null;
  /** Seated players in seat order. */
  players: ViewSeat[];
  hostId: PlayerId | null;
  isHost: boolean;
  score: { wins: number[]; draws: number };
  options: Options;
  /** Set once the game is over. */
  result: GameResult | null;
  /**
   * The game's timer (`ctx.setTimer` in the `Game`), or `null`: `event` names it, `ms` is its full
   * length and `endsAt` when it goes off (compare with `Date.now()`, e.g. in `onUpdate`).
   */
  timer: { event: string; ms: number; endsAt: number } | null;
  /**
   * The frame in design units (720 tall, 960 to 1600 wide; docs/ui-guide.md): size, center,
   * `top` = first free unit below the app's room bar, and the HUD scale (multiply font and button
   * sizes by it). `gap` is the free middle of the room bar's own row (between its buttons and
   * the room's name), for something small like the seat across; `null` when the bar wrapped
   * onto more rows or there is none (the sandbox).
   */
  screen: {
    width: number;
    height: number;
    cx: number;
    cy: number;
    top: number;
    hud: number;
    gap: { left: number; right: number; top: number; bottom: number } | null;
  };
}

/** An event someone played, as a view hook gets it. */
export interface ViewEvent<Payload = unknown> {
  name: string;
  /** Who played it (`null` if they already left). */
  player: ViewSeat | null;
  isMe: boolean;
  /** Its data (missing for events the game keeps secret from you). */
  payload: Payload;
}

export abstract class GameView<View, Options = unknown> extends GameScene {
  /** Everything about the room right now (same object the hooks get). */
  protected ctx!: ViewContext<View, Options>;
  private props!: BoardProps<View, Options>;
  private lastSeq = 0;
  private timer: ViewContext<View, Options>['timer'] = null;
  /** Options sent with `changeOptions` that the server hasn't sent back yet. */
  private pendingOptions: Options | null = null;

  // ── Hooks: `onCreate` is required; write any of the others (see the top of this file) and
  // the app calls them. They aren't declared here, so no `override` is needed.

  protected abstract onCreate(ctx: ViewContext<View, Options>): void;

  /** Calls a hook if the game wrote it. */
  private hook(name: string, ...args: unknown[]) {
    const fn = (this as unknown as Record<string, unknown>)[name];
    if (typeof fn === 'function') fn.apply(this, args);
  }

  // ── Actions ────────────────────────────────────────────────────────────────────────────

  /** Plays an event (the server checks it and runs the game's `on<Event>` hook). */
  protected send(event: string, payload: object = {}) {
    this.game.events.emit(BOARD_MOVE, { event, payload });
  }

  /**
   * Host only, between games: new room options for the next game (checked by the plugin's
   * `room.options`). `ctx.options` shows them at once, so quick taps build on each other.
   */
  protected changeOptions(options: Options) {
    this.pendingOptions = options;
    this.game.events.emit(BOARD_OPTIONS, options);
    this.ctx = this.makeContext();
    this.hook('onState', this.ctx);
  }

  // ── Wiring (the app ↔ the hooks); games don't need to read below ────────────────────────

  create() {
    this.props = this.registry.get('board') as BoardProps<View, Options>;
    this.timer = this.timerOf(this.props);
    this.ctx = this.makeContext();
    this.lastSeq = this.props.last?.seq ?? 0;
    this.onCreate(this.ctx);
    this.hook('onLayout', this.ctx);
    if (!this.props.last && !this.props.result) this.hook('onStart', this.ctx);
    this.hook('onState', this.ctx);

    const onProps = (props: BoardProps<View, Options>) => this.receive(props);
    const onResize = () => {
      this.ctx = this.makeContext();
      this.hook('onLayout', this.ctx);
      this.hook('onState', this.ctx);
    };
    this.followFrame(onResize);
    this.game.events.on(BOARD_PROPS, onProps);
    this.registry.events.on('changedata-hudTop', onResize);
    this.registry.events.on('changedata-hudGap', onResize);
    this.events.once('shutdown', () => {
      this.game.events.off(BOARD_PROPS, onProps);
      this.registry.events.off('changedata-hudTop', onResize);
      this.registry.events.off('changedata-hudGap', onResize);
    });
  }

  override update(_time: number, delta: number) {
    if (this.ctx) this.hook('onUpdate', this.ctx, delta);
  }

  /** New props from the server: call the hooks in lifecycle order. */
  private receive(props: BoardProps<View, Options>) {
    const before = this.props;
    this.props = props;
    this.timer = this.timerOf(props);
    if (JSON.stringify(props.options) === JSON.stringify(this.pendingOptions)) {
      this.pendingOptions = null;
    }
    this.ctx = this.makeContext();
    if (props.round !== before.round) {
      this.lastSeq = 0;
      this.hook('onStart', this.ctx);
    }
    const last = props.last;
    if (last && last.seq > this.lastSeq) {
      this.lastSeq = last.seq;
      const { event, payload } = last.move as { event: string; payload?: unknown };
      this.hook(hookName(event), this.ctx, {
        name: event,
        player: this.ctx.players.find((p) => p.id === last.player) ?? null,
        isMe: last.player === props.me,
        payload,
      } satisfies ViewEvent);
    }
    this.hook('onState', this.ctx);
    if (props.result && !before.result) this.hook('onEnd', this.ctx);
  }

  /** When the timer ends on this device's clock (the server sends how much is left). */
  private timerOf(props: BoardProps<View, Options>) {
    const t = props.timer;
    if (!t) return null;
    const same = this.timer?.event === t.event && this.timer.ms === t.ms;
    const endsAt = Date.now() + t.left;
    // The same timer sent again (another player's change): keep the clock steady.
    if (same && this.timer && Math.abs(this.timer.endsAt - endsAt) < 400) return this.timer;
    return { event: t.event, ms: t.ms, endsAt };
  }

  private makeContext(): ViewContext<View, Options> {
    const { view, me, players, hostId, score, options, result } = this.props;
    const seats = players.map((p, seat) => ({
      id: p.id,
      name: p.name,
      seat,
      bot: Boolean(p.bot),
      connected: p.connected,
      avatar: p.avatar,
      left: Boolean(p.left),
    }));
    const { width, height } = this.view;
    const hud = hudScale();
    const top = ((this.registry.get('hudTop') as number | undefined) ?? 110 * hud) + 8 * hud;
    const gap = (this.registry.get('hudGap') as ViewContext<View>['screen']['gap']) ?? null;
    return {
      state: view,
      me: seats.find((p) => p.id === me) ?? null,
      players: seats,
      hostId,
      isHost: hostId === me,
      score,
      options: this.pendingOptions ?? options,
      result,
      timer: this.timer,
      screen: { width, height, cx: width / 2, cy: height / 2, top, hud, gap },
    };
  }
}
