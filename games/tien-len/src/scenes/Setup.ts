/**
 * The room settings screen, one form: computer players, how strong, how many rounds, and the
 * turn clock. It opens for "Tạo phòng" and for the host's "Tuỳ chỉnh" in the room, with the
 * current picks selected.
 */
import { type Button, RoomSetupScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Options, optionsSchema, ROUNDS, TURN_SECONDS } from '../game/model.js';

type Key = 'bots' | 'level' | 'rounds' | 'turnSeconds';

interface Row {
  key: Key;
  title: string;
  choices: { value: Options[Key]; label: string }[];
}

const ROWS: Row[] = [
  {
    key: 'bots',
    title: 'Chơi với máy',
    choices: [
      { value: 0, label: 'Không' },
      { value: 1, label: '1 máy' },
      { value: 2, label: '2 máy' },
      { value: 3, label: '3 máy' },
    ],
  },
  {
    key: 'level',
    title: 'Máy chơi',
    choices: [
      { value: 'easy', label: 'Dễ' },
      { value: 'normal', label: 'Vừa' },
      { value: 'hard', label: 'Khó' },
    ],
  },
  {
    key: 'rounds',
    title: 'Số vòng',
    choices: ROUNDS.map((n) => ({ value: n, label: `${n} vòng` })),
  },
  {
    key: 'turnSeconds',
    title: 'Thời gian mỗi lượt',
    choices: TURN_SECONDS.map((s) => ({ value: s, label: `${s} giây` })),
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
    this.picks = optionsSchema.parse(this.current ?? {});
    this.panel = this.add.graphics();
    this.title = this.label(this.current ? 'Tuỳ chỉnh ván đấu' : 'Tạo ván đấu', { size: 40 });
    this.rows = ROWS.map((row) => ({
      row,
      title: this.label(row.title, { size: 24, color: '#ffe8a3' }),
      chips: row.choices.map(({ value, label }) =>
        this.button(label, () => this.pick(row.key, value), {
          image: 'button',
          size: 24,
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

  /** Lights up the picked choice of each row; greys out rows that don't matter now. */
  private refresh() {
    for (const { row, title, chips } of this.rows) {
      // Strength needs a computer; the clock needs two people (3 computers leave one seat).
      const matters =
        (row.key !== 'level' || this.picks.bots > 0) &&
        (row.key !== 'turnSeconds' || this.picks.bots < 3);
      title.setAlpha(matters ? 1 : 0.45);
      row.choices.forEach(({ value }, i) => {
        const chip = chips[i] as Button;
        const picked = this.picks[row.key] === value;
        chip.setEnabled(matters);
        chip.container.setAlpha(!matters ? 0.3 : picked ? 1 : 0.55);
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
    const { width, height } = this.scale;
    const top = this.safeTop();
    const panelW = Math.min(560, width - 24);
    const pad = 16;
    const rowH = 96;
    const titleH = 64;
    const submitH = 72;
    const panelH = titleH + ROWS.length * rowH + submitH + pad * 2;
    const scale = Math.min(1, (height - top - 16) / panelH);
    const h = panelH * scale;
    const x = (width - panelW) / 2;
    const y = top + Math.max(0, (height - top - h) / 2);

    this.panel.clear();
    this.panel.fillStyle(0x0d4a33, 0.92).fillRoundedRect(x, y, panelW, h, 22);
    this.panel.lineStyle(4, 0xf2c14e, 1).strokeRoundedRect(x, y, panelW, h, 22);

    let cursor = y + pad * scale;
    this.title.setPosition(width / 2, cursor + (titleH * scale) / 2);
    this.fitText(this.title, this.title.text, panelW - 32, 20);
    cursor += titleH * scale;
    const inner = panelW - pad * 2;
    for (const { row, title, chips } of this.rows) {
      title.setPosition(width / 2, cursor + 16 * scale);
      const gap = 8;
      const chipW = (inner - gap * (chips.length - 1)) / chips.length;
      const chipH = 50 * scale;
      chips.forEach((chip, i) => {
        chip
          .setSize(chipW, chipH)
          .setPosition(x + pad + chipW / 2 + i * (chipW + gap), cursor + 58 * scale);
      });
      cursor += rowH * scale;
    }
    this.submitButton
      .setSize(Math.min(280, inner), 62 * scale)
      .setPosition(width / 2, cursor + (submitH * scale) / 2);
  }
}
