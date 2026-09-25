import { type TicTacToeMove, type TicTacToeState, winningLine } from '@psc/shared';
import type Phaser from 'phaser';
import { playSfx } from '@/lib/sound';
import { titleStyle } from '@/phaser/assets';
import { BoardScene } from '@/phaser/BoardScene';

/** Seat 0 plays X (red), seat 1 plays O (blue). */
const SEATS = [
  { piece: 'piece-x', color: '#ff6b6b' },
  { piece: 'piece-o', color: '#5fb4ff' },
] as const;

export class TicTacToeScene extends BoardScene<TicTacToeState, TicTacToeMove> {
  private tiles: Phaser.GameObjects.Image[] = [];
  private pieces: (Phaser.GameObjects.Image | null)[] = [];
  private status!: Phaser.GameObjects.Text;
  private score!: {
    icons: Phaser.GameObjects.Image[];
    names: Phaser.GameObjects.Text[];
    numbers: Phaser.GameObjects.Text;
  };
  /** Winning line currently highlighted, as "a,b,c" (so the pulse starts only once). */
  private highlighted = '';
  /** No landing sound for pieces already on the board when the scene opens (e.g. rejoin). */
  private firstDraw = true;

  constructor() {
    super('tic-tac-toe');
  }

  protected build() {
    this.status = this.add.text(0, 0, '', titleStyle(40)).setOrigin(0.5);
    this.score = {
      icons: SEATS.map((s) => this.add.image(0, 0, s.piece)),
      names: SEATS.map(() => this.add.text(0, 0, '', titleStyle(26))),
      numbers: this.add.text(0, 0, '', titleStyle(40)).setOrigin(0.5),
    };
    this.score.names[0]?.setOrigin(1, 0.5);
    this.score.names[1]?.setOrigin(0, 0.5);
    this.tiles = Array.from({ length: 9 }, (_, cell) => {
      const tile = this.add.image(0, 0, 'tile').setInteractive({ useHandCursor: true });
      tile.on('pointerover', () => this.canPlay(cell) && tile.setTint(0xfff1b8));
      tile.on('pointerout', () => this.canPlay(cell) && tile.clearTint());
      tile.on('pointerup', () => {
        if (!this.canPlay(cell)) return;
        tile.clearTint();
        this.sendMove({ cell });
      });
      return tile;
    });
    this.pieces = Array(9).fill(null);
    this.highlighted = '';
    this.firstDraw = true;
  }

  private canPlay(cell: number) {
    const { view, me, result } = this.props;
    return !result && view.turn === me && view.board[cell] === null;
  }

  protected draw() {
    const { view, me, result } = this.props;
    const { size, cx, cy, hud, statusY, scoreY } = this.boardArea();
    const cellSize = size / 3;
    const line = winningLine(view.board);

    const status = result
      ? 'Hết ván!'
      : view.turn === me
        ? 'Tới lượt bạn!'
        : `Lượt của ${this.nameOf(view.turn)}`;
    const { width } = this.scale;
    this.status
      .setFontSize(Math.min(44, Math.max(26, cellSize * 0.28)) * hud)
      .setPosition(cx, statusY);
    this.fitText(this.status, status, width - 24);
    this.drawScore(cx, scoreY, size, hud);

    this.tiles.forEach((tile, cell) => {
      const x = cx + ((cell % 3) - 1) * cellSize;
      const y = cy + (Math.floor(cell / 3) - 1) * cellSize;
      tile.setPosition(x, y).setDisplaySize(cellSize * 0.96, cellSize * 0.96);
      // Gold tiles under the winning three.
      if (line?.includes(cell)) tile.setTint(0xffd34d);
      else if (!this.canPlay(cell)) tile.clearTint();

      const mark = view.board[cell];
      let piece = this.pieces[cell] ?? null;
      if (!mark && piece) {
        piece.destroy();
        piece = null;
      }
      if (mark && !piece) {
        // New piece: pop it in with a water-drop sound.
        piece = this.add.image(x, y, mark === 'X' ? 'piece-x' : 'piece-o').setScale(0);
        this.tweens.add({
          targets: piece,
          scale: (cellSize * 0.72) / piece.width,
          duration: 260,
          ease: 'Back.easeOut',
        });
        if (!this.firstDraw) playSfx('mark-drop');
      } else if (piece) {
        piece.setPosition(x, y);
        // Pieces still popping in or bouncing (winning line) keep their tweened scale.
        if (!this.tweens.isTweening(piece)) piece.setScale((cellSize * 0.72) / piece.width);
      }
      this.pieces[cell] = piece;
    });

    this.highlight(line, cellSize);
    this.firstDraw = false;
  }

  /**
   * Red player, score, blue player: e.g. [X] Minh  2 – 1  Lan [O]. Long names are cut
   * short with "…" so the row fits the screen.
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
    SEATS.forEach((seat, i) => {
      const side = i === 0 ? -1 : 1;
      const name = this.score.names[i];
      const img = this.score.icons[i];
      if (!name || !img) return;
      const player = players[i];
      name
        .setFontSize(font)
        .setColor(seat.color)
        .setPosition(cx + side * half, y);
      this.fitText(name, player ? player.name : '…', nameWidth);
      img
        .setDisplaySize(icon, icon)
        .setPosition(cx + side * (half + name.width + font * 0.4 + icon / 2), y);
    });
  }

  /** The winning pieces bounce and glow gold while the result is shown. */
  private highlight(line: [number, number, number] | null, cellSize: number) {
    const key = line?.join(',') ?? '';
    if (key === this.highlighted) return;
    this.highlighted = key;
    if (!line) return;
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
