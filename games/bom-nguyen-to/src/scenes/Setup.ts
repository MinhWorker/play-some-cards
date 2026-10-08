import { RoomSetupScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import {
  ELEMENT_INFO,
  ELEMENTS,
  type Element,
  type Options,
  optionsSchema,
} from '../game/model.js';
import { THEME, textStyle } from './theme.js';

interface Choice {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  active: () => boolean;
}
export class Setup extends RoomSetupScene<Options> {
  private picked!: Options;
  private content!: Phaser.GameObjects.Container;
  private choices: Choice[] = [];
  private title!: Phaser.GameObjects.Text;
  private description!: Phaser.GameObjects.Text;
  submitButton!: Choice;
  protected build() {
    this.picked = optionsSchema.parse(this.current ?? {});
    this.choices = [];
    this.content = this.add.container();
    this.title = this.add.text(0, 0, 'Bom Nguyên Tố', textStyle(44)).setOrigin(0.5);
    this.content.add(this.title);
    const heading = (y: number, label: string) =>
      this.content.add(this.add.text(-360, y, label, textStyle(25)).setOrigin(0, 0.5));
    heading(-144, 'Chế độ');
    heading(-74, 'Số nhân vật');
    heading(-4, 'Máy trong phòng');
    heading(66, 'Độ khó');
    heading(142, 'Nguyên tố khởi đầu');
    ['Sinh tồn đơn', 'Đấu đội 2v2'].forEach((name, i) => {
      this.choice(
        name,
        -20 + i * 214,
        -144,
        200,
        () => this.picked.mode === (i === 0 ? 'solo' : 'teams'),
        () => {
          this.picked.mode = i === 0 ? 'solo' : 'teams';
          if (i === 1) this.picked.total = 4;
          this.draw();
        },
      );
    });
    for (let i = 1; i <= 4; i++)
      this.choice(
        `${i}`,
        -55 + (i - 1) * 117,
        -74,
        100,
        () => this.picked.total === i,
        () => {
          if (this.picked.mode === 'teams') return;
          this.picked.total = i;
          this.picked.bots = Math.min(this.picked.bots, i - 1);
          this.draw();
        },
      );
    for (let i = 0; i <= 3; i++)
      this.choice(
        i === 0 ? 'Bạn bè' : `${i} máy`,
        -55 + i * 117,
        -4,
        100,
        () => this.picked.bots === i,
        () => {
          this.picked.bots = Math.min(i, this.picked.total - 1);
          this.draw();
        },
      );
    ['Dễ', 'Thường', 'Khó'].forEach((name, i) => {
      this.choice(
        name,
        -22 + i * 153,
        66,
        140,
        () => this.picked.level === ['easy', 'normal', 'hard'][i],
        () => {
          this.picked.level = (['easy', 'normal', 'hard'] as const)[i] ?? 'normal';
          this.draw();
        },
      );
    });
    ELEMENTS.forEach((element, i) => {
      const c = this.choice(
        ELEMENT_INFO[element].name,
        -20 + i * 86,
        152,
        76,
        () => this.picked.element === element,
        () => {
          this.picked.element = element;
          this.draw();
        },
      );
      const icon = this.image(0, -16, element).setDisplaySize(46, 50);
      c.container.add(icon);
      c.label.setY(29);
    });
    this.description = this.add.text(0, 226, '', textStyle(21, THEME.muted)).setOrigin(0.5);
    this.content.add(this.description);
    this.submitButton = this.choice(
      'Vào đấu trường',
      0,
      290,
      290,
      () => true,
      () => this.submit(this.picked),
    );
  }
  private choice(
    label: string,
    x: number,
    y: number,
    width: number,
    active: () => boolean,
    pick: () => void,
  ): Choice {
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, textStyle(23)).setOrigin(0.5);
    const container = this.add
      .container(x, y, [bg, text])
      .setSize(width, y === 152 ? 88 : 52)
      .setInteractive({ useHandCursor: true });
    container.on('pointerup', pick);
    this.content.add(container);
    const c = { container, bg, label: text, active };
    this.choices.push(c);
    return c;
  }
  protected draw() {
    const { width, height } = this.view;
    const scale = Math.min((width - 80) / 810, (height - this.safeTop() - 40) / 580);
    this.content
      .setPosition(width / 2, this.safeTop() + (height - this.safeTop()) / 2 - 30)
      .setScale(scale);
    this.title.setPosition(0, -220);
    for (const c of this.choices) {
      const w = c.container.width,
        h = c.container.height;
      c.bg
        .clear()
        .fillStyle(c.active() ? 0x31515a : THEME.ink, 0.94)
        .fillRoundedRect(-w / 2, -h / 2, w, h, 12)
        .lineStyle(c.active() ? 2 : 1, c.active() ? THEME.gold : 0x63817c)
        .strokeRoundedRect(-w / 2, -h / 2, w, h, 12);
      c.label.setColor(c.active() ? THEME.paper : THEME.muted);
    }
    const element: Element = this.picked.element;
    this.description.setText(
      `${ELEMENT_INFO[element].skill} · ${this.picked.mode === 'teams' ? 'Thiếu người: tự bổ sung máy' : this.picked.total === 1 ? 'Luyện tập một mình' : `${this.picked.total} nhân vật`}`,
    );
  }
}
