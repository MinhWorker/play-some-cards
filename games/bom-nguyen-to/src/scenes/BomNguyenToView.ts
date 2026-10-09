import { GameView, rasterizeGraphics, type ViewContext } from '@psc/sdk/client';
import Phaser from 'phaser';
import { blastCells, inRing, moveFighter, nextRing } from '../game/arena.js';
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
  arenaAnimation,
  arenaFrame,
  type EffectAnimation,
  effectAnimation,
  effectFrame,
  registerAnimations,
} from './animations.js';
import { boldStyle, CHARACTER, THEME, textStyle } from './theme.js';

type Ctx = ViewContext<State, Options>;
type Skin = 'orange' | 'purple' | 'blue' | 'cream';
type Bake = (g: Phaser.GameObjects.Graphics) => void;

/** A pressable HUD button: `container` takes the taps, `face` sinks while pressed. */
interface Control {
  container: Phaser.GameObjects.Container;
  face: Phaser.GameObjects.Container;
  bg?: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  ring?: Phaser.GameObjects.Image;
  width: number;
  height: number;
  enabled: boolean;
  hovered: boolean;
  pressed: boolean;
  selected: boolean;
}
/** One arrow of the D-pad; the whole pad plate takes the touches. */
interface PadKey {
  container: Phaser.GameObjects.Container;
  key: Phaser.GameObjects.Image;
  arrow: Phaser.GameObjects.Image;
  dir: Direction;
}
interface Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  ring: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
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
}
interface Card {
  container: Phaser.GameObjects.Container;
  paper?: Phaser.GameObjects.Image;
  width: number;
  height: number;
  portrait: Phaser.GameObjects.Image;
  name: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  hp: Phaser.GameObjects.Text;
  team: Phaser.GameObjects.Text;
  paint: string;
}
interface StatRow {
  icon: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  pill: Phaser.GameObjects.Graphics;
  value: Phaser.GameObjects.Text;
  paint: string;
}

const SKIN_IMAGE: Record<Skin, string> = {
  orange: 'button-orange',
  purple: 'button-purple',
  blue: 'button-blue',
  cream: 'dpad-key',
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
const PAD_DIRS = ['up', 'left', 'down', 'right'] as const;
const ACTIONS = [
  { action: 'bomb', name: 'Bom', key: 'Space', icon: 'icon-bomb', skin: 'orange' },
  { action: 'skill', name: 'Kỹ năng', key: 'E', icon: 'icon-skill', skin: 'purple' },
  { action: 'dash', name: 'Lướt', key: 'Shift', icon: 'icon-dash', skin: 'blue' },
] as const;
const ITEM_LABEL = { heal: '+30 HP', range: 'Tầm nổ +1', capacity: 'Bom +1', speed: 'Tốc độ +' };
const STAT_PILL = { width: 84, height: 26 };
/** How long before the arena shrinks its next ring is shown on the board (ms). */
const RING_WARNING = 5000;
/** Vertical squash of the slightly tilted top-down camera. */
const TILT = 0.86;
/** The board's reach around the interior cells' centres (1..11, 1..9), in cells. */
const BOARD = { left: 0.18, right: 11.82, top: -0.12, bottom: 9.75 };
const TEAM_COLOR = [0x4c9be8, 0xf0708f];

export class BomNguyenToView extends GameView<State, Options> {
  private backdrop!: Phaser.GameObjects.Image;
  private tiles = new Map<string, Phaser.GameObjects.Image>();
  private obstacles = new Map<string, Phaser.GameObjects.Image>();
  private posts: Phaser.GameObjects.Image[] = [];
  private fenceBack?: Phaser.GameObjects.Image;
  private fenceFront?: Phaser.GameObjects.Image;
  private ground?: Phaser.GameObjects.Image;
  private blockShadows?: Phaser.GameObjects.Image;
  private actors = new Map<string, Actor>();
  private bombs = new Map<
    number,
    { image: Phaser.GameObjects.Sprite; ring: Phaser.GameObjects.Ellipse; element: Element }
  >();
  private pickups = new Map<
    string,
    { image: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Ellipse; phase: number }
  >();
  private flames = new Map<string, Phaser.GameObjects.Sprite>();
  private effects = new Set<Phaser.GameObjects.Sprite>();
  private floaters = new Set<{ text: Phaser.GameObjects.Text; start: number; y: number }>();
  private previousCells: State['cells'] = [];
  private previousPickups = new Map<string, State['pickups'][number]>();
  private warningCells: { cell: Point; start: number; element: Element; frozen: boolean }[] = [];
  private suppressFeedback = true;
  private localMarker!: Phaser.GameObjects.Image;
  private overlayShade!: Phaser.GameObjects.Graphics;
  private warnings!: Phaser.GameObjects.Graphics;
  private boardPaint = '';
  private logo!: Phaser.GameObjects.Image;
  private modePill!: Phaser.GameObjects.Image;
  private modeIcon!: Phaser.GameObjects.Image;
  private modeLabel!: Phaser.GameObjects.Text;
  private portraitGlow!: Phaser.GameObjects.Image;
  private portrait!: Phaser.GameObjects.Image;
  private portraitName!: Phaser.GameObjects.Text;
  private statPaper!: Phaser.GameObjects.Image;
  private stats: StatRow[] = [];
  private timerBoard!: Phaser.GameObjects.Image;
  private timerClock!: Phaser.GameObjects.Image;
  private timerLabel!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private roster: Card[] = [];
  private padPlate!: Phaser.GameObjects.Image;
  private padZone!: Phaser.GameObjects.Zone;
  private padCenter: Point = { x: 0, y: 0 };
  private padRadius = 100;
  private pad: PadKey[] = [];
  private actions: Control[] = [];
  private captions: Phaser.GameObjects.Container[] = [];
  private cooldowns: Phaser.GameObjects.Graphics[] = [];
  private cooldownPaint: string[] = [];
  private helpButton!: Control;
  private menuButton!: Control;
  private selectPanel!: Phaser.GameObjects.Container;
  private selectTitle!: Phaser.GameObjects.Text;
  private selectSkill!: Phaser.GameObjects.Text;
  private selectDescription!: Phaser.GameObjects.Text;
  private selectChoices: Control[] = [];
  private readyButton!: Control;
  private resultPanel!: Phaser.GameObjects.Container;
  private resultText!: Phaser.GameObjects.Text;
  private resultPortrait!: Phaser.GameObjects.Image;
  private resultDetail!: Phaser.GameObjects.Text;
  private resultStars!: Phaser.GameObjects.Sprite;
  private resultWait!: Phaser.GameObjects.Text;
  private newGameButton!: Control;
  private customizeButton!: Control;
  private sitButton!: Control;
  private helpPanel!: Phaser.GameObjects.Container;
  private helpClose!: Control;
  private menuPanel!: Phaser.GameObjects.Container;
  private menuWatchers!: Phaser.GameObjects.Text;
  private menuItems: Control[] = [];
  private keys: string[] = [];
  private touch = new Map<number, Direction>();
  private direction: Direction = 'none';
  private sentDirection: Direction = 'none';
  private inputElapsed = 0;
  /** When the player last steered (their fighter trusts its own prediction for a moment). */
  private steeredAt = -1000;
  /** `performance.now()` of the previous frame. */
  private frameAt = 0;
  private snapshotAt = 0;
  private lastPhase: State['phase'] = 'select';
  private previousBlast = 0;
  private lastViewer: string | null = null;
  private ui = 1;
  private tw = 60;
  private th = 52;
  private ox = 0;
  private oy = 0;

  protected onCreate(ctx: Ctx) {
    this.tiles = new Map();
    this.obstacles = new Map();
    this.posts = [];
    this.fenceBack = undefined;
    this.fenceFront = undefined;
    this.ground = undefined;
    this.blockShadows = undefined;
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
    this.steeredAt = -1000;
    this.frameAt = 0;
    this.snapshotAt = this.time.now;
    this.lastPhase = ctx.state.phase;
    this.previousBlast = 0;
    this.lastViewer = ctx.me?.id ?? null;
    this.boardPaint = '';
    this.roster = [];
    this.stats = [];
    this.pad = [];
    this.actions = [];
    this.captions = [];
    this.cooldowns = [];
    this.cooldownPaint = [];
    this.selectChoices = [];
    this.menuItems = [];
    this.backdrop = this.sprite('garden').setDepth(-20);
    registerAnimations(this, (name) => this.texture(name));
    this.warnings = this.add.graphics().setDepth(5);
    this.localMarker = this.bake('bom-marker', { x: -17, y: -29, width: 34, height: 32 }, (g) =>
      g
        .fillStyle(0xffffff)
        .fillTriangle(-14, -22, 14, -22, 0, 1)
        .fillCircle(-7, -19, 8)
        .fillCircle(7, -19, 8)
        .fillStyle(0xf04359)
        .fillTriangle(-10, -20, 10, -20, 0, -3)
        .fillCircle(-5, -18, 5.5)
        .fillCircle(5, -18, 5.5)
        .fillStyle(0xffffff, 0.75)
        .fillCircle(-6, -20, 2),
    ).setDepth(1900);
    this.overlayShade = this.add.graphics().setDepth(2500);
    this.createHud();
    this.createSelection();
    this.createResult();
    this.createHelp();
    this.createMenu();
    this.bindInput();
  }

  // ── Building blocks ────────────────────────────────────────────────────────────────────

  /** Draws once with Graphics and keeps a crisp texture of it. */
  private bake(key: string, bounds: Phaser.Types.Math.RectangleLike, draw: Bake) {
    const g = this.add.graphics();
    draw(g);
    const image = rasterizeGraphics(this, g, key, bounds);
    g.destroy();
    return image;
  }
  private rebake(
    image: Phaser.GameObjects.Image | undefined,
    key: string,
    bounds: Phaser.Types.Math.RectangleLike,
    draw: Bake,
  ) {
    const g = this.add.graphics();
    draw(g);
    const result = rasterizeGraphics(this, g, key, bounds, image);
    g.destroy();
    return result;
  }
  private text(text: string, size: number, color = THEME.paper) {
    return this.add.text(0, 0, text, textStyle(size, color)).setOrigin(0.5);
  }
  private bold(text: string, size: number, color = THEME.white) {
    return this.add.text(0, 0, text, boldStyle(size, color)).setOrigin(0.5);
  }
  /** Cream paper card with a honey-wood rim, centred on its position. */
  private paper(width: number, height: number, radius = 24) {
    return this.bake(
      `bom-paper-${width}-${height}-${radius}`,
      { x: -width / 2 - 4, y: -height / 2 - 4, width: width + 8, height: height + 14 },
      (g) =>
        g
          .fillStyle(0x5d7d3a, 0.22)
          .fillRoundedRect(-width / 2, -height / 2 + 7, width, height, radius)
          .fillStyle(THEME.wood)
          .fillRoundedRect(-width / 2, -height / 2 + 3, width, height, radius)
          .fillStyle(THEME.panel)
          .fillRoundedRect(-width / 2, -height / 2, width, height, radius)
          .lineStyle(3, THEME.outline)
          .strokeRoundedRect(-width / 2, -height / 2, width, height, radius)
          .lineStyle(2, 0xffffff, 0.8)
          .strokeRoundedRect(
            -width / 2 + 6,
            -height / 2 + 6,
            width - 12,
            height - 12,
            Math.max(4, radius - 5),
          ),
    );
  }
  private control(
    text: string,
    skin: Skin,
    tap: () => void,
    { icon, size = 24, onDown = false }: { icon?: string; size?: number; onDown?: boolean } = {},
  ): Control {
    const key = this.texture(SKIN_IMAGE[skin]);
    const source = this.textures.getFrame(key);
    const slice = Math.round(Math.min(source.width, source.height) * 0.34);
    const bg = this.add.nineslice(
      0,
      0,
      key,
      undefined,
      source.width,
      source.height,
      slice,
      slice,
      slice,
      slice,
    );
    const label =
      skin === 'cream'
        ? this.add.text(0, 0, text, textStyle(size)).setOrigin(0.5)
        : this.bold(text, size);
    const face = this.add.container(0, 0, [bg, label]);
    const container = this.add.container(0, 0, [face]).setDepth(2000);
    const c: Control = {
      container,
      face,
      bg,
      label,
      width: 0,
      height: 0,
      enabled: true,
      hovered: false,
      pressed: false,
      selected: false,
    };
    if (icon) {
      c.icon = this.sprite(icon);
      face.add(c.icon);
    }
    container.setInteractive({
      hitArea: new Phaser.Geom.Rectangle(0, 0, 1, 1),
      hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      useHandCursor: true,
    });
    const fire = () => {
      if (c.enabled) tap();
    };
    container.on('pointerdown', () => {
      c.pressed = c.enabled;
      this.paintControl(c);
      if (onDown) fire();
    });
    container.on('pointerup', () => {
      const pressed = c.pressed;
      c.pressed = false;
      this.paintControl(c);
      if (pressed && !onDown) fire();
    });
    container.on('pointerover', () => {
      c.hovered = true;
      this.paintControl(c);
    });
    container.on('pointerout', () => {
      c.hovered = false;
      c.pressed = false;
      this.paintControl(c);
    });
    return c;
  }
  /** Sizes a control; its corners keep their shape and the tap area is at least 88 square. */
  private sizeControl(c: Control, width: number, height: number) {
    c.width = width;
    c.height = height;
    if (c.bg) {
      const frame = this.textures.getFrame(c.bg.texture.key);
      const scale = Math.min(height / frame.height, width / (c.bg.leftWidth + c.bg.rightWidth + 1));
      c.bg.setSize(width / scale, height / scale).setScale(scale);
    }
    const hitW = Math.max(width, 88);
    const hitH = Math.max(height, 72);
    c.container.setSize(width, height);
    const area = c.container.input?.hitArea as Phaser.Geom.Rectangle | undefined;
    area?.setTo((width - hitW) / 2, (height - hitH) / 2, hitW, hitH);
    this.paintControl(c);
  }
  private paintControl(c: Control) {
    const pressed = c.pressed && c.enabled;
    c.face.setY(pressed ? 3 : 0).setScale(pressed ? 0.97 : c.hovered && c.enabled ? 1.03 : 1);
    c.container.setAlpha(c.enabled ? 1 : 0.6);
    c.ring?.setVisible(c.selected);
  }

  // ── HUD ────────────────────────────────────────────────────────────────────────────────

  private createHud() {
    this.logo = this.sprite('logo').setOrigin(0.5, 0).setDepth(2000);
    this.modePill = this.paper(200, 40, 20).setDepth(2000);
    this.modeIcon = this.sprite('portrait-fire').setDepth(2001);
    this.modeLabel = this.text('', 20).setOrigin(0, 0.5).setDepth(2001);
    this.portraitGlow = this.bake(
      'bom-portrait-glow',
      { x: -110, y: -110, width: 220, height: 220 },
      (g) => {
        for (let i = 10; i > 0; i--) g.fillStyle(0xfffbe8, 0.06).fillCircle(0, 0, i * 10);
        for (const [x, y, r] of [
          [-80, -64, 9],
          [78, -44, 7],
          [-70, 58, 6],
          [86, 40, 10],
        ] as const) {
          g.fillStyle(0xffe58a)
            .fillTriangle(x - r * 0.35, y, x + r * 0.35, y, x, y - r)
            .fillTriangle(x - r * 0.35, y, x + r * 0.35, y, x, y + r)
            .fillTriangle(x, y - r * 0.35, x, y + r * 0.35, x - r, y)
            .fillTriangle(x, y - r * 0.35, x, y + r * 0.35, x + r, y);
        }
      },
    ).setDepth(1999);
    this.portrait = this.sprite('portrait-fire').setDepth(2000);
    this.portraitName = this.bold('', 22).setDepth(2001);
    this.statPaper = this.paper(236, 128, 20).setDepth(2000);
    this.stats = (
      [
        ['icon-heart', 'HP'],
        ['icon-bomb', 'Bom'],
        ['icon-blast', 'Tầm nổ'],
      ] as const
    ).map(([icon, label]) => ({
      icon: this.sprite(icon).setDepth(2001),
      label: this.text(label, 20).setOrigin(0, 0.5).setDepth(2001),
      pill: this.add.graphics().setDepth(2001),
      value: this.text('', 19).setDepth(2002),
      paint: '',
    }));
    this.timerBoard = this.sprite('timer-board').setDepth(2000);
    this.timerClock = this.sprite('icon-clock').setDepth(2001);
    this.timerLabel = this.bold('03:00', 32).setDepth(2001);
    this.status = this.bold('', 18, '#fff6d8').setDepth(2001);
    this.roster = Array.from({ length: 4 }, () => {
      const portrait = this.sprite('portrait-fire');
      const name = this.text('', 17).setOrigin(0, 0.5);
      const bar = this.add.graphics();
      const hp = this.bold('', 13).setStroke(THEME.stroke, 3);
      const team = this.bold('', 14).setStroke(THEME.stroke, 3);
      const container = this.add.container(0, 0, [portrait, name, bar, hp, team]).setDepth(2000);
      return { container, width: 0, height: 0, portrait, name, bar, hp, team, paint: '' };
    });
    this.padPlate = this.sprite('dpad').setDepth(2000);
    this.pad = PAD_DIRS.map((dir) => {
      const key = this.sprite('dpad-key');
      const arrow = this.bake(`bom-arrow-${dir}`, { x: -16, y: -16, width: 32, height: 32 }, (g) =>
        g.fillStyle(THEME.woodDark).fillTriangle(-12, 8, 12, 8, 0, -11),
      );
      arrow.setRotation({ up: 0, left: -Math.PI / 2, down: Math.PI, right: Math.PI / 2 }[dir]);
      const container = this.add.container(0, 0, [key, arrow]).setDepth(2001);
      return { container, key, arrow, dir };
    });
    this.padZone = this.add.zone(0, 0, 10, 10).setDepth(2002);
    this.padZone.setInteractive({
      hitArea: new Phaser.Geom.Circle(0, 0, 1),
      hitAreaCallback: Phaser.Geom.Circle.Contains,
    });
    this.padZone.on('pointerdown', (p: Phaser.Input.Pointer) => this.padTouch(p));
    this.actions = ACTIONS.map((a) => {
      const c = this.control(a.name, a.skin, () => this.act(a.action), {
        icon: a.icon,
        size: 20,
        onDown: true,
      });
      const cooldown = this.add.graphics();
      c.face.addAt(cooldown, 1);
      this.cooldowns.push(cooldown);
      this.cooldownPaint.push('');
      const caption = this.add.container(0, 0, [
        this.bake(`bom-caption-${a.key}`, { x: -40, y: -15, width: 80, height: 32 }, (g) =>
          g
            .fillStyle(0x5d7d3a, 0.25)
            .fillRoundedRect(-36, -11, 72, 26, 13)
            .fillStyle(THEME.panel)
            .fillRoundedRect(-36, -13, 72, 26, 13)
            .lineStyle(2, THEME.outline)
            .strokeRoundedRect(-36, -13, 72, 26, 13),
        ),
        this.text(a.key, 17),
      ]);
      caption.setDepth(2001);
      this.captions.push(caption);
      return c;
    });
    this.helpButton = this.control('Luật chơi', 'cream', () => this.toggleHelp(), {
      icon: 'icon-book',
      size: 19,
    });
    this.menuButton = this.control('', 'cream', () => this.toggleMenu(), { icon: 'icon-gear' });
  }

  private createSelection() {
    this.selectPanel = this.add.container().setDepth(3000);
    const bg = this.paper(880, 470, 32);
    this.selectTitle = this.bold('Chọn bạn nhỏ của bạn', 40).setY(-188);
    this.selectSkill = this.text('', 26).setPosition(0, 104);
    this.selectDescription = this.text('', 20, THEME.muted).setPosition(0, 138);
    this.selectChoices = ELEMENTS.map((element, i) => {
      const card = this.bake(
        `bom-choice-${element}`,
        { x: -76, y: -96, width: 152, height: 200 },
        (g) =>
          g
            .fillStyle(0x5d7d3a, 0.2)
            .fillRoundedRect(-72, -88, 144, 184, 22)
            .fillStyle(CHARACTER[element].pastel)
            .fillRoundedRect(-72, -92, 144, 184, 22)
            .lineStyle(3, THEME.outline)
            .strokeRoundedRect(-72, -92, 144, 184, 22)
            .lineStyle(2, 0xffffff, 0.85)
            .strokeRoundedRect(-66, -86, 132, 172, 18),
      );
      const ring = this.bake(
        `bom-choice-ring-${element}`,
        { x: -82, y: -102, width: 164, height: 204 },
        (g) =>
          g
            .lineStyle(6, ELEMENT_INFO[element].color)
            .strokeRoundedRect(-78, -98, 156, 196, 26)
            .lineStyle(2, 0xffffff)
            .strokeRoundedRect(-78, -98, 156, 196, 26),
      );
      const portrait = this.sprite(`portrait-${element}`);
      portrait.setScale(124 / Math.max(portrait.width, portrait.height)).setY(-16);
      const name = this.text(CHARACTER[element].name, 19).setY(64);
      const face = this.add.container(0, 0, [ring, card, portrait, name]);
      const container = this.add.container((i - 2) * 160, -40, [face]);
      container.setSize(144, 184).setInteractive({ useHandCursor: true });
      const c: Control = {
        container,
        face,
        label: name,
        ring,
        width: 144,
        height: 184,
        enabled: true,
        hovered: false,
        pressed: false,
        selected: false,
      };
      container.on('pointerdown', () => {
        c.pressed = c.enabled;
        this.paintControl(c);
      });
      container.on('pointerup', () => {
        const pressed = c.pressed;
        c.pressed = false;
        this.paintControl(c);
        if (pressed && c.enabled && this.ctx.me) this.send('choose', { element });
      });
      container.on('pointerover', () => {
        c.hovered = true;
        this.paintControl(c);
      });
      container.on('pointerout', () => {
        c.hovered = false;
        c.pressed = false;
        this.paintControl(c);
      });
      ring.setVisible(false);
      this.selectPanel.add(container);
      return c;
    });
    this.readyButton = this.control('Sẵn sàng', 'orange', () => {
      if (this.ctx.me) this.send('ready');
    });
    this.sizeControl(this.readyButton, 260, 68);
    this.readyButton.label.setFontSize(30);
    this.readyButton.container.setY(196).setDepth(3001);
    this.selectPanel.addAt(bg, 0);
    this.selectPanel.add([
      this.selectTitle,
      this.selectSkill,
      this.selectDescription,
      this.readyButton.container,
    ]);
  }

  private createResult() {
    this.resultPanel = this.add.container().setDepth(3000).setVisible(false);
    this.resultText = this.bold('', 44).setY(-150).setWordWrapWidth(560);
    this.resultStars = this.add
      .sprite(0, -40, this.texture('cartoon-fx'), effectFrame('victory'))
      .setDisplaySize(240, 240);
    this.resultPortrait = this.sprite('portrait-fire').setPosition(0, -40);
    this.resultDetail = this.text('', 21, THEME.muted).setY(72).setWordWrapWidth(560);
    this.resultWait = this.text('', 20, THEME.muted).setY(150);
    this.newGameButton = this.control('Chơi ván mới', 'orange', () => this.newGame());
    this.customizeButton = this.control('Tuỳ chỉnh', 'cream', () => this.customize());
    this.sitButton = this.control('Vào chơi', 'orange', () => this.takeSeat());
    for (const c of [this.newGameButton, this.customizeButton, this.sitButton]) {
      this.sizeControl(c, 220, 64);
      c.label.setFontSize(26);
      c.container.setY(150).setDepth(3001);
    }
    this.resultPanel.add([
      this.paper(660, 420, 32),
      this.resultStars,
      this.resultText,
      this.resultPortrait,
      this.resultDetail,
      this.resultWait,
      this.newGameButton.container,
      this.customizeButton.container,
      this.sitButton.container,
    ]);
  }

  private createHelp() {
    this.helpPanel = this.add.container().setDepth(4000).setVisible(false);
    const title = this.bold('Luật chơi', 38).setY(-196);
    const body = this.text(
      [
        'WASD / Phím mũi tên · Di chuyển',
        'Space · Đặt bom    E · Kỹ năng    Shift · Lướt',
        '',
        'Bom nổ sau 2,5 giây; vùng sáng báo phạm vi nổ.',
        'Hàng rào và đá chặn lửa; thùng quà phá được, rơi vật phẩm.',
        'Bom kích hoạt nhau; bom băng có thể trì hoãn bom.',
        'Hồi máu +30 HP · Tầm nổ · Số bom · Tốc độ',
        '',
        'Sinh tồn: người sống sót cuối cùng thắng.',
        '2v2: đội còn người thắng; không sát thương đồng đội.',
        'Sau 2 phút, đấu trường thu hẹp.',
        'Hết 3 phút: so HP còn lại; bằng nhau thì hòa.',
      ].join('\n'),
      21,
    ).setWordWrapWidth(620);
    this.helpClose = this.control('Đóng', 'orange', () => this.toggleHelp(false));
    this.sizeControl(this.helpClose, 200, 60);
    this.helpClose.container.setY(200).setDepth(4001);
    this.helpPanel.add([this.paper(720, 480, 32), title, body, this.helpClose.container]);
  }

  private createMenu() {
    this.menuPanel = this.add.container().setDepth(4000).setVisible(false);
    const title = this.bold('Tuỳ chọn', 38).setY(-170);
    this.menuWatchers = this.text('', 18, THEME.muted).setY(-128);
    const items: [string, Skin, () => void][] = [
      [
        'Cài đặt',
        'cream',
        () => {
          this.toggleMenu(false);
          this.openSettings();
        },
      ],
      [
        'Về danh sách phòng',
        'cream',
        () => {
          this.toggleMenu(false);
          this.leaveRoom();
        },
      ],
      [
        'Về trang chủ',
        'cream',
        () => {
          this.toggleMenu(false);
          this.leaveRoom('home');
        },
      ],
      ['Tiếp tục', 'orange', () => this.toggleMenu(false)],
    ];
    this.menuItems = items.map(([label, skin, tap], i) => {
      const c = this.control(label, skin, tap, { size: 24 });
      this.sizeControl(c, 320, 60);
      c.container.setY(-78 + i * 74).setDepth(4001);
      return c;
    });
    this.menuPanel.add([
      this.paper(420, 420, 32),
      title,
      this.menuWatchers,
      ...this.menuItems.map((c) => c.container),
    ]);
  }

  private toggleHelp(visible = !this.helpPanel.visible) {
    this.helpPanel.setVisible(visible);
    if (visible) this.menuPanel.setVisible(false);
    this.releaseInput();
    this.renderHud(this.ctx);
  }

  private toggleMenu(visible = !this.menuPanel.visible) {
    this.menuPanel.setVisible(visible);
    if (visible) this.helpPanel.setVisible(false);
    this.releaseInput();
    this.renderHud(this.ctx);
  }

  // ── Layout ─────────────────────────────────────────────────────────────────────────────

  protected onLayout(ctx: Ctx) {
    const { width: w, height: h, top } = ctx.screen;
    const { left, right, top: bleedTop, bottom } = this.bleed;
    const ratio = Math.max(
      (right - left) / this.backdrop.width,
      (bottom - bleedTop) / this.backdrop.height,
    );
    this.backdrop.setPosition((left + right) / 2, (bleedTop + bottom) / 2).setScale(ratio);
    const ui = Phaser.Math.Clamp(ctx.screen.hud / 1.35, 0.85, 1.15);
    this.ui = ui;
    const margin = 10;
    const leftW = Math.min(Phaser.Math.Clamp(w * 0.19, 214, 262) * ui, w * 0.27);
    const rowH = 64 * ui;
    const compact = w < 1150;

    // Left column: logo, mode, my character, my numbers, D-pad.
    const cx = margin + leftW / 2;
    this.logo.setPosition(cx, top).setScale((leftW - 6) / this.logo.width);
    const logoBottom = top + this.logo.displayHeight;
    const pillW = leftW - 20;
    const pillH = 40 * ui;
    this.modePill = this.rebake(
      this.modePill,
      'bom-mode-pill',
      { x: -pillW / 2 - 4, y: -pillH / 2 - 4, width: pillW + 8, height: pillH + 12 },
      (g) =>
        g
          .fillStyle(0x5d7d3a, 0.22)
          .fillRoundedRect(-pillW / 2, -pillH / 2 + 5, pillW, pillH, pillH / 2)
          .fillStyle(THEME.panel)
          .fillRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2)
          .lineStyle(2.5, THEME.outline)
          .strokeRoundedRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2),
    );
    const pillY = logoBottom + 4 + pillH / 2;
    this.modePill.setPosition(cx, pillY);
    this.modeIcon
      .setScale((pillH * 0.95) / this.modeIcon.height)
      .setPosition(cx - pillW / 2 + pillH * 0.55, pillY - 2);
    this.modeLabel
      .setFontSize(Math.round(21 * ui))
      .setPosition(cx - pillW / 2 + pillH * 1.05, pillY);
    const padD = Math.min(leftW - 4, 230 * ui);
    this.padCenter = { x: cx, y: h - margin - padD / 2 };
    this.padRadius = padD / 2;
    this.padPlate
      .setPosition(this.padCenter.x, this.padCenter.y)
      .setScale(padD / this.padPlate.width);
    const keySize = padD * 0.3;
    const offset = padD * 0.27;
    for (const k of this.pad) {
      const d = DIRECTIONS[k.dir];
      k.key.setScale(keySize / k.key.width);
      k.arrow.setDisplaySize(keySize * 0.5, keySize * 0.5);
      k.container.setPosition(this.padCenter.x + d.x * offset, this.padCenter.y + d.y * offset);
    }
    this.padZone.setPosition(this.padCenter.x, this.padCenter.y).setSize(padD, padD);
    (this.padZone.input?.hitArea as Phaser.Geom.Circle | undefined)?.setTo(
      padD / 2,
      padD / 2,
      padD / 2,
    );
    const statH = 128 * ui;
    const statW = leftW - 8;
    const statY = this.padCenter.y - padD / 2 - 10 - statH / 2;
    this.statPaper = this.rebake(
      this.statPaper,
      'bom-stats',
      { x: -statW / 2 - 4, y: -statH / 2 - 4, width: statW + 8, height: statH + 14 },
      (g) =>
        g
          .fillStyle(0x5d7d3a, 0.22)
          .fillRoundedRect(-statW / 2, -statH / 2 + 7, statW, statH, 20)
          .fillStyle(THEME.panel, 0.96)
          .fillRoundedRect(-statW / 2, -statH / 2, statW, statH, 20)
          .lineStyle(2.5, 0xe7cdb1)
          .strokeRoundedRect(-statW / 2, -statH / 2, statW, statH, 20),
    );
    this.statPaper.setPosition(cx, statY);
    this.stats.forEach((row, i) => {
      const y = statY - statH / 2 + (statH / 3) * (i + 0.5);
      const pillX = cx + statW / 2 - 14 * ui - (STAT_PILL.width * ui) / 2;
      row.icon.setScale((30 * ui) / row.icon.height).setPosition(cx - statW / 2 + 26 * ui, y);
      row.label.setFontSize(Math.round(18 * ui)).setPosition(cx - statW / 2 + 46 * ui, y);
      row.value.setFontSize(Math.round(18 * ui)).setPosition(pillX, y);
      row.pill.setPosition(pillX, y);
      row.paint = '';
    });
    const portraitTop = pillY + pillH / 2 + 6;
    const portraitBottom = statY - statH / 2 - 8;
    const portraitH = Math.min(portraitBottom - portraitTop, 200 * ui);
    const portraitY = (portraitTop + portraitBottom) / 2;
    this.portrait
      .setVisible(portraitH > 60)
      .setScale(Math.min(portraitH / this.portrait.height, (leftW - 30) / this.portrait.width))
      .setPosition(cx, portraitY);
    this.portraitGlow
      .setVisible(portraitH > 60)
      .setDisplaySize(portraitH * 1.1, portraitH * 1.1)
      .setPosition(cx, portraitY);
    this.portraitName
      .setVisible(portraitH > 90)
      .setFontSize(Math.round(20 * ui))
      .setPosition(cx, portraitY + portraitH / 2 - 8);

    // Top-right: rules and the room menu.
    const iconBtn = 54 * ui;
    this.sizeControl(this.menuButton, iconBtn, iconBtn);
    this.menuButton.icon?.setScale((iconBtn * 0.66) / (this.menuButton.icon?.height ?? 1));
    this.menuButton.container.setPosition(w - margin - iconBtn / 2, top + rowH / 2);
    const rulesW = compact ? iconBtn : 128 * ui;
    this.sizeControl(this.helpButton, rulesW, iconBtn);
    this.helpButton.label.setVisible(!compact).setFontSize(Math.round(19 * ui));
    this.helpButton.icon
      ?.setScale((iconBtn * 0.56) / (this.helpButton.icon?.height ?? 1))
      .setX(compact ? 0 : -rulesW / 2 + iconBtn * 0.4);
    this.helpButton.label.setX(iconBtn * 0.36).setY(-1);
    this.helpButton.container.setPosition(w - margin - iconBtn - 8 - rulesW / 2, top + rowH / 2);

    // Actions: a column on the right, or a row under the board when that leaves it bigger.
    const actionSize = 96 * ui;
    const actionStep = actionSize + 34 * ui;
    const columnW = actionSize + 24 * ui;
    const regionX = margin + leftW + 8;
    const regionY = top + rowH + 6;
    const regionH = h - regionY - 6;
    const across = (width: number) => width / (BOARD.right - BOARD.left);
    const down = (height: number) => height / ((BOARD.bottom - BOARD.top) * TILT);
    const sideTw = Math.min(across(w - margin - columnW - 6 - regionX), down(regionH));
    const rowTw = Math.min(across(w - margin - regionX), down(regionH - actionStep));
    const below = rowTw > sideTw * 1.04;
    this.tw = below ? rowTw : sideTw;
    this.th = this.tw * TILT;
    const regionW = below ? w - margin - regionX : w - margin - columnW - 6 - regionX;
    const boardW = (BOARD.right - BOARD.left) * this.tw;
    const boardH = (BOARD.bottom - BOARD.top) * this.th;
    const boardX = regionX + (regionW - boardW) / 2;
    const boardY = below ? regionY : regionY + (regionH - boardH) / 2;
    this.ox = boardX - BOARD.left * this.tw;
    this.oy = boardY - BOARD.top * this.th;
    this.actions.forEach((c, i) => {
      this.sizeControl(c, actionSize, actionSize);
      c.icon?.setScale((actionSize * 0.46) / (c.icon?.height ?? 1)).setY(-actionSize * 0.13);
      c.label.setFontSize(Math.round(18 * ui)).setY(actionSize * 0.22);
      const x = below
        ? w - margin - actionSize / 2 - (2 - i) * (actionSize + 12 * ui)
        : w - margin - columnW / 2;
      const y = below
        ? h - 16 * ui - actionSize / 2
        : h - 16 * ui - actionSize / 2 - i * actionStep;
      c.container.setPosition(x, y);
      this.captions[i]?.setPosition(x, y + actionSize / 2 + 2).setScale(ui);
      this.cooldownPaint[i] = '';
    });

    // Top row: two cards, the timer, two cards, between the logo and the buttons.
    const rowLeft = regionX;
    const rowRight = this.helpButton.container.x - rulesW / 2 - 10;
    const timerW = 168 * ui;
    const gap = 8 * ui;
    const cardW = Math.min(204 * ui, (rowRight - rowLeft - timerW - 4 * gap) / 4);
    const cardH = 58 * ui;
    const rowMid = (rowLeft + rowRight) / 2;
    const rowY = top + rowH / 2;
    this.timerBoard.setScale(timerW / this.timerBoard.width).setPosition(rowMid, rowY);
    const timerH = this.timerBoard.displayHeight;
    this.timerClock
      .setScale((timerH * 0.82) / this.timerClock.height)
      .setPosition(rowMid - timerW * 0.29, rowY + timerH * 0.04);
    this.timerLabel.setFontSize(Math.round(33 * ui)).setPosition(rowMid + timerW * 0.1, rowY + 2);
    this.status.setFontSize(Math.round(17 * ui)).setPosition(rowMid, rowY + timerH / 2 + 14 * ui);
    this.roster.forEach((card, i) => {
      const slot = [-2, -1, 1, 2][i] ?? 0;
      const x =
        rowMid +
        Math.sign(slot) * (timerW / 2 + gap + cardW / 2 + (Math.abs(slot) - 1) * (cardW + gap));
      card.container.setPosition(x, rowY);
      this.layoutCard(card, cardW, cardH, ui);
    });

    const available = h - top;
    const overlayScale = Math.min((w - 40) / 900, (available - 24) / 500, 1.15);
    for (const panel of [this.selectPanel, this.resultPanel, this.helpPanel, this.menuPanel])
      panel.setPosition(w / 2, top + available / 2).setScale(overlayScale);
    this.overlayShade
      .clear()
      .fillStyle(0xfff8e6, 0.55)
      .fillRect(left, bleedTop, right - left, bottom - bleedTop);
    this.boardPaint = '';
    this.renderBoard(ctx);
    this.layoutActors(ctx);
    this.renderTransient(ctx);
    this.renderHud(ctx);
    for (const sprite of this.effects) {
      const pos = this.project(sprite.getData('point') as Point);
      const size = sprite.getData('size') as number;
      sprite
        .setPosition(pos.x, pos.y)
        .setDisplaySize(this.tw * size, this.tw * size)
        .setDepth(100 + pos.y + 17);
    }
  }

  private layoutCard(card: Card, width: number, height: number, ui: number) {
    card.paint = '';
    card.width = width;
    card.height = height;
    const fresh = !card.paper;
    card.paper = this.rebake(
      card.paper,
      `bom-card-${this.roster.indexOf(card)}`,
      { x: -width / 2 - 4, y: -height / 2 - 4, width: width + 8, height: height + 14 },
      (g) =>
        g
          .fillStyle(0x5d7d3a, 0.24)
          .fillRoundedRect(-width / 2, -height / 2 + 6, width, height, 18)
          .fillStyle(THEME.panel)
          .fillRoundedRect(-width / 2, -height / 2, width, height, 18)
          .lineStyle(2.5, 0xe2c6a8)
          .strokeRoundedRect(-width / 2, -height / 2, width, height, 18),
    );
    if (fresh) card.container.addAt(card.paper.setPosition(0, 0), 0);
    this.fitHead(card);
    const textX = -width / 2 + 8 + height * 0.98;
    card.name.setFontSize(Math.round(15 * ui)).setPosition(textX, -height * 0.2);
    card.bar.setPosition(textX, height * 0.2);
    card.hp.setFontSize(Math.round(13 * ui)).setPosition(textX, height * 0.2);
    card.team.setFontSize(Math.round(14 * ui)).setPosition(width / 2 - 12 * ui, -height / 2 + 4);
  }

  /** A card shows the head and shoulders: the top of the full-body picture. */
  private fitHead(card: Card) {
    const frame = card.portrait.frame;
    const head = 0.64;
    const scale = (card.height * 1.02) / (frame.height * head);
    card.portrait
      .setCrop(0, 0, frame.width, frame.height * head)
      .setOrigin(0.5, head / 2)
      .setScale(Math.min(scale, card.height / frame.width))
      .setPosition(-card.width / 2 + 4 + card.height * 0.48, -3);
  }

  /** Top-down projection with a slight forward tilt; grid axes stay screen-aligned. */
  project(p: Point): Point {
    return { x: this.ox + p.x * this.tw, y: this.oy + p.y * this.th };
  }

  // ── Board ──────────────────────────────────────────────────────────────────────────────

  private renderBoard({ state }: Ctx) {
    const paint = `${this.tw}:${this.ox}:${this.oy}:${state.ring}:${state.cells.join(',')}`;
    if (paint === this.boardPaint) return;
    const relayout = !this.boardPaint.startsWith(`${this.tw}:${this.ox}:${this.oy}:`);
    this.boardPaint = paint;
    if (relayout) this.renderFence();
    const closing = (x: number, y: number) => state.ring > 0 && inRing({ x, y }, state.ring);
    const blocks: Point[] = [];
    for (let y = 1; y < HEIGHT - 1; y++)
      for (let x = 1; x < WIDTH - 1; x++) {
        const p = { x, y };
        const key = keyOf(p);
        const pos = this.project(p);
        const tile = tileAt(state, p);
        let image = this.tiles.get(key);
        if (!image) {
          image = this.sprite((x + y) % 2 === 0 ? 'tile-grass' : 'tile-dirt').setDepth(0);
          this.tiles.set(key, image);
        }
        image.setPosition(pos.x, pos.y).setDisplaySize(this.tw * 1.01, this.th * 1.01);
        const pillar = x % 2 === 0 && y % 2 === 0;
        const wanted = tile === 'crate' ? 'block-crate' : tile === 'wall' ? 'block-stone' : null;
        let prop = this.obstacles.get(key);
        if (!wanted) {
          prop?.destroy();
          this.obstacles.delete(key);
          continue;
        }
        if (!prop) {
          prop = this.sprite(wanted);
          this.obstacles.set(key, prop);
        }
        blocks.push(pos);
        prop
          .setTexture(this.texture(wanted))
          .setOrigin(0.5, 1)
          .setScale((this.tw * 1.02) / prop.width)
          .setPosition(pos.x, pos.y + this.th * 0.52)
          .setTint(!pillar && tile === 'wall' && closing(x, y) ? 0xffb4a6 : 0xffffff)
          .setDepth(100 + pos.y - 0.5);
      }
    // Each block casts a soft shadow down and to the right (light from the upper left), so it
    // reads as standing on the ground rather than printed on it.
    const a = this.project({ x: 0.5, y: 0.5 });
    const b = this.project({ x: 11.5, y: 10 });
    const { tw, th } = this;
    this.blockShadows = this.rebake(
      this.blockShadows,
      'bom-block-shadows',
      { x: a.x, y: a.y, width: b.x - a.x + tw * 0.2, height: b.y - a.y },
      (g) => {
        for (const pos of blocks)
          g.fillStyle(0x23391b, 0.3).fillRoundedRect(
            pos.x - tw * 0.42,
            pos.y + th * 0.4,
            tw * 0.96,
            th * 0.3,
            Math.min(10, tw * 0.14),
          );
      },
    ).setDepth(1);
  }

  /** The lawn under the tiles and the wooden fence around them, redrawn on resize only. */
  private renderFence() {
    const tw = this.tw;
    const th = this.th;
    const a = this.project({ x: 0.5, y: 0.5 });
    const b = this.project({ x: 11.5, y: 9.5 });
    const pad = tw * 0.1;
    const groundBounds = {
      x: a.x - pad * 3,
      y: a.y - pad * 3,
      width: b.x - a.x + pad * 6,
      height: b.y - a.y + pad * 6,
    };
    this.ground = this.rebake(this.ground, 'bom-ground', groundBounds, (g) =>
      g
        .fillStyle(0x3f6b2a, 0.28)
        .fillRoundedRect(
          a.x - pad,
          a.y - pad + th * 0.12,
          b.x - a.x + pad * 2,
          b.y - a.y + pad * 2,
          pad * 2,
        )
        .fillStyle(0x7d6338)
        .fillRoundedRect(
          a.x - pad * 0.6,
          a.y - pad * 0.6,
          b.x - a.x + pad * 1.2,
          b.y - a.y + pad * 1.2,
          pad * 1.5,
        )
        .fillStyle(0x5f8f35)
        .fillRect(a.x, a.y, b.x - a.x, b.y - a.y),
    ).setDepth(-5);
    const rail = THEME.wood;
    const railLight = 0xf2c588;
    const outline = THEME.outline;
    const t = th * 0.1;
    const railH = (g: Phaser.GameObjects.Graphics, x0: number, x1: number, y: number, s = 1) =>
      g
        .fillStyle(outline)
        .fillRoundedRect(x0 - 1.5, y - (t * s) / 2 - 1.5, x1 - x0 + 3, t * s + 3, (t * s) / 2 + 1.5)
        .fillStyle(rail)
        .fillRoundedRect(x0, y - (t * s) / 2, x1 - x0, t * s, (t * s) / 2)
        .fillStyle(railLight)
        .fillRect(x0 + t, y - (t * s) / 2 + 1, x1 - x0 - 2 * t, Math.max(1.5, (t * s) / 3));
    const railV = (g: Phaser.GameObjects.Graphics, x: number, y0: number, y1: number) =>
      g
        .fillStyle(outline)
        .fillRoundedRect(x - t * 0.6 - 1.5, y0 - 1.5, t * 1.2 + 3, y1 - y0 + 3, t * 0.6)
        .fillStyle(rail)
        .fillRoundedRect(x - t * 0.6, y0, t * 1.2, y1 - y0, t * 0.6)
        .fillStyle(railLight)
        .fillRect(x - t * 0.15, y0 + t, t * 0.3, y1 - y0 - 2 * t);
    const top = a.y;
    const back = {
      x: a.x - tw * 0.4,
      y: top - th * 0.6,
      width: b.x - a.x + tw * 0.8,
      height: b.y - a.y + th * 0.8,
    };
    this.fenceBack = this.rebake(this.fenceBack, 'bom-fence-back', back, (g) => {
      railV(g, a.x, top - th * 0.42, b.y - th * 0.22);
      railV(g, b.x, top - th * 0.42, b.y - th * 0.22);
      railH(g, a.x, b.x, top - th * 0.44);
      railH(g, a.x, b.x, top - th * 0.2);
    }).setDepth(99);
    const fy = this.project({ x: 0, y: 9.62 }).y;
    const front = {
      x: a.x - tw * 0.4,
      y: fy - th * 0.5,
      width: b.x - a.x + tw * 0.8,
      height: th * 0.7,
    };
    this.fenceFront = this.rebake(this.fenceFront, 'bom-fence-front', front, (g) => {
      railH(g, a.x, b.x, fy - th * 0.3, 0.9);
      railH(g, a.x, b.x, fy - th * 0.11, 0.9);
    }).setDepth(100 + fy + 2);
    for (const post of this.posts) post.destroy();
    this.posts = [];
    const post = (x: number, y: number, height: number, depth: number) => {
      const image = this.sprite('fence-post').setOrigin(0.5, 0.97);
      image
        .setScale(height / image.height)
        .setPosition(x, y)
        .setDepth(depth);
      this.posts.push(image);
    };
    for (let x = 0.5; x <= 11.5; x++) {
      const p = this.project({ x, y: 0.5 });
      post(p.x, p.y, th * (x === 0.5 || x === 11.5 ? 0.78 : 0.66), 99.5);
      const q = this.project({ x, y: 9.62 });
      post(q.x, q.y + th * 0.04, th * (x === 0.5 || x === 11.5 ? 0.62 : 0.5), 100 + q.y + 3);
    }
    for (let y = 1.5; y <= 8.5; y++)
      for (const x of [0.5, 11.5]) {
        const p = this.project({ x, y });
        post(p.x, p.y, th * 0.62, 100 + p.y - 1);
      }
  }

  // ── State ──────────────────────────────────────────────────────────────────────────────

  protected onState(ctx: Ctx) {
    this.snapshotAt = this.time.now;
    if (this.lastViewer !== (ctx.me?.id ?? null)) {
      this.releaseInput();
      for (const actor of this.actors.values()) this.destroyActor(actor);
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
          this.floating(ITEM_LABEL[pickup.kind], pickup, '#3f9b6e');
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

  private destroyActor(actor: Actor) {
    actor.sprite.destroy();
    actor.shadow.destroy();
    actor.ring.destroy();
    actor.name.destroy();
    actor.status?.destroy();
  }

  private layoutActors(ctx: Ctx, feedback = false) {
    for (const p of ctx.state.fighters) {
      let actor = this.actors.get(p.id);
      if (!actor) {
        actor = {
          sprite: this.add.sprite(
            0,
            0,
            this.texture(`actor-${p.element}`),
            actorFrame('idle', p.facing),
          ),
          shadow: this.add.ellipse(0, 0, 32, 12, 0x2f5a22, 0.3),
          ring: this.add.ellipse(0, 0, 32, 12).setFillStyle(),
          name: this.bold('', 14).setStroke(THEME.stroke, 4),
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
      const error = { x: p.x - actor.position.x, y: p.y - actor.position.y };
      // The player's own fighter keeps its prediction while they steer: the server follows the
      // position this screen sends (`at`), so its older snapshots must not pull them back. A real
      // change (a push) is further off than walking could explain.
      const steering = this.time.now - this.steeredAt < 500;
      const own = p.id === ctx.me?.id && steering && Math.abs(error.x) + Math.abs(error.y) < 1.2;
      actor.correction = own ? { x: 0, y: 0 } : error;
      // 256 px frames hold a 200 px standing character: 1.4 cells tall.
      actor.sprite.setOrigin(0.5, 244 / 256).setDisplaySize(this.tw * 1.79, this.tw * 1.79);
      const human = !p.bot && p.id !== ctx.me?.id;
      actor.name
        .setText(human ? p.name.slice(0, 12) : '')
        .setFontSize(Math.max(12, Math.round(this.tw * 0.22)));
      const team = ctx.state.mode === 'teams' ? TEAM_COLOR[p.team] : undefined;
      actor.ring
        .setStrokeStyle(Math.max(2, this.tw * 0.04), team ?? 0xffffff, team ? 0.95 : 0)
        .setVisible(team !== undefined && p.hp > 0);
      if (feedback) {
        if (p.hp < actor.hpBefore) {
          this.floating(`−${actor.hpBefore - p.hp}`, p, '#e2475e');
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
      for (const obj of [actor.shadow, actor.name]) obj.setVisible(p.hp > 0);
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
      .setDepth(100 + pos.y + 17)
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
    const text = this.bold(label, Math.max(16, Math.round(this.tw * 0.32)), color)
      .setPosition(pos.x, pos.y - this.tw * 0.9)
      .setStroke('#fffaf0', 5)
      .setDepth(1500);
    this.floaters.add({ text, y: text.y, start: this.time.now });
  }

  private positionActor(actor: Actor, p: Fighter, now: number) {
    const pos = this.project(actor.position);
    const feet = pos.y + this.th * 0.25;
    actor.sprite.setPosition(pos.x, feet).setDepth(100 + pos.y);
    actor.shadow
      .setPosition(pos.x, feet - this.th * 0.02)
      .setSize(this.tw * 0.62, this.th * 0.3)
      .setDepth(4);
    actor.ring
      .setPosition(pos.x, feet - this.th * 0.02)
      .setSize(this.tw * 0.74, this.th * 0.38)
      .setDepth(4);
    actor.sprite.setAlpha(
      p.invulnerableUntil > now && Math.floor(this.time.now / 100) % 2 ? 0.6 : 1,
    );
    const status = p.frozenUntil > now ? 'freeze' : p.stunUntil > now ? 'stun' : null;
    if (status && p.hp > 0) {
      if (!actor.status)
        actor.status = this.add.sprite(0, 0, this.texture('cartoon-fx'), effectFrame(status));
      actor.status
        .play(effectAnimation(status), true)
        .setPosition(pos.x, feet - this.tw * 0.45)
        .setOrigin(0.5, 0.6)
        .setDisplaySize(this.tw * 1.2, this.tw * 1.2)
        .setDepth(100 + pos.y + 2);
    } else {
      actor.status?.destroy();
      actor.status = null;
    }
    actor.name.setPosition(pos.x, feet - this.tw * 1.5).setDepth(1000);
  }

  private renderTransient(ctx: Ctx) {
    const s = ctx.state;
    for (const [id, b] of this.bombs)
      if (!s.bombs.some((b) => b.id === id)) {
        b.image.destroy();
        b.ring.destroy();
        this.bombs.delete(id);
      }
    for (const b of s.bombs) {
      let object = this.bombs.get(b.id);
      if (!object) {
        object = {
          image: this.add
            .sprite(0, 0, this.texture('arena-fx'), arenaFrame('bomb'))
            .setOrigin(0.5, 180 / 192)
            .play(arenaAnimation('bomb')),
          ring: this.add.ellipse(0, 0, 20, 10, ELEMENT_INFO[b.element].color, 0.55),
          element: b.element,
        };
        this.bombs.set(b.id, object);
      }
      const pos = this.project(b);
      object.image
        .setPosition(pos.x, pos.y + this.th * 0.3)
        .setDisplaySize(this.tw, this.tw)
        .setDepth(100 + pos.y + 0.2)
        .setTint(b.frozenUntil > s.time ? 0xbfefff : 0xffffff);
      object.ring
        .setPosition(pos.x, pos.y + this.th * 0.26)
        .setSize(this.tw * 0.72, this.th * 0.4)
        .setDepth(4.5);
    }
    const wanted = new Set(s.pickups.map((p) => keyOf(p)));
    for (const [key, item] of this.pickups)
      if (!wanted.has(key)) {
        item.image.destroy();
        item.glow.destroy();
        this.pickups.delete(key);
      }
    for (const p of s.pickups) {
      const key = keyOf(p);
      let item = this.pickups.get(key);
      if (!item) {
        item = {
          image: this.add
            .image(0, 0, this.texture('arena-fx'), arenaFrame(`item-${p.kind}`))
            .setOrigin(0.5, 176 / 192),
          glow: this.add.ellipse(0, 0, 20, 10, 0xfff6c8, 0.7),
          phase: (p.x * 7 + p.y * 3) % 6,
        };
        this.pickups.set(key, item);
      }
      const pos = this.project(p);
      item.image
        .setPosition(pos.x, pos.y + this.th * 0.22)
        .setDisplaySize(this.tw * 0.78, this.tw * 0.78)
        .setDepth(100 + pos.y - 0.1);
      item.glow
        .setPosition(pos.x, pos.y + this.th * 0.24)
        .setSize(this.tw * 0.62, this.th * 0.34)
        .setDepth(4);
    }
    const flames = new Set<string>();
    for (const b of s.blasts)
      for (const c of b.cells) {
        const key = `${b.id}:${keyOf(c)}`;
        flames.add(key);
        let flame = this.flames.get(key);
        const pos = this.project(c);
        if (!flame) {
          flame = this.add
            .sprite(0, 0, this.texture('arena-fx'), arenaFrame(`blast-${b.element}`))
            .play(arenaAnimation(`blast-${b.element}`));
          this.flames.set(key, flame);
          if (!this.suppressFeedback) {
            flame.setData('born', this.time.now);
          }
        }
        flame.setPosition(pos.x, pos.y).setDepth(100 + pos.y + 15);
        flame.setData('size', this.tw * 1.2);
        if (!flame.getData('born')) flame.setDisplaySize(this.tw * 1.2, this.tw * 1.2);
      }
    for (const [key, image] of this.flames)
      if (!flames.has(key)) {
        image.destroy();
        this.flames.delete(key);
      }
  }

  private renderHud(ctx: Ctx) {
    const s = ctx.state;
    const me = s.fighters.find((p) => p.id === ctx.me?.id);
    const focus = me ?? s.fighters[0];
    this.modeLabel.setText(
      s.mode === 'teams' ? 'Đấu đội 2v2' : s.fighters.length === 1 ? 'Luyện tập' : 'Sinh tồn đơn',
    );
    if (focus) {
      this.modeIcon.setTexture(this.texture(`portrait-${focus.element}`));
      this.portrait.setTexture(this.texture(`portrait-${focus.element}`));
      this.portraitName.setText(me ? CHARACTER[focus.element].name : 'Khán giả');
    }
    const stat = (i: number, value: string, fill: number, color: number) => {
      const row = this.stats[i];
      if (!row) return;
      const paint = `${value}:${fill}:${color}:${row.pill.x}`;
      if (row.paint === paint) return;
      row.paint = paint;
      const { width, height } = STAT_PILL;
      row.value.setText(value).setColor(i === 0 ? THEME.white : THEME.paper);
      if (i === 0) row.value.setStroke(THEME.stroke, 3);
      row.pill
        .clear()
        .setScale(this.ui)
        .fillStyle(i === 0 ? 0xffd6dc : 0xf5e6d3)
        .fillRoundedRect(-width / 2, -height / 2, width, height, height / 2)
        .fillStyle(color, fill > 0 ? 1 : 0)
        .fillRoundedRect(
          -width / 2,
          -height / 2,
          Math.max(height, width * fill),
          height,
          height / 2,
        )
        .lineStyle(2, THEME.outline, 0.5)
        .strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
    };
    if (me) {
      const live = s.bombs.filter((b) => b.owner === me.id).length;
      stat(0, `${me.hp} / 100`, me.hp / 100, 0xf0566a);
      stat(1, `${Math.max(0, me.capacity - live)} / ${me.capacity}`, 1, 0xf5e6d3);
      stat(2, `${me.range}`, 1, 0xf5e6d3);
    } else {
      stat(0, '—', 0, 0xf0566a);
      stat(1, '—', 1, 0xf5e6d3);
      stat(2, '—', 1, 0xf5e6d3);
    }
    this.roster.forEach((card, i) => {
      const p = s.fighters[i];
      card.container.setVisible(Boolean(p));
      if (!p) return;
      const name = p.id === me?.id ? 'Bạn' : p.bot ? CHARACTER[p.element].name : p.name;
      const paint = `${name}:${p.hp}:${p.element}:${s.mode}:${p.team}:${card.width}`;
      card.container.setAlpha(p.hp > 0 ? 1 : 0.55);
      if (card.paint === paint) return;
      card.paint = paint;
      card.portrait
        .setTexture(this.texture(`portrait-${p.element}`))
        .setTint(p.hp > 0 ? 0xffffff : 0x9a9a9a);
      this.fitHead(card);
      const textX = card.name.x;
      const barW = card.width / 2 - textX - 10 * this.ui;
      // Narrow cards (4:3) keep the picture and the HP bar: a cut-off name helps nobody.
      const named = barW >= 76 * this.ui;
      card.name.setVisible(named).setFontSize(Math.round(15 * this.ui));
      if (named) this.fitText(card.name, name, barW, 11);
      card.bar.setY(named ? card.height * 0.2 : 0);
      card.hp.setY(named ? card.height * 0.2 : 0);
      const barH = (named ? 18 : 22) * this.ui;
      card.bar
        .clear()
        .fillStyle(0xe9dccb)
        .fillRoundedRect(0, -barH / 2, barW, barH, barH / 2)
        .fillStyle(CHARACTER[p.element].bar)
        .fillRoundedRect(
          0,
          -barH / 2,
          Math.max(p.hp > 0 ? barH : 0, (barW * p.hp) / 100),
          barH,
          barH / 2,
        )
        .lineStyle(1.5, THEME.outline, 0.45)
        .strokeRoundedRect(0, -barH / 2, barW, barH, barH / 2);
      card.hp.setText(`${p.hp}/100`).setX(textX + barW / 2);
      card.team
        .setText(s.mode === 'teams' ? (p.team === 0 ? 'A' : 'B') : '')
        .setColor(p.team === 0 ? '#bfe0ff' : '#ffd0dc');
    });
    const overlay = this.helpPanel.visible || this.menuPanel.visible;
    this.selectPanel.setVisible(s.phase === 'select' && !overlay);
    this.resultPanel.setVisible(s.phase === 'ended' && !overlay);
    this.overlayShade.setVisible(s.phase !== 'playing' || overlay);
    const element = me?.element;
    this.selectSkill.setText(
      element ? `${ELEMENT_INFO[element].name} · ${ELEMENT_INFO[element].skill}` : '',
    );
    this.selectDescription.setText(
      element ? ELEMENT_INFO[element].description : 'Đang chờ người chơi chọn bạn nhỏ',
    );
    this.readyButton.label.setText(me?.ready ? 'Đã sẵn sàng' : 'Sẵn sàng');
    this.readyButton.enabled = Boolean(me && !me.ready);
    this.paintControl(this.readyButton);
    this.selectChoices.forEach((c, i) => {
      c.enabled = Boolean(me);
      c.selected = me?.element === ELEMENTS[i];
      this.paintControl(c);
    });
    for (const c of this.actions) {
      c.enabled = Boolean(me && me.hp > 0 && s.phase === 'playing' && !overlay);
      this.paintControl(c);
    }
    const watchers = ctx.room.watchers;
    this.menuWatchers.setText(watchers > 0 ? `${watchers} người đang xem` : '');
    if (s.phase === 'ended') {
      const won = me && s.winners.includes(me.id);
      const names = s.fighters
        .filter((p) => s.winners.includes(p.id))
        .map((p) => (p.bot ? CHARACTER[p.element].name : p.name))
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
        `${s.reason}${me ? `\n${me.kills} hạ gục · ${me.crates} thùng quà đã mở` : ''}`,
      );
      const winner =
        s.fighters.find((p) => s.winners.includes(p.id))?.element ?? me?.element ?? 'fire';
      this.resultPortrait.setTexture(this.texture(`portrait-${winner}`));
      this.resultPortrait.setScale(150 / this.resultPortrait.height);
      this.resultStars.setVisible(Boolean(won));
      const host = ctx.players.find((p) => p.id === ctx.hostId);
      const buttons = [
        ctx.room.newGame && this.newGameButton,
        ctx.room.customize && this.customizeButton,
        ctx.room.sit && this.sitButton,
      ].filter((c): c is Control => Boolean(c));
      for (const c of [this.newGameButton, this.customizeButton, this.sitButton])
        c.container.setVisible(buttons.includes(c));
      buttons.forEach((c, i) => {
        c.container.setX((i - (buttons.length - 1) / 2) * 236);
      });
      this.resultWait.setText(
        buttons.length
          ? ''
          : ctx.me
            ? `Chờ ${host ? host.name : 'chủ phòng'} mở ván mới…`
            : 'Đang xem ván đấu',
      );
    }
  }

  // ── Frame loop ─────────────────────────────────────────────────────────────────────────

  protected onUpdate(ctx: Ctx) {
    const s = ctx.state;
    const now = s.time + Math.min(100, this.time.now - this.snapshotAt);
    // Real elapsed time, not Phaser's smoothed delta: on a slow device a frame really lasts
    // longer, and the server follows this screen's position, so walking must keep real speed.
    // Movement goes cell by cell, so a long frame cannot tunnel.
    const frameAt = performance.now();
    const elapsed = Math.min(250, frameAt - (this.frameAt || frameAt));
    this.frameAt = frameAt;
    const dt = elapsed / 1000;
    this.inputElapsed += elapsed;
    if (this.direction !== 'none') this.steeredAt = this.time.now;
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
        // Steering keeps the walk going, against a wall too (walking on the spot): the player
        // sees their input taken even where the lane ends.
        const moving =
          s.phase === 'playing' &&
          !frozen &&
          (d !== DIRECTIONS.none || this.time.now - actor.lastMoved < 130);
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
    const left = s.phase === 'select' ? SELECT_TIME - s.time : MATCH_TIME - s.elapsed;
    const seconds = Math.max(0, Math.ceil(left / 1000));
    const clock = `${Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    if (this.timerLabel.text !== clock) this.timerLabel.setText(clock);
    const me = s.fighters.find((p) => p.id === ctx.me?.id);
    const status =
      s.phase === 'select'
        ? 'Chọn bạn nhỏ'
        : me?.hp === 0 && s.phase === 'playing'
          ? 'Đã bị loại · Đang theo dõi'
          : this.closingIn(s, now) !== null
            ? 'Đấu trường sắp thu hẹp!'
            : s.ring > 0 && s.phase === 'playing'
              ? 'Đấu trường đang thu hẹp!'
              : '';
    if (this.status.text !== status) this.status.setText(status);
    if (me) {
      const cds = [
        Math.max(me.nextBomb - now, 0),
        Math.max(me.skillReady - now, 0),
        Math.max(me.dashReady - now, 0),
      ];
      const totals = [400, 14000, 5000];
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
        const left = cds[i] ?? 0;
        const label = left > 500 ? `${Math.ceil(left / 1000)}s` : (ACTIONS[i]?.name ?? '');
        if (c.label.text !== label) c.label.setText(label);
        const fraction = left > 0 ? Math.min(1, left / (totals[i] ?? 1)) : 0;
        const paint = `${Math.round(fraction * 60)}:${c.width}:${i === 1 && me.skillUntil > now}`;
        if (this.cooldownPaint[i] !== paint) {
          this.cooldownPaint[i] = paint;
          const g = this.cooldowns[i];
          const r = c.width * 0.36;
          g?.clear();
          if (fraction > 0)
            g?.fillStyle(0x3b2a4a, 0.4)
              .slice(
                0,
                -c.width * 0.08,
                r,
                -Math.PI / 2,
                -Math.PI / 2 + fraction * Math.PI * 2,
                false,
              )
              .fillPath();
          if (i === 1 && me.skillUntil > now)
            g?.lineStyle(4, 0xfff1a0, 0.95).strokeCircle(0, -c.width * 0.08, r + 2);
        }
      });
    }
    const ownActor = me && this.actors.get(me.id);
    const showMarker = Boolean(me && me.hp > 0 && ownActor && s.phase !== 'ended');
    this.localMarker.setVisible(showMarker);
    if (showMarker && ownActor) {
      const pos = this.project(ownActor.position);
      const bob = Math.sin(this.time.now / 180) * this.tw * 0.05;
      this.localMarker
        .setDisplaySize(this.tw * 0.5, this.tw * 0.47)
        .setPosition(pos.x, pos.y + this.th * 0.25 - this.tw * 1.5 + bob);
    }
    this.drawWarnings(s, now);
    for (const b of s.bombs) {
      const obj = this.bombs.get(b.id);
      if (!obj) continue;
      const frozen = b.frozenUntil > now;
      const left = b.explodeAt - now;
      obj.image.anims.timeScale = frozen ? 0.2 : left < 700 ? 2.4 : 1;
      const pulse = frozen
        ? 1
        : 1 +
          Math.max(0, Math.sin(this.time.now / (left < 700 ? 45 : 110))) *
            (left < 700 ? 0.1 : 0.04);
      obj.image.setDisplaySize(this.tw * pulse, this.tw * pulse);
      obj.image.setTint(
        frozen ? 0xbfefff : left < 700 && Math.floor(this.time.now / 90) % 2 ? 0xffb0a0 : 0xffffff,
      );
    }
    for (const b of s.blasts)
      for (const c of b.cells) {
        const flame = this.flames.get(`${b.id}:${keyOf(c)}`);
        if (!flame) continue;
        const born = flame.getData('born') as number | undefined;
        const size = flame.getData('size') as number;
        const grow = born ? Math.min(1, (this.time.now - born) / 140) : 1;
        flame
          .setDisplaySize(size * (0.45 + 0.55 * grow), size * (0.45 + 0.55 * grow))
          .setAlpha(Math.min(1, (b.expires - now) / 300));
      }
    for (const [, item] of this.pickups) {
      const bob = Math.sin(this.time.now / 260 + item.phase) * this.tw * 0.05;
      item.image.setY(item.glow.y - this.th * 0.02 + bob);
    }
    for (const floater of this.floaters) {
      const elapsed = (this.time.now - floater.start) / 900;
      floater.text.setY(floater.y - elapsed * 34).setAlpha(Math.min(1, (1 - elapsed) * 2));
      if (elapsed >= 1) {
        floater.text.destroy();
        this.floaters.delete(floater);
      }
    }
  }

  /** How long until the next ring closes, when that is within the warning time; else null. */
  private closingIn(s: State, now: number) {
    const next = s.phase === 'playing' ? nextRing(s) : null;
    if (!next) return null;
    const left = next.at - (s.elapsed + (now - s.time));
    return left > 0 && left <= RING_WARNING ? left : null;
  }

  private drawWarnings(s: State, now: number) {
    this.warnings.clear();
    if (s.phase !== 'playing') return;
    const w = this.tw * 0.9;
    const h = this.th * 0.9;
    const r = Math.min(10, this.tw * 0.14);
    // The cells the arena closes next flash red, faster as the stones come.
    const closing = this.closingIn(s, now);
    const ring = nextRing(s)?.ring;
    if (closing !== null && ring) {
      const pulse = 0.45 + Math.abs(Math.sin(this.time.now / (closing < 2000 ? 90 : 180))) * 0.3;
      for (let y = 1; y < HEIGHT - 1; y++)
        for (let x = 1; x < WIDTH - 1; x++) {
          const cell = { x, y };
          if (!inRing(cell, ring) || inRing(cell, ring - 1) || tileAt(s, cell) === 'wall') continue;
          const pos = this.project(cell);
          this.warnings
            .fillStyle(0xc81e2b, pulse)
            .fillRoundedRect(pos.x - w / 2, pos.y - h / 2, w, h, r)
            .lineStyle(3, 0xffffff, 0.9)
            .strokeRoundedRect(pos.x - w / 2, pos.y - h / 2, w, h, r);
        }
    }
    for (const warning of this.warningCells) {
      const pos = this.project(warning.cell);
      const imminent = warning.start - now < 700;
      const color = warning.frozen
        ? 0x72c6dd
        : imminent
          ? 0xff5a3c
          : ELEMENT_INFO[warning.element].color;
      this.warnings
        .fillStyle(color, imminent ? 0.4 + Math.sin(this.time.now / 70) * 0.12 : 0.24)
        .fillRoundedRect(pos.x - w / 2, pos.y - h / 2, w, h, r)
        .lineStyle(2, imminent ? 0xfff0d8 : color, imminent ? 0.95 : 0.7)
        .strokeRoundedRect(pos.x - w / 2, pos.y - h / 2, w, h, r);
    }
    for (const b of s.blasts) {
      const color = b.element === 'fire' ? 0xff8a3d : ELEMENT_INFO[b.element].color;
      for (const c of b.cells) {
        const pos = this.project(c);
        this.warnings
          .fillStyle(color, 0.5 * Math.min(1, (b.expires - now) / 300))
          .fillRoundedRect(pos.x - w / 2, pos.y - h / 2, w, h, r);
      }
    }
  }

  // ── Input ──────────────────────────────────────────────────────────────────────────────

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
        if (this.menuPanel.visible) this.toggleMenu(false);
        else this.toggleHelp();
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
    const pointermove = (p: Phaser.Input.Pointer) => {
      if (this.touch.has(p.id)) this.padTouch(p);
    };
    this.input.on('pointerup', pointerup);
    this.input.on('pointerupoutside', pointerup);
    this.input.on('pointermove', pointermove);
    if (this.input.manager.pointers.length < 5)
      this.input.addPointer(4 - this.input.manager.pointers.length);
    this.events.once('shutdown', () => {
      this.releaseInput();
      keyboard?.off('keydown', keydown);
      keyboard?.off('keyup', keyup);
      this.input.off('pointerup', pointerup);
      this.input.off('pointerupoutside', pointerup);
      this.input.off('pointermove', pointermove);
      window.removeEventListener('blur', release);
      document.removeEventListener('visibilitychange', hide);
    });
  }

  /** A finger on the D-pad: its angle from the centre picks the direction. */
  private padTouch(p: Phaser.Input.Pointer) {
    if (!this.canAct()) return;
    const dx = p.worldX - this.padCenter.x;
    const dy = p.worldY - this.padCenter.y;
    const distance = Math.hypot(dx, dy);
    if (distance > this.padRadius * 1.5) {
      this.touch.delete(p.id);
    } else if (distance < this.padRadius * 0.12) {
      this.touch.set(p.id, 'none');
    } else {
      this.touch.set(
        p.id,
        Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up',
      );
    }
    this.refreshDirection();
  }

  private canAct() {
    return (
      this.ctx.state.phase === 'playing' &&
      Boolean(
        this.ctx.me && this.ctx.state.fighters.find((p) => p.id === this.ctx.me?.id && p.hp > 0),
      ) &&
      !this.helpPanel.visible &&
      !this.menuPanel.visible
    );
  }

  private refreshDirection() {
    const touched = [...this.touch.values()].filter((d) => d !== 'none').at(-1);
    this.direction = this.canAct()
      ? (touched ?? KEY_DIR[this.keys.at(-1) ?? ''] ?? 'none')
      : 'none';
    for (const k of this.pad) {
      const held = this.direction === k.dir;
      k.container.setScale(held ? 0.94 : 1).setAlpha(held ? 0.85 : 1);
    }
    if (this.direction !== this.sentDirection) this.sendDirection();
  }

  /** Where this screen shows the player, sent with their input so the server follows it. */
  private ownPosition() {
    const own = this.ctx.me && this.actors.get(this.ctx.me.id);
    if (!own) return {};
    const round = (n: number) => Math.round(n * 1000) / 1000;
    return { at: { x: round(own.position.x), y: round(own.position.y) } };
  }

  private sendDirection() {
    if (this.ctx.me && this.ctx.state.phase === 'playing')
      this.send('input', { direction: this.direction, ...this.ownPosition() });
    this.sentDirection = this.direction;
    this.inputElapsed = 0;
  }

  private releaseInput() {
    this.keys = [];
    this.touch.clear();
    for (const k of this.pad) k.container.setScale(1).setAlpha(1);
    this.direction = 'none';
    if (this.sentDirection !== 'none') this.sendDirection();
  }

  private act(action: 'bomb' | 'skill' | 'dash') {
    if (!this.canAct()) return;
    // A bomb lands on the cell the player sees themselves on.
    this.send(action, action === 'bomb' ? this.ownPosition() : {});
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
    this.menuPanel.setVisible(false);
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
