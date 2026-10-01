/**
 * The game's screen, in the browser. The app calls these hooks in order; `ctx` has the state
 * (what this player may see), `me`, the players, host, score, options and the screen size.
 */
import { type Button, GameView, type ViewContext, type ViewEvent } from '@psc/sdk/client';
import type Phaser from 'phaser';
import type { State } from '../game/CounterGame.js';

type Ctx = ViewContext<State>;

/** Seat 0 is red, seat 1 blue. */
const COLORS = ['#ff6b6b', '#5fb4ff'];

export class CounterView extends GameView<State> {
  private counter!: Phaser.GameObjects.Text;
  /** One button per seat, and a name + press count under each. */
  private buttons: Button[] = [];
  private names: Phaser.GameObjects.Text[] = [];

  /** Once, when the screen opens: make the objects. */
  protected onCreate(ctx: Ctx) {
    this.counter = this.label('0', { size: 140 });
    this.buttons = ctx.players.map(() =>
      this.button('Bấm!', () => this.send('press'), { image: 'button', sound: 'press' }),
    );
    this.names = ctx.players.map((player) =>
      this.label(player.name, { size: 26, color: COLORS[player.seat] }),
    );
  }

  /** After onCreate and on every resize: place the objects. */
  protected onLayout({ screen, players }: Ctx) {
    const { width, height, cx, top, hud } = screen;
    this.counter.setFontSize(140 * hud).setPosition(cx, top + (height - top) * 0.3);
    const size = Math.min(200 * hud, (width - 48) / players.length);
    players.forEach((_, seat) => {
      const x = cx + (seat - (players.length - 1) / 2) * (size + 24 * hud);
      const y = top + (height - top) * 0.65;
      this.buttons[seat]?.setSize(size, size).setPosition(x, y);
      this.names[seat]?.setPosition(x, y + size / 2 + 28 * hud);
    });
  }

  /** Someone pressed (event `press`): bounce their button and pop the number. */
  protected onPress(_ctx: Ctx, event: ViewEvent) {
    const button = event.player && this.buttons[event.player.seat];
    if (button) {
      this.runtime.run(async (fx) => {
        await fx.tween({ targets: button.container, scale: 0.9, duration: 60, yoyo: true });
      });
    }
    this.runtime.tween({
      targets: this.counter,
      scale: { from: 1.3, to: 1 },
      duration: 180,
      ease: 'Sine.easeOut',
    });
    if (!event.isMe) this.sfx('press');
  }

  /** The state changed: show it. Only your own button can be pressed. */
  protected onState({ state, players, me }: Ctx) {
    this.counter.setText(String(state.count));
    players.forEach((player, seat) => {
      this.buttons[seat]?.setEnabled(player.id === me?.id);
      this.names[seat]?.setText(`${player.name}: ${state.presses[seat] ?? 0}`);
    });
  }

  protected onStart() {
    this.onResync();
  }

  protected onResync() {
    this.counter.setScale(1);
    for (const button of this.buttons) button.container.setScale(1);
  }
}
