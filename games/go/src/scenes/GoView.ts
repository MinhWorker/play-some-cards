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
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    lines: Phaser.GameObjects.Text[];
  };
  private leftColumn = { x: 0, width: 200, top: 0, bottom: 400 };
  private statusArea = { top: 0, side: 0 };
  private buttons!: { pass: Button; accept: Button; resume: Button; resign: Button };
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
    this.score = {
      icons: [0, 1].map(() => this.add.image(0, 0, this.stoneKey('b'))),
      names: [0, 1].map(() => this.railLabel('', 30).setOrigin(0, 0.5)),
      lines: [0, 1].map(() => this.railLabel('', 24).setOrigin(0, 0.5)),
    };
    const opts = { image: 'button', slice: 36, size: 30, hoverSound: false };
    this.buttons = {
      pass: this.button('Bỏ lượt', () => this.send('pass'), opts),
      accept: this.button('Đồng ý', () => this.send('accept'), opts),
      resume: this.button('Đánh tiếp', () => this.send('resume'), opts),
      resign: this.button('Đầu hàng', () => this.resign(), opts),
    };
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
   * middle; the players in the column on its left (White above, Black below); the status line
   * and the buttons in the column on its right.
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
    this.statusArea = { top: boardTop, side };
    this.status
      .setFontSize(30 * hud)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(columnW)
      .setPosition(rightX, boardTop + side * 0.27);
    this.leftColumn = {
      x: margin + columnW / 2,
      width: columnW,
      top: boardTop + side * 0.26,
      bottom: boardTop + side * 0.67,
    };
    this.layoutScore(ctx);
    this.buttonStack = {
      x: rightX,
      bottom: boardTop + side - 16,
      width: Math.min(columnW, 210 * hud),
      height: 80 * hud,
    };
    this.placeButtons();
    for (const [p, stone] of this.stones) this.placeStone(stone, p);
    this.drawMarks(ctx);
  }

  /** A new game: an empty board (onState sets the stones out). */
  protected onStart() {
    this.resetBoard();
    void this.sfx('go-start');
  }

  private resetBoard() {
    this.resignTimer?.cancel();
    this.resignTimer = undefined;
    this.resignArmed = false;
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
  }

  protected onState(ctx: Ctx) {
    if (ctx.state.size !== this.grid.size) {
      this.onStart();
      this.onLayout(ctx);
    }
    this.syncStones(ctx);
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
  }

  private placeStone(stone: StoneObj, p: number) {
    const { x, y } = this.pointXY(p);
    const size = this.grid.cell * 1.04;
    this.runtime.cancelTweens(stone.image);
    stone.image.setPosition(x, y).setDisplaySize(size, size).setAlpha(1);
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
        this.runtime.run(async (fx) => {
          fx.defer(() => image.destroy());
          await fx.tween({ targets: image, alpha: 0, duration: 220, delay: 80 });
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
        const { scaleX, scaleY } = stone.image;
        stone.image.setScale(scaleX * 1.12, scaleY * 1.12).setAlpha(0.85);
        this.runtime.tween({
          targets: stone.image,
          scaleX,
          scaleY,
          alpha: 1,
          duration: 100,
          ease: 'Quad.easeIn',
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
    const mine = this.mySide(ctx);
    let text: string;
    if (state.end) {
      const { winner, reason, score: count } = state.end;
      const loser = winner === 'b' ? 'w' : 'b';
      const who = this.nameOf(ctx, winner);
      if (reason === 'score' && count) {
        text = `${who} thắng ${num(Math.abs(count.b - count.w))} điểm · Đen ${num(count.b)} · Trắng ${num(count.w)}`;
      } else {
        text = `${who} thắng · ${this.nameOf(ctx, loser)} ${reason === 'resign' ? 'đầu hàng' : 'rời bàn'}`;
      }
    } else if (state.phase === 'scoring') {
      const { b, w } = score(state.board, state.size, state.dead, KOMI);
      text = `Đếm điểm · Đen ${num(b)} · Trắng ${num(w)}`;
      const other = mine === 'b' ? 'w' : 'b';
      if (mine && state.accepted.includes(other)) text += ` · ${this.nameOf(ctx, other)} đã đồng ý`;
    } else {
      const turn =
        state.turn === mine
          ? 'Tới lượt bạn'
          : `Lượt ${SIDES[state.turn].name} · ${this.nameOf(ctx, state.turn)}`;
      const passed =
        state.last?.point === null ? `${this.nameOf(ctx, state.last.side)} bỏ lượt · ` : '';
      text = passed + turn;
    }
    this.status.setText(text);
    const { top, side } = this.statusArea;
    const { hud } = ctx.screen;
    this.status.setFontSize(30 * hud);
    if (state.phase === 'scoring' && !state.end) {
      const available = side - 3 * (80 * hud + 8) - 48;
      for (let font = Math.round(30 * hud); this.status.height > available && font > 24 * hud; )
        this.status.setFontSize(--font);
    }
    this.status.setY(top + (state.phase === 'scoring' || state.end ? 16 : side * 0.27));
  }

  /** "Bỏ lượt" while playing (on your turn), "Đồng ý" and "Đánh tiếp" while counting. */
  private showButtons(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    const on = Boolean(mine && !state.end && !ctx.result);
    const counting = on && state.phase === 'scoring';
    const { pass, accept, resume, resign } = this.buttons;
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

  /** The visible buttons, stacked down to the board's bottom edge. */
  private placeButtons() {
    const { x, bottom, width, height } = this.buttonStack;
    const shown = Object.values(this.buttons).filter((b) => b.container.visible);
    const gap = 8;
    const span = shown.length * height + (shown.length - 1) * gap;
    shown.forEach((b, i) => {
      b.setSize(width, height).setPosition(x, bottom - span + height / 2 + i * (height + gap));
    });
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

  /** Open player rail: color, name, wins and prisoners, with a ring on the active side. */
  private layoutScore({ players, score: wins, state, hostId }: Ctx) {
    const { hud } = this.ctx.screen;
    const col = this.leftColumn;
    const icon = 62 * hud;
    const left = col.x - col.width / 2 + 8;
    this.playerMarks.clear();
    [0, 1].forEach((seat) => {
      const name = this.score.names[seat];
      const line = this.score.lines[seat];
      const img = this.score.icons[seat];
      const player = players[seat];
      if (!name || !line || !img) return;
      const side: Side = player ? (state.players[0] === player.id ? 'b' : 'w') : seat ? 'w' : 'b';
      const y = side === 'b' ? col.bottom : col.top;
      img
        .setTexture(this.stoneKey(side))
        .setDisplaySize(icon, icon)
        .setPosition(left + icon / 2, y);
      const active = !state.end && state.phase === 'play' && state.turn === side;
      if (active) {
        this.playerMarks.lineStyle(2, 0xe5bd72, 0.9).strokeCircle(left + icon / 2, y, icon * 0.52);
      }
      name.setFontSize(30 * hud).setPosition(left, y + icon / 2 + 24 * hud);
      const playerName = player ? `${player.id === hostId ? '♛ ' : ''}${player.name}` : '…';
      this.fitText(name, playerName, col.width - 16, 24 * hud);
      name.setAlpha(active || state.phase === 'scoring' ? 1 : 0.7);
      line
        .setFontSize(24 * hud)
        .setText(`Thắng ${wins.wins[seat] ?? 0} · Bắt ${state.prisoners[side]}`);
      const wrapped = line.width > col.width - 16;
      if (wrapped) line.setText(`Thắng ${wins.wins[seat] ?? 0}\nBắt ${state.prisoners[side]}`);
      line.setPosition(left, y + icon / 2 + (wrapped ? 75 : 58) * hud);
      this.fitText(line, line.text, col.width - 16, 24 * hud);
    });
  }
}
