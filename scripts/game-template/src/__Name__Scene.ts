import { BoardScene, titleStyle } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Move, type State, TARGET } from './rules.js';

/**
 * Starter board: the running total and three "+1 / +2 / +3" buttons. Replace it with your game.
 * Put images and sounds in ../assets/ and use them by file name: this.image(x, y, 'card'),
 * this.sfx('deal').
 */
export class __Name__Scene extends BoardScene<State, Move> {
  private status!: Phaser.GameObjects.Text;
  private total!: Phaser.GameObjects.Text;
  private buttons: Phaser.GameObjects.Text[] = [];

  protected build() {
    this.status = this.add.text(0, 0, '', titleStyle(36)).setOrigin(0.5);
    this.total = this.add.text(0, 0, '', titleStyle(120)).setOrigin(0.5);
    this.buttons = [1, 2, 3].map((add) =>
      this.add
        .text(0, 0, `+${add}`, titleStyle(56))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.canPlay(add) && this.sendMove({ add })),
    );
  }

  private canPlay(add: number) {
    const { view, me, result } = this.props;
    return !result && view.turn === me && view.total + add <= TARGET;
  }

  protected draw() {
    const { view, me, result } = this.props;
    const { size, cx, cy, hud, statusY } = this.boardArea();

    const status = result
      ? 'Hết ván!'
      : view.turn === me
        ? 'Tới lượt bạn!'
        : `Lượt của ${this.nameOf(view.turn)}`;
    this.status.setFontSize(36 * hud).setPosition(cx, statusY);
    this.fitText(this.status, status, this.scale.width - 24);

    this.total
      .setText(`${view.total} / ${TARGET}`)
      .setFontSize(size * 0.2)
      .setPosition(cx, cy - size * 0.15);
    this.buttons.forEach((button, i) => {
      button
        .setFontSize(size * 0.12)
        .setPosition(cx + (i - 1) * size * 0.3, cy + size * 0.2)
        .setAlpha(this.canPlay(i + 1) ? 1 : 0.4);
    });
  }
}
