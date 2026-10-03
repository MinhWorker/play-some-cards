/**
 * __Name__View: a game screen, in the browser. The app calls the hooks below in order; `ctx`
 * (also `this.ctx`) has the state as this player may see it, `me`, the players, host, score,
 * options, result and the screen size. Show it in src/client.ts:
 * `defineClient({ scene: __Name__View })`.
 */
import { GameView, type ViewContext } from '@psc/sdk/client';
import type Phaser from 'phaser';
import type { State } from '../game/__LOGIC__.js';

type Ctx = ViewContext<State>;

export class __Name__View extends GameView<State> {
  private status!: Phaser.GameObjects.Text;

  /**
   * Once, when the screen opens: make the objects (this.label, this.button, this.sprite, or
   * Phaser: this.add; presentation: this.runtime.run(async fx => { await fx.tween(...); })).
   */
  protected onCreate(_ctx: Ctx) {
    this.status = this.label('', { size: 36 });
  }

  /** After onCreate and when the frame changes: place them (ctx.screen, in design units). */
  protected onLayout({ screen }: Ctx) {
    this.status.setFontSize(36 * screen.hud).setPosition(screen.cx, screen.top + 40 * screen.hud);
  }

  /** After any change (a new game, an event, new options): show the state. */
  protected onState({ result }: Ctx) {
    this.status.setText(result ? 'Hết ván!' : 'Đang chơi');
  }

  // Optional hooks: write them and the app calls them.
  //   onStart(ctx: Ctx)                       a new game began: clear what the last one left
  //   on<Event>(ctx: Ctx, event: ViewEvent)   someone's event was played: animate it
  //   onResync(ctx: Ctx)                     missed events: redraw without old sounds
  //   onEnd(ctx: Ctx)                         the game is over (ctx.result)
  //   onUpdate(ctx: Ctx, dt: number)          every frame (dt in ms)
}
