/**
 * The board, in the browser. The app calls the hooks in lifecycle order; `ctx` has the state,
 * `me`, the players, host, score, options, result and screen size.
 *
 *   onCreate  board, lines, texts and buttons       onMove   queue the move's animation
 *   onLayout  place everything (and on resize)       onState  pieces, marks, status, buttons
 *   onStart   a new game: clean board, start sound   onEnd    mate / draw / win sound
 *
 * Tap one of your pieces on your turn to see where it may go (dots; rings on pieces it can
 * take), then tap a point to move. Black's player sees the board turned round.
 *
 * The board image is plain wood in a lacquer frame (theme.ts BOARD says where the points go);
 * the lines are drawn here and 楚河 漢界 is an image. Pieces are renders seen a little from
 * the front: each is drawn a little above its point and over the pieces behind it, on a
 * shadow of its own (piece-shadow) that stays on the table when the piece is lifted.
 *
 * Effects (lifting, sliding, dust, knocks, shakes, the check pulse and pop-up) can be turned
 * off on each device ("Hiệu ứng"); pieces then jump straight to their points. The board always
 * follows the state at once; animations only catch the pieces' looks up, one move at a time.
 */
import { type Button, GameView, type ViewContext, type ViewEvent } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { COLS, type Move, type Options, ROWS, type Side, type View } from '../game/model.js';
import { colOf, generalOf, kindOf, legalTargets, rowOf, sideOf } from '../game/rules.js';
import { BOARD, COLORS, DISC, endText, pieceImage, SIDES } from './theme.js';

type Ctx = ViewContext<View, Options>;

/** A piece on screen: its shadow on the table and, above it, the piece (lifted when moving). */
interface PieceObj {
  piece: string;
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Image;
  image: Phaser.GameObjects.Image;
}

/** Pieces nearer the bottom of the screen are drawn over those behind them (+ row / 100). */
const DEPTH = { board: 0, lines: 1, marks: 2, piece: 5, moving: 7, popup: 9 } as const;

/** How high a piece rises, in column gaps: picked, and while it moves. */
const LIFT = { picked: 0.14, moving: 0.3 };

const EFFECTS_KEY = 'xiangqi.effects';
const DUST = 'xiangqi-dust';

export class XiangqiView extends GameView<View, Options> {
  private boardImage!: Phaser.GameObjects.Image;
  private lines!: Phaser.GameObjects.Graphics;
  private river!: Phaser.GameObjects.Image;
  /** Marks on the table, under the pieces: last move, selection, targets. */
  private marks!: Phaser.GameObjects.Graphics;
  /** The ring around a general in check (its own object, so it can pulse). */
  private checkRing!: Phaser.GameObjects.Graphics;
  private zone!: Phaser.GameObjects.Zone;
  private status!: Phaser.GameObjects.Text;
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    numbers: Phaser.GameObjects.Text;
  };
  private buttons!: { draw: Button; decline: Button; resign: Button; effects: Button };
  private pieces = new Map<number, PieceObj>();
  /** Where point (row 0, col 0) is on screen, and the gaps between columns and rows. */
  private grid = { x0: 0, y0: 0, dx: 40, dy: 35, flip: false };
  private selected: number | null = null;
  private targets: number[] = [];
  /** The piece the mouse is over (lit when you may pick it). */
  private hovered: number | null = null;
  /** Where the buttons sit: a row under the board, or stacked beside it (sideways phones). */
  private buttonRow = { x: 0, y: 0, width: 300, height: 40, stacked: false };
  /** "Đầu hàng" was tapped once: a second tap within a few seconds confirms. */
  private resignArmed = false;
  private resignTimer?: Phaser.Time.TimerEvent;
  /** This device shows effects (saved in the browser). */
  private effects = loadEffects();
  /** Move animations run one after another; a new game drops the ones still waiting. */
  private queue: Promise<void> = Promise.resolve();
  /** Taken pieces not yet knocked off the board (their move's animation hasn't run). */
  private leaving = new Set<Phaser.GameObjects.Container>();
  private waiting = 0;
  private generation = 0;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate() {
    this.boardImage = this.sprite('board').setDepth(DEPTH.board);
    this.lines = this.add.graphics().setDepth(DEPTH.lines);
    this.river = this.sprite('river').setDepth(DEPTH.lines);
    this.marks = this.add.graphics().setDepth(DEPTH.marks);
    this.checkRing = this.add.graphics().setDepth(DEPTH.marks);
    this.zone = this.add
      .zone(0, 0, 10, 10)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => this.tap(p.x, p.y))
      .on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.hover(this.pointAt(p.x, p.y));
      })
      .on('pointerout', () => this.hover(null));
    this.status = this.label('', { size: 34 });
    this.score = {
      icons: [0, 1].map(() => this.sprite(pieceImage('r', 'k'))),
      names: [0, 1].map(() => this.label('', { size: 24 })),
      numbers: this.label('', { size: 36 }),
    };
    this.score.names[0]?.setOrigin(1, 0.5);
    this.score.names[1]?.setOrigin(0, 0.5);
    const opts = { image: 'button', size: 24 };
    this.buttons = {
      draw: this.button('Xin hoà', () => this.send('offer-draw'), opts),
      decline: this.button('Từ chối', () => this.send('decline-draw'), opts),
      resign: this.button('Đầu hàng', () => this.resign(), opts),
      effects: this.button('', () => this.toggleEffects(), opts),
    };
    this.makeDustTexture();
  }

  protected onLayout(ctx: Ctx) {
    const { width, height, top, hud } = ctx.screen;
    const sideways = width > height && height < 500;
    const scoreH = 44 * hud;
    const statusH = 46 * hud;
    const bottom = sideways ? 12 : 120 * hud;
    const sideRoom = sideways ? 180 * hud : 0;
    const availW = width - 8 - sideRoom;
    const availH = height - top - scoreH - statusH - bottom;
    // The table image, as big as fits.
    const scale = Math.min(availW / BOARD.width, availH / BOARD.height);
    const boardW = BOARD.width * scale;
    const boardH = BOARD.height * scale;
    const cx = (width - sideRoom) / 2;
    const boardTop = top + scoreH + statusH + Math.max(0, (availH - boardH) / 2);
    const cy = boardTop + boardH / 2;
    const left = cx - boardW / 2;
    const grid = {
      x0: left + BOARD.x0 * scale,
      y0: boardTop + BOARD.y0 * scale,
      dx: BOARD.dx * scale,
      dy: BOARD.dy * scale,
      flip: this.mySide(ctx) === 'b',
    };
    this.grid = grid;
    const cell = grid.dx;

    this.boardImage.setPosition(cx, cy).setDisplaySize(boardW, boardH);
    this.drawLines();
    // 楚河 漢界: the image spans the 8 column gaps, on the river.
    const riverW = grid.dx * (COLS - 1);
    this.river
      .setPosition(grid.x0 + riverW / 2, grid.y0 + grid.dy * 4.5)
      .setDisplaySize(riverW, (riverW * this.river.height) / this.river.width);
    // Taps anywhere within half a gap of the outer points.
    const zoneW = grid.dx * COLS;
    const zoneH = grid.dy * ROWS;
    this.zone.setPosition(
      grid.x0 + (grid.dx * (COLS - 1)) / 2,
      grid.y0 + (grid.dy * (ROWS - 1)) / 2,
    );
    this.zone.setSize(zoneW, zoneH);
    this.zone.input?.hitArea.setTo(0, 0, zoneW, zoneH);
    this.status.setFontSize(Math.min(34, Math.max(20, cell * 0.5)) * hud);
    this.status.setPosition(cx, boardTop - statusH / 2);
    this.layoutScore(ctx, cx, top + scoreH / 2, hud);

    const btnH = 46 * hud;
    this.buttonRow = sideways
      ? {
          x: cx + boardW / 2 + sideRoom / 2,
          y: cy,
          width: sideRoom - 16,
          height: btnH,
          stacked: true,
        }
      : {
          x: cx,
          y: boardTop + boardH + 12 * hud + btnH / 2,
          width: availW - 16,
          height: btnH,
          stacked: false,
        };
    this.placeButtons();

    for (const [sq, obj] of this.pieces) this.placePiece(obj, sq);
    this.drawMarks(ctx);
  }

  /** A new game: an empty board (animations still waiting are dropped), then the start sound. */
  protected onStart() {
    this.generation++;
    this.queue = Promise.resolve();
    this.waiting = 0;
    for (const obj of this.pieces.values()) obj.container.destroy();
    for (const container of this.leaving) container.destroy();
    this.pieces.clear();
    this.leaving.clear();
    this.deselect();
    this.sfx('xiangqi-start');
  }

  /**
   * A move was played. The pieces map follows it at once (onState relies on it); the pieces'
   * looks catch up in the animation queue.
   */
  protected onMove(ctx: Ctx, event: ViewEvent<Move>) {
    const { from, to } = event.payload;
    const moving = this.pieces.get(from);
    const victim = this.pieces.get(to);
    this.selected = null;
    this.targets = [];
    if (!moving) return; // onState draws whatever is missing
    this.pieces.delete(from);
    this.pieces.set(to, moving);
    if (victim) this.leaving.add(victim.container);
    const { state, result, me } = ctx;
    const after = {
      check: Boolean(state.check && !result),
      general: generalOf(state.board, state.turn),
      myTurn: Boolean(me && !result && state.turn === this.mySide(ctx)),
      heavy: Boolean(victim && kindOf(victim.piece) === 'r'),
    };
    this.enqueue((fast) => this.animateMove(moving, from, to, victim ?? null, after, fast));
  }

  protected onState(ctx: Ctx) {
    const flip = this.mySide(ctx) === 'b';
    if (flip !== this.grid.flip) this.onLayout(ctx);
    this.syncPieces(ctx);
    if (this.selected !== null && !this.canPick(ctx, this.selected)) this.deselect();
    this.drawMarks(ctx);
    this.showStatus(ctx);
    this.showButtons(ctx);
    this.layoutScore(ctx, ...this.scoreRow());
  }

  protected onEnd(ctx: Ctx) {
    const { end } = ctx.state;
    if (!end) return;
    if (!end.winner) this.sfx('xiangqi-draw');
    else if (end.reason === 'checkmate') this.sfx('xiangqi-checkmate');
    else if (end.winner === this.mySide(ctx)) this.sfx('xiangqi-game-win');
  }

  // ── Board ───────────────────────────────────────────────────────────────────────────────

  private mySide({ me, state }: Ctx): Side | null {
    if (!me) return null;
    return state.players[0] === me.id ? 'r' : state.players[1] === me.id ? 'b' : null;
  }

  /** Row and column as drawn (Black's player sees the board turned round). */
  private shown(sq: number) {
    const { flip } = this.grid;
    return {
      row: flip ? ROWS - 1 - rowOf(sq) : rowOf(sq),
      col: flip ? COLS - 1 - colOf(sq) : colOf(sq),
    };
  }

  /** Screen position of a point on the table. */
  private pointXY(sq: number) {
    const { x0, y0, dx, dy } = this.grid;
    const { row, col } = this.shown(sq);
    return { x: x0 + col * dx, y: y0 + row * dy };
  }

  /** Where a piece standing on a point is drawn (its center is above the table). */
  private piecePos(sq: number) {
    const { x, y } = this.pointXY(sq);
    return { x, y: y - BOARD.lift * this.grid.dx };
  }

  private depthAt(sq: number) {
    return DEPTH.piece + this.shown(sq).row / 100;
  }

  /** The point nearest to a screen position (a tap on a piece's face counts for its point). */
  private pointAt(x: number, y: number) {
    const { x0, y0, dx, dy, flip } = this.grid;
    let col = Math.round((x - x0) / dx);
    let row = Math.round((y + BOARD.lift * dx - y0) / dy);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
    if (flip) {
      col = COLS - 1 - col;
      row = ROWS - 1 - row;
    }
    return row * COLS + col;
  }

  /** The board's lines: files broken at the river, ranks, palaces, a border, point marks. */
  private drawLines() {
    const { x0, y0, dx, dy } = this.grid;
    const g = this.lines.clear();
    const w = Math.max(1.5, dx * 0.045);
    const x = (col: number) => x0 + col * dx;
    const y = (row: number) => y0 + row * dy;
    g.lineStyle(w, COLORS.line, 1);
    for (let row = 0; row < ROWS; row++) g.lineBetween(x(0), y(row), x(COLS - 1), y(row));
    for (let col = 0; col < COLS; col++) {
      if (col === 0 || col === COLS - 1) g.lineBetween(x(col), y(0), x(col), y(ROWS - 1));
      else {
        g.lineBetween(x(col), y(0), x(col), y(4));
        g.lineBetween(x(col), y(5), x(col), y(ROWS - 1));
      }
    }
    for (const [a, b] of [
      [0, 2],
      [7, 9],
    ] as const) {
      g.lineBetween(x(3), y(a), x(5), y(b));
      g.lineBetween(x(5), y(a), x(3), y(b));
    }
    const out = 0.2;
    g.lineStyle(w * 2, COLORS.line, 1);
    g.strokeRect(x(-out), y(-out), dx * (COLS - 1 + 2 * out), dy * (ROWS - 1 + 2 * out));
    // Where cannons and soldiers start: four small corners around the point.
    g.lineStyle(w * 0.8, COLORS.line, 1);
    const gap = 0.1;
    const arm = 0.22;
    const marks = [
      [2, 1],
      [2, 7],
      [7, 1],
      [7, 7],
      ...[3, 6].flatMap((row) => [0, 2, 4, 6, 8].map((col) => [row, col])),
    ];
    for (const [row = 0, col = 0] of marks) {
      for (const sx of [-1, 1]) {
        if ((col === 0 && sx < 0) || (col === COLS - 1 && sx > 0)) continue;
        for (const sy of [-1, 1]) {
          const cx = x(col + sx * gap);
          const cy = y(row + sy * gap);
          g.lineBetween(cx, cy, x(col + sx * (gap + arm)), cy);
          g.lineBetween(cx, cy, cx, y(row + sy * (gap + arm)));
        }
      }
    }
  }

  /** Makes the screen match the state: pieces appear or go without animation. */
  private syncPieces({ state }: Ctx) {
    for (const [sq, obj] of this.pieces) {
      if (state.board[sq] !== obj.piece) {
        obj.container.destroy();
        this.pieces.delete(sq);
      }
    }
    state.board.forEach((piece, sq) => {
      if (piece && !this.pieces.has(sq)) this.pieces.set(sq, this.makePiece(piece, sq));
    });
  }

  private makePiece(piece: string, sq: number): PieceObj {
    const shadow = this.sprite('piece-shadow');
    const image = this.sprite(pieceImage(sideOf(piece), kindOf(piece)));
    const container = this.add.container(0, 0, [shadow, image]);
    const obj = { piece, container, shadow, image };
    this.placePiece(obj, sq);
    return obj;
  }

  /** Puts a piece on its point at the current board size, at rest. */
  private placePiece(obj: PieceObj, sq: number) {
    const { x, y } = this.piecePos(sq);
    this.tweens.killTweensOf([obj.container, obj.image, obj.shadow]);
    obj.container.setPosition(x, y).setScale(1).setAlpha(1).setAngle(0).setDepth(this.depthAt(sq));
    const size = (this.grid.dx * BOARD.disc) / DISC;
    obj.image.setDisplaySize(size, size).setPosition(0, 0);
    obj.shadow.setDisplaySize(size, size).setPosition(0, 0).setAlpha(1);
    if (sq === this.selected && this.effects) this.lift(obj, LIFT.picked, 0);
  }

  /** Raises the piece `height` column gaps off the table (0 = standing on it). */
  private lift(obj: PieceObj, height: number, duration = 110) {
    const size = (this.grid.dx * BOARD.disc) / DISC;
    const shadowScale = (size / obj.shadow.width) * (1 - height * 0.4);
    const to = {
      image: { y: -height * this.grid.dx },
      shadow: { alpha: 1 - height * 1.3, scaleX: shadowScale, scaleY: shadowScale },
    };
    if (!duration) {
      obj.image.setY(to.image.y);
      obj.shadow.setAlpha(to.shadow.alpha).setScale(shadowScale);
      return Promise.resolve();
    }
    return Promise.all([
      this.tween({ targets: obj.image, ...to.image, duration, ease: 'Quad.easeOut' }),
      this.tween({ targets: obj.shadow, ...to.shadow, duration, ease: 'Quad.easeOut' }),
    ]).then(() => undefined);
  }

  /**
   * Marks on the table, under the pieces: the last move, the picked piece and where it may go
   * (dots; rings around pieces it can take). The check ring is `showCheck`'s.
   */
  private drawMarks(ctx: Ctx) {
    const { state } = ctx;
    const { dx, dy } = this.grid;
    const flat = dy / dx;
    const g = this.marks.clear();
    const disc = (sq: number, r: number, color: number, alpha: number) => {
      const at = this.pointXY(sq);
      g.fillStyle(color, alpha).fillEllipse(at.x, at.y, 2 * r * dx, 2 * r * dx * flat);
    };
    if (state.last) {
      disc(state.last.from, 0.22, COLORS.last, 0.45);
      disc(state.last.to, 0.6, COLORS.last, 0.55);
    }
    if (this.selected !== null) disc(this.selected, 0.62, COLORS.selected, 0.75);
    for (const sq of this.targets) {
      if (!state.board[sq]) {
        disc(sq, 0.15, COLORS.target, 0.9);
        continue;
      }
      const at = this.pointXY(sq);
      g.lineStyle(Math.max(2, 0.08 * dx), COLORS.target, 1);
      g.strokeEllipse(at.x, at.y, 1.2 * dx, 1.2 * dx * flat);
    }
    this.showCheck(state.check && !ctx.result ? generalOf(state.board, state.turn) : -1);
  }

  /** The red ring around the general in check (`-1`: none). It pulses when effects are on. */
  private showCheck(general: number) {
    const ring = this.checkRing.clear();
    this.tweens.killTweensOf(ring);
    ring.setAlpha(1);
    if (general < 0) return;
    const { dx, dy } = this.grid;
    const at = this.pointXY(general);
    ring.lineStyle(Math.max(2, 0.1 * dx), COLORS.check, 1);
    ring.strokeEllipse(at.x, at.y, 1.24 * dx, 1.24 * dy);
    if (this.effects) {
      this.tweens.add({ targets: ring, alpha: 0.3, duration: 480, yoyo: true, repeat: -1 });
    }
  }

  // ── Animations ──────────────────────────────────────────────────────────────────────────

  /**
   * Runs `step` after the animations before it. `fast` is true when more moves are waiting:
   * the step then hurries, so the board never lags behind the game.
   */
  private enqueue(step: (fast: boolean) => Promise<void>) {
    const generation = this.generation;
    this.waiting++;
    this.queue = this.queue
      .then(async () => {
        this.waiting--;
        if (generation === this.generation) await step(this.waiting > 0);
      })
      .catch((err) => console.error(err));
  }

  /** A tween as a promise; it also settles if the tween is stopped (resize, new game). */
  private tween(config: Phaser.Types.Tweens.TweenBuilderConfig) {
    return new Promise<void>((resolve) => {
      const duration = Number(config.duration ?? 300) + Number(config.delay ?? 0);
      const timer = setTimeout(resolve, duration + 250);
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      this.tweens.add({ ...config, onComplete: done, onStop: done });
    });
  }

  /** Lift, slide, set down with a thud and a puff of dust; a taken piece is knocked away. */
  private async animateMove(
    obj: PieceObj,
    from: number,
    to: number,
    victim: PieceObj | null,
    after: { check: boolean; general: number; myTurn: boolean; heavy: boolean },
    fast: boolean,
  ) {
    const end = this.piecePos(to);
    const land = () => {
      this.sfx(
        victim ? (after.heavy ? 'xiangqi-capture-heavy' : 'xiangqi-capture') : 'xiangqi-move',
      );
    };
    if (!this.effects || !obj.container.active) {
      if (obj.container.active) this.placePiece(obj, to);
      if (victim) this.gone(victim);
      land();
      this.afterMove(after);
      return;
    }
    const speed = fast ? 0.4 : 1;
    const a = this.shown(from);
    const b = this.shown(to);
    const distance = Math.hypot(a.row - b.row, a.col - b.col);
    obj.container.setDepth(DEPTH.moving);
    await this.lift(obj, LIFT.moving, 90 * speed);
    await this.tween({
      targets: obj.container,
      x: end.x,
      y: end.y,
      duration: Math.min(420, 150 + 50 * distance) * speed,
      ease: 'Sine.easeInOut',
    });
    await this.lift(obj, 0, 80 * speed);
    if (!obj.container.active) return;
    land();
    const at = this.pointXY(to);
    this.puff(at.x, at.y);
    this.tweens.add({
      targets: obj.container,
      scaleX: 1.06,
      scaleY: 0.92,
      duration: 70 * speed,
      yoyo: true,
    });
    if (victim)
      this.knock(victim, (b.col - a.col) / (distance || 1), (b.row - a.row) / (distance || 1));
    obj.container.setDepth(this.depthAt(to));
    this.afterMove(after, true);
  }

  /** After a move lands: the check's shake and pop-up, or "your turn". */
  private afterMove(after: { check: boolean; general: number; myTurn: boolean }, animate = false) {
    if (after.check) {
      this.time.delayedCall(120, () => this.sfx('xiangqi-check'));
      if (animate && this.effects) this.announceCheck(after.general);
    } else if (after.myTurn) {
      this.time.delayedCall(260, () => this.sfx('xiangqi-turn'));
    }
  }

  private gone(victim: PieceObj) {
    this.leaving.delete(victim.container);
    victim.container.destroy();
  }

  /** The taken piece flies off the way the attacker came, spinning, and fades. */
  private knock(victim: PieceObj, dirCol: number, dirRow: number) {
    const { dx, dy } = this.grid;
    const c = victim.container;
    if (!c.active) return;
    c.setDepth(DEPTH.moving - 0.5);
    victim.shadow.setVisible(false);
    this.tweens.add({
      targets: c,
      x: c.x + dirCol * dx * 1.1,
      y: c.y + dirRow * dy * 1.1 - dy * 0.5,
      angle: (dirCol >= 0 ? 1 : -1) * 150,
      scale: 0.8,
      alpha: 0,
      duration: 360,
      ease: 'Quad.easeOut',
      onComplete: () => this.gone(victim),
    });
  }

  /** The general in check shakes, and "Chiếu!" pops up over it. */
  private announceCheck(general: number) {
    const obj = this.pieces.get(general);
    if (!obj) return;
    this.shake(obj.image, 0.07);
    const { x, y } = this.piecePos(general);
    const { dx } = this.grid;
    const text = this.label('Chiếu!', { size: 40, color: '#ff5a4f' })
      .setFontSize(Math.max(18, dx * 0.6))
      .setPosition(x, y - dx * 0.7)
      .setDepth(DEPTH.popup)
      .setScale(0.3);
    this.tweens.chain({
      targets: text,
      tweens: [
        { scale: 1.15, duration: 160, ease: 'Back.easeOut' },
        { scale: 1, duration: 90 },
        { y: text.y - dx * 0.35, alpha: 0, delay: 650, duration: 300 },
      ],
      onComplete: () => text.destroy(),
    });
  }

  /** A quick side-to-side wiggle of `amount` column gaps. */
  private shake(target: Phaser.GameObjects.Image, amount: number) {
    const x = target.x;
    this.tweens.killTweensOf(target);
    this.tweens.add({
      targets: target,
      x: x + amount * this.grid.dx,
      duration: 45,
      yoyo: true,
      repeat: 3,
      ease: 'Sine.easeInOut',
      onComplete: () => target.setX(x),
    });
  }

  /** A soft round blob to make dust from, drawn once. */
  private makeDustTexture() {
    if (this.textures.exists(DUST)) return;
    const g = this.make.graphics({}, false);
    for (let r = 16; r > 0; r -= 2) g.fillStyle(0xffffff, 0.12).fillCircle(16, 16, r);
    g.generateTexture(DUST, 32, 32);
    g.destroy();
  }

  /** A little dust kicked up around a piece set down at (x, y). */
  private puff(x: number, y: number) {
    const { dx } = this.grid;
    const dust = this.add
      .particles(x, y, DUST, {
        lifespan: 420,
        speedX: { min: -dx * 1.4, max: dx * 1.4 },
        speedY: { min: -dx * 0.5, max: dx * 0.3 },
        scale: { start: dx / 140, end: dx / 55 },
        alpha: { start: 0.7, end: 0 },
        tint: 0xf1dcae,
        emitting: false,
      })
      .setDepth(this.depthAt(0) - 0.5);
    dust.explode(10);
    this.time.delayedCall(500, () => dust.destroy());
  }

  // ── Taps ────────────────────────────────────────────────────────────────────────────────

  private canPick(ctx: Ctx, sq: number) {
    const piece = ctx.state.board[sq];
    const side = this.mySide(ctx);
    return Boolean(piece && !ctx.result && side === ctx.state.turn && sideOf(piece) === side);
  }

  /**
   * A tap on the board: pick one of your pieces, move the picked one to a marked point, or
   * (tapping somewhere it can't go) shake it with the "no" sound. Tapping it again drops it.
   */
  private tap(x: number, y: number) {
    const ctx = this.ctx;
    const sq = this.pointAt(x, y);
    if (sq === null) return;
    if (this.selected !== null && this.targets.includes(sq)) {
      // The piece stays lifted: its move's animation carries on from there.
      this.send('move', { from: this.selected, to: sq });
      this.selected = null;
      this.targets = [];
    } else if (sq === this.selected) {
      this.deselect();
    } else if (this.canPick(ctx, sq)) {
      this.deselect();
      this.selected = sq;
      this.targets = legalTargets(ctx.state.board, sq);
      this.hover(null);
      const obj = this.pieces.get(sq);
      if (obj && this.effects) void this.lift(obj, LIFT.picked);
      this.sfx('xiangqi-piece-select');
    } else if (this.selected !== null) {
      const obj = this.pieces.get(this.selected);
      if (obj && this.effects) this.shake(obj.image, 0.06);
      this.sfx('xiangqi-illegal');
    }
    this.drawMarks(ctx);
  }

  /** Drops the picked piece back onto the table. */
  private deselect() {
    const obj = this.selected === null ? null : this.pieces.get(this.selected);
    if (obj) void this.lift(obj, 0);
    this.selected = null;
    this.targets = [];
  }

  /** Lights the piece under the mouse when it may be picked. */
  private hover(sq: number | null) {
    const pickable = sq !== null && sq !== this.selected && this.canPick(this.ctx, sq);
    const next = pickable ? sq : null;
    if (next === this.hovered) return;
    if (this.hovered !== null) this.pieces.get(this.hovered)?.image.clearTint();
    this.hovered = next;
    if (next !== null) this.pieces.get(next)?.image.setTint(0xfff3d0);
  }

  // ── Status, score and buttons ───────────────────────────────────────────────────────────

  private nameOf(ctx: Ctx, side: Side) {
    const id = ctx.state.players[side === 'r' ? 0 : 1];
    if (id === ctx.me?.id) return 'Bạn';
    return ctx.players.find((p) => p.id === id)?.name ?? SIDES[side].name;
  }

  private showStatus(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    let text: string;
    if (state.end) {
      const winner = state.end.winner;
      const loser = winner === 'r' ? 'b' : 'r';
      text = endText(
        state.end.reason,
        winner ? this.nameOf(ctx, winner) : '',
        winner ? this.nameOf(ctx, loser) : '',
      );
    } else {
      const check = state.check ? ' · Chiếu tướng!' : '';
      text =
        state.turn === mine
          ? `Tới lượt bạn${check}`
          : `Lượt ${SIDES[state.turn].name} · ${this.nameOf(ctx, state.turn)}${check}`;
      if (state.drawOffer && state.drawOffer !== mine && mine) {
        text = `${this.nameOf(ctx, state.drawOffer)} xin hoà`;
      }
    }
    const size = Number.parseFloat(String(this.status.style.fontSize));
    this.fitText(this.status, text, this.scale.width - 24, size * 0.6);
  }

  /**
   * Game buttons for seated players while the game is on ("Từ chối" only when the other side
   * offered a draw); "Hiệu ứng" for everyone, always.
   */
  private showButtons(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    const playing = Boolean(mine && !state.end && !ctx.result);
    const offered = playing && state.drawOffer && state.drawOffer !== mine;
    // The computer never takes a draw: no point offering one.
    const vsBot = ctx.players.some((p) => p.bot);
    const { draw, decline, resign, effects } = this.buttons;
    draw.container.setVisible(playing && !vsBot);
    resign.container.setVisible(playing);
    decline.container.setVisible(Boolean(offered));
    draw.setText(offered ? 'Đồng ý hoà' : state.drawOffer === mine ? 'Đã xin hoà' : 'Xin hoà');
    draw.setEnabled(state.drawOffer !== mine);
    resign.setText(this.resignArmed ? 'Chắc chưa?' : 'Đầu hàng');
    effects.setText(this.effects ? 'Hiệu ứng: Bật' : 'Hiệu ứng: Tắt');
    this.placeButtons();
  }

  /** The visible buttons, sharing their row (or stack) evenly. */
  private placeButtons() {
    const row = this.buttonRow;
    const shown = Object.values(this.buttons).filter((b) => b.container.visible);
    const gap = 8;
    if (row.stacked) {
      shown.forEach((b, i) => {
        b.setSize(row.width, row.height);
        b.setPosition(row.x, row.y + (i - (shown.length - 1) / 2) * (row.height + gap));
      });
      return;
    }
    const hud = this.ctx.screen.hud;
    const width = Math.min(150 * hud, (row.width - gap * (shown.length - 1)) / shown.length);
    shown.forEach((b, i) => {
      b.setSize(width, row.height);
      b.setPosition(row.x + (i - (shown.length - 1) / 2) * (width + gap), row.y);
    });
  }

  /** Effects on or off on this device, remembered in the browser. */
  private toggleEffects() {
    this.effects = !this.effects;
    try {
      localStorage.setItem(EFFECTS_KEY, this.effects ? 'on' : 'off');
    } catch {
      // Private mode or storage blocked: it still applies until the page closes.
    }
    for (const [sq, obj] of this.pieces) this.placePiece(obj, sq);
    this.drawMarks(this.ctx);
    this.showButtons(this.ctx);
  }

  private resign() {
    if (this.resignArmed) {
      this.resignTimer?.remove();
      this.resignArmed = false;
      this.send('resign');
      return;
    }
    this.resignArmed = true;
    this.buttons.resign.setText('Chắc chưa?');
    this.resignTimer = this.time.delayedCall(3000, () => {
      this.resignArmed = false;
      this.buttons.resign.setText('Đầu hàng');
    });
  }

  private scoreRow(): [number, number, number] {
    const { grid } = this;
    const cx = grid.x0 + (grid.dx * (COLS - 1)) / 2;
    const { top, hud } = this.ctx.screen;
    return [cx, top + (44 * hud) / 2, hud];
  }

  /** Seat 0 left, score, seat 1 right, each with the color it plays: [Đỏ] Minh 1 – 0 Lan [Đen]. */
  private layoutScore({ players, score, state }: Ctx, cx: number, y: number, hud: number) {
    const font = 22 * hud;
    const icon = font * 1.6;
    this.score.numbers
      .setText(`${score.wins[0] ?? 0}  –  ${score.wins[1] ?? 0}`)
      .setFontSize(font * 1.4)
      .setPosition(cx, y);
    const half = this.score.numbers.width / 2 + font * 0.6;
    const nameWidth = this.scale.width / 2 - 12 - half - font * 0.4 - icon;
    [0, 1].forEach((seat) => {
      const name = this.score.names[seat];
      const img = this.score.icons[seat];
      const player = players[seat];
      if (!name || !img) return;
      const side: Side = player ? (state.players[0] === player.id ? 'r' : 'b') : seat ? 'b' : 'r';
      const dir = seat === 0 ? -1 : 1;
      name
        .setFontSize(font)
        .setColor(SIDES[side].text)
        .setPosition(cx + dir * half, y);
      this.fitText(name, player ? player.name : '…', nameWidth);
      img
        .setTexture(this.texture(pieceImage(side, 'k')))
        .setDisplaySize(icon / DISC, icon / DISC)
        .setPosition(cx + dir * (half + name.width + font * 0.4 + icon / 2), y);
    });
  }
}

/** Effects are on unless this browser saved "off". */
function loadEffects() {
  try {
    return localStorage.getItem(EFFECTS_KEY) !== 'off';
  } catch {
    return true;
  }
}
