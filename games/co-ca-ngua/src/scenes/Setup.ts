import { type Button, RoomSetupScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Options, optionsSchema } from '../game/model.js';

export class Setup extends RoomSetupScene<Options> {
  private picks!: Options;
  private title!: Phaser.GameObjects.Text;
  private buttons: Button[] = [];
  private submitButton!: Button;
  private sent = false;

  protected build() {
    this.sent = false;
    this.picks = optionsSchema.parse(this.current ?? {});
    this.title = this.label('Chơi với ai?', { size: 40 });
    this.buttons = ['Bạn bè', '1 máy', '2 máy', '3 máy'].map((text, bots) =>
      this.button(
        text,
        () => {
          this.picks = { bots };
          this.draw();
        },
        { image: 'button', slice: 48, size: 32, hoverSound: false },
      ),
    );
    this.submitButton = this.button(
      this.current ? 'Lưu' : 'Tạo phòng',
      () => {
        if (this.sent) return;
        this.sent = true;
        this.submit(this.picks);
      },
      { image: 'button', slice: 48, size: 36 },
    );
  }

  protected draw() {
    const { width, height } = this.view;
    const cx = width / 2;
    const cy = this.safeTop() + (height - this.safeTop()) / 2;
    this.title.setPosition(cx, cy - 170);
    this.buttons.forEach((button, bots) => {
      button
        .setSize(248, 96)
        .setPosition(cx + (bots % 2 ? 1 : -1) * 136, cy - 60 + Math.floor(bots / 2) * 112);
      button.container.setAlpha(this.picks.bots === bots ? 1 : 0.5);
    });
    this.submitButton.setSize(272, 96).setPosition(cx, cy + 192);
    for (const button of [...this.buttons, this.submitButton]) {
      button.container.input?.hitArea.setTo(0, 0, button.container.width, button.container.height);
    }
  }
}
