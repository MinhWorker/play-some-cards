import { type Button, RoomSetupScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Options, optionsSchema } from '../game/model.js';

export class Setup extends RoomSetupScene<Options> {
  private picks!: Options;
  private panel!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private labelText!: Phaser.GameObjects.Text;
  private clockLabel!: Phaser.GameObjects.Text;
  private choices: Button[] = [];
  private clockChoices: Button[] = [];
  private submitButton!: Button;
  private sentAt = -Infinity;

  protected build() {
    this.picks = optionsSchema.parse(this.current ?? {});
    this.panel = this.add.graphics();
    this.title = this.label(this.current ? 'Tuỳ chỉnh ván đấu' : 'Tạo ván đấu', { size: 40 });
    this.labelText = this.label('Chơi với máy', { size: 26, color: '#ffe8a3' });
    this.choices = [0, 1, 2, 3].map((bots) =>
      this.button(
        bots === 0 ? 'Không' : `${bots} máy`,
        () => {
          this.picks = { ...this.picks, bots };
          this.refresh();
        },
        { image: 'button', size: 24 },
      ),
    );
    this.clockLabel = this.label('Thời gian lượt PvP', { size: 26, color: '#ffe8a3' });
    this.clockChoices = [15, 30, 60, 90].map((turnSeconds) =>
      this.button(
        `${turnSeconds} giây`,
        () => {
          this.picks = { ...this.picks, turnSeconds };
          this.refresh();
        },
        { image: 'button', size: 24 },
      ),
    );
    this.submitButton = this.button(
      this.current ? 'Lưu' : 'Tạo phòng',
      () => {
        if (this.time.now - this.sentAt < 1500) return;
        this.sentAt = this.time.now;
        this.submit(this.picks);
      },
      { image: 'button', size: 30 },
    );
    this.refresh();
  }

  private refresh() {
    this.choices.forEach((choice, bots) => {
      const picked = bots === this.picks.bots;
      choice.container.setAlpha(picked ? 1 : 0.55);
      choice.container.setScale(picked ? 1.06 : 1);
    });
    this.clockChoices.forEach((choice, i) => {
      const picked = [15, 30, 60, 90][i] === this.picks.turnSeconds;
      choice.container.setAlpha(picked ? 1 : 0.55);
      choice.container.setScale(picked ? 1.06 : 1);
    });
  }

  protected draw() {
    const { width, height } = this.view;
    const top = this.safeTop();
    const panelW = Math.min(560, width - 24);
    const panelH = 388;
    const x = (width - panelW) / 2;
    const y = top + Math.max(0, (height - top - panelH) / 2);
    this.panel.clear();
    this.panel.fillStyle(0x0d4a33, 0.92).fillRoundedRect(x, y, panelW, panelH, 22);
    this.panel.lineStyle(4, 0xf2c14e).strokeRoundedRect(x, y, panelW, panelH, 22);
    this.title.setPosition(width / 2, y + 48);
    this.labelText.setPosition(width / 2, y + 105);
    const gap = 8;
    const chipW = (panelW - 32 - gap * 3) / 4;
    this.choices.forEach((choice, i) => {
      choice.setSize(chipW, 52).setPosition(x + 16 + chipW / 2 + i * (chipW + gap), y + 163);
    });
    this.clockLabel.setPosition(width / 2, y + 220);
    this.clockChoices.forEach((choice, i) => {
      choice.setSize(chipW, 52).setPosition(x + 16 + chipW / 2 + i * (chipW + gap), y + 270);
    });
    this.submitButton.setSize(Math.min(260, panelW - 32), 58).setPosition(width / 2, y + 342);
  }
}
