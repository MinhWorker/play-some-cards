/**
 * The room settings screen, in steps: play a friend or the computer, then (computer) how strong.
 * It opens for "Tạo phòng" and again for "Tuỳ chỉnh" inside a room, where
 * the room's current picks are marked gold. The last tap calls `this.submit(options)`; those
 * options stay with the room (`ctx.options` in CaroGame and CaroView).
 */
import { hudScale, RoomSetupScene, titleStyle } from '@xomdao/sdk/client';
import type Phaser from 'phaser';
import { type BotLevel, type Options, optionsSchema } from '../game/model.js';
import { MARKS, TINT } from './theme.js';

/** A wooden tile with a label (and maybe a piece) that reacts to taps. */
interface Choice {
  /** Whether this is what the room has now (marked when editing a room). */
  isCurrent: (current: Options) => boolean;
  tile: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
}

type Step = 'opponent' | 'level';

const TITLES: Record<Step, string> = {
  opponent: 'Chơi với ai?',
  level: 'Máy chơi giỏi cỡ nào?',
};

const LEVELS: { level: BotLevel; label: string }[] = [
  { level: 'easy', label: 'Dễ' },
  { level: 'normal', label: 'Vừa' },
  { level: 'hard', label: 'Khó' },
];

export class Setup extends RoomSetupScene<Options> {
  /** Steps shown so far, the current one last ("‹ Quay lại" goes one back). */
  private steps: Step[] = ['opponent'];
  /** What was picked in the earlier steps. */
  private picked: Partial<Options> = {};
  private title!: Phaser.GameObjects.Text;
  private back!: Phaser.GameObjects.Text;
  private opponents: Choice[] = [];
  private levels: Choice[] = [];
  /** Ignores taps for a moment after asking for a room (no double rooms). */
  private sentAt = 0;

  // ── Create ──────────────────────────────────────────────────────────────────────────────

  protected build() {
    this.steps = ['opponent'];
    this.picked = {};
    this.title = this.add.text(0, 0, '', titleStyle(44)).setOrigin(0.5);
    this.back = this.add
      .text(0, 0, '‹ Quay lại', titleStyle(28))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => this.goBack());
    this.opponents = [
      this.choice(
        'Bạn bè',
        { piece: MARKS.X.piece, isCurrent: (c) => c.opponent === 'human' },
        // Editing keeps what this screen doesn't ask (who plays red).
        () => this.send({ ...this.current, opponent: 'human' }),
      ),
      this.choice('Máy', { piece: MARKS.O.piece, isCurrent: (c) => c.opponent === 'bot' }, () =>
        this.pick({ opponent: 'bot' }, 'level'),
      ),
    ];
    this.levels = LEVELS.map(({ level, label }) =>
      this.choice(label, { isCurrent: (c) => c.opponent === 'bot' && c.level === level }, () =>
        this.send({ ...this.current, ...this.picked, level }),
      ),
    );
  }

  private choice(
    text: string,
    extra: { piece?: string; isCurrent: Choice['isCurrent'] },
    onPick: () => void,
  ) {
    const tile = this.image(0, 0, 'tile').setInteractive({ useHandCursor: true });
    const rest = () => this.tint(choice);
    tile.on('pointerover', () => tile.setTint(TINT.hover));
    tile.on('pointerout', rest);
    tile.on('pointerup', () => {
      rest();
      this.sfx('caro-select');
      onPick();
    });
    const choice: Choice = {
      isCurrent: extra.isCurrent,
      tile,
      label: this.add.text(0, 0, text, titleStyle(32)).setOrigin(0.5),
    };
    if (extra.piece) choice.icon = this.image(0, 0, extra.piece);
    return choice;
  }

  // ── Steps ───────────────────────────────────────────────────────────────────────────────

  private pick(options: Partial<Options>, next: Step) {
    this.picked = { ...this.picked, ...options };
    this.steps.push(next);
    this.draw();
  }

  private goBack() {
    this.steps.pop();
    this.draw();
  }

  private send(options: Partial<Options>) {
    if (this.time.now - this.sentAt < 1500) return;
    this.sentAt = this.time.now;
    this.submit(optionsSchema.parse(options));
  }

  // ── Update ──────────────────────────────────────────────────────────────────────────────

  protected draw() {
    const { width, height } = this.view;
    const hud = hudScale();
    const top = this.safeTop();
    const step = this.steps.at(-1) ?? 'opponent';
    const all = { opponent: this.opponents, level: this.levels };
    for (const [name, choices] of Object.entries(all)) {
      for (const c of choices) this.setVisible(c, name === step);
    }
    const choosing = all[step];

    const gap = 16 * hud;
    const count = choosing.length;
    const size = Math.min(
      220 * hud,
      (width - 32 - gap * (count - 1)) / count,
      (height - top) * 0.34,
    );
    const cy = top + (height - top) * 0.5;

    this.title.setFontSize(44 * hud).setPosition(width / 2, cy - size / 2 - 56 * hud);
    this.fitText(this.title, TITLES[step], width - 32, 20);
    this.back
      .setFontSize(28 * hud)
      .setVisible(this.steps.length > 1)
      .setPosition(width / 2, cy + size / 2 + 48 * hud);

    choosing.forEach((c, i) => {
      const x = width / 2 + (i - (count - 1) / 2) * (size + gap);
      c.tile.setPosition(x, cy).setDisplaySize(size, size);
      this.tint(c);
      const labelY = c.icon ? cy + size * 0.28 : cy;
      c.label.setFontSize(Math.max(22, size * 0.2)).setPosition(x, labelY);
      c.icon?.setPosition(x, cy - size * 0.1).setScale((size * 0.45) / c.icon.width);
    });
  }

  /** Gold when it is the room's current pick (editing a room), plain wood otherwise. */
  private tint(c: Choice) {
    if (this.current && c.isCurrent(this.current)) c.tile.setTint(TINT.win);
    else c.tile.clearTint();
  }

  private setVisible(c: Choice, visible: boolean) {
    for (const obj of [c.tile, c.label, c.icon]) obj?.setVisible(visible);
  }
}
