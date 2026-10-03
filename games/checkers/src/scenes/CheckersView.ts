/**
 * The board, in the browser. The app calls the hooks in lifecycle order; `ctx` has the state,
 * `me`, the players, host, score, options, result and screen size.
 *
 *   onCreate  board, pieces' looks, texts, buttons   onMove   slide the piece hop by hop
 *   onLayout  place everything (and on resize)      onState  pieces, marks, status, buttons
 *   onStart   a new game: clean board
 *
 * On your turn the pieces that may move are ringed. Tap one, then the square to go to; a
 * capture of several pieces is tapped one landing square at a time. The side that moves second
 * sees the board turned round, so your pieces are always at the bottom.
 *
 * The board and the pieces are drawn here until their images exist in assets/ (piece-<white|
 * black>-<man|king>); sounds come with the art.
 */
import {
  type Button,
  type FlowContext,
  type FlowHandle,
  GameView,
  type ViewContext,
  type ViewEvent,
} from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Move, type Options, RULES, type Side, type View } from '../game/model.js';
import { colOf, isDark, isKing, legalMoves, other, rowOf, sideOf } from '../game/rules.js';

type Ctx = ViewContext<View, Options>;

const DEPTH = { board: 0, marks: 1, piece: 5, moving: 7 } as const;

const COLORS = {
  light: 0xf0dcb4,
  dark: 0xa87650,
  frame: 0x4a2a14,
  last: 0xffe066,
  selected: 0x7fd4ff,
  target: 0x2e9d57,
  movable: 0xffe066,
} as const;

const SIDES: Record<Side, { name: string; art: string; text: string }> = {
  w: { name: 'Trắng', art: 'white', text: '#fff6e0' },
  b: { name: 'Đen', art: 'black', text: '#ffb199' },
};

interface PieceObj {
  piece: string;
  image: Phaser.GameObjects.Image;
}

export class CheckersView extends GameView<View, Options> {
  private board!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  private zone!: Phaser.GameObjects.Zone;
  private status!: Phaser.GameObjects.Text;
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    lines: Phaser.GameObjects.Text[];
  };
  private leftColumn = { x: 0, width: 200, top: 0, bottom: 400 };
  private buttons!: { draw: Button; decline: Button; resign: Button };
  private buttonStack = { x: 0, bottom: 0, width: 200, height: 40 };
  private pieces = new Map<number, PieceObj>();
  private leaving = new Set<Phaser.GameObjects.Image>();
  /** Where the top-left square's corner is, a square's size, the board's size and turn. */
  private grid = { x0: 0, y0: 0, cell: 60, size: 8, flip: false };
  /** The squares tapped so far for this move: the piece, then each landing square. */
  private path: number[] = [];
  /** The legal moves of this turn (on your turn). */
  private moves: Move[] = [];
  private resignArmed = false;
  private resignTimer?: FlowHandle;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate() {
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.pieces = new Map();
    this.leaving = new Set();
    this.path = [];
    this.moves = [];
    this.makeTextures();
    this.board = this.add.graphics().setDepth(DEPTH.board);
    this.marks = this.add.graphics().setDepth(DEPTH.marks);
    this.zone = this.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => this.tap(p.worldX, p.worldY));
    this.status = this.label('', { size: 34 });
    this.score = {
      icons: [0, 1].map(() => this.add.image(0, 0, this.pieceKey('w'))),
      names: [0, 1].map(() => this.label('', { size: 26 }).setOrigin(0, 0.5)),
      lines: [0, 1].map(() => this.label('', { size: 20 }).setOrigin(0, 0.5)),
    };
    const opts = { image: 'button', size: 24 };
    this.buttons = {
      draw: this.button('Xin hoà', () => this.send('offer-draw'), opts),
      decline: this.button('Từ chối', () => this.send('decline-draw'), opts),
      resign: this.button('Đầu hàng', () => this.resign(), opts),
    };
  }

  /**
   * On the frame (docs/ui-guide.md): the board as tall as it fits under the room bar, in the
   * middle; the players in the column on its left (yours below); the status line and the
   * buttons in the column on its right.
   */
  protected onLayout(ctx: Ctx) {
    this.runtime.cancelLane('move');
    for (const image of this.leaving) image.destroy();
    this.leaving.clear();
    const { width, height, top, hud } = ctx.screen;
    const margin = 16;
    const availH = height - top - margin;
    const side = Math.max(160, Math.min(width - 2 * 150 * hud, availH));
    const size = RULES[ctx.state.variant].size;
    const frame = side * 0.03;
    const cell = (side - 2 * frame) / size;
    const left = (width - side) / 2;
    const boardTop = top + Math.max(0, (availH - side) / 2);
    const columnW = left - 2 * margin;
    const flip = this.mySide(ctx) === other(RULES[ctx.state.variant].first);
    this.grid = { x0: left + frame, y0: boardTop + frame, cell, size, flip };
    this.drawBoard(left, boardTop, side);
    this.zone.setPosition(this.grid.x0, this.grid.y0).setSize(cell * size, cell * size);
    this.zone.input?.hitArea.setTo(0, 0, cell * size, cell * size);

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
    for (const [sq, obj] of this.pieces) this.placePiece(obj, sq);
    this.drawMarks(ctx);
  }

  /** A new game: an empty board (onState sets the pieces out). */
  protected onStart() {
    this.runtime.cancelLane('move');
    for (const image of this.leaving) image.destroy();
    this.leaving.clear();
    this.resignTimer?.cancel();
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.buttons.resign.setText('Đầu hàng');
    for (const obj of this.pieces.values()) obj.image.destroy();
    this.pieces.clear();
    this.path = [];
  }

  /** A move was played: the piece slides hop by hop, taken pieces fade, a new king is crowned. */
  protected onMove(ctx: Ctx, event: ViewEvent<{ path: number[] }>) {
    const last = ctx.state.last;
    const from = event.payload.path[0] ?? 0;
    const moving = this.pieces.get(from);
    this.path = [];
    if (!moving || !last) return; // onState draws whatever is missing
    const to = last.path[last.path.length - 1] ?? from;
    this.pieces.delete(from);
    const taken = last.captures.map((sq) => this.pieces.get(sq)).filter((o) => o !== undefined);
    for (const sq of last.captures) this.pieces.delete(sq);
    this.pieces.set(to, moving);
    moving.piece = ctx.state.board[to] ?? moving.piece;
    moving.image.setDepth(DEPTH.moving);
    const hops = last.path.slice(1).map((sq) => this.pointXY(sq));
    for (const obj of taken) this.leaving.add(obj.image);
    this.runtime.run(
      async (fx) => {
        for (const obj of taken)
          fx.defer(() => {
            this.leaving.delete(obj.image);
            obj.image.destroy();
          });
        await fx.parallel(
          async (move) => {
            for (const { x, y } of hops) {
              await move.tween({
                targets: moving.image,
                x,
                y,
                duration: 150,
                ease: 'Sine.easeInOut',
              });
            }
            move.checkpoint();
            moving.image.setTexture(this.pieceKey(moving.piece)).setDepth(DEPTH.piece);
            this.placePiece(moving, to);
          },
          ...taken.map((obj, i) => async (capture: FlowContext) => {
            await capture.tween({
              targets: obj.image,
              alpha: 0,
              delay: 150 * (i + 1),
              duration: 200,
            });
          }),
        );
      },
      { lane: 'move', onFailure: () => this.onResync(this.ctx) },
    );
  }

  protected onResync(ctx: Ctx) {
    this.onStart();
    this.onState(ctx);
  }

  protected onState(ctx: Ctx) {
    const size = RULES[ctx.state.variant].size;
    const flip = this.mySide(ctx) === other(RULES[ctx.state.variant].first);
    if (size !== this.grid.size) this.onStart();
    if (size !== this.grid.size || flip !== this.grid.flip) this.onLayout(ctx);
    this.syncPieces(ctx);
    const mine = this.mySide(ctx);
    this.moves =
      mine && !ctx.result && ctx.state.turn === mine
        ? legalMoves(ctx.state.board, mine, RULES[ctx.state.variant])
        : [];
    if (this.path.length && !this.moves.some((m) => this.startsWith(m, this.path))) this.path = [];
    this.drawMarks(ctx);
    this.showStatus(ctx);
    this.showButtons(ctx);
    this.layoutScore(ctx);
  }

  // ── Board ───────────────────────────────────────────────────────────────────────────────

  private mySide({ me, state }: Ctx): Side | null {
    if (!me) return null;
    const first = RULES[state.variant].first;
    return state.players[0] === me.id ? first : state.players[1] === me.id ? other(first) : null;
  }

  /** Screen position of a square's center (turned round for the side moving second). */
  pointXY(sq: number) {
    const { x0, y0, cell, size, flip } = this.grid;
    const row = flip ? size - 1 - rowOf(size, sq) : rowOf(size, sq);
    const col = flip ? size - 1 - colOf(size, sq) : colOf(size, sq);
    return { x: x0 + (col + 0.5) * cell, y: y0 + (row + 0.5) * cell };
  }

  private squareAt(x: number, y: number) {
    const { x0, y0, cell, size, flip } = this.grid;
    let col = Math.floor((x - x0) / cell);
    let row = Math.floor((y - y0) / cell);
    if (col < 0 || col >= size || row < 0 || row >= size) return null;
    if (flip) {
      col = size - 1 - col;
      row = size - 1 - row;
    }
    return row * size + col;
  }

  private drawBoard(left: number, top: number, side: number) {
    const { x0, y0, cell, size } = this.grid;
    const g = this.board.clear();
    g.fillStyle(COLORS.frame, 1).fillRoundedRect(left, top, side, side, side * 0.012);
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        g.fillStyle((row + col) % 2 ? COLORS.dark : COLORS.light, 1);
        g.fillRect(x0 + col * cell, y0 + row * cell, cell, cell);
      }
    }
  }

  /** Texture key of a piece's look: its image once the art exists, the drawn one until then. */
  private pieceKey(piece: string) {
    const side = sideOf(piece);
    const art = `${this.gameId}/piece-${SIDES[side].art}-${isKing(piece) ? 'king' : 'man'}`;
    return this.textures.exists(art) ? art : `checkers-${side}${isKing(piece) ? 'k' : ''}`;
  }

  /** Round pieces with a ridge, kings with a gold crown ring, drawn once. */
  private makeTextures() {
    const r = 64;
    for (const side of ['w', 'b'] as const) {
      for (const king of [false, true]) {
        const key = `checkers-${side}${king ? 'k' : ''}`;
        if (this.textures.exists(key)) continue;
        const [body, rim, ring] =
          side === 'w' ? [0xf6ead0, 0xc9b58c, 0xe2d2ae] : [0x2a1d1a, 0x0f0a09, 0x5a4038];
        const g = this.make.graphics({}, false);
        g.fillStyle(0x000000, 0.3).fillCircle(r + 3, r + 6, r - 6);
        g.fillStyle(rim, 1).fillCircle(r, r, r - 6);
        g.fillStyle(body, 1).fillCircle(r, r - 3, r - 10);
        g.lineStyle(4, ring, 1).strokeCircle(r, r - 3, r * 0.62);
        g.lineStyle(3, ring, 1).strokeCircle(r, r - 3, r * 0.38);
        if (king) {
          g.lineStyle(7, 0xf2c14e, 1).strokeCircle(r, r - 3, r * 0.5);
          g.fillStyle(0xf2c14e, 1).fillCircle(r, r - 3, r * 0.16);
        }
        g.generateTexture(key, r * 2 + 6, r * 2 + 8);
        g.destroy();
      }
    }
  }

  private placePiece(obj: PieceObj, sq: number) {
    const { x, y } = this.pointXY(sq);
    const size = this.grid.cell * 0.86;
    this.runtime.cancelTweens(obj.image);
    obj.image
      .setTexture(this.pieceKey(obj.piece))
      .setPosition(x, y)
      .setDisplaySize(size, size)
      .setAlpha(1)
      .setDepth(DEPTH.piece);
  }

  /** Makes the screen match the state: pieces appear or go without animation. */
  private syncPieces({ state }: Ctx) {
    for (const [sq, obj] of this.pieces) {
      if (state.board[sq] === obj.piece) continue;
      obj.image.destroy();
      this.pieces.delete(sq);
    }
    for (let sq = 0; sq < state.board.length; sq++) {
      const piece = state.board[sq] ?? '.';
      if (piece === '.' || this.pieces.has(sq)) continue;
      const obj = { piece, image: this.add.image(0, 0, this.pieceKey(piece)) };
      this.pieces.set(sq, obj);
      this.placePiece(obj, sq);
    }
  }

  private startsWith(move: Move, prefix: number[]) {
    return prefix.every((sq, i) => move.path[i] === sq);
  }

  /**
   * The last move's squares; on your turn, rings on the pieces that may move; the picked piece,
   * the squares it has landed on so far, the pieces it takes on the way and where it may go next.
   */
  private drawMarks(ctx: Ctx) {
    const { state } = ctx;
    const { cell } = this.grid;
    const g = this.marks.clear();
    const fill = (sq: number, color: number, alpha: number) => {
      const { x, y } = this.pointXY(sq);
      g.fillStyle(color, alpha).fillRect(x - cell / 2, y - cell / 2, cell, cell);
    };
    if (state.last) for (const sq of state.last.path) fill(sq, COLORS.last, 0.3);
    for (const obj of this.pieces.values()) obj.image.setAlpha(1);
    if (!this.path.length) {
      const starts = new Set(this.moves.map((m) => m.path[0] ?? -1));
      g.lineStyle(Math.max(2, cell * 0.06), COLORS.movable, 0.9);
      for (const sq of starts) {
        const { x, y } = this.pointXY(sq);
        g.strokeCircle(x, y, cell * 0.47);
      }
      return;
    }
    for (const sq of this.path) fill(sq, COLORS.selected, 0.45);
    const matching = this.moves.filter((m) => this.startsWith(m, this.path));
    // Pieces taken on the hops tapped so far fade a little.
    const hops = this.path.length - 1;
    for (const sq of matching[0]?.captures.slice(0, hops) ?? [])
      this.pieces.get(sq)?.image.setAlpha(0.4);
    const next = new Set(matching.map((m) => m.path[this.path.length] ?? -1));
    g.fillStyle(COLORS.target, 0.55);
    for (const sq of next) {
      if (sq < 0) continue;
      const { x, y } = this.pointXY(sq);
      g.fillCircle(x, y, cell * 0.18);
    }
  }

  // ── Taps ────────────────────────────────────────────────────────────────────────────────

  /**
   * A tap: pick a piece that may move, or the next square of its move (the move is sent once
   * the tapped squares make a whole move), or drop the pick.
   */
  private tap(x: number, y: number) {
    const sq = this.squareAt(x, y);
    if (sq === null || !isDark(this.grid.size, sq)) {
      this.path = [];
      this.drawMarks(this.ctx);
      return;
    }
    const extended = [...this.path, sq];
    const matching = this.path.length ? this.moves.filter((m) => this.startsWith(m, extended)) : [];
    if (matching.length) {
      const done = matching.find((m) => m.path.length === extended.length);
      if (done && matching.length === 1) {
        this.send('move', { path: done.path });
        this.path = [];
      } else this.path = extended;
    } else if (this.moves.some((m) => m.path[0] === sq)) {
      this.path = sq === this.path[0] && this.path.length === 1 ? [] : [sq];
    } else this.path = [];
    this.drawMarks(this.ctx);
  }

  // ── Status, score and buttons ───────────────────────────────────────────────────────────

  private nameOf(ctx: Ctx, side: Side) {
    const first = RULES[ctx.state.variant].first;
    const id = ctx.state.players[side === first ? 0 : 1];
    if (id === ctx.me?.id) return 'Bạn';
    return ctx.players.find((p) => p.id === id)?.name ?? SIDES[side].name;
  }

  private showStatus(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    let text: string;
    if (state.end) {
      const { winner, reason } = state.end;
      const loser = winner ? other(winner) : null;
      const how = {
        blocked: loser ? `${this.nameOf(ctx, loser)} hết nước đi` : '',
        resign: loser ? `${this.nameOf(ctx, loser)} đầu hàng` : '',
        left: loser ? `${this.nameOf(ctx, loser)} rời bàn` : '',
        repetition: 'Lặp lại thế cờ ba lần',
        'move-limit': 'Lâu không ăn quân',
        agreement: 'Hai bên đồng ý',
      }[reason];
      text = winner ? `${this.nameOf(ctx, winner)} thắng · ${how}` : `Hoà · ${how}`;
    } else {
      const must = this.moves[0]?.captures.length ? ' · Phải ăn quân' : '';
      text =
        state.turn === mine
          ? `Tới lượt bạn${must}`
          : `Lượt ${SIDES[state.turn].name} · ${this.nameOf(ctx, state.turn)}`;
      if (state.drawOffer && mine && state.drawOffer !== mine) {
        text = `${this.nameOf(ctx, state.drawOffer)} xin hoà`;
      }
    }
    this.status.setText(text);
  }

  private showButtons(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    const playing = Boolean(mine && !state.end && !ctx.result);
    const offered = playing && state.drawOffer && state.drawOffer !== mine;
    const vsBot = ctx.players.some((p) => p.bot);
    const { draw, decline, resign } = this.buttons;
    draw.container.setVisible(playing && !vsBot);
    resign.container.setVisible(playing);
    decline.container.setVisible(Boolean(offered));
    draw.setText(offered ? 'Đồng ý hoà' : state.drawOffer === mine ? 'Đã xin hoà' : 'Xin hoà');
    draw.setEnabled(state.drawOffer !== mine);
    resign.setText(this.resignArmed ? 'Chắc chưa?' : 'Đầu hàng');
    this.placeButtons();
  }

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

  /** The two players in the left column beside their pieces: the bottom side below. */
  private layoutScore({ players, score, state }: Ctx) {
    const { hud } = this.ctx.screen;
    const col = this.leftColumn;
    const icon = 52 * hud;
    const textX = col.x - col.width / 2 + icon + 12 * hud;
    const textW = col.width - icon - 12 * hud;
    const first = RULES[state.variant].first;
    const bottomSide = this.grid.flip ? other(first) : first;
    [0, 1].forEach((seat) => {
      const name = this.score.names[seat];
      const line = this.score.lines[seat];
      const img = this.score.icons[seat];
      const player = players[seat];
      if (!name || !line || !img) return;
      const side: Side =
        player && state.players[1] === player.id
          ? other(first)
          : player
            ? first
            : seat
              ? other(first)
              : first;
      const y = side === bottomSide ? col.bottom : col.top;
      img
        .setTexture(this.pieceKey(side))
        .setDisplaySize(icon, icon)
        .setPosition(col.x - col.width / 2 + icon / 2, y);
      name
        .setFontSize(26 * hud)
        .setColor(SIDES[side].text)
        .setPosition(textX, y - 14 * hud);
      this.fitText(name, player ? player.name : '…', textW, 18 * hud);
      line
        .setFontSize(20 * hud)
        .setText(`Thắng ${score.wins[seat] ?? 0} · Ăn ${state.taken[side]}`)
        .setPosition(textX, y + 16 * hud);
    });
  }
}
