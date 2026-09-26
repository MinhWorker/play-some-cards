/**
 * EXPERIMENTAL: a game's screen as a class with lifecycle hooks, the browser half of `Game`
 * (from `@psc/sdk`). The app calls the hooks; you draw with the helpers below or with Phaser
 * directly (`this.add`, `this.tweens`, … still work).
 *
 *   onCreate(ctx)          once, when the screen opens: make your objects
 *   onLayout(ctx)          after onCreate and whenever the screen size changes: place them
 *   onStart(ctx)           a new game began
 *   on<Event>(ctx, event)  someone's event was played (`press` → onPress): animate it
 *   onState(ctx)           the state changed (after any of the above): show it
 *   onEnd(ctx)             the game is over (`ctx.result`)
 *   onUpdate(ctx, dt)      every frame (browser only; the server has no frames)
 *
 * `ctx` (also `this.ctx`) has everything: the state as you may see it, who you are, the players,
 * host, score, options, result.
 */
import type Phaser from 'phaser';
import { hookName } from '../engine.js';
import type { GameResult, PlayerId } from '../game.js';
import { BOARD_MOVE, BOARD_PROPS, type BoardProps } from './BoardScene.js';
import { GameScene } from './GameScene.js';
import { hudScale, titleStyle } from './text.js';

/** Someone at the table, as a screen sees them. */
export interface ViewSeat {
  id: PlayerId;
  name: string;
  seat: number;
  bot: boolean;
  connected: boolean;
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
   * The screen: size, center, `top` = first free pixel below the app's room bar, and the HUD
   * scale (small phones < 1; multiply sizes by it).
   */
  screen: { width: number; height: number; cx: number; cy: number; top: number; hud: number };
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

/** A button made by `this.button()`: an optional image with a label, reacting to taps. */
export interface Button {
  container: Phaser.GameObjects.Container;
  label: Phaser.GameObjects.Text;
  image?: Phaser.GameObjects.Image;
  setPosition(x: number, y: number): Button;
  /** Width and height (the image is stretched to it; the label shrinks to fit). */
  setSize(width: number, height: number): Button;
  /** A disabled button is greyed out and ignores taps. */
  setEnabled(enabled: boolean): Button;
  setText(text: string): Button;
}

export abstract class GameView<View, Options = unknown> extends GameScene {
  /** Everything about the room right now (same object the hooks get). */
  protected ctx!: ViewContext<View, Options>;
  private props!: BoardProps<View, Options>;
  private lastSeq = 0;

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

  // ── Ready-made objects (Phaser objects underneath; use Phaser for anything else) ────────

  /** Game-style text (white, dark outline, the app's font), centered on its position. */
  protected label(text: string, { size = 32, color }: { size?: number; color?: string } = {}) {
    const obj = this.add.text(0, 0, text, titleStyle(size * hudScale())).setOrigin(0.5);
    if (color) obj.setColor(color);
    return obj;
  }

  /** An image from the game's `assets/` by file name, centered on its position. */
  protected sprite(name: string) {
    return this.image(0, 0, name);
  }

  /**
   * A tappable button: `image` (from `assets/`, stretched to the size) with a label on top, or
   * just the label. Lights up on hover, plays `sound` (from `assets/`) on tap.
   */
  protected button(
    text: string,
    onTap: () => void,
    { image, sound, size = 32 }: { image?: string; sound?: string; size?: number } = {},
  ): Button {
    const bg = image ? this.image(0, 0, image) : undefined;
    const label = this.label(text, { size });
    const container = this.add.container(0, 0, bg ? [bg, label] : [label]);
    let enabled = true;
    let fontSize = size * hudScale();
    const button: Button = {
      container,
      label,
      image: bg,
      setPosition: (x, y) => {
        container.setPosition(x, y);
        return button;
      },
      setSize: (width, height) => {
        bg?.setDisplaySize(width, height);
        container.setSize(width, height);
        fontSize = Math.min(size * hudScale(), height * 0.4);
        label.setFontSize(fontSize);
        this.fitText(label, label.text, width * 0.9, fontSize * 0.5);
        return button;
      },
      setEnabled: (value) => {
        enabled = value;
        container.setAlpha(value ? 1 : 0.45);
        return button;
      },
      setText: (value) => {
        label.setFontSize(fontSize);
        this.fitText(
          label,
          value,
          (container.width || Number.POSITIVE_INFINITY) * 0.9,
          fontSize * 0.5,
        );
        return button;
      },
    };
    const { width, height } = bg ?? label;
    button.setSize(width, height);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => enabled && bg?.setTint(0xfff1b8));
    container.on('pointerout', () => bg?.clearTint());
    container.on('pointerup', () => {
      if (!enabled) return;
      bg?.clearTint();
      if (sound) this.sfx(sound);
      onTap();
    });
    return button;
  }

  // ── Wiring (the app ↔ the hooks); games don't need to read below ────────────────────────

  create() {
    this.props = this.registry.get('board') as BoardProps<View, Options>;
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
    this.game.events.on(BOARD_PROPS, onProps);
    this.scale.on('resize', onResize);
    this.registry.events.on('changedata-hudTop', onResize);
    this.events.once('shutdown', () => {
      this.game.events.off(BOARD_PROPS, onProps);
      this.scale.off('resize', onResize);
      this.registry.events.off('changedata-hudTop', onResize);
    });
  }

  override update(_time: number, delta: number) {
    if (this.ctx) this.hook('onUpdate', this.ctx, delta);
  }

  /** New props from the server: call the hooks in lifecycle order. */
  private receive(props: BoardProps<View, Options>) {
    const before = this.props;
    this.props = props;
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

  private makeContext(): ViewContext<View, Options> {
    const { view, me, players, hostId, score, options, result } = this.props;
    const seats = players.map((p, seat) => ({
      id: p.id,
      name: p.name,
      seat,
      bot: Boolean(p.bot),
      connected: p.connected,
    }));
    const { width, height } = this.scale;
    const hud = hudScale();
    const top = ((this.registry.get('hudTop') as number | undefined) ?? 110 * hud) + 8 * hud;
    return {
      state: view,
      me: seats.find((p) => p.id === me) ?? null,
      players: seats,
      hostId,
      isHost: hostId === me,
      score,
      options,
      result,
      screen: { width, height, cx: width / 2, cy: height / 2, top, hud },
    };
  }
}
