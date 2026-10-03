/**
 * The board, in the browser. The app calls the hooks in lifecycle order; `ctx` has the state,
 * `me`, the players, host, score, options, result and screen size.
 *
 *   onCreate  board, texts and buttons                onMove   slide the piece (and the rook)
 *   onLayout  place everything (and on resize)       onState  pieces, marks, status, buttons
 *   onStart   a new game: clean board
 *
 * Tap one of your pieces on your turn to see where it may go (dots; rings on pieces it can
 * take), then tap a square to move. A pawn reaching the last rank asks what it becomes. Black's
 * player sees the board turned round.
 *
 * The board is drawn here (squares, frame, coordinates). Pieces are chess symbols drawn as text
 * until their images exist in assets/ (theme.ts); sounds come with the art.
 */
import {
  type Button,
  type FlowHandle,
  GameView,
  type ViewContext,
  type ViewEvent,
} from '@psc/sdk/client';
import type Phaser from 'phaser';
import type { Move, Options, Piece, Promotion, Side, View } from '../game/model.js';
import { SIZE } from '../game/model.js';
import {
  colOf,
  isPromotion,
  kindOf,
  kingOf,
  legalTargets,
  PROMOTIONS,
  rowOf,
  sideOf,
  square,
} from '../game/rules.js';
import {
  COLORS,
  DISC,
  endText,
  GLYPH_FONT,
  glyphOf,
  PROMOTION_NAMES,
  pieceImage,
  SIDES,
} from './theme.js';

type Ctx = ViewContext<View, Options>;

/** A piece on screen: its image, or its symbol until the art exists. */
interface PieceObj {
  piece: Piece;
  look: Phaser.GameObjects.Image | Phaser.GameObjects.Text;
}

const DEPTH = { board: 0, marks: 1, piece: 5, moving: 7, picker: 10 } as const;

/** Where the rook goes when the king castles to `to` (from its corner). */
const CASTLE_ROOKS: Record<number, [number, number]> = {
  62: [63, 61],
  58: [56, 59],
  6: [7, 5],
  2: [0, 3],
};

export class ChessView extends GameView<View, Options> {
  private board!: Phaser.GameObjects.Graphics;
  /** Marks on the squares, under the pieces: last move, selection, targets, check. */
  private marks!: Phaser.GameObjects.Graphics;
  /** Files a–h along the bottom row, ranks 1–8 along the left column. */
  private coords!: { files: Phaser.GameObjects.Text[]; ranks: Phaser.GameObjects.Text[] };
  private zone!: Phaser.GameObjects.Zone;
  private status!: Phaser.GameObjects.Text;
  /** Per seat: the king it plays, its name and its wins, in the left column. */
  private score!: {
    icons: PieceObj[];
    names: Phaser.GameObjects.Text[];
    wins: Phaser.GameObjects.Text[];
  };
  /** The column left of the board (x in the middle), for the score. */
  private leftColumn = { x: 0, width: 200, top: 0, bottom: 400 };
  private buttons!: { draw: Button; decline: Button; resign: Button };
  /** "What does the pawn become?": a backdrop, a title and one button per piece. */
  private picker!: {
    bg: Phaser.GameObjects.Graphics;
    title: Phaser.GameObjects.Text;
    choices: Button[];
  };
  /** The pawn move waiting for its promotion piece. */
  private promoting: Move | null = null;
  private pieces = new Map<number, PieceObj>();
  /** Taken pieces fading out. */
  private leaving = new Set<PieceObj['look']>();
  /** Where square a8's top-left corner is on screen, a square's size, and the board turned. */
  private grid = { x0: 0, y0: 0, cell: 60, flip: false };
  private selected: number | null = null;
  private targets: number[] = [];
  /** The buttons' stack in the column right of the board: its middle, bottom and sizes. */
  private buttonStack = { x: 0, bottom: 0, width: 200, height: 40 };
  /** "Đầu hàng" was tapped once: a second tap within a few seconds confirms. */
  private resignArmed = false;
  private resignTimer?: FlowHandle;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate() {
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.pieces = new Map();
    this.leaving = new Set();
    this.selected = null;
    this.targets = [];
    this.promoting = null;
    this.board = this.add.graphics().setDepth(DEPTH.board);
    this.marks = this.add.graphics().setDepth(DEPTH.marks);
    const coord = () => this.add.text(0, 0, '', { fontStyle: '700' }).setDepth(DEPTH.marks);
    this.coords = {
      files: Array.from({ length: SIZE }, () => coord().setOrigin(1, 1)),
      ranks: Array.from({ length: SIZE }, () => coord().setOrigin(0, 0)),
    };
    this.zone = this.add
      .zone(0, 0, 10, 10)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', (p: Phaser.Input.Pointer) => this.tap(p.worldX, p.worldY));
    this.status = this.label('', { size: 34 });
    this.score = {
      icons: [0, 1].map(() => ({ piece: 'K', look: this.makeLook('K') })),
      names: [0, 1].map(() => this.label('', { size: 26 }).setOrigin(0, 0.5)),
      wins: [0, 1].map(() => this.label('', { size: 20 }).setOrigin(0, 0.5)),
    };
    const opts = { image: 'button', size: 24 };
    this.buttons = {
      draw: this.button('Xin hoà', () => this.send('offer-draw'), opts),
      decline: this.button('Từ chối', () => this.send('decline-draw'), opts),
      resign: this.button('Đầu hàng', () => this.resign(), opts),
    };
    this.picker = {
      bg: this.add.graphics().setDepth(DEPTH.picker),
      title: this.label('Phong cấp', { size: 30 }).setDepth(DEPTH.picker),
      choices: PROMOTIONS.map((p) =>
        this.button(PROMOTION_NAMES[p], () => this.promote(p), { ...opts, size: 26 }),
      ),
    };
    for (const choice of this.picker.choices) choice.container.setDepth(DEPTH.picker);
    this.showPicker(false);
  }

  /**
   * On the frame (docs/ui-guide.md): the board as tall as it fits under the room bar, in the
   * middle; the players and their wins in the column on its left (the side at the top of the
   * board above, yours below); the status line and the buttons in the column on its right.
   */
  protected onLayout(ctx: Ctx) {
    const { width, height, top, hud } = ctx.screen;
    const margin = 16;
    const availH = height - top - margin;
    const size = Math.max(160, Math.min(width - 2 * 150 * hud, availH));
    const frame = size * 0.03;
    const cell = (size - 2 * frame) / SIZE;
    const left = (width - size) / 2;
    const boardTop = top + Math.max(0, (availH - size) / 2);
    const columnW = left - 2 * margin;
    this.grid = {
      x0: left + frame,
      y0: boardTop + frame,
      cell,
      flip: this.mySide(ctx) === 'b',
    };
    this.drawBoard(left, boardTop, size);
    this.zone.setPosition(this.grid.x0, this.grid.y0).setSize(cell * SIZE, cell * SIZE);
    this.zone.input?.hitArea.setTo(0, 0, cell * SIZE, cell * SIZE);

    const rightX = left + size + margin + columnW / 2;
    this.status
      .setFontSize(Math.min(34, Math.max(22, cell * 0.4)) * hud)
      .setOrigin(0.5, 0)
      .setWordWrapWidth(columnW)
      .setPosition(rightX, boardTop + 8);
    this.leftColumn = {
      x: margin + columnW / 2,
      width: columnW,
      top: boardTop + 40 * hud,
      bottom: boardTop + size - 40 * hud,
    };
    this.layoutScore(ctx);
    this.buttonStack = {
      x: rightX,
      bottom: boardTop + size,
      width: Math.min(columnW, 190 * hud),
      height: 56 * hud,
    };
    this.placeButtons();
    this.layoutPicker();

    for (const [sq, obj] of this.pieces) {
      this.runtime.cancelTweens(obj.look);
      this.restyle(obj);
      this.placePiece(obj, sq);
    }
    this.drawMarks(ctx);
  }

  /** A new game: an empty board (onState sets the pieces out). */
  protected onStart() {
    this.resignTimer?.cancel();
    this.resignTimer = undefined;
    this.resignArmed = false;
    this.buttons.resign.setText('Đầu hàng');
    for (const obj of this.pieces.values()) obj.look.destroy();
    for (const look of this.leaving) look.destroy();
    this.pieces.clear();
    this.leaving.clear();
    this.deselect();
  }

  /**
   * A move was played: the piece slides to its square (the rook too when castling), the taken
   * piece fades, a promoted pawn turns into its new piece as it lands.
   */
  protected onMove(ctx: Ctx, event: ViewEvent<Move>) {
    const { from, to } = event.payload;
    const last = ctx.state.last;
    const moving = this.pieces.get(from);
    this.deselect();
    if (!moving || !last) return; // onState draws whatever is missing
    const taken = last.enPassant ? square(rowOf(from), colOf(to)) : to;
    const victim = this.pieces.get(taken);
    if (victim) {
      this.pieces.delete(taken);
      this.fade(victim);
    }
    this.pieces.delete(from);
    this.pieces.set(to, moving);
    const becomes = ctx.state.board[to];
    if (becomes && becomes !== moving.piece) {
      moving.piece = becomes;
      this.slide(moving, to, () => this.restyle(moving));
    } else this.slide(moving, to);
    const rook = last.castle ? CASTLE_ROOKS[to] : undefined;
    const rookObj = rook && this.pieces.get(rook[0]);
    if (rook && rookObj) {
      this.pieces.delete(rook[0]);
      this.pieces.set(rook[1], rookObj);
      this.slide(rookObj, rook[1]);
    }
  }

  protected onResync(ctx: Ctx) {
    this.onStart();
    this.onState(ctx);
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
  }

  // ── Board ───────────────────────────────────────────────────────────────────────────────

  private mySide({ me, state }: Ctx): Side | null {
    if (!me) return null;
    return state.players[0] === me.id ? 'w' : state.players[1] === me.id ? 'b' : null;
  }

  /** Row and column as drawn (Black's player sees the board turned round). */
  private shown(sq: number) {
    const { flip } = this.grid;
    return {
      row: flip ? SIZE - 1 - rowOf(sq) : rowOf(sq),
      col: flip ? SIZE - 1 - colOf(sq) : colOf(sq),
    };
  }

  /** Screen position of a square's center. */
  pointXY(sq: number) {
    const { x0, y0, cell } = this.grid;
    const { row, col } = this.shown(sq);
    return { x: x0 + (col + 0.5) * cell, y: y0 + (row + 0.5) * cell };
  }

  /** The square under a screen position. */
  private squareAt(x: number, y: number) {
    const { x0, y0, cell, flip } = this.grid;
    let col = Math.floor((x - x0) / cell);
    let row = Math.floor((y - y0) / cell);
    if (col < 0 || col >= SIZE || row < 0 || row >= SIZE) return null;
    if (flip) {
      col = SIZE - 1 - col;
      row = SIZE - 1 - row;
    }
    return square(row, col);
  }

  /** The frame and the 64 squares, with the files and ranks written on the edge squares. */
  private drawBoard(left: number, top: number, size: number) {
    const { x0, y0, cell, flip } = this.grid;
    const g = this.board.clear();
    g.fillStyle(COLORS.frame, 1).fillRoundedRect(left, top, size, size, size * 0.012);
    for (let row = 0; row < SIZE; row++) {
      for (let col = 0; col < SIZE; col++) {
        g.fillStyle((row + col) % 2 ? COLORS.dark : COLORS.light, 1);
        g.fillRect(x0 + col * cell, y0 + row * cell, cell, cell);
      }
    }
    const font = `${Math.round(cell * 0.2)}px`;
    const pad = cell * 0.06;
    this.coords.files.forEach((text, col) => {
      // Light text on dark squares and the other way round (a8 and h1 are light).
      text
        .setText('abcdefgh'[flip ? SIZE - 1 - col : col] ?? '')
        .setFontSize(font)
        .setColor(col % 2 ? COLORS.lightText : COLORS.darkText)
        .setPosition(x0 + (col + 1) * cell - pad, y0 + SIZE * cell - pad * 0.5);
    });
    this.coords.ranks.forEach((text, row) => {
      text
        .setText(String(flip ? row + 1 : SIZE - row))
        .setFontSize(font)
        .setColor(row % 2 ? COLORS.darkText : COLORS.lightText)
        .setPosition(x0 + pad, y0 + row * cell + pad * 0.5);
    });
  }

  /** Makes the screen match the state: pieces appear or go without animation. */
  private syncPieces({ state }: Ctx) {
    for (const [sq, obj] of this.pieces) {
      if (state.board[sq] !== obj.piece) {
        obj.look.destroy();
        this.pieces.delete(sq);
      }
    }
    state.board.forEach((piece, sq) => {
      if (!piece || this.pieces.has(sq)) return;
      const obj = { piece, look: this.makeLook(piece) };
      this.pieces.set(sq, obj);
      this.placePiece(obj, sq);
    });
  }

  /** A piece's image, or its symbol when the art isn't there yet. */
  private makeLook(piece: Piece): PieceObj['look'] {
    const side = sideOf(piece);
    const kind = kindOf(piece);
    const key = `${this.gameId}/${pieceImage(side, kind)}`;
    if (this.textures.exists(key)) return this.add.image(0, 0, key).setDepth(DEPTH.piece);
    const { fill, edge } = SIDES[side];
    return this.add
      .text(0, 0, glyphOf(kind), { fontFamily: GLYPH_FONT, color: fill, stroke: edge })
      .setOrigin(0.5, 0.52)
      .setDepth(DEPTH.piece);
  }

  /** Sizes a piece's look for `size` design units (the piece's width). */
  private sizeLook(look: PieceObj['look'], size: number) {
    if ('setFontSize' in look) {
      look.setFontSize(Math.round(size)).setStroke(look.style.stroke, Math.max(2, size * 0.06));
    } else look.setDisplaySize(size / DISC, size / DISC);
  }

  /** A promoted piece changes its looks. */
  private restyle(obj: PieceObj) {
    const { x, y } = obj.look;
    obj.look.destroy();
    obj.look = this.makeLook(obj.piece);
    this.sizeLook(obj.look, this.grid.cell * 0.82);
    obj.look.setPosition(x, y);
  }

  /** Puts a piece on its square at the current board size. */
  private placePiece(obj: PieceObj, sq: number) {
    const { x, y } = this.pointXY(sq);
    this.runtime.cancelTweens(obj.look);
    this.sizeLook(obj.look, this.grid.cell * 0.82);
    obj.look.setPosition(x, y).setAlpha(1).setDepth(DEPTH.piece);
  }

  private slide(obj: PieceObj, to: number, done?: () => void) {
    const { x, y } = this.pointXY(to);
    this.runtime.cancelTweens(obj.look);
    obj.look.setDepth(DEPTH.moving);
    this.runtime.run(async (fx) => {
      await fx.tween({ targets: obj.look, x, y, duration: 180, ease: 'Sine.easeInOut' });
      fx.checkpoint();
      obj.look.setDepth(DEPTH.piece);
      done?.();
    });
  }

  private fade(obj: PieceObj) {
    const look = obj.look;
    this.leaving.add(look);
    this.runtime.cancelTweens(look);
    this.runtime.run(async (fx) => {
      fx.defer(() => {
        this.leaving.delete(look);
        look.destroy();
      });
      await fx.tween({ targets: look, alpha: 0, delay: 120, duration: 200 });
    });
  }

  /** Marks on the squares: the last move, the picked piece and where it may go, a king in check. */
  private drawMarks(ctx: Ctx) {
    const { state } = ctx;
    const { cell } = this.grid;
    const g = this.marks.clear();
    const fill = (sq: number, color: number, alpha: number) => {
      const { x, y } = this.pointXY(sq);
      g.fillStyle(color, alpha).fillRect(x - cell / 2, y - cell / 2, cell, cell);
    };
    if (state.last) {
      fill(state.last.from, COLORS.last, 0.35);
      fill(state.last.to, COLORS.last, 0.45);
    }
    if (state.check && !ctx.result) fill(kingOf(state.board, state.turn), COLORS.check, 0.55);
    if (this.selected !== null) fill(this.selected, COLORS.selected, 0.5);
    const picked = this.selected === null ? null : state.board[this.selected];
    for (const sq of this.targets) {
      const { x, y } = this.pointXY(sq);
      g.fillStyle(COLORS.target, 0.35);
      const enPassant = picked && kindOf(picked) === 'p' && colOf(sq) !== colOf(this.selected ?? 0);
      if (state.board[sq] || enPassant) {
        // A ring on a piece it can take.
        g.lineStyle(cell * 0.08, COLORS.target, 0.45).strokeCircle(x, y, cell * 0.44);
      } else g.fillCircle(x, y, cell * 0.16);
    }
  }

  // ── Taps ────────────────────────────────────────────────────────────────────────────────

  private canPick(ctx: Ctx, sq: number) {
    const piece = ctx.state.board[sq];
    const side = this.mySide(ctx);
    return Boolean(piece && !ctx.result && side === ctx.state.turn && sideOf(piece) === side);
  }

  /**
   * A tap on the board: pick one of your pieces, move the picked one to a marked square (a pawn
   * reaching the last rank asks what it becomes first), or drop it. Tapping it again drops it.
   */
  private tap(x: number, y: number) {
    const ctx = this.ctx;
    const sq = this.squareAt(x, y);
    if (sq === null) return;
    if (this.promoting) {
      this.promoting = null;
      this.showPicker(false);
    }
    if (this.selected !== null && this.targets.includes(sq)) {
      const move = { from: this.selected, to: sq };
      if (isPromotion(ctx.state, move)) {
        this.promoting = move;
        this.showPicker(true);
        return;
      }
      this.send('move', move);
      this.deselect();
    } else if (sq === this.selected) {
      this.deselect();
    } else if (this.canPick(ctx, sq)) {
      this.selected = sq;
      this.targets = legalTargets(ctx.state, sq);
    } else {
      this.deselect();
    }
    this.drawMarks(ctx);
  }

  private promote(promotion: Promotion) {
    if (!this.promoting) return;
    this.send('move', { ...this.promoting, promotion });
    this.promoting = null;
    this.showPicker(false);
    this.deselect();
    this.drawMarks(this.ctx);
  }

  private deselect() {
    this.selected = null;
    this.targets = [];
    if (this.promoting) {
      this.promoting = null;
      this.showPicker(false);
    }
  }

  private showPicker(shown: boolean) {
    this.picker.bg.setVisible(shown);
    this.picker.title.setVisible(shown);
    for (const choice of this.picker.choices) choice.container.setVisible(shown);
  }

  /** The promotion picker, across the middle of the board. */
  private layoutPicker() {
    const { x0, y0, cell } = this.grid;
    const { hud } = this.ctx.screen;
    const cx = x0 + (cell * SIZE) / 2;
    const cy = y0 + (cell * SIZE) / 2;
    const w = cell * SIZE * 0.9;
    const btnH = 56 * hud;
    const h = btnH * 2.6;
    this.picker.bg
      .clear()
      .fillStyle(0x2b1d12, 0.9)
      .fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 16)
      .lineStyle(3, 0xf2c14e, 1)
      .strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);
    this.picker.title.setFontSize(30 * hud).setPosition(cx, cy - h / 2 + btnH * 0.55);
    const gap = 8;
    const n = this.picker.choices.length;
    const btnW = (w - 32 - gap * (n - 1)) / n;
    this.picker.choices.forEach((choice, i) => {
      choice
        .setSize(btnW, btnH)
        .setPosition(cx - w / 2 + 16 + btnW / 2 + i * (btnW + gap), cy + h / 2 - btnH * 0.8);
    });
  }

  // ── Status, score and buttons ───────────────────────────────────────────────────────────

  private nameOf(ctx: Ctx, side: Side) {
    const id = ctx.state.players[side === 'w' ? 0 : 1];
    if (id === ctx.me?.id) return 'Bạn';
    return ctx.players.find((p) => p.id === id)?.name ?? SIDES[side].name;
  }

  private showStatus(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    let text: string;
    if (state.end) {
      const winner = state.end.winner;
      const loser = winner === 'w' ? 'b' : 'w';
      text = endText(
        state.end.reason,
        winner ? this.nameOf(ctx, winner) : '',
        winner ? this.nameOf(ctx, loser) : '',
      );
    } else {
      const check = state.check ? ' · Chiếu!' : '';
      text =
        state.turn === mine
          ? `Tới lượt bạn${check}`
          : `Lượt ${SIDES[state.turn].name} · ${this.nameOf(ctx, state.turn)}${check}`;
      if (state.drawOffer && state.drawOffer !== mine && mine) {
        text = `${this.nameOf(ctx, state.drawOffer)} xin hoà`;
      }
    }
    this.status.setText(text);
  }

  /** Game buttons for seated players while the game is on ("Từ chối" only after an offer). */
  private showButtons(ctx: Ctx) {
    const { state } = ctx;
    const mine = this.mySide(ctx);
    const playing = Boolean(mine && !state.end && !ctx.result);
    const offered = playing && state.drawOffer && state.drawOffer !== mine;
    // The computer never takes a draw: no point offering one.
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

  /**
   * The two players in the left column, each beside the king it plays, with its wins: the side
   * at the top of the board above, the side at the bottom below.
   */
  private layoutScore({ players, score, state }: Ctx) {
    const { hud } = this.ctx.screen;
    const col = this.leftColumn;
    const icon = 56 * hud;
    const textX = col.x - col.width / 2 + icon + 10 * hud;
    const textW = col.width - icon - 10 * hud;
    const bottomSide: Side = this.grid.flip ? 'b' : 'w';
    [0, 1].forEach((seat) => {
      const name = this.score.names[seat];
      const wins = this.score.wins[seat];
      const king = this.score.icons[seat];
      const player = players[seat];
      if (!name || !wins || !king) return;
      const side: Side = player ? (state.players[0] === player.id ? 'w' : 'b') : seat ? 'b' : 'w';
      const y = side === bottomSide ? col.bottom : col.top;
      const piece = side === 'w' ? 'K' : 'k';
      if (king.piece !== piece) {
        king.piece = piece;
        this.restyle(king);
      }
      this.sizeLook(king.look, icon);
      king.look.setPosition(col.x - col.width / 2 + icon / 2, y);
      name.setFontSize(26 * hud).setPosition(textX, y - 14 * hud);
      this.fitText(name, player ? player.name : '…', textW, 18 * hud);
      wins
        .setFontSize(20 * hud)
        .setText(`Thắng ${score.wins[seat] ?? 0}`)
        .setPosition(textX, y + 16 * hud);
    });
  }
}
