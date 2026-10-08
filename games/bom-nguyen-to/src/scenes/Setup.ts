import { RoomSetupScene, rasterizeGraphics } from '@psc/sdk/client';
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
  face: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  image?: Phaser.GameObjects.Image;
  skin?: string;
  label: Phaser.GameObjects.Text;
  mark: Phaser.GameObjects.Text;
  active: () => boolean;
  enabled: () => boolean;
  fill?: number;
  primary: boolean;
  hovered: boolean;
  pressed: boolean;
  lane: string;
}

const ELEMENT_PASTELS: Record<Element, number> = {
  fire: 0xffd5bd,
  water: 0xc5eaff,
  lightning: 0xe8d5ff,
  ice: 0xd7f3fc,
  wind: 0xc9f1dc,
};

export class Setup extends RoomSetupScene<Options> {
  private picked!: Options;
  private content!: Phaser.GameObjects.Container;
  private choices: Choice[] = [];
  private description!: Phaser.GameObjects.Text;
  private skill!: Phaser.GameObjects.Text;
  private summary!: Phaser.GameObjects.Text;
  submitButton!: Choice;

  protected build() {
    this.picked = optionsSchema.parse(this.current ?? {});
    this.choices = [];
    this.content = this.add.container();
    const paper = this.add.graphics();
    paper
      .fillStyle(THEME.shadow, 0.22)
      .fillRoundedRect(-438, -293, 876, 596, 36)
      .fillStyle(THEME.wood)
      .fillRoundedRect(-438, -303, 876, 596, 36)
      .lineStyle(3, THEME.outline)
      .strokeRoundedRect(-438, -303, 876, 596, 36)
      .fillStyle(THEME.panel)
      .fillRoundedRect(-428, -298, 856, 580, 30)
      .lineStyle(2, 0xffe4bd)
      .strokeRoundedRect(-416, -286, 832, 556, 24)
      .lineStyle(2, 0xf0d8bf)
      .lineBetween(0, -190, 0, 237)
      .lineBetween(-396, -211, 396, -211);
    this.content.add(paper);
    rasterizeGraphics(this, paper, 'sheet', { x: -442, y: -307, width: 884, height: 614 });
    this.content.add(this.add.text(0, -260, 'Bom Nguyên Tố', textStyle(50)).setOrigin(0.5));
    this.content.add(this.image(-359, -254, 'bomb').setDisplaySize(82, 82));
    const flower = this.add.graphics();
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      flower
        .fillStyle(THEME.peach)
        .fillCircle(360 + Math.cos(angle) * 14, -256 + Math.sin(angle) * 14, 12);
    }
    flower.fillStyle(THEME.gold).fillCircle(360, -256, 10);
    this.content.add(flower);
    rasterizeGraphics(this, flower, 'flower', { x: 328, y: -288, width: 64, height: 64 });
    const heading = (x: number, y: number, label: string) =>
      this.content.add(this.add.text(x, y, label, textStyle(24)).setOrigin(0, 0.5));
    heading(-396, -194, 'Chế độ');
    heading(-396, -88, 'Số nhân vật');
    heading(-396, 18, 'Máy trong phòng');
    heading(-396, 124, 'Độ khó');
    heading(26, -194, 'Bạn nhỏ của bạn');

    ['Sinh tồn đơn', 'Đấu đội 2v2'].forEach((name, i) => {
      this.choice(
        name,
        -300 + i * 196,
        -143,
        184,
        76,
        () => this.picked.mode === (i === 0 ? 'solo' : 'teams'),
        () => {
          this.picked.mode = i === 0 ? 'solo' : 'teams';
          if (i === 1) this.picked.total = 4;
          this.draw();
        },
      );
    });
    for (let i = 1; i <= 4; i++) {
      this.choice(
        `${i}`,
        -352 + (i - 1) * 100,
        -37,
        88,
        76,
        () => this.picked.total === i,
        () => {
          if (this.picked.mode === 'teams') return;
          this.picked.total = i;
          this.picked.bots = Math.min(this.picked.bots, i - 1);
          this.draw();
        },
        { enabled: () => this.picked.mode !== 'teams' || i === 4 },
      );
    }
    for (let i = 0; i <= 3; i++) {
      this.choice(
        `${i} máy`,
        -352 + i * 100,
        69,
        88,
        76,
        () => this.picked.bots === i,
        () => {
          this.picked.bots = Math.min(i, this.picked.total - 1);
          this.draw();
        },
        { enabled: () => i < this.picked.total },
      );
    }
    ['Dễ', 'Thường', 'Khó'].forEach((name, i) => {
      this.choice(
        name,
        -332 + i * 132,
        175,
        120,
        76,
        () => this.picked.level === ['easy', 'normal', 'hard'][i],
        () => {
          this.picked.level = (['easy', 'normal', 'hard'] as const)[i] ?? 'normal';
          this.draw();
        },
      );
    });
    ELEMENTS.forEach((element, i) => {
      const x = i < 3 ? 88 + i * 130 : 153 + (i - 3) * 130;
      const c = this.choice(
        ELEMENT_INFO[element].name,
        x,
        i < 3 ? -113 : 35,
        118,
        130,
        () => this.picked.element === element,
        () => {
          this.picked.element = element;
          this.draw();
        },
        { fill: ELEMENT_PASTELS[element] },
      );
      const icon = this.image(0, -13, element).setDisplaySize(96, 96);
      c.face.addAt(icon, 1);
      c.label.setY(43).setFontSize(28);
    });
    this.skill = this.add.text(218, 119, '', textStyle(27)).setOrigin(0.5);
    this.description = this.add
      .text(218, 164, '', {
        ...textStyle(22, THEME.muted),
        wordWrap: { width: 370 },
      })
      .setOrigin(0.5);
    this.summary = this.add.text(-210, 252, '', textStyle(22, THEME.muted)).setOrigin(0.5);
    this.content.add([this.skill, this.description, this.summary]);
    this.submitButton = this.choice(
      'Vào đấu trường  →',
      218,
      230,
      356,
      76,
      () => true,
      () => this.submit(this.picked),
      { primary: true },
    );
  }

  private choice(
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
    active: () => boolean,
    pick: () => void,
    options: { enabled?: () => boolean; fill?: number; primary?: boolean } = {},
  ): Choice {
    const bg = this.add.graphics();
    const text = this.add.text(0, 0, label, textStyle(options.primary ? 31 : 27)).setOrigin(0.5);
    const mark = this.add.text(width / 2 - 15, -height / 2 + 13, '✓', textStyle(20)).setOrigin(0.5);
    const face = this.add.container(0, 0, [bg, text, mark]);
    const hitWidth = Math.max(width, 96);
    const hitHeight = Math.max(height, 96);
    const hitX = (width - hitWidth) / 2;
    const hitY = (height - hitHeight) / 2;
    const container = this.add
      .container(x, y, [face])
      .setSize(width, height)
      .setInteractive({
        useHandCursor: true,
        hitArea: { x: hitX, y: hitY, width: hitWidth, height: hitHeight },
        hitAreaCallback: (_area: unknown, px: number, py: number) =>
          px >= hitX && px <= hitX + hitWidth && py >= hitY && py <= hitY + hitHeight,
      });
    const c: Choice = {
      container,
      face,
      bg,
      label: text,
      mark,
      active,
      enabled: options.enabled ?? (() => true),
      fill: options.fill,
      primary: options.primary ?? false,
      hovered: false,
      pressed: false,
      lane: `setup-choice-${this.choices.length}`,
    };
    const release = () => {
      c.pressed = false;
      this.paintChoice(c);
      this.runtime.run(
        async (fx) => {
          await fx.tween({ targets: face, y: 0, duration: 160, ease: 'Back.Out' });
        },
        { lane: c.lane, policy: 'replace' },
      );
    };
    container.on('pointerover', () => {
      c.hovered = true;
      this.paintChoice(c);
    });
    container.on('pointerout', () => {
      c.hovered = false;
      release();
    });
    container.on('pointerdown', () => {
      if (!c.enabled()) return;
      this.runtime.cancelLane(c.lane);
      c.pressed = true;
      face.setY(4);
      this.paintChoice(c);
    });
    container.on('pointerup', () => {
      const pressed = c.pressed;
      release();
      if (pressed && c.enabled()) pick();
    });
    this.content.add(container);
    this.choices.push(c);
    return c;
  }

  private paintChoice(c: Choice) {
    const w = c.container.width;
    const h = c.container.height;
    const selected = c.active();
    const enabled = c.enabled();
    const skin = `${selected}:${enabled}:${c.hovered && enabled}:${c.pressed}`;
    c.mark.setVisible(selected && !c.primary);
    c.label.setColor(enabled ? THEME.paper : THEME.muted);
    c.container.setAlpha(enabled ? 1 : 0.46);
    if (c.skin === skin) return;
    c.skin = skin;
    const fill = c.primary
      ? c.hovered || c.pressed
        ? 0xffd689
        : THEME.gold
      : (c.fill ?? (selected ? THEME.mint : c.hovered && enabled ? 0xfff0d5 : 0xfffaf1));
    c.bg
      .clear()
      .fillStyle(c.primary ? 0xd99951 : THEME.shadow, c.primary ? 1 : 0.55)
      .fillRoundedRect(-w / 2, -h / 2 + (c.pressed ? 2 : 6), w, h, 19)
      .fillStyle(fill)
      .fillRoundedRect(-w / 2, -h / 2, w, h, 19)
      .lineStyle(selected && !c.primary ? 3 : 2, selected ? THEME.outline : 0xd7b5a2)
      .strokeRoundedRect(-w / 2, -h / 2, w, h, 19)
      .lineStyle(2, 0xfffaf1, 0.8)
      .strokeRoundedRect(-w / 2 + 5, -h / 2 + 4, w - 10, h - 10, 15);
    if (c.hovered && enabled) {
      c.bg.lineStyle(2, THEME.gold).strokeRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 22);
    }
    c.image = rasterizeGraphics(
      this,
      c.bg,
      c.lane,
      { x: -w / 2 - 6, y: -h / 2 - 6, width: w + 12, height: h + 18 },
      c.image,
    );
  }

  protected draw() {
    const { width, height } = this.view;
    const scale = Math.min((width - 48) / 876, (height - this.safeTop() - 32) / 606, 1);
    this.content.setPosition(width / 2, this.safeTop() + 16 + 303 * scale).setScale(scale);
    for (const c of this.choices) this.paintChoice(c);
    const element: Element = this.picked.element;
    this.skill.setText(ELEMENT_INFO[element].skill);
    this.description.setText(ELEMENT_INFO[element].description);
    this.summary.setText(
      this.picked.mode === 'teams'
        ? '2 đội · 4 bạn nhỏ'
        : this.picked.total === 1
          ? 'Luyện tập một mình'
          : `${this.picked.total} bạn nhỏ · Sinh tồn đơn`,
    );
  }
}
