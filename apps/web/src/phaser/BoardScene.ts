import Phaser from 'phaser';
import { type BoardProps, bridge } from './bridge';

/**
 * Base class for every game's board. Subclasses implement `build` (create objects once)
 * and `draw` (update them from `this.props`, called on every state change and resize).
 * Call `this.sendMove(move)`; the server decides whether it is legal.
 */
export abstract class BoardScene<View, Move> extends Phaser.Scene {
  protected props!: BoardProps<View>;

  create() {
    this.props = this.registry.get('board') as BoardProps<View>;
    this.build();
    this.draw();
    const onStage = (props: BoardProps<View>) => {
      this.props = props;
      this.draw();
    };
    const onResize = () => this.draw();
    bridge.on('board:props', onStage);
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => {
      bridge.off('board:props', onStage);
      this.scale.off('resize', onResize);
    });
  }

  protected sendMove(move: Move) {
    bridge.emit('board:move', move);
  }

  /**
   * Where the board may draw, leaving room for the React room bar (top) and the
   * result panel (bottom), plus a score row and a status line above the board.
   */
  protected boardArea() {
    const { width, height } = this.scale;
    // On phones the room bar wraps onto three rows (back button, title, players).
    const top = width < 700 ? 200 : 110;
    const bottom = 140;
    const score = 50;
    const status = 56;
    const above = score + status;
    const size = Math.max(120, Math.min(width * 0.92, height - top - bottom - above));
    const cx = width / 2;
    const cy = top + above + (height - top - bottom - above) / 2;
    const statusY = cy - size / 2 - status / 2;
    return { size, cx, cy, statusY, scoreY: statusY - status / 2 - score / 2 };
  }

  protected nameOf(id: string) {
    return this.props.players.find((p) => p.id === id)?.name ?? '?';
  }

  protected abstract build(): void;
  protected abstract draw(): void;
}
