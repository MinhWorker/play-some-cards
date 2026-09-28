/**
 * The game's screen, in the browser. The app calls the hooks in lifecycle order; `ctx` has the
 * state, `me`, the players, host, score, options, result and screen size.
 *
 *   onCreate  make the texts and controls        onPlace  a piece pops in, with its sound
 *   onLayout  place everything (and on resize)   onState  show whose turn, score, pieces
 *   onStart   a new game: start sound            onEnd    winning line glows, or the draw sound
 *
 * The board lives in its own layer, laid out in board units (a cell is UNIT wide at its x, y).
 * The layer is the camera: moving and scaling it frames the whole board, and when the board
 * grows the new tiles fade in while the layer glides to the new framing.
 */
import { GameView, type ViewContext, type ViewEvent } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { at, keyOf, points, winningLine } from '../game/board.js';
import { type Board, type Mark, type Options, type Point, type State, WIN } from '../game/model.js';
import { MARKS, TINT } from './theme.js';

type Ctx = ViewContext<State, Options>;

/** A cell's size inside the board layer; the layer's scale turns it into screen pixels. */
const UNIT = 100;
/** How long the camera takes to reframe a grown (or new) board. */
const GLIDE_MS = 650;

export class CaroView extends GameView<State, Options> {
  private status!: Phaser.GameObjects.Text;
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    numbers: Phaser.GameObjects.Text;
  };
  /** Host controls after a game: "⇄" and the piece the host plays next game. */
  private next!: {
    swap: Phaser.GameObjects.Text;
    piece: Phaser.GameObjects.Image;
  };
  /** The board layer (the camera), with the tiles under the pieces. */
  private layer!: Phaser.GameObjects.Container;
  private tileLayer!: Phaser.GameObjects.Container;
  private pieceLayer!: Phaser.GameObjects.Container;
  /** Tiles and pieces by cell ("x,y"). */
  private tiles = new Map<string, Phaser.GameObjects.Image>();
  private pieces = new Map<string, Phaser.GameObjects.Image>();
  /** The board's bounds the tiles show, as "left,top,cols,rows" (to see when it grew). */
  private shown = '';
  /** Winning line currently glowing, as its cells (so the pulse starts only once). */
  private glowing = '';
  /** The cell under the mouse (lights up when you may play it). */
  private hovered: string | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate(ctx: Ctx) {
    // The app reuses this scene for every Caro room on the page: forget the last one's objects
    // (Phaser destroyed them when it stopped).
    this.tiles = new Map();
    this.pieces = new Map();
    this.shown = '';
    this.glowing = '';
    this.hovered = null;
    this.tileLayer = this.add.container();
    this.pieceLayer = this.add.container();
    this.layer = this.add.container(0, 0, [this.tileLayer, this.pieceLayer]);
    this.status = this.label('', { size: 40 });
    this.score = {
      icons: [0, 1].map(() => this.sprite(MARKS.X.piece)),
      names: [0, 1].map(() => this.label('', { size: 26 })),
      numbers: this.label('', { size: 40 }),
    };
    this.score.names[0]?.setOrigin(1, 0.5);
    this.score.names[1]?.setOrigin(0, 0.5);
    this.next = {
      swap: this.tapText('⇄', () => this.swapColors()),
      piece: this.sprite(MARKS.X.piece)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.swapColors()),
    };
    this.syncTiles(ctx.state.board, false);
  }

  protected onLayout(ctx: Ctx) {
    const { size, cx, hud, statusY, scoreY } = this.boardArea();
    this.status
      .setFontSize(Math.min(44, Math.max(26, size * 0.093)) * hud)
      .setPosition(cx, statusY);
    this.layoutScore(ctx, cx, scoreY, size, hud);
    this.layoutNext(ctx, cx, statusY);
    this.frame(ctx.state.board, false);
  }

  /** A new game: a clean board, then the start sound. */
  protected onStart() {
    this.clearBoard();
    this.sfx('caro-start');
  }

  /** Someone marked a cell: pop the piece in with its sound (onState then sees it's there). */
  protected onPlace(ctx: Ctx, event: ViewEvent<Point>) {
    const p = { x: event.payload.x, y: event.payload.y };
    const mark = at(ctx.state.board, p);
    if (!mark || this.pieces.has(keyOf(p))) return;
    const piece = this.addPiece(p, mark).setScale(0);
    this.tweens.add({
      targets: piece,
      scale: this.pieceScale(piece),
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.sfx(MARKS[mark].sound);
  }

  protected onState(ctx: Ctx) {
    const { board } = ctx.state;
    // The board grew (or a new game shrank it): new tiles, and the camera glides to fit.
    if (boundsOf(board) !== this.shown) {
      this.syncTiles(board, true);
      this.frame(board, true);
    }
    // The screen follows the state: pieces missing on screen (opening the room mid-game) appear
    // without animation, pieces on emptied cells go.
    for (const p of points(board)) {
      const mark = at(board, p);
      if (mark && !this.pieces.has(keyOf(p))) this.addPiece(p, mark);
    }
    for (const [key, piece] of this.pieces) {
      const [x = 0, y = 0] = key.split(',').map(Number);
      if (at(board, { x, y })) continue;
      piece.destroy();
      this.pieces.delete(key);
    }
    const line = winningLine(board);
    for (const key of this.tiles.keys()) this.tintTile(key, line);
    this.glow(line);
    this.showStatus(ctx);
    this.layoutScore(ctx, ...this.scoreRow());
    this.layoutNext(ctx, this.boardArea().cx, this.status.y);
  }

  protected onEnd(ctx: Ctx) {
    this.sfx(winningLine(ctx.state.board) ? 'caro-line-complete' : 'caro-draw');
  }

  // ── Board ───────────────────────────────────────────────────────────────────────────────

  /**
   * Back to an empty board: no pieces, plain tiles, no glow. `onState` then draws whatever the
   * state has (nothing, at the start of a game) and shrinks the board back.
   */
  private clearBoard() {
    for (const piece of this.pieces.values()) {
      this.tweens.killTweensOf(piece);
      piece.destroy();
    }
    this.pieces.clear();
    for (const tile of this.tiles.values()) tile.clearTint();
    this.glowing = '';
  }

  /**
   * One wooden tile per cell of `board`: tiles off the board go, new ones are made (fading in,
   * nearest the old board first, when `animate`).
   */
  private syncTiles(board: Board, animate: boolean) {
    const old = this.shownBounds();
    const wanted = new Set(points(board).map(keyOf));
    for (const [key, tile] of this.tiles) {
      if (wanted.has(key)) continue;
      tile.destroy();
      this.tiles.delete(key);
    }
    for (const p of points(board)) {
      const key = keyOf(p);
      if (this.tiles.has(key)) continue;
      const tile = this.makeTile(p);
      this.tiles.set(key, tile);
      if (!animate || !old) continue;
      const away = Math.max(
        old.left - p.x,
        p.x - (old.left + old.cols - 1),
        old.top - p.y,
        p.y - (old.top + old.rows - 1),
      );
      tile.setAlpha(0);
      this.tweens.add({
        targets: tile,
        alpha: 1,
        duration: 320,
        delay: 120 + away * 110,
        ease: 'Sine.easeOut',
      });
    }
    if (this.hovered && !this.tiles.has(this.hovered)) this.hovered = null;
    this.shown = boundsOf(board);
  }

  private makeTile(p: Point) {
    const key = keyOf(p);
    const tile = this.sprite('tile')
      .setPosition(p.x * UNIT, p.y * UNIT)
      .setDisplaySize(UNIT * 0.96, UNIT * 0.96)
      .setInteractive({ useHandCursor: true });
    tile.on('pointerover', () => {
      this.hovered = key;
      this.tintTile(key);
    });
    tile.on('pointerout', () => {
      if (this.hovered === key) this.hovered = null;
      this.tintTile(key);
    });
    tile.on('pointerup', () => {
      if (!this.canPlay(p)) return;
      this.hovered = null;
      this.tintTile(key);
      this.send('place', p);
    });
    this.tileLayer.add(tile);
    return tile;
  }

  /** The bounds the tiles show now, or `null` before the first board. */
  private shownBounds() {
    if (!this.shown) return null;
    const [left = 0, top = 0, cols = 0, rows = 0] = this.shown.split(',').map(Number);
    return { left, top, cols, rows };
  }

  /**
   * Points the camera at `board`: the whole board fits the board area, centered. It glides
   * there when `smooth`, else jumps (first draw, screen resized).
   */
  private frame(board: Board, smooth: boolean) {
    const { size, cx, cy } = this.boardArea();
    const scale = size / Math.max(board.cols, board.rows) / UNIT;
    const x = cx - (board.left + (board.cols - 1) / 2) * UNIT * scale;
    const y = cy - (board.top + (board.rows - 1) / 2) * UNIT * scale;
    this.tweens.killTweensOf(this.layer);
    if (!smooth) {
      this.layer.setPosition(x, y).setScale(scale);
      return;
    }
    this.tweens.add({
      targets: this.layer,
      x,
      y,
      scale,
      duration: GLIDE_MS,
      ease: 'Cubic.easeInOut',
    });
  }

  /** Gold under the winning line, light under the mouse when you may play there, else plain. */
  private tintTile(key: string, line = winningLine(this.ctx.state.board)) {
    const tile = this.tiles.get(key);
    if (!tile) return;
    const [x = 0, y = 0] = key.split(',').map(Number);
    if (line?.some((p) => keyOf(p) === key)) tile.setTint(TINT.win);
    else if (key === this.hovered && this.canPlay({ x, y })) tile.setTint(TINT.hover);
    else tile.clearTint();
  }

  private canPlay(p: Point) {
    const { state, me, result } = this.ctx;
    return !result && state.turn === me?.id && at(state.board, p) === null;
  }

  private addPiece(p: Point, mark: Mark) {
    const piece = this.sprite(MARKS[mark].piece).setPosition(p.x * UNIT, p.y * UNIT);
    piece.setScale(this.pieceScale(piece));
    this.pieceLayer.add(piece);
    this.pieces.set(keyOf(p), piece);
    return piece;
  }

  private pieceScale(piece: Phaser.GameObjects.Image) {
    return (UNIT * 0.72) / piece.width;
  }

  /** The winning pieces bounce and glow gold while the result is shown. */
  private glow(line: Point[] | null) {
    const key = line?.map(keyOf).join(';') ?? '';
    if (key === this.glowing) return;
    this.glowing = key;
    line?.forEach((p, i) => {
      const piece = this.pieces.get(keyOf(p));
      if (!piece) return;
      piece.enableFilters().filters?.internal.addGlow(0xffe066, 6, 0, 1.2, false, 12, 12);
      const scale = this.pieceScale(piece);
      this.tweens.killTweensOf(piece);
      piece.setScale(scale);
      this.tweens.add({
        targets: piece,
        scale: scale * 1.18,
        duration: 420,
        delay: 300 + i * 120,
        ease: 'Sine.easeInOut',
        yoyo: true,
        repeat: -1,
      });
    });
  }

  // ── Status, score and the host's controls ───────────────────────────────────────────────

  /** Whose turn it is; after a game the host's controls take its place. */
  private showStatus({ state, me, result, isHost }: Ctx) {
    const rule = ` · nối ${WIN}`;
    const name = this.ctx.players.find((p) => p.id === state.turn)?.name ?? '?';
    const text = result
      ? 'Hết ván!'
      : state.turn === me?.id
        ? `Tới lượt bạn!${rule}`
        : `Lượt của ${name}${rule}`;
    this.status.setVisible(!(result && isHost));
    this.fitText(this.status, text, this.view.width - 24, 18);
  }

  private scoreRow(): [number, number, number, number] {
    const { size, cx, hud, scoreY } = this.boardArea();
    return [cx, scoreY, size, hud];
  }

  /**
   * Seat 0 left, score, seat 1 right: e.g. [X] Minh  2 – 1  Lan [O]. Each name has the color
   * and piece it plays this game. Long names are cut short with "…".
   */
  private layoutScore(
    { players, score, state }: Ctx,
    cx: number,
    y: number,
    size: number,
    hud: number,
  ) {
    const font = Math.min(26, Math.max(18, size * 0.06)) * hud;
    const icon = font * 1.5;
    this.score.numbers
      .setText(`${score.wins[0] ?? 0}  –  ${score.wins[1] ?? 0}`)
      .setFontSize(font * 1.5)
      .setPosition(cx, y);
    const half = this.score.numbers.width / 2 + font * 0.6;
    const nameWidth = this.view.width / 2 - 12 - half - font * 0.4 - icon;
    [0, 1].forEach((seat) => {
      const name = this.score.names[seat];
      const img = this.score.icons[seat];
      const player = players[seat];
      if (!name || !img) return;
      const mark: Mark = player
        ? state.players[0] === player.id
          ? 'X'
          : 'O'
        : seat === 0
          ? 'X'
          : 'O';
      const side = seat === 0 ? -1 : 1;
      name
        .setFontSize(font)
        .setColor(MARKS[mark].color)
        .setPosition(cx + side * half, y);
      this.fitText(name, player ? player.name : '…', nameWidth);
      img
        .setTexture(this.texture(MARKS[mark].piece))
        .setDisplaySize(icon, icon)
        .setPosition(cx + side * (half + name.width + font * 0.4 + icon / 2), y);
    });
  }

  /** [⇄][the piece the host plays next game] — host only, after a game. */
  private layoutNext({ result, isHost, options, players, me }: Ctx, cx: number, y: number) {
    const { swap, piece } = this.next;
    const show = Boolean(result) && isHost;
    for (const obj of [swap, piece]) obj.setVisible(show);
    if (!show) return;
    const font = this.status.style.fontSize
      ? Number.parseFloat(String(this.status.style.fontSize))
      : 32;
    const small = font * 0.75;
    const hostSeat = players.findIndex((p) => p.id === me?.id);
    const nextMark: Mark = (hostSeat === 0) !== options.swap ? 'X' : 'O';
    swap.setFontSize(small);
    piece.setTexture(this.texture(MARKS[nextMark].piece)).setDisplaySize(small * 1.3, small * 1.3);
    const gap = small * 0.8;
    const width = swap.displayWidth + gap + piece.displayWidth;
    swap.setPosition(cx - width / 2 + swap.displayWidth / 2, y);
    piece.setPosition(cx + width / 2 - piece.displayWidth / 2, y);
  }

  private swapColors() {
    this.changeOptions({ ...this.ctx.options, swap: !this.ctx.options.swap });
  }

  /** A tappable text (the host's controls). */
  private tapText(text: string, onTap: () => void) {
    return this.label(text, { size: 26 })
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.sfx('caro-select');
        onTap();
      });
  }
}

/** A board's bounds as "left,top,cols,rows". */
const boundsOf = ({ left, top, cols, rows }: Board) => `${left},${top},${cols},${rows}`;
