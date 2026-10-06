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
 * The board image is plain wood in a narrow walnut frame (theme.ts BOARD has the points);
 * the lines are drawn here and 楚河 漢界 is an image. Pieces are renders seen a little from
 * the front: each is drawn a little above its point and over the pieces behind it, on a
 * shadow of its own (piece-shadow) that stays on the table when the piece is lifted.
 *
 * A capture is a little scene of its own per kind of attacker (`attack`); the taken piece is
 * struck, thrown and breaks into shards of itself (shatter.ts).
 *
 * Effects (lifting, sliding, dust, captures, shakes, the check pulse and pop-up) can be turned
 * off on each device ("Hiệu ứng"); pieces then jump straight to their points. The board always
 * follows the state at once; animations only catch the pieces' looks up, one move at a time.
 */
import {
  type Button,
  type FiniteTweenConfig,
  type FlowContext,
  type FlowHandle,
  GameView,
  type ViewContext,
  type ViewEvent,
} from '@psc/sdk/client';
import Phaser from 'phaser';
import { COLS, type Move, type Options, ROWS, type Side, type View } from '../game/model.js';
import { colOf, generalOf, kindOf, legalTargets, rowOf, sideOf } from '../game/rules.js';
import { cutIn, loadBrushFont } from './cutin.js';
import { formatPlayed, ResultPanel } from './ResultPanel.js';
import { shatter } from './shatter.js';
import {
  BOARD,
  COLORS,
  DISC,
  endText,
  PIECE_HOVER,
  PIECE_TINT,
  pieceImage,
  reasonText,
  SIDES,
} from './theme.js';

type Ctx = ViewContext<View, Options>;

/** A piece on screen: its shadow on the table and, above it, the piece (lifted when moving). */
interface PieceObj {
  piece: string;
  container: Phaser.GameObjects.Container;
  shadow: Phaser.GameObjects.Image;
  image: Phaser.GameObjects.Image;
  /** Tweened by `lift` and `leap` (so `placePiece` can stop them): gaps up, and a leap's progress. */
  height: number;
  progress: number;
}

/** Pieces nearer the bottom of the screen are drawn over those behind them (+ row / 100). */
const DEPTH = {
  board: 0,
  lines: 1,
  marks: 2,
  piece: 5,
  moving: 7,
  popup: 9,
  panel: 12,
  cutIn: 15,
} as const;

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
  private playerMarks!: Phaser.GameObjects.Graphics;
  private matchInfo!: Phaser.GameObjects.Text;
  /** Per seat: the general it plays, its name and its wins, in the left column. */
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    wins: Phaser.GameObjects.Text[];
  };
  /** The column left of the board (x in the middle), for the score. */
  private leftColumn = { x: 0, width: 200, top: 0, bottom: 400, compact: false };
  private buttons!: {
    draw: Button;
    decline: Button;
    resign: Button;
    result: Button;
    effects: Button;
  };
  /** The result over the board once a game is over. */
  private panel!: ResultPanel;
  /** This game's end is on its way to the screen (queued after the last move's animation). */
  private endQueued = false;
  /** This screen saw the game being played (not just its finished board, joining late). */
  private live = false;
  private pieces = new Map<number, PieceObj>();
  /** Where point (row 0, col 0) is on screen, and the gaps between columns and rows. */
  private grid = { x0: 0, y0: 0, dx: 40, dy: 35, flip: false };
  private selected: number | null = null;
  private targets: number[] = [];
  /** The piece the mouse is over (lit when you may pick it). */
  private hovered: number | null = null;
  /** The buttons' stack in the column right of the board: its middle, bottom and sizes. */
  private buttonStack = { x: 0, bottom: 0, width: 200, height: 40 };
  /** "Đầu hàng" was tapped once: a second tap within a few seconds confirms. */
  private resignArmed = false;
  private resignTimer?: FlowHandle;
  /** This device shows effects (saved in the browser). */
  private effects = loadEffects();
  /** Taken pieces not yet knocked off the board (their move's animation hasn't run). */
  private leaving = new Set<Phaser.GameObjects.Container>();

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate() {
    loadBrushFont();
    this.pieces = new Map();
    this.leaving = new Set();
    this.endQueued = false;
    this.live = false;
    this.selected = null;
    this.targets = [];
    this.hovered = null;
    this.resignArmed = false;
    this.resignTimer = undefined;
    this.boardImage = this.sprite('board').setDepth(DEPTH.board);
    this.lines = this.add.graphics().setDepth(DEPTH.lines);
    this.river = this.sprite('river').setDepth(DEPTH.lines);
    this.marks = this.add.graphics().setDepth(DEPTH.marks);
    this.checkRing = this.add.graphics().setDepth(DEPTH.marks);
    this.zone = this.add
      .zone(0, 0, 10, 10)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => this.tap(p.worldX, p.worldY))
      .on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.hover(this.pointAt(p.worldX, p.worldY));
      })
      .on('pointerout', () => this.hover(null));
    this.status = this.label('', { size: 34 });
    this.status.setColor('#f3e6ce').setStroke('#211a14', 3);
    this.playerMarks = this.add.graphics();
    this.matchInfo = this.label('', { size: 24, color: '#cab79a' }).setStroke('#211a14', 2);
    this.score = {
      icons: [0, 1].map(() => this.sprite(pieceImage('r', 'k'))),
      names: [0, 1].map(() => this.label('', { size: 30 }).setStroke('#211a14', 3)),
      wins: [0, 1].map(() =>
        this.label('', { size: 24, color: '#cab79a' }).setStroke('#211a14', 2),
      ),
    };
    const opts = { image: 'button', size: 28 };
    this.buttons = {
      draw: this.button('Xin hoà', () => this.send('offer-draw'), opts),
      decline: this.button('Từ chối', () => this.send('decline-draw'), opts),
      resign: this.button('Đầu hàng', () => this.resign(), opts),
      result: this.button('Kết quả', () => this.showPanel(false), opts),
      effects: this.button('Hiệu ứng: Bật', () => this.toggleEffects(), { size: 24 }),
    };
    this.buttons.effects.label.setColor('#cab79a').setStroke('#211a14', 2);
    const close = this.button(
      'Xem bàn cờ',
      () => {
        this.panel.hide();
        this.showButtons(this.ctx);
      },
      opts,
    );
    this.panel = new ResultPanel(this, close, DEPTH.panel);
    this.makeDustTexture();
  }

  /**
   * Fill the free middle between the room's corner controls. A wrapped bar or the sandbox's
   * seat controls keep the board below the bar. The side rails never cover playable points.
   */
  protected onLayout(ctx: Ctx) {
    const interrupted = this.runtime.busy('turn');
    if (interrupted) this.runtime.newRound('resize');
    const { width, height, top, hud, gap } = ctx.screen;
    const margin = 12;
    const columnMin = 136 * hud + margin;
    const availW = width - 2 * columnMin;
    const fullScale = Math.min(availW / BOARD.width, (height - 2 * margin) / BOARD.height);
    const fullW = BOARD.width * fullScale;
    const fullLeft = (width - fullW) / 2;
    const fitsGap = gap && fullLeft >= gap.left + 8 && fullLeft + fullW <= gap.right - 8;
    const safeTop = fitsGap ? Math.max(margin, gap.top) : top;
    const availH = height - safeTop - margin;
    // The table image, as big as fits.
    const scale = Math.min(availW / BOARD.width, availH / BOARD.height);
    const boardW = BOARD.width * scale;
    const boardH = BOARD.height * scale;
    const cx = width / 2;
    const boardTop = safeTop + Math.max(0, (availH - boardH) / 2);
    const cy = boardTop + boardH / 2;
    const left = cx - boardW / 2;
    const columnW = left - 2 * margin;
    const grid = {
      x0: left + BOARD.x0 * scale,
      y0: boardTop + BOARD.y0 * scale,
      dx: BOARD.dx * scale,
      dy: BOARD.dy * scale,
      flip: this.mySide(ctx) === 'b',
    };
    this.grid = grid;

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

    const rightX = cx + boardW / 2 + margin + columnW / 2;
    this.status
      .setFontSize(28 * hud)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(columnW)
      .setPosition(rightX, top + 16);
    const compact = boardH < 440 * hud;
    this.leftColumn = {
      x: margin + columnW / 2,
      width: columnW,
      top: Math.max(top + 42 * hud, boardTop + boardH * 0.23),
      bottom: boardTop + boardH * 0.76,
      compact,
    };
    this.matchInfo.setFontSize(24 * hud).setPosition(this.leftColumn.x, boardTop + boardH * 0.53);
    this.layoutScore(ctx);
    this.updateMatchInfo(ctx);

    const btnH = 72 * hud;
    this.buttonStack = {
      x: rightX,
      bottom: boardTop + boardH - 8,
      width: Math.min(columnW, 210 * hud),
      height: btnH,
    };
    this.placeButtons();

    if (interrupted) {
      for (const container of this.leaving) container.destroy();
      this.leaving.clear();
      this.endQueued = false;
      this.live = false;
      this.syncPieces(ctx);
    }
    for (const [sq, obj] of this.pieces) this.placePiece(obj, sq);
    this.drawMarks(ctx);
    if (this.panel.shown) this.showPanel(false);
  }

  /** A new game: an empty board (animations still waiting are dropped), then the start sound. */
  protected onStart() {
    this.runtime.cancelLane('turn');
    for (const obj of this.pieces.values()) obj.container.destroy();
    for (const container of this.leaving) container.destroy();
    this.pieces.clear();
    this.leaving.clear();
    this.deselect();
    this.endQueued = false;
    this.live = true;
    this.panel.hide();
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
      mate: state.end?.reason === 'checkmate',
      attacker: moving.image.texture.key,
      general: generalOf(state.board, state.turn),
      myTurn: Boolean(me && !result && state.turn === this.mySide(ctx)),
      heavy: Boolean(victim && kindOf(victim.piece) === 'r'),
    };
    this.enqueue((fx, fast) => this.animateMove(fx, moving, from, to, victim ?? null, after, fast));
  }

  protected onState(ctx: Ctx) {
    const flip = this.mySide(ctx) === 'b';
    if (flip !== this.grid.flip) this.onLayout(ctx);
    this.syncPieces(ctx);
    if (this.selected !== null && !this.canPick(ctx, this.selected)) this.deselect();
    this.drawMarks(ctx);
    this.showStatus(ctx);
    this.showButtons(ctx);
    this.layoutScore(ctx);
    this.updateMatchInfo(ctx);
    if (!ctx.result) this.live = true;
    else if (!this.endQueued) {
      // After the last move's animation (it is queued already, onMove comes first).
      this.endQueued = true;
      const live = this.live;
      this.enqueue((fx) => this.presentEnd(fx, live), { move: false });
    }
  }

  protected onUpdate(ctx: Ctx) {
    this.updateMatchInfo(ctx);
  }

  private updateMatchInfo({ clock, state }: Ctx) {
    const elapsed = clock ? formatPlayed((clock.endedAt ?? Date.now()) - clock.startedAt) : '';
    const text = [elapsed, `${state.plies} nước`].filter(Boolean).join('\n');
    if (this.matchInfo.text !== text) this.matchInfo.setText(text);
  }

  // ── Board ───────────────────────────────────────────────────────────────────────────────

  protected onResync(ctx: Ctx) {
    this.runtime.cancelLane('turn');
    for (const obj of this.pieces.values()) obj.container.destroy();
    for (const obj of this.leaving) obj.destroy();
    this.pieces.clear();
    this.leaving.clear();
    this.endQueued = false;
    this.live = false;
    this.syncPieces(ctx);
    this.onState(ctx);
  }

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
    const obj = { piece, container, shadow, image, height: 0, progress: 0 };
    this.placePiece(obj, sq);
    return obj;
  }

  /** Puts a piece on its point at the current board size, at rest. */
  private placePiece(obj: PieceObj, sq: number) {
    const { x, y } = this.piecePos(sq);
    this.runtime.cancelTweens([obj, obj.container, obj.image, obj.shadow]);
    obj.container.setPosition(x, y).setScale(1).setAlpha(1).setAngle(0).setDepth(this.depthAt(sq));
    const size = (this.grid.dx * BOARD.disc) / DISC;
    obj.image.setDisplaySize(size, size).setPosition(0, 0).setTint(PIECE_TINT);
    obj.shadow.setDisplaySize(size, size).setPosition(0, 0).setAlpha(1);
    if (sq === this.selected && this.effects) this.setLift(obj, LIFT.picked);
  }

  /** Raises the piece `height` column gaps off the table (0 = standing on it). */
  private lift(fx: FlowContext, obj: PieceObj, height: number, duration = 110) {
    if (!duration) {
      this.setLift(obj, height);
      return Promise.resolve();
    }
    return this.tween(fx, {
      targets: obj,
      height,
      duration,
      ease: 'Quad.easeOut',
      onUpdate: () => this.setLift(obj, obj.height),
    });
  }

  /** The piece `height` gaps up; its shadow stays on the table, smaller and fainter. */
  private setLift(obj: PieceObj, height: number) {
    if (!obj.image.active) return;
    obj.height = height;
    const size = (this.grid.dx * BOARD.disc) / DISC;
    obj.image.setY(-height * this.grid.dx);
    obj.shadow
      .setAlpha(Math.max(0, 1 - height * 1.3))
      .setScale((size / obj.shadow.width) * Math.max(0.4, 1 - height * 0.4));
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
  private enqueue(step: (fx: FlowContext, fast: boolean) => Promise<void>, _options = {}) {
    this.runtime.run(
      async (fx) => {
        const fast = this.runtime.pending('turn') > 0;
        this.runtime.setSpeed(fast ? 2.5 : 1);
        await step(fx, fast);
        fx.checkpoint();
      },
      { lane: 'turn', onFailure: () => this.onResync(this.ctx) },
    );
    this.runtime.setSpeed(this.runtime.pending('turn') > 0 ? 2.5 : 1);
  }

  private tween(fx: FlowContext, config: FiniteTweenConfig) {
    return fx.tween(config);
  }

  /**
   * Lift, slide, set down with a thud and a puff of dust. A capture has its own scene per kind
   * of attacker (`attack`); when moves are waiting it is just a quick slide and the break.
   */
  private async animateMove(
    fx: FlowContext,
    obj: PieceObj,
    from: number,
    to: number,
    victim: PieceObj | null,
    after: AfterMove & { heavy: boolean },
    fast: boolean,
  ) {
    const end = this.piecePos(to);
    const captureSound = after.heavy ? 'xiangqi-capture-heavy' : 'xiangqi-capture';
    if (!this.effects || !obj.container.active) {
      if (obj.container.active) this.placePiece(obj, to);
      if (victim) this.gone(victim);
      this.sfx(victim ? captureSound : 'xiangqi-move');
      await this.afterMove(fx, after, false);
      fx.checkpoint();
      return;
    }
    const speed = 1;
    const a = this.shown(from);
    const b = this.shown(to);
    const distance = Math.hypot(a.row - b.row, a.col - b.col);
    const blow = { x: (b.col - a.col) / (distance || 1), y: (b.row - a.row) / (distance || 1) };
    const hit = (power: number) => {
      if (!victim) return;
      this.sfx(captureSound);
      this.hit(victim, blow, power);
    };
    obj.container.setDepth(DEPTH.moving);
    if (victim && !fast) {
      await this.attack(fx, obj, from, to, blow, hit);
      fx.checkpoint();
    } else {
      await this.lift(fx, obj, LIFT.moving, 90 * speed);
      fx.checkpoint();
      await this.tween(fx, {
        targets: obj.container,
        x: end.x,
        y: end.y,
        duration: Math.min(420, 150 + 50 * distance) * speed,
        ease: 'Sine.easeInOut',
      });
      fx.checkpoint();
      await this.lift(fx, obj, 0, 80 * speed);
      fx.checkpoint();
      if (victim) hit(1);
      else this.sfx('xiangqi-move');
    }
    if (!obj.container.active) return;
    this.settle(obj, to, speed);
    // Let the taken piece break in view before a cut-in covers the board.
    if (victim && !fast && (after.check || after.mate)) await fx.wait(450);
    fx.checkpoint();
    await this.afterMove(fx, after, !fast);
    fx.checkpoint();
  }

  /** The piece sets down on point `sq`: dust, a squash, back to its place in the rows. */
  private settle(obj: PieceObj, sq: number, speed = 1) {
    const at = this.pointXY(sq);
    this.puff(at.x, at.y);
    this.runtime.tween({
      targets: obj.container,
      scaleX: 1.06,
      scaleY: 0.92,
      duration: 70 * speed,
      yoyo: true,
    });
    obj.container.setDepth(this.depthAt(sq));
  }

  /**
   * How each kind of piece takes: the attacker ends on `to` standing
   * on the table, and `hit(power)` fires at the moment it strikes.
   */
  private async attack(
    fx: FlowContext,
    obj: PieceObj,
    from: number,
    to: number,
    blow: { x: number; y: number },
    hit: (power: number) => void,
  ) {
    const end = this.piecePos(to);
    const gap = this.grid.dx;
    const a = this.shown(from);
    const b = this.shown(to);
    const distance = Math.hypot(a.row - b.row, a.col - b.col);
    const kind = kindOf(obj.piece);
    if (kind === 'p') {
      // A short step back to wind up, then a quick shove.
      await this.tween(fx, {
        targets: obj.container,
        x: obj.container.x - blow.x * gap * 0.18,
        y: obj.container.y - blow.y * gap * 0.18,
        scaleX: 1.08,
        scaleY: 0.9,
        duration: 150,
        ease: 'Quad.easeOut',
      });
      fx.checkpoint();
      await this.leap(fx, obj, end, {
        height: 0.12,
        duration: 130,
        ease: 'Quad.easeIn',
        unsquash: true,
      });
      fx.checkpoint();
      hit(0.75);
    } else if (kind === 'a') {
      // A neat diagonal glide, spinning once.
      await this.leap(fx, obj, end, {
        height: 0.28,
        duration: 320,
        ease: 'Sine.easeInOut',
        spin: blow.x >= 0 ? 360 : -360,
      });
      fx.checkpoint();
      hit(0.85);
    } else if (kind === 'b') {
      // A big diagonal bound that grows as it rises, landing like a ram.
      await this.crouch(fx, obj, 110);
      fx.checkpoint();
      await this.leap(fx, obj, end, { height: 0.6, duration: 380, grow: 0.2, unsquash: true });
      fx.checkpoint();
      this.shockwave(to, 0.8);
      hit(1.05);
    } else if (kind === 'n') {
      // The L: a hop onto the leg point, then a leap with a somersault onto the victim.
      const leg = legPoint(from, to);
      await this.leap(fx, obj, this.piecePos(leg), { height: 0.25, duration: 170 });
      fx.checkpoint();
      await this.tween(fx, {
        targets: obj.container,
        scaleX: 1.08,
        scaleY: 0.9,
        duration: 60,
        yoyo: true,
      });
      fx.checkpoint();
      await this.leap(fx, obj, end, { height: 0.85, duration: 380, flip: true });
      fx.checkpoint();
      hit(1);
    } else if (kind === 'r') {
      // Straight in fast with a blur behind, past the point, braking back onto it.
      await this.lift(fx, obj, 0.1, 70);
      fx.checkpoint();
      const trail = this.afterimages(obj);
      fx.defer(() => trail.cancel());
      await this.tween(fx, {
        targets: obj.container,
        x: end.x,
        y: end.y,
        duration: 110 + 25 * distance,
        ease: 'Cubic.easeIn',
      });
      fx.checkpoint();
      hit(1.2);
      await this.tween(fx, {
        targets: obj.container,
        x: end.x + blow.x * gap * 0.2,
        y: end.y + blow.y * gap * 0.2,
        duration: 70,
        ease: 'Quad.easeOut',
      });
      fx.checkpoint();
      trail.cancel();
      await fx.parallel(
        async (child) => {
          await child.tween({
            targets: obj.container,
            x: end.x,
            y: end.y,
            duration: 160,
            ease: 'Back.easeOut',
          });
          child.checkpoint();
        },
        async (child) => {
          await this.lift(child, obj, 0, 120);
          child.checkpoint();
        },
      );
      fx.checkpoint();
    } else if (kind === 'c') {
      // Crouch, fly high over the screen (which jumps as it's passed), crash down.
      const screen = this.screenBetween(from, to);
      await this.crouch(fx, obj, 130);
      fx.checkpoint();
      const duration = 300 + 30 * distance;
      if (screen) this.runtime.after(duration * 0.45, () => this.jolt(screen));
      await this.leap(fx, obj, end, { height: 1.5, duration, ease: 'Quad.easeIn', unsquash: true });
      fx.checkpoint();
      this.shockwave(to, 1);
      this.cameras.main.shake(130, 0.004);
      hit(1.15);
    } else {
      // The general: rises slowly, trembling with the effort, and comes down on it.
      await this.lift(fx, obj, 0.75, 280);
      fx.checkpoint();
      this.shake(obj.image, 0.04);
      await fx.wait(200);
      fx.checkpoint();
      await this.leap(fx, obj, end, {
        height: 0.1,
        duration: 170,
        ease: 'Quad.easeIn',
        unsquash: true,
      });
      fx.checkpoint();
      this.shockwave(to, 1.3);
      this.cameras.main.shake(180, 0.006);
      hit(1.3);
      await fx.wait(60);
      fx.checkpoint();
    }
  }

  /**
   * Flies the piece to `end` on an arc `height` gaps high (starting from however high it is
   * now), optionally spinning, growing at the top, or flipping over like a coin.
   */
  private leap(
    fx: FlowContext,
    obj: PieceObj,
    end: { x: number; y: number },
    o: {
      height: number;
      duration: number;
      ease?: string;
      spin?: number;
      grow?: number;
      flip?: boolean;
      /** Ease its squash from `crouch` back out on the way. */
      unsquash?: boolean;
    },
  ) {
    const c = obj.container;
    const start = { x: c.x, y: c.y, lift: obj.height, angle: c.angle };
    const squash = { x: c.scaleX, y: c.scaleY };
    const imageScale = obj.image.scaleY;
    obj.progress = 0;
    return this.tween(fx, {
      targets: obj,
      progress: 1,
      duration: o.duration,
      ease: o.ease ?? 'Sine.easeInOut',
      onUpdate: () => {
        if (!c.active) return;
        const p = obj.progress;
        const arc = 4 * p * (1 - p);
        c.setPosition(start.x + (end.x - start.x) * p, start.y + (end.y - start.y) * p);
        this.setLift(obj, start.lift * (1 - p) + o.height * arc);
        if (o.spin) c.setAngle(start.angle + o.spin * p);
        const grow = 1 + (o.grow ?? 0) * arc;
        const back = o.unsquash ? Math.min(1, p * 3) : 0;
        c.setScale(
          grow * (squash.x + (1 - squash.x) * back),
          grow * (squash.y + (1 - squash.y) * back),
        );
        if (o.flip) {
          const turn = Math.cos(p * Math.PI * 2);
          obj.image.setScale(obj.image.scaleX, imageScale * turn);
          // Its plain underside shows darker while it's upside down.
          if (turn < 0) obj.image.setTint(0xd8cfb8);
          else obj.image.clearTint();
        }
      },
      onComplete: () => {
        if (!c.active) return;
        c.setAngle(start.angle);
        obj.image.setScale(obj.image.scaleX, imageScale).clearTint();
      },
    });
  }

  /** Squashes down before a jump. */
  private crouch(fx: FlowContext, obj: PieceObj, duration: number) {
    return this.tween(fx, {
      targets: obj.container,
      scaleX: 1.12,
      scaleY: 0.86,
      duration,
      ease: 'Quad.easeOut',
    });
  }

  /** The piece a cannon jumps over on its way from `from` to `to`. */
  private screenBetween(from: number, to: number) {
    const step = rowOf(to) === rowOf(from) ? Math.sign(to - from) : Math.sign(to - from) * COLS;
    for (let sq = from + step; sq !== to; sq += step) {
      const obj = this.pieces.get(sq);
      if (obj) return obj;
    }
    return null;
  }

  /** A piece jumps a little in its place, as if the table shook under it. */
  private jolt(obj: PieceObj) {
    if (!obj.container.active) return;
    this.runtime.tween({
      targets: obj.image,
      y: obj.image.y - this.grid.dx * 0.12,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** Fading copies of the piece left behind it while it dashes; `remove()` stops them. */
  private afterimages(obj: PieceObj) {
    let elapsed = 0;
    return this.runtime.run(async (fx) => {
      await fx.frame((delta) => {
        elapsed += delta;
        if (!obj.container.active) return true;
        if (elapsed < 28) return false;
        elapsed %= 28;
        const c = obj.container;
        const ghost = this.add
          .image(c.x, c.y + obj.image.y * c.scaleY, obj.image.texture.key)
          .setScale(obj.image.scaleX * c.scaleX, obj.image.scaleY * c.scaleY)
          .setAlpha(0.35)
          .setDepth(DEPTH.moving - 0.1);
        this.runtime.run(async (child) => {
          child.defer(() => ghost.destroy());
          await child.tween({ targets: ghost, alpha: 0, duration: 180 });
          child.checkpoint();
        });
        return false;
      });
      fx.checkpoint();
    });
  }

  /** A ring of air flattening out across the table from point `sq`. */
  private shockwave(sq: number, power: number) {
    const { x, y } = this.pointXY(sq);
    const gap = this.grid.dx;
    const ring = this.add
      .graphics()
      .setPosition(x, y)
      .setDepth(DEPTH.marks + 0.5);
    ring.lineStyle(Math.max(2, gap * 0.08), 0xfff6dc, 1).strokeEllipse(0, 0, gap, gap * 0.9);
    ring.setScale(0.5);
    this.runtime.run(async (fx) => {
      fx.defer(() => ring.destroy());
      await fx.tween({
        targets: ring,
        scale: 1.3 + power,
        alpha: 0,
        duration: 380,
        ease: 'Quad.easeOut',
      });
    });
  }

  /**
   * The taken piece is struck: it flashes white, is thrown up and along the blow, spinning,
   * and breaks into shards with the jade's crack. `power` (about 1) sets how far and how hard.
   */
  private hit(victim: PieceObj, blow: { x: number; y: number }, power: number) {
    const c = victim.container;
    if (!c.active) return;
    const gap = this.grid.dx;
    const image = victim.image;
    c.setDepth(DEPTH.popup - 1);
    image.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
    this.runtime.after(60, () => {
      if (image.active) image.setTint(PIECE_TINT).setTintMode(Phaser.TintModes.MULTIPLY);
    });
    this.runtime.tween({
      targets: victim.shadow,
      alpha: 0,
      duration: 120,
    });
    const side = Math.random() < 0.5 ? -1 : 1;
    // Along the blow and a little aside, but still over the board, so it breaks in view.
    const { x0, y0, dy } = this.grid;
    const throwTo = {
      x: Phaser.Math.Clamp(
        c.x + (blow.x - blow.y * side * 0.4) * gap * 0.55 * power,
        x0,
        x0 + gap * (COLS - 1),
      ),
      y: Phaser.Math.Clamp(
        c.y + (blow.y + blow.x * side * 0.4) * gap * 0.55 * power,
        y0 - gap * 0.1,
        y0 + dy * (ROWS - 1),
      ),
    };
    this.runtime.tween({
      targets: c,
      ...throwTo,
      angle: side * 120 * power,
      duration: 200,
      ease: 'Quad.easeOut',
    });
    this.runtime.tween({
      targets: image,
      y: -gap * 0.5 * power,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (!c.active) return this.gone(victim);
        this.sfx('xiangqi-shatter');
        shatter(this, {
          key: image.texture.key,
          x: c.x,
          y: c.y + image.y,
          size: image.displayWidth * c.scaleX,
          angle: c.angle,
          ground: c.y + BOARD.lift * gap,
          gap,
          dirX: blow.x,
          dirY: blow.y,
          power,
          depth: DEPTH.popup - 1,
        });
        this.gone(victim);
      },
    });
  }

  /**
   * After a move lands: a check or mate cut-in (then the general in check shakes), or "your
   * turn". `animate` is false when effects are off or moves are waiting to be shown.
   */
  private async afterMove(fx: FlowContext, after: AfterMove, animate: boolean) {
    if (after.check || after.mate) {
      this.sfx(after.mate ? 'xiangqi-checkmate' : 'xiangqi-check');
      if (!animate || !this.effects) return;
      const { width, height, hud } = this.ctx.screen;
      await cutIn(this, fx, {
        text: after.mate ? 'CHIẾU BÍ!' : 'CHIẾU TƯỚNG!',
        piece: after.attacker,
        width,
        height,
        hud,
        depth: DEPTH.cutIn,
      });
      fx.checkpoint();
      const general = this.pieces.get(after.general);
      if (general) this.shake(general.image, 0.07);
    } else if (after.myTurn) {
      this.runtime.after(260, () => this.sfx('xiangqi-turn'));
    }
  }

  private gone(victim: PieceObj) {
    this.leaving.delete(victim.container);
    victim.container.destroy();
  }

  /**
   * The game is over (after its last move has played out): the win jingle for the winner here,
   * the draw sound, then the result panel. `live`: this screen watched it end.
   */
  private async presentEnd(fx: FlowContext, live: boolean) {
    const ctx = this.ctx;
    const end = ctx.state.end;
    if (!ctx.result || !end) return;
    if (live) {
      if (!end.winner) this.sfx('xiangqi-draw');
      else if (end.winner === this.mySide(ctx)) this.jingle('xiangqi-victory');
      if (this.effects) await fx.wait(350);
      fx.checkpoint();
    }
    this.showPanel(live && this.effects);
  }

  /** Fills and shows the result panel over the board. */
  private showPanel(pop: boolean) {
    const ctx = this.ctx;
    const { state, clock } = ctx;
    const end = state.end;
    if (!ctx.result || !end) return;
    const mine = this.mySide(ctx);
    const winner = end.winner;
    const loser = winner === 'r' ? 'b' : 'r';
    const title = !winner
      ? 'Hoà'
      : mine
        ? winner === mine
          ? 'Chiến thắng!'
          : 'Thua rồi'
        : `${SIDES[winner].name} thắng`;
    const general = (side: Side) => this.texture(pieceImage(side, 'k'));
    // Pieces each side took: Black's pieces (lower case) were taken by Red.
    const took = (side: Side) => state.captured.filter((p) => sideOf(p) !== side).length;
    const rows: [string, string][] = [];
    if (clock)
      rows.push(['Thời gian', formatPlayed((clock.endedAt ?? Date.now()) - clock.startedAt)]);
    rows.push(['Số nước', String(state.plies)]);
    rows.push(['Quân đã ăn', `Đỏ ${took('r')} · Đen ${took('b')}`]);
    this.panel.show(
      {
        title,
        reason: reasonText(end.reason, winner ? this.nameOf(ctx, loser) : ''),
        generals: winner ? [general(winner)] : [general('r'), general('b')],
        rows,
      },
      {
        x: this.boardImage.x,
        y: this.boardImage.y,
        width: this.boardImage.displayWidth,
        hud: ctx.screen.hud,
      },
      pop,
    );
    this.showButtons(ctx);
  }

  /** A quick side-to-side wiggle of `amount` column gaps. */
  private shake(target: Phaser.GameObjects.Image, amount: number) {
    const x = target.x;
    this.runtime.cancelTweens(target);
    this.runtime.tween({
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
    dust.setActive(false);
    this.runtime.run(async (fx) => {
      fx.defer(() => dust.destroy());
      let elapsed = 0;
      await fx.frame((delta) => {
        dust.preUpdate(0, delta);
        elapsed += delta;
        return elapsed >= 500;
      });
    });
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
      if (obj && this.effects)
        this.runtime.run(async (fx) => {
          await this.lift(fx, obj, LIFT.picked);
          fx.checkpoint();
        });
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
    if (obj)
      this.runtime.run(async (fx) => {
        await this.lift(fx, obj, 0);
        fx.checkpoint();
      });
    this.selected = null;
    this.targets = [];
  }

  /** Lights the piece under the mouse when it may be picked. */
  private hover(sq: number | null) {
    const pickable = sq !== null && sq !== this.selected && this.canPick(this.ctx, sq);
    const next = pickable ? sq : null;
    if (next === this.hovered) return;
    if (this.hovered !== null) this.pieces.get(this.hovered)?.image.setTint(PIECE_TINT);
    this.hovered = next;
    if (next !== null) this.pieces.get(next)?.image.setTint(PIECE_HOVER);
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
        state.turn === mine ? `Tới lượt bạn${check}` : `Lượt ${SIDES[state.turn].name}${check}`;
      if (state.drawOffer && state.drawOffer !== mine && mine) {
        text = `${SIDES[state.drawOffer].name} xin hoà`;
      }
    }
    // Wraps in the column right of the board (onLayout).
    this.status.setText(text);
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
    const { draw, decline, resign, result, effects } = this.buttons;
    result.container.setVisible(Boolean(ctx.result && state.end && !this.panel.shown));
    draw.container.setVisible(playing && !vsBot);
    resign.container.setVisible(playing);
    decline.container.setVisible(Boolean(offered));
    draw.setText(offered ? 'Đồng ý hoà' : state.drawOffer === mine ? 'Đã xin hoà' : 'Xin hoà');
    draw.setEnabled(state.drawOffer !== mine);
    resign.setText(this.resignArmed ? 'Chắc chưa?' : 'Đầu hàng');
    effects.setText(this.effects ? 'Hiệu ứng: Bật' : 'Hiệu ứng: Tắt');
    this.placeButtons();
  }

  /**
   * The visible buttons, stacked down to the board's bottom edge; once the game is over, just
   * under the status line instead (the app's result panel takes the bottom-right corner).
   */
  private placeButtons() {
    const { x, bottom, width, height: preferredHeight } = this.buttonStack;
    const shown = Object.values(this.buttons).filter((b) => b.container.visible);
    const gap = 8;
    const available = bottom - this.status.y - this.status.height - 16;
    const height = this.ctx.result
      ? preferredHeight
      : Math.min(
          preferredHeight,
          Math.max(88, (available - (shown.length - 1) * gap) / shown.length),
        );
    const span = shown.length * height + (shown.length - 1) * gap;
    const top = this.ctx.result ? this.status.y + this.status.height + 16 : bottom - span;
    shown.forEach((b, i) => {
      b.setSize(width, height).setPosition(x, top + height / 2 + i * (height + gap));
      b.container.input?.hitArea.setTo(0, 0, width, height);
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
      this.resignTimer?.cancel();
      this.resignArmed = false;
      this.send('resign');
      return;
    }
    this.resignArmed = true;
    this.buttons.resign.setText('Chắc chưa?');
    this.resignTimer = this.runtime.after(3000, () => {
      this.resignArmed = false;
      this.buttons.resign.setText('Đầu hàng');
    });
  }

  /**
   * The two players in the left column, each beside the general it plays, with its wins: the
   * side at the top of the board above, the side at the bottom below.
   */
  private layoutScore({ players, score, state, hostId }: Ctx) {
    const { hud } = this.ctx.screen;
    const col = this.leftColumn;
    const icon = (col.compact ? 44 : 54) * hud;
    const iconX = col.compact ? col.x - col.width / 2 + icon / 2 + 8 : col.x;
    const textX = col.compact ? col.x - col.width / 2 + icon + 16 : col.x;
    const textW = col.compact ? col.width - icon - 24 : col.width - 8;
    const bottomSide: Side = this.grid.flip ? 'b' : 'r';
    this.playerMarks.clear();
    [0, 1].forEach((seat) => {
      const name = this.score.names[seat];
      const wins = this.score.wins[seat];
      const img = this.score.icons[seat];
      const player = players[seat];
      if (!name || !wins || !img) return;
      const side: Side = player ? (state.players[0] === player.id ? 'r' : 'b') : seat ? 'b' : 'r';
      const y = side === bottomSide ? col.bottom : col.top;
      img
        .setTexture(this.texture(pieceImage(side, 'k')))
        .setDisplaySize(icon / DISC, icon / DISC)
        .setPosition(iconX, y)
        .setTint(PIECE_TINT);
      const active = !state.end && state.turn === side;
      if (active) {
        this.playerMarks.lineStyle(3, 0xe5bd72, 0.95).strokeCircle(iconX, y - 3 * hud, icon * 0.57);
      }
      name
        .setFontSize(30 * hud)
        .setColor(SIDES[side].text)
        .setOrigin(col.compact ? 0 : 0.5, 0.5)
        .setPosition(textX, y + (col.compact ? -14 : 46) * hud)
        .setAlpha(active ? 1 : 0.8);
      const playerName = player ? `${player.id === hostId ? '♛ ' : ''}${player.name}` : '…';
      this.fitText(name, playerName, textW, col.compact ? 24 : 24 * hud);
      wins
        .setFontSize(24 * hud)
        .setOrigin(col.compact ? 0 : 0.5, 0.5)
        .setPosition(textX, y + (col.compact ? 16 : 75) * hud);
      const won = score.wins[seat] ?? 0;
      this.fitText(wins, col.compact ? `${won} thắng` : `Thắng ${won}`, textW, 18 * hud);
    });
  }
}

/** What the screen needs after a move lands (worked out when the move arrives). */
interface AfterMove {
  check: boolean;
  mate: boolean;
  /** Image key of the piece that moved (the cut-in shows it). */
  attacker: string;
  /** The general of the side to move (the one in check). */
  general: number;
  myTurn: boolean;
}

/** The point a horse steps over on its way (its "leg"): one step along its longer leg. */
function legPoint(from: number, to: number) {
  const dr = rowOf(to) - rowOf(from);
  const dc = colOf(to) - colOf(from);
  return Math.abs(dr) === 2 ? from + Math.sign(dr) * COLS : from + Math.sign(dc);
}

/** Effects are on unless this browser saved "off". */
function loadEffects() {
  try {
    return localStorage.getItem(EFFECTS_KEY) !== 'off';
  } catch {
    return true;
  }
}
