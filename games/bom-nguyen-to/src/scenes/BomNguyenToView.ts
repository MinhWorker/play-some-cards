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
}
interface Actor {
  sprite: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  hp: Phaser.GameObjects.Graphics;
  position: Point;
  correction: Point;
  element: Element;
}
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
    { image: Phaser.GameObjects.Image; timer: Phaser.GameObjects.Text }
  >();
  private pickups = new Map<
    string,
    { image: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }
  >();
  private flames = new Map<string, Phaser.GameObjects.Image>();
  private warnings!: Phaser.GameObjects.Graphics;
  private platform!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Text;
  private modeLabel!: Phaser.GameObjects.Text;
  private timerLabel!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private stats!: Phaser.GameObjects.Text;
  private skillName!: Phaser.GameObjects.Text;
  private portrait!: Phaser.GameObjects.Image;
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
    this.keys = [];
    this.touch = new Map();
    this.direction = 'none';
    this.sentDirection = 'none';
    this.inputElapsed = 0;
    this.snapshotAt = this.time.now;
    this.lastPhase = ctx.state.phase;
    this.previousBlast = 0;
    this.lastViewer = ctx.me?.id ?? null;
    this.backdrop = this.sprite('background').setDepth(-20);
    this.platform = this.add.graphics().setDepth(-10);
    this.warnings = this.add.graphics().setDepth(2);
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
    return this.add
      .graphics()
      .fillStyle(THEME.panel, 0.96)
      .fillRoundedRect(-width / 2, -height / 2, width, height, 18)
      .lineStyle(2, THEME.gold)
      .strokeRoundedRect(-width / 2, -height / 2, width, height, 18);
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
    const container = this.add
      .container(0, 0, [bg, label])
      .setSize(width, height)
      .setDepth(2000)
      .setInteractive({ useHandCursor: true });
    const control: Control = { container, bg, label, width, height, enabled: true };
    if (icon) {
      control.icon = this.sprite(icon);
      container.addAt(control.icon, 1);
      control.icon.setDisplaySize(height * 0.62, height * 0.62).setY(-8);
      label.setY(height * 0.33);
    }
    container.on('pointerup', () => {
      if (control.enabled) tap();
    });
    container.on('pointerover', () => this.paintControl(control, true));
    container.on('pointerout', () => this.paintControl(control));
    this.paintControl(control);
    return control;
  }
  private paintControl(c: Control, active = false, color = THEME.gold) {
    c.bg
      .clear()
      .fillStyle(active ? 0x325c64 : THEME.ink, 0.96)
      .fillRoundedRect(-c.width / 2, -c.height / 2, c.width, c.height, Math.min(22, c.height / 2))
      .lineStyle(2, color)
      .strokeRoundedRect(
        -c.width / 2,
        -c.height / 2,
        c.width,
        c.height,
        Math.min(22, c.height / 2),
      );
    c.container.setAlpha(c.enabled ? 1 : 0.5);
  }
  private createHud() {
    this.hud = this.add.container().setDepth(2000);
    this.title = this.text('Bom\nNguyên Tố', 36).setOrigin(0, 0);
    this.modeLabel = this.text('', 20).setOrigin(0, 0);
    this.timerLabel = this.text('03:00', 32);
    this.status = this.text('', 19, THEME.muted);
    this.stats = this.text('', 21).setOrigin(0, 0);
    this.skillName = this.text('', 20).setOrigin(0, 0);
    this.portrait = this.sprite('fire');
    this.hud.add([
      this.title,
      this.modeLabel,
      this.timerLabel,
      this.status,
      this.stats,
      this.skillName,
      this.portrait,
    ]);
    this.roster = Array.from({ length: 4 }, () => {
      const bg = this.panel(144, 54);
      const portrait = this.sprite('fire').setPosition(-51, -2).setDisplaySize(40, 46);
      const name = this.text('', 15).setPosition(-24, -13).setOrigin(0, 0.5);
      const hp = this.add.graphics();
      const container = this.add.container(0, 0, [bg, portrait, name, hp]);
      this.hud.add(container);
      return { container, portrait, name, hp };
    });
    this.pad = (['up', 'left', 'down', 'right'] as const).map((dir) => {
      const c = this.control('', 84, 84, () => {});
      // Filled directional icons stay crisp and separate from text glyphs.
      const arrow = this.add.graphics().fillStyle(0xe8f5ee).fillTriangle(-10, 7, 10, 7, 0, -10);
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
      return c;
    });
    this.actions = [
      this.control('Bom', 94, 98, () => this.act('bomb'), 'bomb'),
      this.control('Kỹ năng', 94, 98, () => this.act('skill'), 'blast-fire'),
      this.control('Lướt', 94, 98, () => this.act('dash'), 'blast-wind'),
    ];
    this.helpButton = this.control('Luật chơi', 112, 38, () =>
      this.helpPanel.setVisible(!this.helpPanel.visible),
    );
  }
  private createSelection() {
    this.selectPanel = this.add.container().setDepth(3000);
    const bg = this.panel(760, 360);
    this.selectTitle = this.text('Chọn nguyên tố', 36).setY(-136);
    this.selectDescription = this.text('', 22, THEME.muted).setPosition(0, 63);
    this.selectChoices = ELEMENTS.map((element, i) => {
      const c = this.control(
        ELEMENT_INFO[element].name,
        124,
        126,
        () => {
          if (this.ctx.me) this.send('choose', { element });
        },
        element,
      );
      c.container.setPosition((i - 2) * 140, -30);
      c.icon?.setDisplaySize(90, 96).setY(-12);
      c.label.setY(44);
      this.selectPanel.add(c.container);
      return c;
    });
    this.readyButton = this.control('Sẵn sàng', 240, 54, () => {
      if (this.ctx.me) this.send('ready');
    });
    this.readyButton.container.setY(124);
    this.selectPanel.addAt(bg, 0);
    this.selectPanel.add([this.selectTitle, this.selectDescription, this.readyButton.container]);
  }
  private createResult() {
    this.resultPanel = this.add.container().setDepth(3000).setVisible(false);
    this.resultText = this.text('', 32).setWordWrapWidth(530);
    this.resultPanel.add([this.panel(620, 270), this.resultText]);
  }
  private createHelp() {
    this.helpPanel = this.add.container().setDepth(4000).setVisible(false);
    const title = this.text('Luật chơi', 34).setY(-178);
    const body = this.text(
      'WASD / Phím mũi tên · Di chuyển\nSpace · Đặt bom    E · Kỹ năng    Shift · Lướt\n\nBom nổ sau 2,5 giây; vùng sáng báo phạm vi nổ.\nTường chặn lửa; thùng có thể phá và rơi vật phẩm.\nBom kích hoạt nhau; bom băng có thể trì hoãn bom.\nHồi máu +30 HP · Tầm nổ · Số bom · Tốc độ\n\nSinh tồn: người sống sót cuối cùng thắng.\n2v2: đội còn người thắng; không sát thương đồng đội.\nSau 2 phút, đấu trường thu hẹp.\nHết 3 phút: so HP còn lại; bằng nhau thì hòa.',
      21,
    ).setWordWrapWidth(600);
    this.helpClose = this.control('Đóng', 180, 46, () => this.helpPanel.setVisible(false));
    this.helpClose.container.setY(188);
    this.helpPanel.add([this.panel(690, 445), title, body, this.helpClose.container]);
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
    const s = Math.min(1, w / 1152) * (touchLayout ? 1.05 : 1);
    const small = w < 1100;
    this.title.setPosition(28, top + 13).setFontSize(small ? 27 : 34);
    this.modeLabel.setPosition(28, top + (small ? 86 : 102)).setFontSize(18);
    this.timerLabel.setPosition(w / 2, top + 22).setFontSize(30);
    this.status.setPosition(w / 2, top + 54);
    const rosterY = top + 24;
    this.roster.forEach((r, i) => {
      const offset = [-280, -140, 140, 280][i] ?? 0;
      const x = w / 2 + offset * (small ? 0.85 : 1);
      r.container.setPosition(x, rosterY).setScale(small ? 0.78 : 0.93);
    });
    const boardW = Math.min(w - (small ? 220 : touchLayout ? 310 : 280), touchLayout ? 1010 : 930);
    const boardH = available - 175;
    this.tw = Math.min(boardW / 12, boardH / 6.5);
    this.th = this.tw * 0.5;
    const cx = w / 2 + (small ? 15 : 35);
    this.ox = cx - ((WIDTH - HEIGHT) * this.tw) / 4;
    this.oy = top + 102 + (available - 175 - this.th * 12) / 2;
    this.platform.clear();
    const outline = [
      this.project({ x: -0.7, y: -0.7 }),
      this.project({ x: WIDTH - 0.3, y: -0.7 }),
      this.project({ x: WIDTH - 0.3, y: HEIGHT - 0.3 }),
      this.project({ x: -0.7, y: HEIGHT - 0.3 }),
    ];
    this.platform
      .fillStyle(0x061d2c, 0.55)
      .fillPoints(
        outline.map((p) => new Phaser.Math.Vector2(p.x, p.y + 20)),
        true,
      )
      .fillStyle(0x375c63)
      .fillPoints(
        outline.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
        true,
      )
      .lineStyle(3, THEME.gold)
      .strokePoints(
        outline.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
        true,
      );
    this.portrait
      .setPosition(83, top + 190)
      .setDisplaySize(96, 108)
      .setVisible(!small);
    this.stats.setPosition(30, top + (small ? 132 : 250)).setFontSize(small ? 18 : 21);
    this.skillName
      .setPosition(30, top + (small ? 228 : 340))
      .setFontSize(small ? 17 : 20)
      .setWordWrapWidth(small ? 136 : 165);
    const padX = 143;
    const padY = h - 144;
    const locations = [
      [0, -85],
      [-85, 0],
      [0, 85],
      [85, 0],
    ];
    this.pad.forEach((c, i) => {
      c.container
        .setPosition(padX + (locations[i]?.[0] ?? 0), padY + (locations[i]?.[1] ?? 0))
        .setScale(s);
    });
    this.actions.forEach((c, i) => {
      c.container.setPosition(w - 294 + i * 108, h - 74).setScale(s);
    });
    this.helpButton.container.setPosition(w - 81, top + 90).setScale(s);
    const overlayScale = Math.min((w - 80) / 800, (available - 28) / 460, 1.2);
    for (const panel of [this.selectPanel, this.resultPanel, this.helpPanel])
      panel.setPosition(w / 2, top + available / 2).setScale(overlayScale);
    this.renderBoard(ctx);
    this.layoutActors(ctx);
    this.renderTransient(ctx);
  }
  /** Orthographic isometric projection of world grid coordinates. */
  project(p: Point): Point {
    return { x: this.ox + ((p.x - p.y) * this.tw) / 2, y: this.oy + ((p.x + p.y) * this.th) / 2 };
  }
  private renderBoard({ state }: Ctx) {
    for (let y = 0; y < HEIGHT; y++)
      for (let x = 0; x < WIDTH; x++) {
        const p = { x, y },
          key = keyOf(p),
          pos = this.project(p),
          tile = tileAt(state, p);
        let image = this.tiles.get(key);
        if (!image) {
          image = this.sprite('tile').setOrigin(0.5, 0.4).setDepth(0);
          this.tiles.set(key, image);
        }
        image
          .setPosition(pos.x, pos.y)
          .setDisplaySize(this.tw * 1.05, this.th * 1.45)
          .setTint(tile === 'wall' ? 0x93b7b4 : 0xffffff);
        const border = x === 0 || y === 0 || x === WIDTH - 1 || y === HEIGHT - 1;
        const wanted = !border && tile !== 'floor' ? (tile === 'wall' ? 'pillar' : 'crate') : null;
        let prop = this.obstacles.get(key);
        if (!wanted) {
          prop?.destroy();
          this.obstacles.delete(key);
          continue;
        }
        if (!prop) {
          prop = this.sprite(wanted).setOrigin(0.5, 0.88);
          this.obstacles.set(key, prop);
        }
        prop
          .setTexture(this.texture(wanted))
          .setPosition(pos.x, pos.y)
          .setDisplaySize(this.tw * 0.85, this.tw * (wanted === 'pillar' ? 0.92 : 0.8))
          .setDepth(10 + pos.y);
      }
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
      }
      this.actors.clear();
      this.lastViewer = ctx.me?.id ?? null;
    }
    this.renderBoard(ctx);
    this.layoutActors(ctx);
    this.renderTransient(ctx);
    this.renderHud(ctx);
    const maxBlast = Math.max(0, ...ctx.state.blasts.map((b) => b.id));
    if (maxBlast > this.previousBlast && ctx.state.phase === 'playing') this.sfx('explode');
    this.previousBlast = maxBlast;
    if (this.lastPhase !== ctx.state.phase) {
      this.releaseInput();
      if (ctx.state.phase === 'playing') this.sfx('start');
    }
    this.lastPhase = ctx.state.phase;
  }
  private layoutActors(ctx: Ctx) {
    for (const p of ctx.state.fighters) {
      let actor = this.actors.get(p.id);
      if (!actor) {
        actor = {
          sprite: this.sprite(p.element).setOrigin(0.5, 0.95),
          shadow: this.add.ellipse(0, 0, 32, 12, 0x09232e, 0.45),
          name: this.text('', 14),
          hp: this.add.graphics(),
          position: { x: p.x, y: p.y },
          correction: { x: 0, y: 0 },
          element: p.element,
        };
        this.actors.set(p.id, actor);
      }
      if (actor.element !== p.element) {
        actor.element = p.element;
        actor.sprite.setTexture(this.texture(p.element));
      }
      if (
        Math.abs(actor.position.x - p.x) + Math.abs(actor.position.y - p.y) > 1.25 ||
        ctx.state.phase !== 'playing'
      )
        actor.position = { x: p.x, y: p.y };
      actor.correction = { x: p.x - actor.position.x, y: p.y - actor.position.y };
      actor.sprite.setDisplaySize(this.tw * 0.78, this.tw * 0.9);
      actor.name.setText(
        p.id === ctx.me?.id ? 'Bạn' : p.bot ? `Máy ${p.seat + 1}` : p.name.slice(0, 12),
      );
      for (const obj of [actor.sprite, actor.shadow, actor.hp, actor.name])
        obj.setVisible(p.hp > 0);
      this.positionActor(actor, p, ctx.state.time);
    }
  }
  private positionActor(actor: Actor, p: Fighter, now: number) {
    const pos = this.project(actor.position),
      bob =
        p.dir !== 'none' && p.frozenUntil <= now
          ? Math.sin(this.time.now / (p.element === 'wind' ? 65 : 90)) * 2.5
          : Math.sin(this.time.now / 420 + p.seat) * 0.7;
    actor.sprite.setPosition(pos.x, pos.y + bob).setDepth(pos.y + 12);
    actor.shadow
      .setPosition(pos.x, pos.y + 2)
      .setSize(this.tw * 0.54, this.th * 0.35)
      .setDepth(3);
    actor.sprite.setAngle(
      p.element === 'wind'
        ? Math.sin(this.time.now / 180) * 3
        : p.element === 'lightning' && p.dir !== 'none'
          ? Math.sin(this.time.now / 50) * 2
          : 0,
    );
    actor.sprite.setFlipX(p.facing === 'left' || p.facing === 'up');
    actor.sprite.setTint(p.frozenUntil > now ? 0xbbefff : p.stunUntil > now ? 0xb9a2ff : 0xffffff);
    actor.sprite.setAlpha(
      p.invulnerableUntil > now ? 0.55 + Math.sin(this.time.now / 45) * 0.3 : 1,
    );
    actor.name
      .setPosition(pos.x, pos.y - this.tw * 1.03)
      .setDepth(1000)
      .setColor(
        p.id === this.ctx.me?.id
          ? '#ffda89'
          : this.ctx.state.mode === 'teams'
            ? p.team === 0
              ? '#8bdcfb'
              : '#ffb0a3'
            : THEME.paper,
      );
    const barW = this.tw * 0.5;
    actor.hp
      .clear()
      .fillStyle(0x0b2530)
      .fillRoundedRect(pos.x - barW / 2, pos.y - this.tw * 0.87, barW, 4, 2)
      .fillStyle(ELEMENT_INFO[p.element].color)
      .fillRoundedRect(pos.x - barW / 2, pos.y - this.tw * 0.87, (barW * p.hp) / 100, 4, 2)
      .setDepth(1000);
  }
  private renderTransient(ctx: Ctx) {
    const s = ctx.state;
    for (const [id, b] of this.bombs)
      if (!s.bombs.some((b) => b.id === id)) {
        b.image.destroy();
        b.timer.destroy();
        this.bombs.delete(id);
      }
    for (const b of s.bombs) {
      let object = this.bombs.get(b.id);
      if (!object) {
        object = { image: this.sprite('bomb').setOrigin(0.5, 0.83), timer: this.text('', 14) };
        this.bombs.set(b.id, object);
      }
      const pos = this.project(b);
      object.image
        .setPosition(pos.x, pos.y)
        .setDisplaySize(this.tw * 0.55, this.tw * 0.6)
        .setDepth(pos.y + 11)
        .setTint(b.frozenUntil > s.time ? 0x99ddff : ELEMENT_INFO[b.element].color);
      object.timer
        .setPosition(pos.x, pos.y - this.tw * 0.62)
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
        item = { image: this.sprite('heal'), label: this.text('', 13) };
        this.pickups.set(key, item);
      }
      const pos = this.project(p);
      const icon =
        p.kind === 'heal'
          ? 'heal'
          : p.kind === 'range'
            ? 'blast-fire'
            : p.kind === 'capacity'
              ? 'bomb'
              : 'blast-wind';
      item.image
        .setTexture(this.texture(icon))
        .setPosition(pos.x, pos.y - 7)
        .setDisplaySize(this.tw * 0.42, this.tw * 0.46)
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
          flame = this.sprite(`blast-${b.element}`).setOrigin(0.5, 0.7);
          this.flames.set(key, flame);
        }
        const pos = this.project(c);
        flame
          .setPosition(pos.x, pos.y)
          .setDisplaySize(this.tw * 0.88, this.tw * 0.8)
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
        .fillStyle(0x0a1d27)
        .fillRoundedRect(-23, 1, 82, 10, 3)
        .fillStyle(ELEMENT_INFO[p.element].color)
        .fillRoundedRect(-23, 1, (82 * p.hp) / 100, 10, 3);
    });
    this.portrait.setTexture(this.texture(me?.element ?? 'fire'));
    this.stats.setText(
      me
        ? `HP   ${me.hp} / 100\nBom   ${Math.max(0, me.capacity - s.bombs.filter((b) => b.owner === me.id).length)} / ${me.capacity}\nTầm nổ   ${me.range}`
        : 'Khán giả',
    );
    this.skillName.setText(me ? ELEMENT_INFO[me.element].skill : '');
    this.actions[1]?.icon?.setTexture(this.texture(`blast-${me?.element ?? 'fire'}`));
    this.selectPanel.setVisible(s.phase === 'select');
    this.resultPanel.setVisible(s.phase === 'ended');
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
        `${s.winners.length ? (won ? 'Chiến thắng!' : s.mode === 'teams' ? `Đội ${s.fighters.find((p) => s.winners.includes(p.id))?.team === 0 ? 'A' : 'B'} chiến thắng` : `${names} chiến thắng`) : 'Hòa!'}\n${s.reason}\n\n${me ? `${me.kills} hạ gục · ${me.crates} thùng đã phá` : ''}`,
      );
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
            : 'WASD · Space · E · Shift',
    );
    if (me) {
      const cds = [
        Math.max(me.nextBomb - now, 0),
        Math.max(me.skillReady - now, 0),
        Math.max(me.dashReady - now, 0),
      ];
      this.actions.forEach((c, i) => {
        c.label.setText(
          cds[i] ? `${Math.ceil((cds[i] ?? 0) / 1000)}s` : (['Bom', 'Kỹ năng', 'Lướt'][i] ?? ''),
        );
        c.container.setAlpha(c.enabled ? (cds[i] ? 0.65 : 1) : 0.4);
      });
    }
    this.drawWarnings(s, now);
    for (const b of s.bombs) {
      const obj = this.bombs.get(b.id);
      if (!obj) continue;
      const pulse = b.explodeAt - now < 800 ? 1 + Math.sin(this.time.now / 60) * 0.08 : 1;
      obj.image.setDisplaySize(this.tw * 0.55 * pulse, this.tw * 0.6 * pulse);
      obj.timer.setText(
        b.frozenUntil > now ? '❄' : Math.max(0, (b.explodeAt - now) / 1000).toFixed(1),
      );
    }
    for (const b of s.blasts)
      for (const c of b.cells)
        this.flames.get(`${b.id}:${keyOf(c)}`)?.setAlpha(Math.min(1, (b.expires - now) / 350));
  }
  private drawWarnings(s: State, now: number) {
    this.warnings.clear();
    if (s.phase !== 'playing') return;
    const danger = dangerMap(s);
    for (const b of s.bombs) {
      for (const c of blastCells(s, b)) {
        const pos = this.project(c);
        const windows = danger.get(keyOf(c)) ?? [];
        const imminent = windows.some((w) => w.start - now < 700);
        const color =
          b.frozenUntil > now ? 0xa0efff : imminent ? 0xff6c50 : ELEMENT_INFO[b.element].color;
        const diamond = [
          { x: pos.x, y: pos.y - this.th * 0.43 },
          { x: pos.x + this.tw * 0.43, y: pos.y },
          { x: pos.x, y: pos.y + this.th * 0.43 },
          { x: pos.x - this.tw * 0.43, y: pos.y },
        ];
        this.warnings
          .fillStyle(color, imminent ? 0.32 + Math.sin(this.time.now / 70) * 0.1 : 0.13)
          .fillPoints(
            diamond.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
            true,
          )
          .lineStyle(1.5, color, imminent ? 1 : 0.6)
          .strokePoints(
            diamond.map((p) => new Phaser.Math.Vector2(p.x, p.y)),
            true,
          );
      }
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
        this.helpPanel.setVisible(!this.helpPanel.visible);
        this.releaseInput();
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
    this.direction = 'none';
    if (this.sentDirection !== 'none') this.sendDirection();
  }
  private act(action: 'bomb' | 'skill' | 'dash') {
    if (this.canAct()) {
      this.send(action);
      if (action === 'bomb') this.sfx('place');
      else this.sfx('skill');
    }
  }
  protected onStart() {
    this.releaseInput();
    this.previousBlast = 0;
  }
  protected onResync() {
    this.releaseInput();
    this.previousBlast = Math.max(0, ...this.ctx.state.blasts.map((b) => b.id));
    this.snapshotAt = this.time.now;
  }
}
