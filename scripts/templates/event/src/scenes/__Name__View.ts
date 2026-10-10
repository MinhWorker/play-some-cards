/**
 * The event's screen in the web app (Phaser); the Godot client uses godot/. Starter screen: the
 * points so far and a "Hái lộc" button.
 */
import { type Button, GameView, type ViewContext } from '@xomdao/sdk/client';
import type Phaser from 'phaser';
import { PICKS, type State } from '../game/__Name__Game.js';

type Ctx = ViewContext<State>;

export class __Name__View extends GameView<State> {
  private points!: Phaser.GameObjects.Text;
  private pick!: Button;

  protected onCreate(_ctx: Ctx) {
    this.points = this.label('', { size: 72 });
    this.pick = this.button('Hái lộc', () => this.send('pick', {}), { size: 48 });
  }

  protected onLayout({ screen }: Ctx) {
    const { height, cx, top, hud } = screen;
    const middle = top + (height - top) / 2;
    this.points.setFontSize(72 * hud).setPosition(cx, middle - 60 * hud);
    this.pick.setPosition(cx, middle + 80 * hud);
  }

  protected onState({ state, result }: Ctx) {
    const points = state.picked.reduce((sum, p) => sum + p, 0);
    this.points.setText(`${points} điểm`);
    this.pick.setEnabled(!result && state.picked.length < PICKS);
  }
}
