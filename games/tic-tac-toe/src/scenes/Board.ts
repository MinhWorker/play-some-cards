/**
 * The board, while a game runs. `build()` creates the objects once; `draw()` updates them from
 * `this.props` (view, me, players, hostId, result, score, options) after every move and on
 * resize. A tap sends a move with `this.sendMove()`; the server checks it with the rules.
 * After a game the host picks the next board size or swaps colors (`this.changeOptions()`).
 */
import { BoardScene, titleStyle } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { winningLine } from '../game/board.js';
import { type Mark, type Move, type Options, SIZES, type State } from '../game/model.js';
import { MARKS, PICKED, TINT, UNPICKED } from './theme.js';

export class Board extends BoardScene<State, Move, Options> {
  private tiles: Phaser.GameObjects.Image[] = [];
  private pieces: (Phaser.GameObjects.Image | null)[] = [];
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
  /** Winning line currently highlighted, as "a,b,c" (so the pulse starts only once). */
  private highlighted = '';
  /** No landing sound for pieces already on the board when the scene opens (e.g. rejoin). */
  private firstDraw = true;
  /** A result was already shown (the draw sound plays once). */
  private hadResult = false;

  // ── Create ──────────────────────────────────────────────────────────────────────────────

  protected build() {
    this.status = this.add.text(0, 0, '', titleStyle(40)).setOrigin(0.5);
    this.score = {
      icons: [0, 1].map(() => this.image(0, 0, MARKS.X.piece)),
      names: [0, 1].map(() => this.add.text(0, 0, '', titleStyle(26))),
      numbers: this.add.text(0, 0, '', titleStyle(40)).setOrigin(0.5),
    };
    this.score.names[0]?.setOrigin(1, 0.5);
    this.score.names[1]?.setOrigin(0, 0.5);
    this.next = {
      sizes: SIZES.map((size) =>
        this.button(`${size}×${size}`, () => this.changeOptions({ ...this.options, size })),
      ),
      swap: this.button('⇄', () => this.swapColors()),
      piece: this.image(0, 0, MARKS.X.piece)
        .setInteractive({ useHandCursor: true })
        .on('pointerup', () => this.swapColors()),
    };
    this.tiles = [];
    this.pieces = [];
    this.highlighted = '';
    this.firstDraw = true;
    this.hadResult = false;
  }

  /** A tappable text (the host's controls). */
  private button(label: string, onTap: () => void) {
    return this.add
      .text(0, 0, label, titleStyle(26))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerup', () => {
        this.sfx('caro-select');
        onTap();
      });
  }

  private swapColors() {
    this.changeOptions({ ...this.options, swap: !this.options.swap });
  }

  /** One tile per cell; rebuilt when the board size changes (a new game on another size). */
  private makeGrid(cells: number) {
    for (const obj of [...this.tiles, ...this.pieces]) obj?.destroy();
    this.tiles = Array.from({ length: cells }, (_, cell) => {
      const tile = this.image(0, 0, 'tile').setInteractive({ useHandCursor: true });
      tile.on('pointerover', () => this.canPlay(cell) && tile.setTint(TINT.hover));
      tile.on('pointerout', () => this.canPlay(cell) && tile.clearTint());
      tile.on('pointerup', () => {
        if (!this.canPlay(cell)) return;
        tile.clearTint();
        this.sendMove({ cell });
      });
      return tile;
    });
    this.pieces = Array(cells).fill(null);
    this.highlighted = '';
  }

  private canPlay(cell: number) {
    const { view, me, result } = this.props;
    return !result && view.turn === me && view.board[cell] === null;
  }

  /** The mark `id` plays in the current game. */
  private markOf(id: string): Mark {
    return this.props.view.players[0] === id ? 'X' : 'O';
  }

  // ── Update ──────────────────────────────────────────────────────────────────────────────

  protected draw() {
    const { view, result } = this.props;
    const area = this.boardArea();
    const line = winningLine(view.board, view.win);
    if (this.tiles.length !== view.board.length) this.makeGrid(view.board.length);

    this.playSounds(line);
    this.drawStatus(area);
    this.drawScore(area.cx, area.scoreY, area.size, area.hud);
    this.drawGrid(area, line);
    this.highlight(line, area.size / view.size);
    this.hadResult = Boolean(result);
    this.firstDraw = false;
  }

  private playSounds(line: number[] | null) {
    const { view, result } = this.props;
    if (this.firstDraw && !result && view.board.every((cell) => cell === null)) {
      this.sfx('caro-start');
    } else if (!this.firstDraw && !this.hadResult && result && !line) {
      this.sfx('caro-draw');
    }
  }

  /** Whose turn it is; after a game, the host's controls for the next one take its place. */
  private drawStatus({ size, cx, hud, statusY }: ReturnType<Board['boardArea']>) {
    const { view, me, result, players } = this.props;
    const { options } = this;
    const { width } = this.scale;
    const hostControls = Boolean(result) && this.isHost;
    const font = Math.min(44, Math.max(26, size * 0.093)) * hud;

    const rule = view.size > 3 ? ` · nối ${view.win}` : '';
    const status = result
      ? 'Hết ván!'
      : view.turn === me
        ? `Tới lượt bạn!${rule}`
        : `Lượt của ${this.nameOf(view.turn)}${rule}`;
    this.status.setVisible(!hostControls).setFontSize(font).setPosition(cx, statusY);
    this.fitText(this.status, status, width - 24, 18);

    const { sizes, swap, piece } = this.next;
    for (const obj of [...sizes, swap, piece]) obj.setVisible(hostControls);
    if (!hostControls) return;
    // [3×3] [6×6] [9×9]   [⇄][piece the host plays next game]
    const small = font * 0.75;
    const hostSeat = players.findIndex((p) => p.id === me);
    const nextMark: Mark = (hostSeat === 0) !== options.swap ? 'X' : 'O';
    sizes.forEach((text, i) => {
      text.setFontSize(small).setColor(SIZES[i] === options.size ? PICKED : UNPICKED);
    });
    swap.setFontSize(small);
    piece.setTexture(this.texture(MARKS[nextMark].piece)).setDisplaySize(small * 1.3, small * 1.3);
    const gap = small * 0.8;
    const items = [...sizes, swap, piece];
    const widths = items.map((obj) => obj.displayWidth);
    const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1) + gap;
    let x = cx - total / 2;
    items.forEach((obj, i) => {
      if (obj === swap) x += gap; // a little more room between sizes and colors
      obj.setPosition(x + (widths[i] ?? 0) / 2, statusY);
      x += (widths[i] ?? 0) + gap;
    });
  }

  /**
   * Seat 0 left, score, seat 1 right: e.g. [X] Minh  2 – 1  Lan [O]. Each name has the color
   * and piece it plays this game. Long names are cut short with "…".
   */
  private drawScore(cx: number, y: number, size: number, hud: number) {
    const { players, score } = this.props;
    const { width } = this.scale;
    const font = Math.min(26, Math.max(18, size * 0.06)) * hud;
    const icon = font * 1.5;
    this.score.numbers
      .setText(`${score.wins[0] ?? 0}  –  ${score.wins[1] ?? 0}`)
      .setFontSize(font * 1.5)
      .setPosition(cx, y);
    const half = this.score.numbers.width / 2 + font * 0.6;
    const nameWidth = width / 2 - 12 - half - font * 0.4 - icon;
    [0, 1].forEach((seat) => {
      const side = seat === 0 ? -1 : 1;
      const name = this.score.names[seat];
      const img = this.score.icons[seat];
      const player = players[seat];
      if (!name || !img) return;
      const look = MARKS[player ? this.markOf(player.id) : seat === 0 ? 'X' : 'O'];
      name
        .setFontSize(font)
        .setColor(look.color)
        .setPosition(cx + side * half, y);
      this.fitText(name, player ? player.name : '…', nameWidth);
      img
        .setTexture(this.texture(look.piece))
        .setDisplaySize(icon, icon)
        .setPosition(cx + side * (half + name.width + font * 0.4 + icon / 2), y);
    });
  }

  private drawGrid({ size, cx, cy }: ReturnType<Board['boardArea']>, line: number[] | null) {
    const { view } = this.props;
    const cellSize = size / view.size;
    const middle = (view.size - 1) / 2;
    this.tiles.forEach((tile, cell) => {
      const x = cx + ((cell % view.size) - middle) * cellSize;
      const y = cy + (Math.floor(cell / view.size) - middle) * cellSize;
      tile.setPosition(x, y).setDisplaySize(cellSize * 0.96, cellSize * 0.96);
      // Gold tiles under the winning line.
      if (line?.includes(cell)) tile.setTint(TINT.win);
      else if (!this.canPlay(cell)) tile.clearTint();

      const mark = view.board[cell];
      let piece = this.pieces[cell] ?? null;
      if (!mark && piece) {
        piece.destroy();
        piece = null;
      }
      if (mark && !piece) {
        // New piece: pop it in with a water-drop sound.
        piece = this.image(x, y, MARKS[mark].piece).setScale(0);
        this.tweens.add({
          targets: piece,
          scale: (cellSize * 0.72) / piece.width,
          duration: 260,
          ease: 'Back.easeOut',
        });
        if (!this.firstDraw) this.sfx(MARKS[mark].sound);
      } else if (piece) {
        piece.setPosition(x, y);
        // Pieces still popping in or bouncing (winning line) keep their tweened scale.
        if (!this.tweens.isTweening(piece)) piece.setScale((cellSize * 0.72) / piece.width);
      }
      this.pieces[cell] = piece;
    });
  }

  /** The winning pieces bounce and glow gold while the result is shown. */
  private highlight(line: number[] | null, cellSize: number) {
    const key = line?.join(',') ?? '';
    if (key === this.highlighted) return;
    this.highlighted = key;
    if (!line) return;
    if (!this.firstDraw) this.sfx('caro-line-complete');
    line.forEach((cell, i) => {
      const piece = this.pieces[cell];
      if (!piece) return;
      piece.enableFilters().filters?.internal.addGlow(0xffe066, 6, 0, 1.2, false, 12, 12);
      const scale = (cellSize * 0.72) / piece.width;
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
}
