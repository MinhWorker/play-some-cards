import type { TicTacToeMove, TicTacToeState } from '@psc/shared';
import type Phaser from 'phaser';
import { titleStyle } from '../../phaser/assets';
import { BoardScene } from '../../phaser/BoardScene';

export class TicTacToeScene extends BoardScene<TicTacToeState, TicTacToeMove> {
  private tiles: Phaser.GameObjects.Image[] = [];
  private pieces: (Phaser.GameObjects.Image | null)[] = [];
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super('tic-tac-toe');
  }

  protected build() {
    this.status = this.add.text(0, 0, '', titleStyle(40)).setOrigin(0.5);
    this.tiles = Array.from({ length: 9 }, (_, cell) => {
      const tile = this.add.image(0, 0, 'tile').setInteractive({ useHandCursor: true });
      tile.on('pointerover', () => this.canPlay(cell) && tile.setTint(0xfff1b8));
      tile.on('pointerout', () => tile.clearTint());
      tile.on('pointerup', () => {
        tile.clearTint();
        if (this.canPlay(cell)) this.sendMove({ cell });
      });
      return tile;
    });
    this.pieces = Array(9).fill(null);
  }

  private canPlay(cell: number) {
    const { view, me, result } = this.props;
    return !result && view.turn === me && view.board[cell] === null;
  }

  protected draw() {
    const { view, me, result } = this.props;
    const { size, cx, cy, statusY } = this.boardArea();
    const cellSize = size / 3;

    const status = result
      ? 'Hết ván!'
      : view.turn === me
        ? 'Tới lượt bạn!'
        : `Lượt của ${this.nameOf(view.turn)}`;
    this.status
      .setText(status)
      .setFontSize(Math.min(44, Math.max(26, cellSize * 0.28)))
      .setPosition(cx, statusY);

    this.tiles.forEach((tile, cell) => {
      const x = cx + ((cell % 3) - 1) * cellSize;
      const y = cy + (Math.floor(cell / 3) - 1) * cellSize;
      tile.setPosition(x, y).setDisplaySize(cellSize * 0.96, cellSize * 0.96);

      const mark = view.board[cell];
      let piece = this.pieces[cell] ?? null;
      if (!mark && piece) {
        piece.destroy();
        piece = null;
      }
      if (mark && !piece) {
        // New piece: pop it in.
        piece = this.add.image(x, y, mark === 'X' ? 'piece-x' : 'piece-o').setScale(0);
        this.tweens.add({
          targets: piece,
          scale: (cellSize * 0.72) / piece.width,
          duration: 260,
          ease: 'Back.easeOut',
        });
      } else if (piece) {
        piece.setPosition(x, y).setScale((cellSize * 0.72) / piece.width);
      }
      this.pieces[cell] = piece;
    });
  }
}
