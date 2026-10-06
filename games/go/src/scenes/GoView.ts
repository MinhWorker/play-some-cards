/**
 * The board, in the browser. The app calls the hooks in lifecycle order; `ctx` has the state,
 * `me`, the players, host, score, options, result and screen size.
 *
 *   onCreate  board, stones' looks, texts, buttons   onState  stones, marks, status, buttons
 *   onLayout  place everything (and on resize)      onStart  a new game: clean board
 *
 * On your turn tap an empty point to play there ("Bỏ lượt" passes). After two passes the
 * count starts: the dead stones are marked (faded, with the points each side gets shown as
 * small squares); tap a chain to mark it dead or alive, "Đồng ý" to agree, "Đánh tiếp" to play
 * on instead.
 *
 * Blender renders the wood and polished stones; grid, shadows and marks remain code-native.
 */
import { type Button, type FlowHandle, GameView, type ViewContext } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { BOARD_SIZE, KOMI, type Options, type Side, type View } from '../game/model.js';
import { colOf, place, rowOf, score, starPoints } from '../game/rules.js';
import { ResultPanel } from './ResultPanel.js';
import { StoneBowl } from './StoneBowl.js';

type Ctx = ViewContext<View, Options>;

const DEPTH = { board: 0, lines: 1, shadow: 1.5, stone: 2, marks: 3, ghost: 4 } as const;

const COLORS = {
  line: 0x3b2a14,
  last: 0xe0463a,
  black: 0x1b1b1b,
  white: 0xf5f2ea,
} as const;

const SIDES: Record<Side, { name: string; art: string }> = {
  b: { name: 'Đen', art: 'black' },
  w: { name: 'Trắng', art: 'white' },
};

/** 7.5 → "7,5" (Vietnamese decimals). */
const num = (n: number) => String(n).replace('.', ',');

interface StoneObj {
  side: Side;
  image: Phaser.GameObjects.Image;
}

export class GoView extends GameView<View, Options> {
  private board!: Phaser.GameObjects.Graphics;
  private boardShadow!: Phaser.GameObjects.Graphics;
  private wood!: Phaser.GameObjects.Image;
  private shadows!: Phaser.GameObjects.Graphics;
  private playerMarks!: Phaser.GameObjects.Graphics;
  /** Over the stones: the last move, the ko point, and while counting, who owns what. */
  private marks!: Phaser.GameObjects.Graphics;
  /** The stone you would play, under the mouse. */
  private ghost!: Phaser.GameObjects.Image;
  private touchLoupe!: Phaser.GameObjects.Container;
  private loupeStones!: Phaser.GameObjects.Image[];
  private zone!: Phaser.GameObjects.Zone;
  private status!: Phaser.GameObjects.Text;
  private details!: Phaser.GameObjects.Text;
  private score!: {
    avatars: Phaser.GameObjects.Image[];
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    lines: Phaser.GameObjects.Text[];
    hosts: Phaser.GameObjects.Text[];
  };
  private rails = { left: 0, right: 0, width: 200, top: 0, bottom: 720, playerHeight: 120 };
  private bowls!: Record<Side, StoneBowl>;
  private buttons!: {
    pass: Button;
    accept: Button;
    resume: Button;
    resign: Button;
    result: Button;
  };
  private panel!: ResultPanel;
  private buttonStack = { x: 0, bottom: 0, width: 200, height: 40 };
  private stones = new Map<number, StoneObj>();
  /** Where point (0, 0) is on screen and the gap between lines. */
  private grid = { x0: 0, y0: 0, cell: 40, size: BOARD_SIZE };
  private hovered: number | null = null;
  /** "Đầu hàng" was tapped once: a second tap within a few seconds confirms. */
  private resignArmed = false;
  private resignTimer?: FlowHandle;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate() {
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.stones = new Map();
    this.hovered = null;
    this.boardShadow = this.add.graphics().setDepth(-1);
    this.wood = this.image(0, 0, 'board').setDepth(DEPTH.board);
    this.board = this.add.graphics().setDepth(DEPTH.lines);
    this.shadows = this.add.graphics().setDepth(DEPTH.shadow);
    this.playerMarks = this.add.graphics().setDepth(DEPTH.marks);
    this.marks = this.add.graphics().setDepth(DEPTH.marks);
    this.ghost = this.add.image(0, 0, this.stoneKey('b')).setAlpha(0.45).setVisible(false);
    this.ghost.setDepth(DEPTH.ghost);
    const lens = this.add.graphics();
    lens.fillStyle(0x102d29, 0.98).fillCircle(0, 0, 72);
    lens.lineStyle(2, 0xe5bd72).strokeCircle(0, 0, 72);
    lens.lineStyle(1, 0xf2ce8b, 0.5);
    for (const at of [-36, 0, 36]) {
      lens.lineBetween(-52, at, 52, at);
      lens.lineBetween(at, -52, at, 52);
    }
    this.loupeStones = Array.from({ length: 9 }, (_, i) =>
      this.add
        .image(((i % 3) - 1) * 36, (Math.floor(i / 3) - 1) * 36, this.stoneKey('b'))
        .setDisplaySize(37, 37),
    );
    this.touchLoupe = this.add
      .container(0, 0, [lens, ...this.loupeStones])
      .setDepth(DEPTH.ghost + 1)
      .setVisible(false);
    this.zone = this.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (p: Phaser.Input.Pointer) => {
        if (p.wasTouch) this.hover(this.pointAt(p.worldX, p.worldY), true);
      })
      .on('pointerup', (p: Phaser.Input.Pointer) => {
        this.hover(null);
        this.tap(p.worldX, p.worldY);
      })
      .on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch || p.isDown) this.hover(this.pointAt(p.worldX, p.worldY), p.wasTouch);
      })
      .on('pointerout', () => this.hover(null));
    this.status = this.railLabel('', 30).setAlign('center');
    this.details = this.railLabel('', 24).setAlign('center').setOrigin(0.5, 0);
    this.score = {
      avatars: [0, 1].map(() => this.add.image(0, 0, this.avatar({}))),
      icons: [0, 1].map(() => this.add.image(0, 0, this.stoneKey('b'))),
      names: [0, 1].map(() => this.railLabel('', 30).setOrigin(0, 0.5)),
      lines: [0, 1].map(() => this.railLabel('', 24).setOrigin(0, 0.5)),
      hosts: [0, 1].map(() => this.railLabel('♛', 24)),
    };
    const opts = { image: 'button', slice: 36, size: 30, hoverSound: false };
    this.buttons = {
      pass: this.button('Bỏ lượt', () => this.send('pass'), opts),
      accept: this.button('Đồng ý', () => this.send('accept'), opts),
      resume: this.button('Đánh tiếp', () => this.send('resume'), opts),
      resign: this.button('Đầu hàng', () => this.resign(), opts),
      result: this.button('Tổng kết', () => this.togglePanel(), opts),
    };
    this.panel = new ResultPanel(this);
    this.bowls = Object.fromEntries(
      (['b', 'w'] as const).map((side) => [
        side,
        new StoneBowl(this, {
          bowl: this.texture('bowl'),
          lid: this.texture('bowl-lid'),
          own: this.stoneKey(side),
          other: this.stoneKey(side === 'b' ? 'w' : 'b'),
        }),
      ]),
    ) as Record<Side, StoneBowl>;
    for (const button of Object.values(this.buttons)) {
      button.label.setColor('#fff1d2').setStroke('#352417', 2);
    }
  }

  private railLabel(text: string, size: number) {
    return this.label(text, { size, color: '#f7e8ca' })
      .setStroke('#142d2a', 2)
      .setShadow(0, 2, '#102421', 3);
  }

  /**
   * On the frame (docs/ui-guide.md): the board as tall as it fits under the room bar, in the
   * middle; seat two and its bowl/lid at the upper left, seat one at the lower right.
   * Play controls occupy the lower left; status and the scoring resume button the upper right.
   */
  protected onLayout(ctx: Ctx) {
    const { width, height, top, hud, gap } = ctx.screen;
    const margin = 12;
    const fullSide = Math.min(width - 2 * 140 * hud, height - 2 * margin);
    const fullLeft = (width - fullSide) / 2;
    // The real room has corner HUDs. Let the board rise between them; a wrapped bar or
    // the sandbox's seat controls keep the board below the bar instead.
    const fitsGap = gap && fullLeft >= gap.left + 8 && fullLeft + fullSide <= gap.right - 8;
    const safeTop = fitsGap ? Math.max(margin, gap.top) : top;
    const availH = height - safeTop - margin;
    const side = Math.max(160, Math.min(width - 2 * 140 * hud, availH));
    const size = ctx.state.size;
    // Half a gap and a bit around the outer lines, so edge stones sit on the wood.
    const cell = side / (size - 1 + 1.6);
    const left = (width - side) / 2;
    const boardTop = safeTop + Math.max(0, (availH - side) / 2);
    const columnW = left - 2 * margin;
    this.grid = { x0: left + cell * 0.8, y0: boardTop + cell * 0.8, cell, size };
    this.drawBoard(left, boardTop, side);
    const zoneSide = cell * size;
    this.zone
      .setPosition(this.grid.x0 - cell / 2, this.grid.y0 - cell / 2)
      .setSize(zoneSide, zoneSide);
    this.zone.input?.hitArea.setTo(0, 0, zoneSide, zoneSide);
    this.ghost.setDisplaySize(cell * 1.04, cell * 1.04);
    this.hover(null);

    const rightX = left + side + margin + columnW / 2;
    // Room bar reporting can be shorter than the shared settings button. Reserve both corners.
    const railTop = Math.max(safeTop, top, 88 * hud);
    const railBottom = height - 24;
    const available = railBottom - railTop;
    const railHud = Math.min(hud, columnW / 190, available / 520);
    this.rails = {
      left: margin + columnW / 2,
      right: rightX,
      width: columnW,
      top: railTop,
      bottom: height - 48,
      playerHeight: 90 * railHud,
    };
    this.status
      .setOrigin(0.5, 0)
      .setWordWrapWidth(columnW)
      .setPosition(rightX, railTop + 8);
    this.buttonStack = {
      x: this.rails.left,
      bottom: height - 84,
      width: Math.min(columnW, 210 * hud),
      height: Math.max(88, Math.min(80 * hud, side * 0.18)),
    };
    const diameter = Math.max(
      72,
      Math.min(
        columnW * 1.15,
        240,
        (available - this.rails.playerHeight - 2 * this.buttonStack.height - 88) / 1.75,
      ),
    );
    const separation = diameter * 0.73 + 8;
    ctx.players.forEach((player, seat) => {
      const color: Side = ctx.state.players[0] === player.id ? 'b' : 'w';
      const x = seat === 0 ? this.rails.right : this.rails.left;
      const y =
        seat === 0
          ? railBottom - this.rails.playerHeight - diameter / 2 - 12
          : railTop + this.rails.playerHeight + diameter / 2 + 12;
      this.bowls[color].layout({
        x,
        y,
        lidX: x,
        lidY: y + (seat === 0 ? -separation : separation),
        diameter,
      });
    });
    this.syncBowls(ctx, false);
    this.layoutScore(ctx);
    this.placeButtons();
    for (const [p, stone] of this.stones) this.placeStone(stone, p);
    this.drawMarks(ctx);
    if (this.panel.shown) this.showPanel(false);
  }

  /** A new game: an empty board (onState sets the stones out). */
  protected onStart() {
    this.resetBoard();
    this.syncBowls(this.ctx, false);
    for (const bowl of Object.values(this.bowls)) bowl.open();
    void this.sfx('go-start');
  }

  private resetBoard() {
    this.resignTimer?.cancel();
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.panel.hide();
    this.buttons.resign.setText('Đầu hàng');
    for (const stone of this.stones.values()) stone.image.destroy();
    this.stones.clear();
    this.hover(null);
  }

  protected onResync(ctx: Ctx) {
    this.resetBoard();
    this.onLayout(ctx);
    this.syncStones(ctx, false);
    this.onState(ctx);
    if (ctx.result && ctx.state.end) this.showPanel(false);
  }

  protected onState(ctx: Ctx) {
    if (ctx.state.size !== this.grid.size) {
      this.onStart();
      this.onLayout(ctx);
    }
    this.syncStones(ctx);
    this.syncBowls(ctx);
    this.drawMarks(ctx);
    this.showStatus(ctx);
    this.showButtons(ctx);
    this.layoutScore(ctx);
    if (this.hovered !== null && !this.canPlay(ctx, this.hovered)) this.hover(null);
  }

  // ── Board ───────────────────────────────────────────────────────────────────────────────

  private mySide({ me, state }: Ctx): Side | null {
    if (!me) return null;
    return state.players[0] === me.id ? 'b' : state.players[1] === me.id ? 'w' : null;
  }

  /** Screen position of a point. */
  pointXY(p: number) {
    const { x0, y0, cell, size } = this.grid;
    return { x: x0 + colOf(size, p) * cell, y: y0 + rowOf(size, p) * cell };
  }

  /** The point nearest to a screen position. */
  private pointAt(x: number, y: number) {
    const { x0, y0, cell, size } = this.grid;
    const col = Math.round((x - x0) / cell);
    const row = Math.round((y - y0) / cell);
    if (col < 0 || col >= size || row < 0 || row >= size) return null;
    return row * size + col;
  }

  /** The wood, the lines and the star points. */
  private drawBoard(left: number, top: number, side: number) {
    const { x0, y0, cell, size } = this.grid;
    const g = this.board.clear();
    const shadow = this.boardShadow.clear();
    // A restrained contact shadow; the image has only a 0.9% milled wood edge.
    for (let i = 12; i > 0; i--) {
      shadow
        .fillStyle(0x071b19, 0.035)
        .fillRoundedRect(left - i, top + 5 - i / 2, side + i * 2, side + i, 6 + i);
    }
    this.wood.setPosition(left + side / 2, top + side / 2).setDisplaySize(side, side);
    const end = (size - 1) * cell;
    g.lineStyle(1.15, COLORS.line, 0.88);
    for (let i = 0; i < size; i++) {
      g.lineBetween(x0, y0 + i * cell, x0 + end, y0 + i * cell);
      g.lineBetween(x0 + i * cell, y0, x0 + i * cell, y0 + end);
    }
    g.lineStyle(1.8, COLORS.line, 0.95).strokeRect(x0, y0, end, end);
    g.fillStyle(COLORS.line, 1);
    for (const p of starPoints(size)) {
      const { x, y } = this.pointXY(p);
      g.fillCircle(x, y, Math.max(2.6, cell * 0.09));
    }
  }

  private stoneKey(side: Side) {
    return this.texture(`stone-${SIDES[side].art}`);
  }

  /** Sounds only follow live events; reconnecting or switching seats stays silent. */
  protected onPlace({ state }: Ctx) {
    const variant = (state.plies % 3) + 1;
    this.runtime.run(async (fx) => {
      await fx.wait(85);
      await fx.sound(`go-place-${variant}`);
      if (state.last?.captured.length) {
        await fx.wait(90);
        await fx.sound('go-capture');
      }
    });
  }

  protected onPass({ state }: Ctx) {
    void this.sfx(state.phase === 'scoring' ? 'go-count' : 'go-pass');
  }

  protected onMark() {
    void this.sfx('go-pass');
  }

  protected onResume() {
    void this.sfx('go-start');
  }

  protected onEnd() {
    this.jingle('go-end');
    this.hover(null);
    this.showPanel(true);
  }

  private showPanel(pop: boolean) {
    const ctx = this.ctx;
    const end = ctx.state.end;
    if (!ctx.result || !end) return;
    const mine = this.mySide(ctx);
    const loser: Side = end.winner === 'b' ? 'w' : 'b';
    const title = mine
      ? end.winner === mine
        ? 'Chiến thắng!'
        : 'Thua rồi'
      : `${SIDES[end.winner].name} thắng!`;
    const reason =
      end.reason === 'score' && end.score
        ? `Thắng ${num(Math.abs(end.score.b - end.score.w))} điểm`
        : `${this.nameOf(ctx, loser)} ${end.reason === 'resign' ? 'đầu hàng' : 'rời bàn'}`;
    const rows: [string, string][] = [
      ['Số nước', String(ctx.state.plies)],
      ['Quân đã bắt', `Đen ${ctx.state.prisoners.b} · Trắng ${ctx.state.prisoners.w}`],
    ];
    if (ctx.clock) {
      const seconds = Math.max(
        0,
        Math.floor(((ctx.clock.endedAt ?? Date.now()) - ctx.clock.startedAt) / 1000),
      );
      rows.push([
        'Thời gian',
        `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
      ]);
    }
    this.panel.show(
      {
        title,
        winner: `${this.nameOf(ctx, end.winner)} · Quân ${SIDES[end.winner].name.toLowerCase()}`,
        stone: this.stoneKey(end.winner),
        reason,
        count: end.reason === 'score' && end.score ? [num(end.score.b), num(end.score.w)] : null,
        rows,
      },
      {
        x: this.wood.x,
        y: Math.max(this.wood.y, (this.rails.top + this.rails.bottom) / 2),
        width: this.wood.displayWidth,
        height: Math.min(this.wood.displayHeight, this.rails.bottom - this.rails.top),
        hud: ctx.screen.hud,
      },
      pop,
    );
    this.showButtons(ctx);
  }

  private togglePanel() {
    if (this.panel.shown) {
      this.panel.hide();
      this.showButtons(this.ctx);
    } else this.showPanel(false);
  }

  private syncBowls({ state }: Ctx, animate = true) {
    const black = [...state.board].filter((cell) => cell === 'b').length;
    const white = [...state.board].filter((cell) => cell === 'w').length;
    this.bowls.b.sync(181 - black - state.prisoners.w, state.prisoners.b, animate);
    this.bowls.w.sync(180 - white - state.prisoners.b, state.prisoners.w, animate);
  }

  private placeStone(stone: StoneObj, p: number) {
    const { x, y } = this.pointXY(p);
    const size = this.grid.cell * 1.04;
    this.runtime.cancelTweens(stone.image);
    stone.image.setPosition(x, y).setDisplaySize(size, size).setAlpha(1).setDepth(DEPTH.stone);
  }

  /**
   * Makes the screen match the state: the stone just played pops in, taken stones fade out,
   * anything else (joining late, a new game) appears at once.
   */
  private syncStones({ state }: Ctx, animate = true) {
    const last = state.last;
    for (const [p, stone] of this.stones) {
      if (state.board[p] === stone.side) continue;
      this.stones.delete(p);
      const image = stone.image;
      if (animate && last?.captured.includes(p)) {
        this.runtime.cancelTweens(image);
        const index = last.captured.indexOf(p);
        const destination = this.bowls[last.side].captureXY(
          state.prisoners[last.side] - last.captured.length + index,
        );
        this.runtime.run(async (fx) => {
          fx.defer(() => image.destroy());
          image.setDepth(10);
          await fx.tween({
            targets: image,
            x: destination.x,
            y: destination.y,
            displayWidth: destination.size,
            displayHeight: destination.size,
            duration: 380,
            delay: index * 28,
            ease: 'Cubic.easeInOut',
          });
        });
      } else image.destroy();
    }
    for (let p = 0; p < state.board.length; p++) {
      const side = state.board[p] as Side | '.';
      if ((side !== 'b' && side !== 'w') || this.stones.has(p)) continue;
      const stone = { side, image: this.add.image(0, 0, this.stoneKey(side)) };
      stone.image.setDepth(DEPTH.stone);
      this.stones.set(p, stone);
      this.placeStone(stone, p);
      if (animate && p === last?.point) {
        const source = this.bowls[side].takeXY();
        const destination = this.pointXY(p);
        const { scaleX, scaleY } = stone.image;
        stone.image
          .setPosition(source.x, source.y)
          .setDisplaySize(source.size, source.size)
          .setDepth(10);
        this.runtime.tween({
          targets: stone.image,
          x: destination.x,
          y: destination.y,
          scaleX,
          scaleY,
          alpha: 1,
          duration: 260,
          ease: 'Cubic.easeInOut',
          onComplete: () => stone.image.setDepth(DEPTH.stone),
        });
      }
    }
  }

  /**
   * The last stone's dot and the ko point; while counting (and after a count), dead stones
   * fade and each point a side gets shows a small square of its color.
   */
  private drawMarks(ctx: Ctx) {
    const { state } = ctx;
    const { cell } = this.grid;
    const g = this.marks.clear();
    const shadows = this.shadows.clear();
    const counting = state.phase === 'scoring' || state.end?.reason === 'score';
    for (const [p, stone] of this.stones) {
      const dead = counting && state.dead.includes(p);
      stone.image.setAlpha(dead ? 0.4 : 1);
      const { x, y } = this.pointXY(p);
      for (let i = 4; i > 0; i--) {
        shadows
          .fillStyle(0x20180f, dead ? 0.035 : 0.1)
          .fillCircle(x + cell * 0.025, y + cell * 0.07, cell * (0.4 + i * 0.024));
      }
    }
    if (counting) {
      const { owner } = score(state.board, state.size, state.dead, KOMI);
      const half = cell * 0.16;
      owner.forEach((o, p) => {
        if (o === '.' || state.board[p] === o) return;
        const { x, y } = this.pointXY(p);
        g.fillStyle(o === 'b' ? COLORS.black : COLORS.white, 0.95);
        g.fillRect(x - half, y - half, half * 2, half * 2);
        g.lineStyle(1, o === 'b' ? COLORS.white : COLORS.black, 0.6);
        g.strokeRect(x - half, y - half, half * 2, half * 2);
      });
      return;
    }
    if (state.last?.point != null) {
      const { x, y } = this.pointXY(state.last.point);
      g.lineStyle(Math.max(2, cell * 0.07), COLORS.last, 1).strokeCircle(x, y, cell * 0.22);
    }
    if (state.ko !== null && !state.end) {
      const { x, y } = this.pointXY(state.ko);
      g.lineStyle(Math.max(2, cell * 0.06), COLORS.line, 0.9);
      g.strokeRect(x - cell * 0.22, y - cell * 0.22, cell * 0.44, cell * 0.44);
    }
  }

  // ── Taps ────────────────────────────────────────────────────────────────────────────────

  /** Whether you may play `p` now (the server also checks the superko rule). */
  private canPlay(ctx: Ctx, p: number) {
    const { state } = ctx;
    const side = this.mySide(ctx);
    if (!side || ctx.result || state.phase !== 'play' || state.turn !== side) return false;
    if (state.board[p] !== '.' || p === state.ko) return false;
    return place(state.board, state.size, p, side) !== null;
  }

  /** Play on your turn; while counting, mark the tapped chain dead or alive. */
  private tap(x: number, y: number) {
    const ctx = this.ctx;
    const p = this.pointAt(x, y);
    if (p === null) return;
    const { state } = ctx;
    if (state.phase === 'scoring') {
      if (this.mySide(ctx) && !ctx.result && state.board[p] !== '.')
        this.send('mark', { point: p });
      return;
    }
    if (!this.canPlay(ctx, p)) return;
    this.hover(null);
    this.send('place', { point: p });
  }

  /** The stone you would play, under the mouse. */
  private hover(p: number | null, touch = false) {
    const shown = p !== null && this.canPlay(this.ctx, p);
    this.hovered = shown ? p : null;
    this.ghost.setVisible(shown);
    this.touchLoupe.setVisible(shown && touch);
    if (!shown || p === null) return;
    const side = this.mySide(this.ctx) ?? 'b';
    const { x, y } = this.pointXY(p);
    this.ghost
      .setTexture(this.stoneKey(side))
      .setDisplaySize(this.grid.cell * 1.04, this.grid.cell * 1.04)
      .setPosition(x, y);
    if (!touch) return;
    const { cell, size } = this.grid;
    const row = rowOf(size, p);
    const col = colOf(size, p);
    this.loupeStones.forEach((stone, i) => {
      const r = row + Math.floor(i / 3) - 1;
      const c = col + (i % 3) - 1;
      const inBoard = r >= 0 && r < size && c >= 0 && c < size;
      const at = r * size + c;
      const color = i === 4 ? side : this.ctx.state.board[at];
      stone.setVisible(inBoard && (color === 'b' || color === 'w'));
      if (color === 'b' || color === 'w') stone.setTexture(this.stoneKey(color));
      stone.setAlpha(i === 4 ? 0.7 : 1);
    });
    const above = y - 118;
    const lensY = above - 72 > this.grid.y0 - cell / 2 ? above : y + 118;
    this.touchLoupe.setPosition(x, Math.min(this.view.height - 80, lensY));
  }

  // ── Status, score and buttons ───────────────────────────────────────────────────────────

  private nameOf(ctx: Ctx, side: Side) {
    const id = ctx.state.players[side === 'b' ? 0 : 1];
    if (id === ctx.me?.id) return 'Bạn';
    return ctx.players.find((p) => p.id === id)?.name ?? SIDES[side].name;
  }

  private showStatus(ctx: Ctx) {
    const { state } = ctx;
    const playing = !state.end && !ctx.result;
    this.status.setVisible(playing);
    this.details.setVisible(playing);
    if (!playing) return;
    const mine = this.mySide(ctx);
    let text = state.turn === mine ? 'Lượt bạn' : `Lượt ${SIDES[state.turn].name}`;
    let detail = `Nước ${state.plies}`;
    if (state.phase === 'scoring') {
      const { b, w } = score(state.board, state.size, state.dead, KOMI);
      text = 'Đếm điểm';
      detail = `Đen ${num(b)}\nTrắng ${num(w)}`;
      const other = mine === 'b' ? 'w' : 'b';
      if (mine && state.accepted.includes(other)) detail += '\nĐã đồng ý';
    } else if (state.last?.point === null) {
      text = `${SIDES[state.last.side].name} bỏ lượt`;
      detail = state.turn === mine ? 'Lượt bạn' : `Lượt ${SIDES[state.turn].name}`;
    }
    const hud = Math.min(
      ctx.screen.hud,
      this.rails.width / 190,
      (this.rails.bottom - this.rails.top) / 520,
    );
    this.status.setText(text).setFontSize(Math.max(24, 30 * hud));
    this.details
      .setText(detail)
      .setFontSize(Math.max(24, 24 * hud))
      .setWordWrapWidth(this.rails.width - 16)
      .setPosition(this.status.x, this.status.y + this.status.height + 12);
  }

  /** The result toggle stays available whether the summary is open or closed. */
  private showButtons(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    const on = Boolean(mine && !state.end && !ctx.result);
    const counting = on && state.phase === 'scoring';
    const { pass, accept, resume, resign, result } = this.buttons;
    result.container.setVisible(Boolean(ctx.result && state.end));
    result.setText(this.panel.shown ? 'Xem bàn cờ' : 'Tổng kết');
    pass.container.setVisible(on && !counting);
    pass.setEnabled(state.turn === mine);
    accept.container.setVisible(counting);
    const agreed = Boolean(mine && state.accepted.includes(mine));
    accept.setText(agreed ? 'Đã đồng ý' : 'Đồng ý').setEnabled(!agreed);
    resume.container.setVisible(counting);
    resign.container.setVisible(on);
    resign.setText(this.resignArmed ? 'Chắc chưa?' : 'Đầu hàng');
    this.placeButtons();
  }

  /** Keep play actions at the lower left, above DEV and away from seat one's HUD. */
  private placeButtons() {
    const { x, bottom, width, height } = this.buttonStack;
    const shown = Object.entries(this.buttons)
      .filter(([key, button]) => key !== 'resume' && button.container.visible)
      .map(([, button]) => button);
    const gap = 8;
    const span = shown.length * height + (shown.length - 1) * gap;
    shown.forEach((button, i) => {
      button.setSize(width, height).setPosition(x, bottom - span + height / 2 + i * (height + gap));
    });
    this.buttons.resume
      .setSize(width, height)
      .setPosition(this.rails.right, this.details.y + this.details.height + 8 + height / 2);
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

  /** Seat positions stay fixed even when room options swap the stone colors. */
  private layoutScore({ players, state, hostId }: Ctx) {
    const rail = this.rails;
    const hud = rail.playerHeight / 90;
    const icon = 46 * hud;
    this.playerMarks.clear();
    [0, 1].forEach((seat) => {
      const player = players[seat];
      const name = this.score.names[seat];
      const line = this.score.lines[seat];
      const img = this.score.icons[seat];
      if (!name || !line || !img) return;
      const side: Side = player ? (state.players[0] === player.id ? 'b' : 'w') : seat ? 'w' : 'b';
      const x = seat === 0 ? rail.right : rail.left;
      const top = seat === 0 ? rail.bottom - rail.playerHeight : rail.top;
      const avatarX = x - rail.width / 2 + icon / 2 + 6;
      const textX = avatarX + icon / 2 + 10 * hud;
      const y = top + 44 * hud;
      this.score.avatars[seat]
        ?.setTexture(this.avatar(player ?? {}))
        .setDisplaySize(icon, icon)
        .setPosition(avatarX, y);
      img
        .setTexture(this.stoneKey(side))
        .setDisplaySize(icon * 0.48, icon * 0.48)
        .setPosition(avatarX + icon * 0.38, y + icon * 0.3);
      const active = !state.end && state.phase === 'play' && state.turn === side;
      if (active)
        this.playerMarks.lineStyle(2, 0xe5bd72, 0.9).strokeCircle(avatarX, y, icon * 0.54);
      this.score.hosts[seat]
        ?.setVisible(player?.id === hostId)
        .setFontSize(Math.max(24, 24 * hud))
        .setPosition(avatarX - icon * 0.4, y - icon * 0.45);
      name
        .setOrigin(0, 0.5)
        .setFontSize(Math.max(24, 26 * hud))
        .setPosition(textX, y - 17 * hud);
      this.fitText(name, player?.name ?? '…', x + rail.width / 2 - textX - 6, 24);
      name.setAlpha(active || state.phase === 'scoring' || state.end ? 1 : 0.8);
      line
        .setOrigin(0, 0.5)
        .setFontSize(Math.max(24, 24 * hud))
        .setText(`Bắt ${state.prisoners[side]}`)
        .setPosition(textX, y + 19 * hud);
    });
  }
}
