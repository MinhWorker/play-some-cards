/**
 * Câu cá Trung Thu in the Phaser web app (the Godot client has its own, godot/main.gd): the
 * catches so far, the points and "Thả câu".
 */
import { type Button, GameView, type ViewContext } from '@xomdao/sdk/client';
import type Phaser from 'phaser';
import { CASTS, CATCHES, pointsOf, type State } from '../game/model.js';

type Ctx = ViewContext<State>;

export class FishingView extends GameView<State> {
  private status!: Phaser.GameObjects.Text;
  private caught!: Phaser.GameObjects.Text;
  private cast!: Button;

  protected onCreate(_ctx: Ctx) {
    this.status = this.label('', { size: 40 });
    this.caught = this.label('', { size: 30 });
    this.cast = this.button('Thả câu', () => this.send('cast', {}), { size: 48 });
  }

  protected onLayout({ screen }: Ctx) {
    const { cx, top, height, hud } = screen;
    const middle = top + (height - top) / 2;
    this.status.setFontSize(40 * hud).setPosition(cx, top + 48 * hud);
    this.caught.setFontSize(30 * hud).setPosition(cx, middle - 40 * hud);
    this.cast.setPosition(cx, middle + 120 * hud);
  }

  protected onState({ state, result }: Ctx) {
    const left = CASTS - state.caught.length;
    this.status.setText(`${pointsOf(state.caught)} điểm  ·  còn ${left} lượt`);
    this.caught.setText(
      state.caught.map((id) => CATCHES.find((c) => c.id === id)?.name ?? '').join('\n'),
    );
    this.cast.setEnabled(!result && left > 0);
  }
}
