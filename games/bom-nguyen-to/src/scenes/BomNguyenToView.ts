import { GameView, type ViewContext } from '@psc/sdk/client';
import Phaser from 'phaser';
import { blastCells, moveFighter } from '../game/arena.js';
import { dangerMap } from '../game/bot.js';
import {
  DIRECTIONS,
  type Direction,
  ELEMENT_INFO,
  ELEMENTS,
  type Element,
  type Fighter,
  HEIGHT,
  keyOf,
  MATCH_TIME,
  type Options,
  type Point,
  SELECT_TIME,
  type State,
  tileAt,
  WIDTH,
} from '../game/model.js';
import {
  type ActorAnimation,
  actorAnimation,
  actorFrame,
  type EffectAnimation,
  effectAnimation,
  effectFrame,
  registerAnimations,
} from './animations.js';
import { rasterizeGraphics } from './paper.js';
import { THEME, textStyle } from './theme.js';

type Ctx = ViewContext<State, Options>;
interface Control {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  width: number;
  height: number;
  enabled: boolean;
  hovered: boolean;
  pressed: boolean;
  selected: boolean;
  accent: number;
  fill: number;
  paper?: Phaser.GameObjects.Image;
  paint?: string;
}
interface Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Graphics;
  position: Point;
  correction: Point;
  element: Element;
  facing: Fighter['facing'];
  clip: ActorAnimation;
  oneShot: ActorAnimation | null;
  lastMoved: number;
  hpBefore: number;
  skillBefore: number;
  bombBefore: number;
  dashBefore: number;
  frozenBefore: number;
  status: Phaser.GameObjects.Sprite | null;
  lastDust: number;
  hpPaint: string;
}
const PASTEL: Record<Element, number> = {
  fire: 0xffd5bd,
  water: 0xc5eaff,
  lightning: 0xe8d5ff,
  ice: 0xd7f3fc,
  wind: 0xc9f1dc,
};
const KEY_DIR: Record<string, Direction> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export class BomNguyenToView extends GameView<State, Options> {
  private backdrop!: Phaser.GameObjects.Image;
  private tiles = new Map<string, Phaser.GameObjects.Image>();
  private obstacles = new Map<string, Phaser.GameObjects.Image>();
  private actors = new Map<string, Actor>();
  private bombs = new Map<
    number,
    {
      image: Phaser.GameObjects.Sprite;
      timer: Phaser.GameObjects.Text;
      ring: Phaser.GameObjects.Ellipse;
    }
  >();
  private pickups = new Map<
    string,
    { image: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text }
  >();
  private flames = new Map<string, Phaser.GameObjects.Sprite>();
  private effects = new Set<Phaser.GameObjects.Sprite>();
  private floaters = new Set<{ text: Phaser.GameObjects.Text; start: number; y: number }>();
  private previousCells: State['cells'] = [];
  private previousPickups = new Map<string, State['pickups'][number]>();
  private warningCells: { cell: Point; start: number; element: Element; frozen: boolean }[] = [];
  private suppressFeedback = true;
  private localMarker!: Phaser.GameObjects.Graphics;
  private markerPaint = '';
  private overlayShade!: Phaser.GameObjects.Graphics;
  private statPaper!: Phaser.GameObjects.Image;
  private timerPaper!: Phaser.GameObjects.Image;
  private warnings!: Phaser.GameObjects.Graphics;
  private propShadows!: Phaser.GameObjects.Graphics;
  private platform!: Phaser.GameObjects.Graphics;
  private platformPaper?: Phaser.GameObjects.Image;
  private shadowPaper?: Phaser.GameObjects.Image;
  private boardPaint = '';
  private hud!: Phaser.GameObjects.Container;
  private rail!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Text;
  private titleTail!: Phaser.GameObjects.Text;
  private modeLabel!: Phaser.GameObjects.Text;
  private timerLabel!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private stats!: Phaser.GameObjects.Text;
  private skillName!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
  private resultPortrait!: Phaser.GameObjects.Image;
  private resultDetail!: Phaser.GameObjects.Text;
  private resultStars!: Phaser.GameObjects.Sprite;
  private roster: {
    container: Phaser.GameObjects.Container;
    portrait: Phaser.GameObjects.Image;
    name: Phaser.GameObjects.Text;
    hp: Phaser.GameObjects.Graphics;
  }[] = [];
  private pad: Control[] = [];
  private actions: Control[] = [];
  private selectPanel!: Phaser.GameObjects.Container;
  private selectTitle!: Phaser.GameObjects.Text;
  private selectDescription!: Phaser.GameObjects.Text;
  private selectChoices: Control[] = [];
  private readyButton!: Control;
  private resultPanel!: Phaser.GameObjects.Container;
  private resultText!: Phaser.GameObjects.Text;
  private helpButton!: Control;
  private helpPanel!: Phaser.GameObjects.Container;
  private helpClose!: Control;
  private keys: string[] = [];
  private touch = new Map<number, Direction>();
  private direction: Direction = 'none';
  private sentDirection: Direction = 'none';
  private inputElapsed = 0;
  private snapshotAt = 0;
  private lastPhase: State['phase'] = 'select';
  private previousBlast = 0;
  private lastViewer: string | null = null;
  private tw = 60;
  private th = 32;
  private ox = 0;
  private oy = 0;

  protected onCreate(ctx: Ctx) {
    this.tiles = new Map();
    this.obstacles = new Map();
    this.actors = new Map();
    this.bombs = new Map();
    this.pickups = new Map();
    this.flames = new Map();
    this.effects = new Set();
    this.floaters = new Set();
    this.previousCells = [];
    this.previousPickups = new Map();
    this.warningCells = [];
    this.suppressFeedback = true;
    this.keys = [];
    this.touch = new Map();
    this.direction = 'none';
    this.sentDirection = 'none';
    this.inputElapsed = 0;
    this.snapshotAt = this.time.now;
    this.lastPhase = ctx.state.phase;
    this.previousBlast = 0;
    this.lastViewer = ctx.me?.id ?? null;
    this.markerPaint = '';
    this.platformPaper = undefined;
    this.shadowPaper = undefined;
    this.boardPaint = '';
    this.backdrop = this.sprite('background').setDepth(-20);
    registerAnimations(this, (name) => this.texture(name));
    this.platform = this.add.graphics().setDepth(-10);
    this.warnings = this.add.graphics().setDepth(2);
    this.warnings.pathDetailThreshold = 1;
    this.propShadows = this.add.graphics().setDepth(1);
    this.localMarker = this.add.graphics().setDepth(4);
    this.overlayShade = this.add.graphics().setDepth(2500);
    this.createHud();
    this.createSelection();
    this.createResult();
    this.createHelp();
    this.bindInput();
  }

  private text(text: string, size: number, color = THEME.paper) {
    return this.add.text(0, 0, text, textStyle(size, color)).setOrigin(0.5);
  }
  private panel(width: number, height: number) {
    const graphics = this.add
      .graphics()
      .fillStyle(THEME.shadow, 0.25)
      .fillRoundedRect(-width / 2, -height / 2 + 8, width, height, 24)
      .fillStyle(THEME.wood)
      .fillRoundedRect(-width / 2, -height / 2 + 4, width, height, 24)
      .fillStyle(THEME.panel)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 24)
      .lineStyle(2.5, THEME.outline)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, 24)
      .lineStyle(2, 0xffffff, 0.7)
      .strokeRoundedRect(-width / 2 + 6, -height / 2 + 6, width - 12, height - 12, 20);
    const bounds = { x: -width / 2 - 3, y: -height / 2 - 3, width: width + 6, height: height + 14 };
    const image = rasterizeGraphics(this, graphics, `bom-paper-${width}-${height}`, bounds)
      .setOrigin(-bounds.x / bounds.width, -bounds.y / bounds.height)
      .setPosition(0, 0);
    graphics.destroy();
    return image;
  }
  private control(
    text: string,
    width: number,
    height: number,
    tap: () => void,
    icon?: string,
  ): Control {
    const bg = this.add.graphics();
    const label = this.text(text, 22);
    // Graphics do not report bounds; include the complete button face and its relief.
    const bounds = this.add.zone(0, 4, width + 4, height + 12);
    const container = this.add
      .container(0, 0, [bounds, bg, label])
      .setSize(width, height)
      .setDepth(2000)
      .setInteractive({ useHandCursor: true });
    const control: Control = {
      container,
      bg,
      label,
      width,
      height,
      enabled: true,
      hovered: false,
      pressed: false,
      selected: false,
      accent: THEME.outline,
      fill: THEME.cream,
    };
    if (icon) {
      control.icon = this.sprite(icon);
      container.addAt(control.icon, 2);
      control.icon.setDisplaySize(height * 0.62, height * 0.62).setY(-8);
      label.setY(height * 0.33);
    }
    container.on('pointerup', () => {
      const pressed = control.pressed;
      control.pressed = false;
      this.paintControl(control);
      if (pressed && control.enabled) {
        tap();
      }
    });
    container.on('pointerdown', () => {
      control.pressed = control.enabled;
      this.paintControl(control);
    });
    container.on('pointerover', () => {
      control.hovered = true;
      this.paintControl(control);
    });
    container.on('pointerout', () => {
      control.hovered = false;
      control.pressed = false;
      this.paintControl(control);
    });
    this.paintControl(control);
    return control;
  }
  private paintControl(c: Control, active = c.selected, color = c.accent) {
    c.selected = active;
    c.accent = color;
    const y = c.pressed ? 4 : 0;
    c.container.setAlpha(c.enabled ? 1 : 0.7);
    const paint = `${active}:${color}:${y}:${c.hovered && c.enabled}:${c.fill}`;
    if (c.paint === paint) return;
    c.paint = paint;
    const radius = Math.min(22, c.height / 2);
    c.bg
      .clear()
      .fillStyle(THEME.shadow, 0.25)
      .fillRoundedRect(-c.width / 2, -c.height / 2 + 8, c.width, c.height, radius)
      .fillStyle(THEME.wood)
      .fillRoundedRect(-c.width / 2, -c.height / 2 + 5, c.width, c.height, radius)
      .fillStyle(c.hovered && c.enabled ? 0xfffdf5 : c.fill)
      .fillRoundedRect(-c.width / 2, -c.height / 2 + y, c.width, c.height - y, radius)
      .lineStyle(active ? 4 : 2.5, active ? color : THEME.outline)
      .strokeRoundedRect(-c.width / 2, -c.height / 2 + y, c.width, c.height - y, radius)
      .lineStyle(2, 0xffffff, 0.65)
      .strokeRoundedRect(
        -c.width / 2 + 5,
        -c.height / 2 + y + 5,
        c.width - 10,
        c.height - y - 10,
        radius - 4,
      );
    const paper = rasterizeGraphics(
      this,
      c.bg,
      `bom-control-${c.width}-${c.height}-${paint}`,
      { x: -c.width / 2 - 3, y: -c.height / 2 - 3, width: c.width + 6, height: c.height + 14 },
      c.paper,
    );
    if (!c.paper) c.container.moveTo(paper, 2);
    c.paper = paper;
  }
  private createHud() {
    this.hud = this.add.container().setDepth(2000);
    this.title = this.text('Bom', 52, '#efa949')
      .setOrigin(0, 0)
      .setStroke('#fff6e7', 6)
      .setShadow(2, 3, '#a77261', 0, true, true);
    this.titleTail = this.text('Nguyên Tố', 31, '#6bbdcc')
      .setOrigin(0, 0)
      .setStroke('#fff6e7', 5)
      .setShadow(2, 3, '#a77261', 0, true, true);
    this.modeLabel = this.text('', 20).setOrigin(0, 0);
    this.timerLabel = this.text('03:00', 32);
    this.status = this.text('', 19, THEME.muted);
    this.stats = this.text('', 21).setOrigin(0, 0);
    this.skillName = this.text('', 20).setOrigin(0, 0);
    this.portrait = this.sprite('fire');
    this.statPaper = this.panel(142, 112);
    this.timerPaper = this.panel(102, 54);
    this.rail = this.add.container(0, 0, [
      this.statPaper,
      this.title,
      this.titleTail,
      this.modeLabel,
      this.stats,
      this.skillName,
      this.portrait,
    ]);
    this.hud.add([this.rail, this.timerPaper, this.timerLabel, this.status]);
    this.roster = Array.from({ length: 4 }, () => {
      const bg = this.panel(136, 54);
      const portrait = this.sprite('fire').setPosition(-45, -1).setDisplaySize(56, 56);
      const name = this.text('', 15).setPosition(-18, -12).setOrigin(0, 0.5);
      const hp = this.add.graphics();
      const container = this.add.container(0, 0, [bg, portrait, name, hp]);
      this.hud.add(container);
      return { container, portrait, name, hp };
    });
    this.pad = (['up', 'left', 'down', 'right'] as const).map((dir) => {
      const c = this.control('', 76, 76, () => {});
      c.fill = THEME.peach;
      // Filled directional icons stay crisp and separate from text glyphs.
      const arrow = this.add.graphics().fillStyle(THEME.ink).fillTriangle(-10, 7, 10, 7, 0, -10);
      arrow.setRotation({ up: 0, left: -Math.PI / 2, down: Math.PI, right: Math.PI / 2 }[dir]);
      c.container.add(arrow);
      c.container.on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (!this.canAct()) return;
        this.touch.set(p.id, dir);
        this.refreshDirection();
      });
      const release = (p: Phaser.Input.Pointer) => {
        this.touch.delete(p.id);
        this.refreshDirection();
      };
      c.container.on('pointerout', release);
      this.paintControl(c);
      return c;
    });
    this.actions = [
      this.control('Bom', 98, 92, () => this.act('bomb'), 'bomb'),
      this.control('Kỹ năng', 98, 92, () => this.act('skill'), 'blast-fire'),
      this.control('Lướt', 98, 92, () => this.act('dash'), 'blast-wind'),
    ];
    this.actions.forEach((c, i) => {
      c.fill = [THEME.peach, 0xe8d5ff, 0xc5eaff][i] ?? THEME.cream;
      c.label.setFontSize(20).setY(27);
      c.icon?.setDisplaySize(66, 66).setY(-16);
      const key = this.text(['Space', 'E', 'Shift'][i] ?? '', 12, THEME.muted).setPosition(29, -32);
      c.container.add(key);
      this.paintControl(c);
    });
    this.helpButton = this.control('Luật chơi', 112, 38, () => this.toggleHelp());
  }
  private createSelection() {
    this.selectPanel = this.add.container().setDepth(3000);
    const bg = this.panel(800, 400);
    this.selectTitle = this.text('Chọn bạn nhỏ của bạn', 36).setY(-153);
    this.selectDescription = this.text('', 21, THEME.muted).setPosition(0, 76);
    this.selectChoices = ELEMENTS.map((element, i) => {
      const c = this.control(
        ELEMENT_INFO[element].name,
        124,
        138,
        () => {
          if (this.ctx.me) this.send('choose', { element });
        },
        element,
      );
      c.container.setPosition((i - 2) * 144, -38);
      c.fill = PASTEL[element];
      c.icon?.setDisplaySize(116, 116).setY(-14);
      c.label.setY(44).setFontSize(24);
      this.selectPanel.add(c.container);
      return c;
    });
    this.readyButton = this.control('Sẵn sàng', 240, 54, () => {
      if (this.ctx.me) this.send('ready');
    });
    this.readyButton.fill = THEME.gold;
    this.readyButton.container.setY(149);
    this.selectPanel.addAt(bg, 0);
    this.selectPanel.add([this.selectTitle, this.selectDescription, this.readyButton.container]);
  }
  private createResult() {
    this.resultPanel = this.add.container().setDepth(3000).setVisible(false);
    this.resultText = this.text('', 37).setY(-108).setWordWrapWidth(540);
    this.resultPortrait = this.sprite('fire').setPosition(0, -8).setDisplaySize(150, 150);
    this.resultDetail = this.text('', 21, THEME.muted).setY(110).setWordWrapWidth(540);
    this.resultStars = this.add
      .sprite(0, -15, this.texture('cartoon-fx'), effectFrame('victory'))
      .setDisplaySize(290, 290);
    this.resultPanel.add([
      this.panel(620, 340),
      this.resultStars,
      this.resultText,
      this.resultPortrait,
      this.resultDetail,
    ]);
  }
  private createHelp() {
    this.helpPanel = this.add.container().setDepth(4000).setVisible(false);
    const title = this.text('Luật chơi', 34).setY(-178);
    const body = this.text(
      'WASD / Phím mũi tên · Di chuyển\nSpace · Đặt bom    E · Kỹ năng    Shift · Lướt\n\nBom nổ sau 2,5 giây; vùng sáng báo phạm vi nổ.\nTường chặn lửa; thùng có thể phá và rơi vật phẩm.\nBom kích hoạt nhau; bom băng có thể trì hoãn bom.\nHồi máu +30 HP · Tầm nổ · Số bom · Tốc độ\n\nSinh tồn: người sống sót cuối cùng thắng.\n2v2: đội còn người thắng; không sát thương đồng đội.\nSau 2 phút, đấu trường thu hẹp.\nHết 3 phút: so HP còn lại; bằng nhau thì hòa.',
      21,
    ).setWordWrapWidth(600);
    this.helpClose = this.control('Đóng', 180, 46, () => this.toggleHelp(false));
    this.helpClose.container.setY(188);
    this.helpPanel.add([this.panel(690, 445), title, body, this.helpClose.container]);
  }
  private toggleHelp(visible = !this.helpPanel.visible) {
    this.helpPanel.setVisible(visible);
    this.releaseInput();
    this.renderHud(this.ctx);
  }

  protected onLayout(ctx: Ctx) {
    const { width: w, height: h, top } = ctx.screen;
    const { left, right, top: bleedTop, bottom } = this.bleed;
    const ratio = Math.max(
      (right - left) / this.backdrop.width,
      (bottom - bleedTop) / this.backdrop.height,
    );
    this.backdrop.setPosition((left + right) / 2, (bleedTop + bottom) / 2).setScale(ratio);
    const available = h - top;
    const touchLayout = window.innerHeight < 540;
    const s = Math.min(1, w / 1050) * (touchLayout ? 1.03 : 1);
    const small = w < 1100;
    this.rail.setPosition(16, top).setScale(1);
    this.title.setPosition(7, 0).setFontSize(36);
    this.titleTail.setPosition(7, 44).setFontSize(22);
    this.modeLabel.setPosition(8, 82).setFontSize(17);
    // Side controls can cover boundary walls, while every interior floor cell stays clear.
    const boardH = available - 96;
    this.tw = Math.min((w - 414) / 10, boardH / (HEIGHT * 0.82));
    this.th = this.tw * 0.82;
    const gridLeft = Phaser.Math.Clamp(
      (w - WIDTH * this.tw) / 2,
      270 - 1.5 * this.tw,
      w - 144 - 11.5 * this.tw,
    );
    this.ox = gridLeft + this.tw / 2;
    this.oy = top + 74 + this.th / 2;
    const cx = gridLeft + (WIDTH * this.tw) / 2;
    this.timerLabel.setPosition(cx, top + 27).setFontSize(29);
    this.timerPaper.setPosition(cx, top + 27);
    this.status
      .setPosition(95, top + 294)
      .setFontSize(17)
      .setWordWrapWidth(158);
    const rosterY = top + 26;
    this.roster.forEach((r, i) => {
      const offset = [-258, -123, 123, 258][i] ?? 0;
      const x = cx + offset * (small ? 0.92 : 1);
      r.container.setPosition(x, rosterY).setScale(small ? 0.84 : 0.95);
    });
    this.platform.clear();
    const boardX = this.ox - this.tw / 2 - 13;
    const boardY = this.oy - this.th / 2 - 13;
    const bw = WIDTH * this.tw + 26;
    const bh = HEIGHT * this.th + 26;
    this.platform
      .fillStyle(0x739f83, 0.25)
      .fillRoundedRect(boardX - 6, boardY + 14, bw + 12, bh + 6, 28)
      .fillStyle(0xbe815d)
      .fillRoundedRect(boardX, boardY + 10, bw, bh, 23)
      .fillStyle(THEME.wood)
      .fillRoundedRect(boardX, boardY, bw, bh, 23)
      .lineStyle(3, THEME.outline)
      .strokeRoundedRect(boardX, boardY, bw, bh, 23)
      .lineStyle(3, 0xffe4ac)
      .strokeRoundedRect(boardX + 5, boardY + 4, bw - 10, bh - 8, 19)
      // A continuous rectangular rim keeps both horizontal edges visibly equal.
      // The tilt compresses Y only; there is no perspective scaling along X.
      .lineStyle(3, 0xffefbd)
      .strokeRect(boardX + 10, boardY + 10, bw - 20, bh - 20);
    // Four tiny daisy screws finish the toy board without obscuring its grid.
    for (const [x, y] of [
      [boardX + 10, boardY + 10],
      [boardX + bw - 10, boardY + 10],
      [boardX + 10, boardY + bh - 10],
      [boardX + bw - 10, boardY + bh - 10],
    ]) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        this.platform
          .fillStyle(THEME.cream)
          .fillCircle((x ?? 0) + Math.cos(a) * 4, (y ?? 0) + Math.sin(a) * 4, 3);
      }
      this.platform.fillStyle(THEME.gold).fillCircle(x ?? 0, y ?? 0, 2.5);
    }
    this.platformPaper = rasterizeGraphics(
      this,
      this.platform,
      'bom-platform',
      { x: boardX - 8, y: boardY - 4, width: bw + 16, height: bh + 28 },
      this.platformPaper,
    );
    this.portrait.setVisible(false);
    this.statPaper.setPosition(79, 179);
    this.stats.setPosition(18, 135).setFontSize(19).setLineSpacing(2);
    this.skillName.setPosition(79, 258).setOrigin(0.5, 0.5).setFontSize(17).setWordWrapWidth(148);
    const padX = 125;
    const padY = h - 129;
    const locations = [
      [0, -76],
      [-76, 0],
      [0, 76],
      [76, 0],
    ];
    this.pad.forEach((c, i) => {
      c.container
        .setPosition(padX + (locations[i]?.[0] ?? 0), padY + (locations[i]?.[1] ?? 0))
        .setScale(s);
    });
    this.actions.forEach((c, i) => {
      c.container.setPosition(w - 64, h - 277 + i * 106).setScale(s);
    });
    this.helpButton.container.setPosition(w - 72, top + 25).setScale(s);
    const overlayScale = Math.min((w - 80) / 800, (available - 28) / 460, 1.2);
    for (const panel of [this.selectPanel, this.resultPanel, this.helpPanel])
      panel.setPosition(w / 2, top + available / 2).setScale(overlayScale);
    this.overlayShade
      .clear()
      .fillStyle(THEME.cream, 0.58)
      .fillRect(left, bleedTop, right - left, bottom - bleedTop);
    this.renderBoard(ctx);
    this.layoutActors(ctx);
    this.renderTransient(ctx);
    for (const sprite of this.effects) {
      const pos = this.project(sprite.getData('point') as Point);
      const size = sprite.getData('size') as number;
      sprite
        .setPosition(pos.x, pos.y)
        .setDisplaySize(this.tw * size, this.tw * size)
        .setDepth(pos.y + 17);
    }
  }
  /** Top-down projection with a slight forward tilt; grid axes stay screen-aligned. */
  project(p: Point): Point {
    return { x: this.ox + p.x * this.tw, y: this.oy + p.y * this.th };
  }
  private renderBoard({ state }: Ctx) {
    const paint = `${this.tw}:${this.th}:${this.ox}:${this.oy}:${state.ring}:${state.cells.join(',')}`;
    if (paint === this.boardPaint) return;
    this.boardPaint = paint;
    this.propShadows.clear();
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) {
        const p = { x, y },
          key = keyOf(p),
          pos = this.project(p),
          tile = tileAt(state, p);
        let image = this.tiles.get(key);
        if (!image) {
          image = this.sprite('tile').setOrigin(0.5).setDepth(0);
          this.tiles.set(key, image);
        }
        image
          .setTexture(
            this.texture(
              (x + y) % 2 === 0 ? 'tile-light' : (x * 7 + y) % 9 === 0 ? 'tile-flower' : 'tile',
            ),
          )
          .setPosition(pos.x, pos.y)
          .setDisplaySize(this.tw, this.th)
          .setTint(
            tile === 'wall' &&
              state.ring > 0 &&
              (x <= state.ring ||
                y <= state.ring ||
                x >= WIDTH - 1 - state.ring ||
                y >= HEIGHT - 1 - state.ring)
              ? 0xeaa1a1
              : 0xffffff,
          );
        const border = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
        const wanted =
          tile === 'wall' ? (border ? 'border' : 'pillar') : tile === 'crate' ? 'crate' : null;
        let prop = this.obstacles.get(key);
        if (!wanted) {
          prop?.destroy();
          this.obstacles.delete(key);
          continue;
        }
        if (!prop) {
          prop = this.sprite(wanted).setOrigin(0.5, 0.86);
          this.obstacles.set(key, prop);
        }
        prop
          .setTexture(this.texture(wanted))
          .setOrigin(0.5, 0.86)
          .setPosition(pos.x, pos.y + this.th * 0.29)
          .setDisplaySize(
            this.tw * (border ? 0.96 : 0.85),
            this.tw * (border ? 0.86 : wanted === 'pillar' ? 1.11 : 1.06),
          )
          .setTint(
            state.ring > 0 &&
              (x <= state.ring ||
                y <= state.ring ||
                x >= WIDTH - 1 - state.ring ||
                y >= HEIGHT - 1 - state.ring)
              ? 0xf4aaa2
              : 0xffffff,
          )
          .setDepth(10 + pos.y + this.th * 0.29);
        this.propShadows
          .fillStyle(0x42745a, border ? 0.17 : 0.28)
          .fillEllipse(
            pos.x + this.tw * 0.1,
            pos.y + this.th * 0.28,
            this.tw * 0.96,
            this.th * 0.64,
          )
          .fillStyle(0x375f4a, 0.14)
          .fillEllipse(
            pos.x + this.tw * 0.06,
            pos.y + this.th * 0.2,
            this.tw * 0.76,
            this.th * 0.4,
          );
      }
    this.shadowPaper = rasterizeGraphics(
      this,
      this.propShadows,
      'bom-prop-shadows',
      {
        x: this.ox - this.tw * 0.6,
        y: this.oy - this.th * 0.5,
        width: this.tw * (WIDTH + 0.2),
        height: this.th * (HEIGHT + 0.2),
      },
      this.shadowPaper,
    );
  }
  protected onState(ctx: Ctx) {
    this.snapshotAt = this.time.now;
    if (this.lastViewer !== (ctx.me?.id ?? null)) {
      this.releaseInput();
      for (const actor of this.actors.values()) {
        actor.sprite.destroy();
        actor.shadow.destroy();
        actor.name.destroy();
        actor.hp.destroy();
        actor.status?.destroy();
      }
      this.actors.clear();
      this.lastViewer = ctx.me?.id ?? null;
      this.suppressFeedback = true;
    }
    const silent = this.suppressFeedback;
    if (!silent && ctx.state.phase === 'playing') {
      ctx.state.cells.forEach((tile, i) => {
        if (this.previousCells[i] === 'crate' && tile === 'floor')
          this.showEffect('crate-break', { x: i % WIDTH, y: Math.floor(i / WIDTH) }, 1.12);
      });
      for (const [key, pickup] of this.previousPickups) {
        if (ctx.state.pickups.some((p) => keyOf(p) === key)) continue;
        const collector = ctx.state.fighters.find(
          (p) => Math.hypot(p.x - pickup.x, p.y - pickup.y) < 0.7,
        );
        if (collector) {
          this.showEffect('dust', pickup, 0.9);
          this.floating(pickup.kind === 'heal' ? '+30 HP' : '+1', pickup, '#4eaa82');
          if (collector.id === ctx.me?.id) this.sfx('pickup');
        }
      }
    }
    this.previousCells = [...ctx.state.cells];
    this.previousPickups = new Map(ctx.state.pickups.map((p) => [keyOf(p), p]));
    const danger = dangerMap(ctx.state);
    const warnings = new Map<string, (typeof this.warningCells)[number]>();
    for (const bomb of ctx.state.bombs) {
      for (const cell of blastCells(ctx.state, bomb)) {
        const key = keyOf(cell);
        const start = Math.min(...(danger.get(key) ?? []).map((w) => w.start), bomb.explodeAt);
        if (!warnings.has(key) || (warnings.get(key)?.start ?? Infinity) > start)
          warnings.set(key, {
            cell,
            start,
            element: bomb.element,
            frozen: bomb.frozenUntil > ctx.state.time,
          });
      }
    }
    this.warningCells = [...warnings.values()];
    this.renderBoard(ctx);
    this.layoutActors(ctx, !silent);
    this.renderTransient(ctx);
    this.renderHud(ctx);
    const maxBlast = Math.max(0, ...ctx.state.blasts.map((b) => b.id));
    if (!silent && maxBlast > this.previousBlast && ctx.state.phase === 'playing')
      this.sfx('explode');
    this.previousBlast = maxBlast;
    if (this.lastPhase !== ctx.state.phase) {
      this.releaseInput();
      if (ctx.state.phase === 'playing' && !silent) {
        this.sfx('start');
        for (const actor of this.actors.values()) this.playActor(actor, 'spawn');
      }
      if (ctx.state.phase === 'ended' && !silent) {
        const won = ctx.me && ctx.state.winners.includes(ctx.me.id);
        this.resultStars.setVisible(Boolean(won)).play(effectAnimation('victory'));
        this.jingle(won ? 'win' : 'lose');
      }
    }
    this.lastPhase = ctx.state.phase;
    this.suppressFeedback = false;
  }
  private layoutActors(ctx: Ctx, feedback = false) {
    for (const p of ctx.state.fighters) {
      let actor = this.actors.get(p.id);
      if (!actor) {
        actor = {
          sprite: this.add
            .sprite(0, 0, this.texture(`actor-${p.element}`), actorFrame('idle', p.facing))
            .setOrigin(0.5, 0.86),
          shadow: this.add.ellipse(0, 0, 32, 12, 0x5d927c, 0.22),
          name: this.text('', 14),
          hp: this.add.graphics(),
          position: { x: p.x, y: p.y },
          correction: { x: 0, y: 0 },
          element: p.element,
          facing: p.facing,
          clip: 'idle',
          oneShot: null,
          lastMoved: -1000,
          hpBefore: p.hp,
          skillBefore: p.skillReady,
          bombBefore: p.nextBomb,
          dashBefore: p.dashReady,
          frozenBefore: p.frozenUntil,
          status: null,
          lastDust: 0,
          hpPaint: '',
        };
        this.actors.set(p.id, actor);
        const created = actor;
        actor.sprite.on('animationcomplete', () => {
          if (created.oneShot === 'ko') created.sprite.setVisible(false);
          created.oneShot = null;
        });
        this.playActor(actor, p.frozenUntil > ctx.state.time ? 'frozen' : 'idle');
      }
      if (actor.element !== p.element) {
        actor.element = p.element;
        actor.sprite.setTexture(this.texture(`actor-${p.element}`), actorFrame('idle', p.facing));
        actor.oneShot = null;
        this.playActor(actor, 'idle');
      }
      if (
        Math.abs(actor.position.x - p.x) + Math.abs(actor.position.y - p.y) > 1.25 ||
        ctx.state.phase !== 'playing'
      )
        actor.position = { x: p.x, y: p.y };
      actor.correction = { x: p.x - actor.position.x, y: p.y - actor.position.y };
      actor.sprite.setDisplaySize(this.tw * 1.38, this.tw * 1.38);
      actor.name.setText(
        p.id === ctx.me?.id ? 'Bạn' : p.bot ? `Máy ${p.seat + 1}` : p.name.slice(0, 12),
      );
      if (feedback) {
        if (p.hp < actor.hpBefore) {
          this.floating(`−${actor.hpBefore - p.hp}`, p, '#d45b72');
          if (p.id === ctx.me?.id) this.sfx('hurt');
          this.playActor(
            actor,
            p.hp === 0 ? 'ko' : p.frozenUntil > ctx.state.time ? 'frozen' : 'hit',
            p.facing,
          );
        } else if (p.skillReady > actor.skillBefore) {
          this.playActor(actor, 'skill', p.facing);
          this.showEffect(`skill-${p.element}`, p, 1.6);
          if (p.id === ctx.me?.id) this.sfx('skill');
        } else if (p.nextBomb > actor.bombBefore) {
          this.playActor(actor, 'place', p.facing);
          if (p.id === ctx.me?.id) this.sfx('place');
        }
        if (p.dashReady > actor.dashBefore) {
          this.showEffect('dash', p, 1.2);
          if (p.id === ctx.me?.id) this.sfx('dash');
        }
      }
      if (feedback || this.suppressFeedback) {
        actor.hpBefore = p.hp;
        actor.skillBefore = p.skillReady;
        actor.bombBefore = p.nextBomb;
        actor.dashBefore = p.dashReady;
        actor.frozenBefore = p.frozenUntil;
      }
      actor.sprite.setVisible(p.hp > 0 || actor.oneShot === 'ko');
      for (const obj of [actor.shadow, actor.hp, actor.name]) obj.setVisible(p.hp > 0);
      this.positionActor(actor, p, ctx.state.time);
    }
  }
  private playActor(actor: Actor, state: ActorAnimation, facing = actor.facing) {
    const key = actorAnimation(actor.element, state, facing);
    if (actor.sprite.anims.currentAnim?.key === key && actor.sprite.anims.isPlaying) return;
    actor.clip = state;
    actor.facing = facing;
    actor.oneShot = ['place', 'skill', 'hit', 'ko', 'spawn'].includes(state) ? state : null;
    actor.sprite.anims.timeScale = 1;
    actor.sprite.play(key);
  }
  private showEffect(name: EffectAnimation, point: Point, size = 1) {
    // Bound decorative effects independently of the authoritative blast/bomb objects.
    if (this.effects.size >= 40) return;
    const pos = this.project(point);
    const sprite = this.add
      .sprite(pos.x, pos.y, this.texture('cartoon-fx'), effectFrame(name))
      .setOrigin(0.5, 0.55)
      .setDisplaySize(this.tw * size, this.tw * size)
      .setDepth(pos.y + 17)
      .setData('point', { ...point })
      .setData('size', size);
    this.effects.add(sprite);
    sprite.once('animationcomplete', () => {
      this.effects.delete(sprite);
      sprite.destroy();
    });
    sprite.play(effectAnimation(name));
  }
  private floating(label: string, point: Point, color: string) {
    if (this.floaters.size >= 18) return;
    const pos = this.project(point);
    const text = this.text(label, 18, color)
      .setPosition(pos.x, pos.y - this.tw * 0.8)
      .setStroke('#fff9ee', 4)
      .setDepth(1500);
    this.floaters.add({ text, y: text.y, start: this.time.now });
  }
  private positionActor(actor: Actor, p: Fighter, now: number) {
    const pos = this.project(actor.position);
    actor.sprite.setPosition(pos.x, pos.y).setDepth(pos.y + 12);
    actor.shadow
      .setPosition(pos.x, pos.y + 2)
      .setSize(this.tw * 0.54, this.th * 0.35)
      .setDepth(3);
    actor.sprite.setAlpha(
      p.invulnerableUntil > now && Math.floor(this.time.now / 100) % 2 ? 0.7 : 1,
    );
    const status = p.frozenUntil > now ? 'freeze' : p.stunUntil > now ? 'pickup-gleam' : null;
    if (status && p.hp > 0) {
      if (!actor.status)
        actor.status = this.add.sprite(0, 0, this.texture('cartoon-fx'), effectFrame(status));
      actor.status
        .play(effectAnimation(status), true)
        .setPosition(pos.x, pos.y - this.tw * 0.22)
        .setOrigin(0.5, 0.6)
        .setDisplaySize(this.tw * 1.15, this.tw * 1.15)
        .setDepth(pos.y + 14);
    } else {
      actor.status?.destroy();
      actor.status = null;
    }
    const nameColor =
      p.id === this.ctx.me?.id
        ? '#8f4d46'
        : this.ctx.state.mode === 'teams'
          ? p.team === 0
            ? '#397eaf'
            : '#c65b79'
          : THEME.paper;
    if (actor.name.style.color !== nameColor) actor.name.setColor(nameColor);
    actor.name
      .setPosition(pos.x, pos.y - this.tw * 0.96)
      .setDepth(1000)
      .setStroke('#fff9ed', 3);
    const barW = this.tw * 0.5;
    const hpPaint = `${this.tw}:${p.hp}:${p.element}`;
    if (actor.hpPaint !== hpPaint) {
      actor.hpPaint = hpPaint;
      actor.hp
        .clear()
        .fillStyle(0xfff6e7)
        .fillRoundedRect(-barW / 2, 0, barW, 4, 2)
        .fillStyle(ELEMENT_INFO[p.element].color)
        .fillRoundedRect(-barW / 2, 0, (barW * p.hp) / 100, 4, 2);
    }
    actor.hp.setPosition(pos.x, pos.y - this.tw * 0.87).setDepth(1000);
  }
  private renderTransient(ctx: Ctx) {
    const s = ctx.state;
    for (const [id, b] of this.bombs)
      if (!s.bombs.some((b) => b.id === id)) {
        b.image.destroy();
        b.timer.destroy();
        b.ring.destroy();
        this.bombs.delete(id);
      }
    for (const b of s.bombs) {
      let object = this.bombs.get(b.id);
      if (!object) {
        object = {
          image: this.add
            .sprite(0, 0, this.texture('cartoon-fx'), effectFrame(`bomb-${b.element}`))
            .setOrigin(0.5, 0.86),
          timer: this.text('', 13).setStroke('#fff9ed', 3),
          ring: this.add.ellipse(0, 0, 20, 10, ELEMENT_INFO[b.element].color, 0.65),
        };
        this.bombs.set(b.id, object);
      }
      const pos = this.project(b);
      object.image
        .setPosition(pos.x, pos.y)
        .setDisplaySize(this.tw * 1.02, this.tw * 1.02)
        .setDepth(pos.y + 11)
        .play(effectAnimation(b.frozenUntil > s.time ? 'bomb-frozen' : `bomb-${b.element}`), true);
      object.ring
        .setPosition(pos.x, pos.y + 1)
        .setSize(this.tw * 0.62, this.th * 0.48)
        .setDepth(3);
      object.timer
        .setPosition(pos.x, pos.y - this.tw * 0.63)
        .setDepth(1000)
        .setText(
          b.frozenUntil > s.time ? '❄' : `${Math.max(0, (b.explodeAt - s.time) / 1000).toFixed(1)}`,
        );
    }
    const wanted = new Set(s.pickups.map((p) => keyOf(p)));
    for (const [key, item] of this.pickups)
      if (!wanted.has(key)) {
        item.image.destroy();
        item.label.destroy();
        this.pickups.delete(key);
      }
    for (const p of s.pickups) {
      const key = keyOf(p);
      let item = this.pickups.get(key);
      if (!item) {
        const clip = `pickup-${p.kind}` as const;
        item = {
          image: this.add
            .sprite(0, 0, this.texture('cartoon-fx'), effectFrame(clip))
            .setOrigin(0.5, 0.86),
          label: this.text('', 13, '#428b71').setStroke('#fff9ed', 3),
        };
        this.pickups.set(key, item);
      }
      const pos = this.project(p);
      item.image
        .play(effectAnimation(`pickup-${p.kind}`), true)
        .setPosition(pos.x, pos.y)
        .setDisplaySize(this.tw * 0.97, this.tw * 0.97)
        .setDepth(pos.y + 9);
      item.label
        .setText(p.kind === 'heal' ? '+30' : '+1')
        .setPosition(pos.x, pos.y + 7)
        .setDepth(1000);
    }
    const flames = new Set<string>();
    for (const b of s.blasts)
      for (const c of b.cells) {
        const key = `${b.id}:${keyOf(c)}`;
        flames.add(key);
        let flame = this.flames.get(key);
        if (!flame) {
          flame = this.add
            .sprite(0, 0, this.texture('cartoon-fx'), effectFrame(`burst-${b.element}`))
            .setOrigin(0.5, 0.55);
          if (this.suppressFeedback) flame.play(effectAnimation(`linger-${b.element}`));
          else {
            const sprite = flame;
            flame.once('animationcomplete', () => {
              if (sprite.scene) sprite.play(effectAnimation(`linger-${b.element}`));
            });
            flame.play(effectAnimation(`burst-${b.element}`));
          }
          this.flames.set(key, flame);
        }
        const pos = this.project(c);
        flame
          .setPosition(pos.x, pos.y)
          .setDisplaySize(this.tw * 1.2, this.tw * 1.2)
          .setDepth(pos.y + 15);
      }
    for (const [key, image] of this.flames)
      if (!flames.has(key)) {
        image.destroy();
        this.flames.delete(key);
      }
  }
  private renderHud(ctx: Ctx) {
    const s = ctx.state,
      me = s.fighters.find((p) => p.id === ctx.me?.id);
    this.modeLabel.setText(
      s.mode === 'teams' ? 'Đấu đội 2v2' : s.fighters.length === 1 ? 'Luyện tập' : 'Sinh tồn đơn',
    );
    this.roster.forEach((r, i) => {
      const p = s.fighters[i];
      r.container.setVisible(Boolean(p));
      if (!p) return;
      r.portrait.setTexture(this.texture(p.element));
      r.name.setText(
        `${p.id === me?.id ? 'Bạn' : p.bot ? `Máy ${p.seat + 1}` : p.name.slice(0, 8)}${s.mode === 'teams' ? (p.team === 0 ? ' · A' : ' · B') : ''}`,
      );
      r.container.setAlpha(p.hp > 0 ? 1 : 0.4);
      r.hp
        .clear()
        .fillStyle(0xeadac9)
        .fillRoundedRect(-18, 1, 76, 10, 5)
        .fillStyle(ELEMENT_INFO[p.element].color)
        .fillRoundedRect(-18, 1, (76 * p.hp) / 100, 10, 5);
    });
    this.portrait.setTexture(this.texture(me?.element ?? 'fire'));
    this.stats.setText(
      me
        ? `HP  ${me.hp} / 100\nBom  ${Math.max(0, me.capacity - s.bombs.filter((b) => b.owner === me.id).length)} / ${me.capacity}\nTầm nổ  ${me.range}`
        : 'Khán giả',
    );
    this.skillName.setText(me ? ELEMENT_INFO[me.element].skill : '');
    this.actions[1]?.icon?.setTexture(this.texture(`blast-${me?.element ?? 'fire'}`));
    this.selectPanel.setVisible(s.phase === 'select');
    this.resultPanel.setVisible(s.phase === 'ended');
    this.overlayShade.setVisible(s.phase !== 'playing' || this.helpPanel.visible);
    this.selectDescription.setText(
      me
        ? `${ELEMENT_INFO[me.element].skill}\n${ELEMENT_INFO[me.element].description}`
        : 'Đang chờ người chơi chọn nguyên tố',
    );
    this.readyButton.label.setText(me?.ready ? 'Đã sẵn sàng' : 'Sẵn sàng');
    this.readyButton.enabled = Boolean(me && !me.ready);
    this.paintControl(this.readyButton);
    this.selectChoices.forEach((c, i) => {
      c.enabled = Boolean(me);
      this.paintControl(c, me?.element === ELEMENTS[i], ELEMENT_INFO[ELEMENTS[i] ?? 'fire'].color);
    });
    for (const c of [...this.pad, ...this.actions]) {
      c.enabled = Boolean(me && me.hp > 0 && s.phase === 'playing' && !this.helpPanel.visible);
      this.paintControl(c);
    }
    if (s.phase === 'ended') {
      const won = me && s.winners.includes(me.id);
      const names = s.fighters
        .filter((p) => s.winners.includes(p.id))
        .map((p) => p.name)
        .join(', ');
      this.resultText.setText(
        s.winners.length
          ? won
            ? 'Chiến thắng!'
            : s.mode === 'teams'
              ? `Đội ${s.fighters.find((p) => s.winners.includes(p.id))?.team === 0 ? 'A' : 'B'} chiến thắng`
              : `${names} chiến thắng`
          : 'Hòa!',
      );
      this.resultDetail.setText(
        `${s.reason}\n${me ? `${me.kills} hạ gục · ${me.crates} thùng quà đã mở` : ''}`,
      );
      this.resultPortrait.setTexture(
        this.texture(
          s.fighters.find((p) => s.winners.includes(p.id))?.element ?? me?.element ?? 'fire',
        ),
      );
      this.resultStars.setVisible(Boolean(won));
    }
  }
  protected onUpdate(ctx: Ctx, delta: number) {
    const s = ctx.state,
      now = s.time + Math.min(100, this.time.now - this.snapshotAt);
    const dt = Math.min(delta, 50) / 1000;
    this.inputElapsed += delta;
    if (
      this.direction !== this.sentDirection ||
      (this.direction !== 'none' && this.inputElapsed >= 200)
    )
      this.sendDirection();
    for (const p of s.fighters) {
      const actor = this.actors.get(p.id);
      if (!actor || p.hp <= 0) continue;
      const frozen = p.frozenUntil > now || p.stunUntil > now;
      const local = p.id === ctx.me?.id;
      const d = DIRECTIONS[frozen ? 'none' : local ? this.direction : p.dir];
      const speed = p.speed * (p.dashUntil > now ? 1.85 : 1) * (p.slowUntil > now ? 0.5 : 1);
      const before = { ...actor.position };
      if (s.phase === 'playing' && (local || this.time.now - this.snapshotAt < 100)) {
        const predicted = { ...p, ...actor.position };
        moveFighter(s, predicted, d.x * speed * dt, d.y * speed * dt);
        actor.position = { x: predicted.x, y: predicted.y };
      }
      const correction = Math.min(1, dt * 8);
      actor.position.x += actor.correction.x * correction;
      actor.position.y += actor.correction.y * correction;
      actor.correction.x *= 1 - correction;
      actor.correction.y *= 1 - correction;
      if (Math.hypot(actor.position.x - before.x, actor.position.y - before.y) > 0.002 && !frozen)
        actor.lastMoved = this.time.now;
      if (p.frozenUntil > now) this.playActor(actor, 'frozen', p.facing);
      else if (!actor.oneShot) {
        const moving = s.phase === 'playing' && !frozen && this.time.now - actor.lastMoved < 130;
        const facing = local && this.direction !== 'none' ? this.direction : p.facing;
        this.playActor(actor, moving ? 'walk' : 'idle', facing);
        actor.sprite.anims.timeScale = moving
          ? (p.speed / 3.2) * (p.dashUntil > now ? 1.65 : 1) * (p.slowUntil > now ? 0.65 : 1)
          : 1;
        if (moving && p.dashUntil > now && this.time.now - actor.lastDust > 160) {
          this.showEffect('dust', actor.position, 0.65);
          actor.lastDust = this.time.now;
        }
      }
      this.positionActor(actor, p, now);
    }
    const seconds = Math.max(0, Math.ceil((MATCH_TIME - s.elapsed) / 1000));
    this.timerLabel.setText(
      `${Math.floor(seconds / 60)
        .toString()
        .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`,
    );
    const me = s.fighters.find((p) => p.id === ctx.me?.id);
    this.status.setText(
      s.phase === 'select'
        ? `Chọn nguyên tố · ${Math.max(0, Math.ceil((SELECT_TIME - s.time) / 1000))}s`
        : me?.hp === 0
          ? 'Đã bị loại · Đang theo dõi'
          : s.ring > 0
            ? 'Đấu trường đang thu hẹp'
            : `${s.fighters.filter((p) => p.hp > 0).length} bạn nhỏ còn lại`,
    );
    if (me) {
      const cds = [
        Math.max(me.nextBomb - now, 0),
        Math.max(me.skillReady - now, 0),
        Math.max(me.dashReady - now, 0),
      ];
      this.actions.forEach((c, i) => {
        const enabled =
          this.canAct() &&
          !cds[i] &&
          me.frozenUntil <= now &&
          me.stunUntil <= now &&
          (i !== 0 || s.bombs.filter((b) => b.owner === me.id).length < me.capacity);
        if (c.enabled !== enabled) {
          c.enabled = enabled;
          this.paintControl(c);
        }
        c.label.setText(
          cds[i] ? `${Math.ceil((cds[i] ?? 0) / 1000)}s` : (['Bom', 'Kỹ năng', 'Lướt'][i] ?? ''),
        );
        c.container.setAlpha(c.enabled ? 1 : 0.7);
      });
      this.skillName.setText(`${ELEMENT_INFO[me.element].skill}${me.skillUntil > now ? ' ✦' : ''}`);
    }
    const ownActor = me && this.actors.get(me.id);
    this.localMarker.setVisible(Boolean(me && me.hp > 0 && ownActor && s.phase === 'playing'));
    if (me && me.hp > 0 && ownActor && s.phase === 'playing') {
      const pos = this.project(ownActor.position);
      const markerPaint = `${this.tw}:${me.element}`;
      if (this.markerPaint !== markerPaint) {
        this.markerPaint = markerPaint;
        this.localMarker
          .clear()
          .lineStyle(2.5, 0xfff6e7)
          .strokeEllipse(0, 0, this.tw * 0.72, this.th * 0.48)
          .lineStyle(1.5, ELEMENT_INFO[me.element].color)
          .strokeEllipse(0, 0, this.tw * 0.64, this.th * 0.4);
      }
      this.localMarker.setPosition(pos.x, pos.y + 2);
    }
    this.drawWarnings(s, now);
    for (const b of s.bombs) {
      const obj = this.bombs.get(b.id);
      if (!obj) continue;
      obj.image.play(
        effectAnimation(b.frozenUntil > now ? 'bomb-frozen' : `bomb-${b.element}`),
        true,
      );
      obj.image.anims.timeScale = b.frozenUntil > now ? 1 : b.explodeAt - now < 700 ? 2.25 : 1;
      obj.timer.setText(
        b.frozenUntil > now
          ? '❄'
          : b.explodeAt - now < 400
            ? '!'
            : Math.max(0, (b.explodeAt - now) / 1000).toFixed(1),
      );
    }
    for (const b of s.blasts)
      for (const c of b.cells)
        this.flames.get(`${b.id}:${keyOf(c)}`)?.setAlpha(Math.min(1, (b.expires - now) / 350));
    for (const floater of this.floaters) {
      const elapsed = (this.time.now - floater.start) / 850;
      floater.text.setY(floater.y - elapsed * 30).setAlpha(Math.min(1, (1 - elapsed) * 2));
      if (elapsed >= 1) {
        floater.text.destroy();
        this.floaters.delete(floater);
      }
    }
  }
  private drawWarnings(s: State, now: number) {
    this.warnings.clear();
    if (s.phase !== 'playing') return;
    for (const warning of this.warningCells) {
      const pos = this.project(warning.cell);
      const imminent = warning.start - now < 700;
      const color = warning.frozen
        ? 0x72c6dd
        : imminent
          ? 0xf37364
          : ELEMENT_INFO[warning.element].color;
      this.warnings
        .fillStyle(color, imminent ? 0.32 + Math.sin(this.time.now / 70) * 0.1 : 0.13)
        .fillRoundedRect(
          pos.x - this.tw * 0.43,
          pos.y - this.th * 0.43,
          this.tw * 0.86,
          this.th * 0.86,
          8,
        )
        .lineStyle(1.5, color, imminent ? 1 : 0.6)
        .strokeRoundedRect(
          pos.x - this.tw * 0.43,
          pos.y - this.th * 0.43,
          this.tw * 0.86,
          this.th * 0.86,
          8,
        );
      if (imminent) this.warnings.fillStyle(0xfff6dc, 0.9).fillCircle(pos.x, pos.y, this.tw * 0.06);
    }
  }
  private bindInput() {
    const keyboard = this.input.keyboard;
    const keydown = (e: KeyboardEvent) => {
      if (
        e.isComposing ||
        !keyboard?.enabled ||
        /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement | null)?.tagName ?? '')
      )
        return;
      if (e.code === 'Escape') {
        this.toggleHelp();
        return;
      }
      if (!this.canAct()) return;
      if (KEY_DIR[e.code]) {
        e.preventDefault();
        if (!this.keys.includes(e.code)) this.keys.push(e.code);
        this.refreshDirection();
      }
      if (!e.repeat) {
        if (e.code === 'Space') {
          e.preventDefault();
          this.act('bomb');
        }
        if (e.code === 'KeyE') this.act('skill');
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.act('dash');
      }
    };
    const keyup = (e: KeyboardEvent) => {
      this.keys = this.keys.filter((code) => code !== e.code);
      this.refreshDirection();
    };
    keyboard?.on('keydown', keydown);
    keyboard?.on('keyup', keyup);
    const release = () => this.releaseInput();
    const hide = () => {
      if (document.hidden) release();
    };
    window.addEventListener('blur', release);
    document.addEventListener('visibilitychange', hide);
    const pointerup = (p: Phaser.Input.Pointer) => {
      this.touch.delete(p.id);
      this.refreshDirection();
    };
    this.input.on('pointerup', pointerup);
    this.input.on('pointerupoutside', pointerup);
    if (this.input.manager.pointers.length < 5)
      this.input.addPointer(4 - this.input.manager.pointers.length);
    this.events.once('shutdown', () => {
      this.releaseInput();
      keyboard?.off('keydown', keydown);
      keyboard?.off('keyup', keyup);
      this.input.off('pointerup', pointerup);
      this.input.off('pointerupoutside', pointerup);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', hide);
    });
  }
  private canAct() {
    return (
      this.ctx.state.phase === 'playing' &&
      Boolean(
        this.ctx.me && this.ctx.state.fighters.find((p) => p.id === this.ctx.me?.id && p.hp > 0),
      ) &&
      !this.helpPanel.visible
    );
  }
  private refreshDirection() {
    this.direction = this.canAct()
      ? ([...this.touch.values()].at(-1) ?? KEY_DIR[this.keys.at(-1) ?? ''] ?? 'none')
      : 'none';
    if (this.direction !== this.sentDirection) this.sendDirection();
  }
  private sendDirection() {
    if (this.ctx.me && this.ctx.state.phase === 'playing')
      this.send('input', { direction: this.direction });
    this.sentDirection = this.direction;
    this.inputElapsed = 0;
  }
  private releaseInput() {
    this.keys = [];
    this.touch.clear();
    for (const c of this.pad) {
      c.pressed = false;
      this.paintControl(c);
    }
    this.direction = 'none';
    if (this.sentDirection !== 'none') this.sendDirection();
  }
  private act(action: 'bomb' | 'skill' | 'dash') {
    if (this.canAct()) {
      this.send(action);
    }
  }
  protected onStart() {
    this.releaseInput();
    this.previousBlast = 0;
    this.resetPresentation();
  }
  protected onResync() {
    this.releaseInput();
    this.previousBlast = Math.max(0, ...this.ctx.state.blasts.map((b) => b.id));
    this.snapshotAt = this.time.now;
    this.resetPresentation();
  }
  private resetPresentation() {
    this.suppressFeedback = true;
    this.helpPanel.setVisible(false);
    this.previousCells = [];
    this.previousPickups.clear();
    for (const effect of this.effects) effect.destroy();
    this.effects.clear();
    for (const floater of this.floaters) floater.text.destroy();
    this.floaters.clear();
    for (const actor of this.actors.values()) {
      actor.oneShot = null;
      actor.lastMoved = -1000;
      actor.sprite.anims.stop();
      actor.status?.destroy();
      actor.status = null;
    }
    for (const flame of this.flames.values()) flame.destroy();
    this.flames.clear();
    this.resultStars.anims.stop();
  }
}
