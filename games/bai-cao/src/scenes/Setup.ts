/**
 * The room settings screen, one form: how many computer players join, and how many rounds. It opens for "Tạo phòng" and for the host's "Tuỳ chỉnh" in the room,
 * with the current picks selected.
 */
import { type Button, RoomSetupScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Options, optionsSchema } from '../game/model.js';

type Key = 'bots' | 'rounds';

interface Row {
  key: Key;
  title: string;
  choices: { value: Options[Key]; label: string }[];
}

const ROWS: Row[] = [
  {
    key: 'bots',
    title: 'Chơi với máy',
    choices: [0, 1, 2, 3, 4, 5].map((n) => ({ value: n, label: n ? `${n} máy` : 'Không' })),
  },
  {
    key: 'rounds',
    title: 'Số ván',
    choices: [5, 10, 20].map((n) => ({ value: n as Options['rounds'], label: `${n} ván` })),
  },
];

export class Setup extends RoomSetupScene<Options> {
  private picks!: Options;
  private panel!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private rows: { row: Row; title: Phaser.GameObjects.Text; chips: Button[] }[] = [];
  private submitButton!: Button;
  /** Ignores taps for a moment after asking for a room (no double rooms). */
  private sentAt = -Infinity;

  protected build() {
    this.sentAt = -Infinity;
    this.picks = optionsSchema.parse(this.current ?? {});
    this.panel = this.add.graphics();
    this.title = this.label(this.current ? 'Tuỳ chỉnh bàn' : 'Tạo bàn Bài Cào', { size: 40 });
    this.rows = ROWS.map((row) => ({
      row,
      title: this.label(row.title, { size: 28, color: '#ffe8a3' }),
      chips: row.choices.map(({ value, label }) =>
        this.button(label, () => this.pick(row.key, value), {
          image: 'button',
          size: 28,
          hoverSound: false,
        }),
      ),
    }));
    this.submitButton = this.button(this.current ? 'Lưu' : 'Tạo phòng', () => this.send(), {
      image: 'button',
      size: 32,
    });
    this.refresh();
  }

  private pick(key: Key, value: Options[Key]) {
    this.picks = { ...this.picks, [key]: value };
    this.refresh();
  }

  /** Lights up the picked choice of each row. */
  private refresh() {
    for (const { row, chips } of this.rows) {
      row.choices.forEach(({ value }, i) => {
        const chip = chips[i] as Button;
        const picked = this.picks[row.key] === value;
        chip.container.setAlpha(picked ? 1 : 0.55);
        chip.container.setScale(picked ? 1.06 : 1);
      });
    }
  }

  private send() {
    if (this.time.now - this.sentAt < 1500) return;
    this.sentAt = this.time.now;
    this.submit(optionsSchema.parse(this.picks));
  }

  protected draw() {
    const { width, height } = this.view;
    const top = this.safeTop();
    const panelW = Math.min(820, width - 48);
    const pad = 24;
    const rowH = 136;
    const titleH = 80;
    const submitH = 112;
    const panelH = titleH + ROWS.length * rowH + submitH + pad * 2;
    const scale = Math.min(1, (height - top - 16) / panelH);
    const h = panelH * scale;
    const x = (width - panelW) / 2;
    const y = top + Math.max(0, (height - top - h) / 2);

    this.panel.clear();
    this.panel.fillStyle(0x4a1f12, 0.92).fillRoundedRect(x, y, panelW, h, 22);
    this.panel.lineStyle(4, 0xf2c14e, 1).strokeRoundedRect(x, y, panelW, h, 22);

    let cursor = y + pad * scale;
    this.title.setPosition(width / 2, cursor + (titleH * scale) / 2);
    this.fitText(this.title, this.title.text, panelW - 32, 20);
    cursor += titleH * scale;
    const inner = panelW - pad * 2;
    for (const { title, chips } of this.rows) {
      title.setPosition(width / 2, cursor + 16 * scale);
      const gap = 12;
      const chipW = (inner - gap * (chips.length - 1)) / chips.length;
      const chipH = 88 * scale;
      chips.forEach((chip, i) => {
        chip
          .setSize(chipW, chipH)
          .setPosition(x + pad + chipW / 2 + i * (chipW + gap), cursor + 80 * scale);
      });
      cursor += rowH * scale;
    }
    this.submitButton
      .setSize(Math.min(320, inner), 96 * scale)
      .setPosition(width / 2, cursor + (submitH * scale) / 2);
  }
}
