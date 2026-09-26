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
      this.tweens.add({ targets: button.container, scale: 0.9, duration: 60, yoyo: true });
    }
    this.counter.setScale(1.3);
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

  /** Every frame (browser only): ease the number back to its size after a pop. */
  protected onUpdate(_ctx: Ctx, dt: number) {
    const scale = this.counter.scale;
    if (scale !== 1) this.counter.setScale(Math.max(1, scale - (scale - 1) * dt * 0.012));
  }
}
