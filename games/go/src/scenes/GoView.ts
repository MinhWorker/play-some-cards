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
 * The board, lines and star points are drawn here. Stones are drawn here too until their
 * images exist in assets/ (stone-black, stone-white); sounds come with the art.
 */
import { type Button, GameView, type ViewContext } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { KOMI, type Options, type Side, type View } from '../game/model.js';
import { colOf, place, rowOf, score, starPoints } from '../game/rules.js';

type Ctx = ViewContext<View, Options>;

const DEPTH = { board: 0, stone: 2, marks: 3, ghost: 4 } as const;

const COLORS = {
  wood: 0xdcb46a,
  woodEdge: 0x8a5a2b,
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
  /** Over the stones: the last move, the ko point, and while counting, who owns what. */
  private marks!: Phaser.GameObjects.Graphics;
  /** The stone you would play, under the mouse. */
  private ghost!: Phaser.GameObjects.Image;
  private zone!: Phaser.GameObjects.Zone;
  private status!: Phaser.GameObjects.Text;
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    lines: Phaser.GameObjects.Text[];
  };
  private leftColumn = { x: 0, width: 200, top: 0, bottom: 400 };
  private buttons!: { pass: Button; accept: Button; resume: Button; resign: Button };
  private buttonStack = { x: 0, bottom: 0, width: 200, height: 40 };
  private stones = new Map<number, StoneObj>();
  /** Where point (0, 0) is on screen and the gap between lines. */
  private grid = { x0: 0, y0: 0, cell: 40, size: 9 };
  private hovered: number | null = null;
  /** "Đầu hàng" was tapped once: a second tap within a few seconds confirms. */
  private resignArmed = false;
  private resignTimer?: Phaser.Time.TimerEvent;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate() {
    this.stones = new Map();
    this.hovered = null;
    this.resignArmed = false;
    this.makeStoneTextures();
    this.board = this.add.graphics().setDepth(DEPTH.board);
    this.marks = this.add.graphics().setDepth(DEPTH.marks);
    this.ghost = this.add.image(0, 0, this.stoneKey('b')).setAlpha(0.45).setVisible(false);
    this.ghost.setDepth(DEPTH.ghost);
    this.zone = this.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => this.tap(p.worldX, p.worldY))
      .on('pointermove', (p: Phaser.Input.Pointer) => {
        if (!p.wasTouch) this.hover(this.pointAt(p.worldX, p.worldY));
      })
      .on('pointerout', () => this.hover(null));
    this.status = this.label('', { size: 34 });
    this.score = {
      icons: [0, 1].map(() => this.add.image(0, 0, this.stoneKey('b'))),
      names: [0, 1].map(() => this.label('', { size: 26 }).setOrigin(0, 0.5)),
      lines: [0, 1].map(() => this.label('', { size: 20 }).setOrigin(0, 0.5)),
    };
    const opts = { image: 'button', size: 24 };
    this.buttons = {
      pass: this.button('Bỏ lượt', () => this.send('pass'), opts),
      accept: this.button('Đồng ý', () => this.send('accept'), opts),
      resume: this.button('Đánh tiếp', () => this.send('resume'), opts),
      resign: this.button('Đầu hàng', () => this.resign(), opts),
    };
  }

  /**
   * On the frame (docs/ui-guide.md): the board as tall as it fits under the room bar, in the
   * middle; the players in the column on its left (White above, Black below); the status line
   * and the buttons in the column on its right.
   */
  protected onLayout(ctx: Ctx) {
    const { width, height, top, hud } = ctx.screen;
    const margin = 16;
    const availH = height - top - margin;
    const side = Math.max(160, Math.min(width - 2 * 150 * hud, availH));
    const size = ctx.state.size;
    // Half a gap and a bit around the outer lines, so edge stones sit on the wood.
    const cell = side / (size - 1 + 1.3);
    const left = (width - side) / 2;
    const boardTop = top + Math.max(0, (availH - side) / 2);
    const columnW = left - 2 * margin;
    this.grid = { x0: left + cell * 0.65, y0: boardTop + cell * 0.65, cell, size };
    this.drawBoard(left, boardTop, side);
    const zoneSide = cell * size;
    this.zone
      .setPosition(this.grid.x0 - cell / 2, this.grid.y0 - cell / 2)
      .setSize(zoneSide, zoneSide);
    this.zone.input?.hitArea.setTo(0, 0, zoneSide, zoneSide);
    this.ghost.setDisplaySize(cell * 0.96, cell * 0.96);

    const rightX = left + side + margin + columnW / 2;
    this.status
      .setFontSize(30 * hud)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(columnW)
      .setPosition(rightX, boardTop + 8);
    this.leftColumn = {
      x: margin + columnW / 2,
      width: columnW,
      top: boardTop + 40 * hud,
      bottom: boardTop + side - 40 * hud,
    };
    this.layoutScore(ctx);
    this.buttonStack = {
      x: rightX,
      bottom: boardTop + side,
      width: Math.min(columnW, 190 * hud),
      height: 56 * hud,
    };
    this.placeButtons();
    for (const [p, stone] of this.stones) this.placeStone(stone, p);
    this.drawMarks(ctx);
  }

  /** A new game: an empty board (onState sets the stones out). */
  protected onStart() {
    for (const stone of this.stones.values()) stone.image.destroy();
    this.stones.clear();
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
    g.fillStyle(COLORS.woodEdge, 1).fillRoundedRect(left, top, side, side, side * 0.012);
    const rim = side * 0.012;
    g.fillStyle(COLORS.wood, 1).fillRect(left + rim, top + rim, side - 2 * rim, side - 2 * rim);
    const end = (size - 1) * cell;
    g.lineStyle(Math.max(1, cell * 0.035), COLORS.line, 1);
    for (let i = 0; i < size; i++) {
      g.lineBetween(x0, y0 + i * cell, x0 + end, y0 + i * cell);
      g.lineBetween(x0 + i * cell, y0, x0 + i * cell, y0 + end);
    }
    g.lineStyle(Math.max(2, cell * 0.07), COLORS.line, 1).strokeRect(x0, y0, end, end);
    g.fillStyle(COLORS.line, 1);
    for (const p of starPoints(size)) {
      const { x, y } = this.pointXY(p);
      g.fillCircle(x, y, Math.max(2.5, cell * 0.11));
    }
  }

  /** Texture key of a side's stone: its image once the art exists, the drawn one until then. */
  private stoneKey(side: Side) {
    const art = `${this.gameId}/stone-${SIDES[side].art}`;
    return this.textures.exists(art) ? art : `go-stone-${side}`;
  }

  /** Round stones with a soft highlight, drawn once. */
  private makeStoneTextures() {
    const r = 64;
    for (const side of ['b', 'w'] as const) {
      const key = `go-stone-${side}`;
      if (this.textures.exists(key)) continue;
      const g = this.make.graphics({}, false);
      g.fillStyle(0x000000, 0.25).fillCircle(r + 3, r + 5, r - 4);
      if (side === 'b') {
        g.fillStyle(COLORS.black, 1).fillCircle(r, r, r - 4);
        g.fillStyle(0xffffff, 0.12).fillCircle(r - 18, r - 20, r * 0.36);
        g.fillStyle(0xffffff, 0.1).fillCircle(r - 20, r - 22, r * 0.2);
      } else {
        g.fillStyle(0xc9c2b2, 1).fillCircle(r, r, r - 4);
        g.fillStyle(COLORS.white, 1).fillCircle(r - 2, r - 3, r - 8);
        g.fillStyle(0xffffff, 0.8).fillCircle(r - 18, r - 20, r * 0.3);
      }
      g.generateTexture(key, r * 2 + 6, r * 2 + 8);
      g.destroy();
    }
  }

  private placeStone(stone: StoneObj, p: number) {
    const { x, y } = this.pointXY(p);
    const size = this.grid.cell * 0.96;
    this.tweens.killTweensOf(stone.image);
    stone.image.setPosition(x, y).setDisplaySize(size, size).setAlpha(1);
  }

  /**
   * Makes the screen match the state: the stone just played pops in, taken stones fade out,
   * anything else (joining late, a new game) appears at once.
   */
  private syncStones({ state }: Ctx) {
    const last = state.last;
    for (const [p, stone] of this.stones) {
      if (state.board[p] === stone.side) continue;
      this.stones.delete(p);
      const image = stone.image;
      if (last?.captured.includes(p)) {
        this.tweens.add({
          targets: image,
          alpha: 0,
          duration: 220,
          delay: 80,
          onComplete: () => image.destroy(),
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
      if (p === last?.point) {
        const { scaleX, scaleY } = stone.image;
        stone.image.setScale(scaleX * 1.2, scaleY * 1.2).setAlpha(0.6);
        this.tweens.add({
          targets: stone.image,
          scaleX,
          scaleY,
          alpha: 1,
          duration: 130,
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
    const counting = state.phase === 'scoring' || state.end?.reason === 'score';
    for (const [p, stone] of this.stones) {
      stone.image.setAlpha(counting && state.dead.includes(p) ? 0.45 : 1);
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
  private hover(p: number | null) {
    const shown = p !== null && this.canPlay(this.ctx, p);
    this.hovered = shown ? p : null;
    this.ghost.setVisible(shown);
    if (!shown || p === null) return;
    const side = this.mySide(this.ctx) ?? 'b';
    const { x, y } = this.pointXY(p);
    this.ghost
      .setTexture(this.stoneKey(side))
      .setDisplaySize(this.grid.cell * 0.96, this.grid.cell * 0.96)
      .setPosition(x, y);
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

  /** The two players in the left column beside their stones: White above, Black below. */
  private layoutScore({ players, score: wins, state }: Ctx) {
    const { hud } = this.ctx.screen;
    const col = this.leftColumn;
    const icon = 52 * hud;
    const textX = col.x - col.width / 2 + icon + 12 * hud;
    const textW = col.width - icon - 12 * hud;
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
        .setPosition(col.x - col.width / 2 + icon / 2, y);
      name.setFontSize(26 * hud).setPosition(textX, y - 14 * hud);
      this.fitText(name, player ? player.name : '…', textW, 18 * hud);
      line
        .setFontSize(20 * hud)
        .setText(`Thắng ${wins.wins[seat] ?? 0} · Bắt ${state.prisoners[side]}`)
        .setPosition(textX, y + 16 * hud);
      this.fitText(line, line.text, textW, 14 * hud);
    });
  }
}
