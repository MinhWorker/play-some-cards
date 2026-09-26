/**
 * The game's screen, in the browser. The app calls the hooks in lifecycle order; `ctx` has the
 * state, `me`, the players, host, score, options, result and screen size.
 *
 *   onCreate  make the texts and controls        onPlace  a piece pops in, with its sound
 *   onLayout  place everything (and on resize)   onState  show whose turn, score, pieces
 *   onStart   a new game: start sound            onEnd    winning line glows, or the draw sound
 */
import { GameView, type ViewContext, type ViewEvent } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { winningLine } from '../game/board.js';
import { type Mark, type Options, SIZES, type State } from '../game/model.js';
import { MARKS, PICKED, TINT, UNPICKED } from './theme.js';

type Ctx = ViewContext<State, Options>;

export class CaroView extends GameView<State, Options> {
  private status!: Phaser.GameObjects.Text;
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    numbers: Phaser.GameObjects.Text;
  };
  /** Host controls after a game: one text per board size, then "⇄" and the host's next piece. */
  private next!: {
    sizes: Phaser.GameObjects.Text[];
    swap: Phaser.GameObjects.Text;
    piece: Phaser.GameObjects.Image;
  };
  private tiles: Phaser.GameObjects.Image[] = [];
  private pieces: (Phaser.GameObjects.Image | null)[] = [];
  /** Where the grid is: its center and cell size (set by onLayout). */
  private grid = { cx: 0, cy: 0, cell: 0 };
  /** Winning line currently glowing, as "a,b,c" (so the pulse starts only once). */
  private glowing = '';
  /** The cell under the mouse (lights up when you may play it). */
  private hovered: number | null = null;

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  protected onCreate(ctx: Ctx) {
    this.status = this.label('', { size: 40 });
    this.score = {
      icons: [0, 1].map(() => this.sprite(MARKS.X.piece)),
      names: [0, 1].map(() => this.label('', { size: 26 })),
      numbers: this.label('', { size: 40 }),
    };
    this.score.names[0]?.setOrigin(1, 0.5);
    this.score.names[1]?.setOrigin(0, 0.5);
    this.next = {
      sizes: SIZES.map((size) =>
        this.tapText(`${size}×${size}`, () => this.changeOptions({ ...this.ctx.options, size })),
      ),
      swap: this.tapText('⇄', () => this.swapColors()),
      piece: this.sprite(MARKS.X.piece)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.swapColors()),
    };
    this.makeGrid(ctx.state.board.length);
  }

  protected onLayout(ctx: Ctx) {
    const { size, cx, cy, hud, statusY, scoreY } = this.boardArea();
    const cells = ctx.state.size;
    this.grid = { cx, cy, cell: size / cells };
    this.status
      .setFontSize(Math.min(44, Math.max(26, size * 0.093)) * hud)
      .setPosition(cx, statusY);
    this.layoutScore(ctx, cx, scoreY, size, hud);
    this.layoutNext(ctx, cx, statusY);
    this.tiles.forEach((tile, cell) => {
      const { x, y } = this.cellXY(cell, cells);
      tile.setPosition(x, y).setDisplaySize(this.grid.cell * 0.96, this.grid.cell * 0.96);
    });
    this.pieces.forEach((piece, cell) => {
      if (!piece) return;
      const { x, y } = this.cellXY(cell, cells);
      piece.setPosition(x, y);
      if (!this.tweens.isTweening(piece)) piece.setScale(this.pieceScale(piece));
    });
  }

  /** A new game: a clean board, then the start sound. */
  protected onStart() {
    this.clearBoard();
    this.sfx('caro-start');
  }

  /** Someone marked a cell: pop the piece in with its sound (onState then sees it's there). */
  protected onPlace(ctx: Ctx, event: ViewEvent<{ cell: number }>) {
    const { cell } = event.payload;
    const mark = ctx.state.board[cell];
    if (!mark || this.pieces[cell]) return;
    const piece = this.addPiece(cell, mark, ctx.state.size).setScale(0);
    this.tweens.add({
      targets: piece,
      scale: this.pieceScale(piece),
      duration: 260,
      ease: 'Back.easeOut',
    });
    this.sfx(MARKS[mark].sound);
  }

  protected onState(ctx: Ctx) {
    const { state } = ctx;
    if (this.tiles.length !== state.board.length) {
      this.makeGrid(state.board.length);
      this.onLayout(ctx);
    }
    // The screen follows the state: pieces missing on screen (opening the room mid-game) appear
    // without animation, pieces on emptied cells go.
    state.board.forEach((mark, cell) => {
      const piece = this.pieces[cell];
      if (mark && !piece) this.addPiece(cell, mark, state.size);
      if (!mark && piece) {
        piece.destroy();
        this.pieces[cell] = null;
      }
    });
    const line = winningLine(state.board, state.win);
    for (let cell = 0; cell < this.tiles.length; cell++) this.tintTile(cell, line);
    this.glow(line);
    this.showStatus(ctx);
    this.layoutScore(ctx, ...this.scoreRow());
    this.layoutNext(ctx, this.grid.cx, this.status.y);
  }

  protected onEnd(ctx: Ctx) {
    const line = winningLine(ctx.state.board, ctx.state.win);
    this.sfx(line ? 'caro-line-complete' : 'caro-draw');
  }

  // ── Grid ────────────────────────────────────────────────────────────────────────────────

  /**
   * Back to an empty board: no pieces, plain tiles, no glow. `onState` then draws whatever the
   * state has (nothing, at the start of a game).
   */
  private clearBoard() {
    this.pieces.forEach((piece, cell) => {
      if (piece) this.tweens.killTweensOf(piece);
      piece?.destroy();
      this.pieces[cell] = null;
    });
    for (const tile of this.tiles) tile.clearTint();
    this.glowing = '';
  }

  /** Gold under the winning line, light under the mouse when you may play there, else plain. */
  private tintTile(cell: number, line = winningLine(this.ctx.state.board, this.ctx.state.win)) {
    const tile = this.tiles[cell];
    if (!tile) return;
    if (line?.includes(cell)) tile.setTint(TINT.win);
    else if (cell === this.hovered && this.canPlay(cell)) tile.setTint(TINT.hover);
    else tile.clearTint();
  }

  /** One wooden tile per cell; rebuilt when a new game uses another board size. */
  private makeGrid(cells: number) {
    for (const obj of [...this.tiles, ...this.pieces]) obj?.destroy();
    this.hovered = null;
    this.tiles = Array.from({ length: cells }, (_, cell) => {
      const tile = this.sprite('tile').setInteractive({ useHandCursor: true });
      tile.on('pointerover', () => {
        this.hovered = cell;
        this.tintTile(cell);
      });
      tile.on('pointerout', () => {
        if (this.hovered === cell) this.hovered = null;
        this.tintTile(cell);
      });
      tile.on('pointerup', () => {
        if (!this.canPlay(cell)) return;
        this.hovered = null;
        this.tintTile(cell);
        this.send('place', { cell });
      });
      return tile;
    });
    this.pieces = Array(cells).fill(null);
    this.glowing = '';
  }

  private canPlay(cell: number) {
    const { state, me, result } = this.ctx;
    return !result && state.turn === me?.id && state.board[cell] === null;
  }

  private cellXY(cell: number, cells: number) {
    const middle = (cells - 1) / 2;
    return {
      x: this.grid.cx + ((cell % cells) - middle) * this.grid.cell,
      y: this.grid.cy + (Math.floor(cell / cells) - middle) * this.grid.cell,
    };
  }

  private addPiece(cell: number, mark: Mark, cells: number) {
    const { x, y } = this.cellXY(cell, cells);
    const piece = this.sprite(MARKS[mark].piece).setPosition(x, y);
    piece.setScale(this.pieceScale(piece));
    this.pieces[cell] = piece;
    return piece;
  }

  private pieceScale(piece: Phaser.GameObjects.Image) {
    return (this.grid.cell * 0.72) / piece.width;
  }

  /** The winning pieces bounce and glow gold while the result is shown. */
  private glow(line: number[] | null) {
    const key = line?.join(',') ?? '';
    if (key === this.glowing) return;
    this.glowing = key;
    line?.forEach((cell, i) => {
      const piece = this.pieces[cell];
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
    const rule = state.size > 3 ? ` · nối ${state.win}` : '';
    const name = this.ctx.players.find((p) => p.id === state.turn)?.name ?? '?';
    const text = result
      ? 'Hết ván!'
      : state.turn === me?.id
        ? `Tới lượt bạn!${rule}`
        : `Lượt của ${name}${rule}`;
    this.status.setVisible(!(result && isHost));
    this.fitText(this.status, text, this.scale.width - 24, 18);
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
    const nameWidth = this.scale.width / 2 - 12 - half - font * 0.4 - icon;
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

  /** [3×3] [6×6] [9×9]   [⇄][the piece the host plays next game] — host only, after a game. */
  private layoutNext({ result, isHost, options, players, me }: Ctx, cx: number, y: number) {
    const { sizes, swap, piece } = this.next;
    const show = Boolean(result) && isHost;
    for (const obj of [...sizes, swap, piece]) obj.setVisible(show);
    if (!show) return;
    const font = this.status.style.fontSize
      ? Number.parseFloat(String(this.status.style.fontSize))
      : 32;
    const small = font * 0.75;
    const hostSeat = players.findIndex((p) => p.id === me?.id);
    const nextMark: Mark = (hostSeat === 0) !== options.swap ? 'X' : 'O';
    sizes.forEach((text, i) => {
      text.setFontSize(small).setColor(SIZES[i] === options.size ? PICKED : UNPICKED);
    });
    swap.setFontSize(small);
    piece.setTexture(this.texture(MARKS[nextMark].piece)).setDisplaySize(small * 1.3, small * 1.3);
    const gap = small * 0.8;
    const items = [...sizes, swap, piece];
    const widths = items.map((obj) => obj.displayWidth);
    let x = cx - (widths.reduce((a, b) => a + b, 0) + gap * items.length) / 2;
    items.forEach((obj, i) => {
      if (obj === swap) x += gap;
      obj.setPosition(x + (widths[i] ?? 0) / 2, y);
      x += (widths[i] ?? 0) + gap;
    });
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
