/**
 * The game's screen, in the browser. The app calls these hooks in order; `ctx` (also `this.ctx`)
 * has the state as this player may see it, `me`, the players, host, score, options, result and
 * the screen size. Taps send events with `this.send(...)`; the server checks them.
 *
 * Starter screen: whose turn, the running total and three "+1 / +2 / +3" buttons. Replace it
 * with your game. Images and sounds in assets/ are used by file name: this.sprite('card'),
 * this.sfx('deal').
 */
import { type Button, GameView, type ViewContext, type ViewEvent } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type State, TARGET } from '../game/TienLenGame.js';

type Ctx = ViewContext<State>;

export class TienLenView extends GameView<State> {
  private status!: Phaser.GameObjects.Text;
  private total!: Phaser.GameObjects.Text;
  private buttons: Button[] = [];

  /** Once, when the screen opens: make the objects. */
  protected onCreate(_ctx: Ctx) {
    this.status = this.label('', { size: 36 });
    this.total = this.label('', { size: 120 });
    this.buttons = [1, 2, 3].map((amount) =>
      this.button(`+${amount}`, () => this.send('add', { amount }), { size: 56 }),
    );
  }

  /** After onCreate and on every resize: place them. */
  protected onLayout({ screen }: Ctx) {
    const { width, height, cx, top, hud } = screen;
    const middle = top + (height - top) / 2;
    this.status.setFontSize(36 * hud).setPosition(cx, top + 40 * hud);
    this.total.setFontSize(120 * hud).setPosition(cx, middle - 60 * hud);
    const gap = Math.min(160 * hud, (width - 32) / 3);
    this.buttons.forEach((button, i) => {
      button.setPosition(cx + (i - 1) * gap, middle + 80 * hud);
    });
  }

  /** Someone added (event `add`): pop the total. */
  protected onAdd(_ctx: Ctx, _event: ViewEvent) {
    this.tweens.add({ targets: this.total, scale: 1.2, duration: 80, yoyo: true });
  }

  /** After any change: show the state. Only the player whose turn it is can tap. */
  protected onState({ state, players, me, result }: Ctx) {
    const turn = players[state.turn];
    const status = result
      ? 'Hết ván!'
      : turn?.id === me?.id
        ? 'Tới lượt bạn!'
        : `Lượt của ${turn?.name ?? ''}`;
    this.fitText(this.status, status, this.ctx.screen.width - 24);
    this.total.setText(`${state.total} / ${TARGET}`);
    this.buttons.forEach((button, i) => {
      button.setEnabled(!result && turn?.id === me?.id && state.total + i + 1 <= TARGET);
    });
  }
}
