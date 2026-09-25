import Phaser from 'phaser';
import { hudScale } from '@/lib/hudScale';
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
    this.registry.events.on('changedata-hudTop', onResize);
    this.events.once('shutdown', () => {
      bridge.off('board:props', onStage);
      this.scale.off('resize', onResize);
      this.registry.events.off('changedata-hudTop', onResize);
    });
  }

  protected sendMove(move: Move) {
    bridge.emit('board:move', move);
  }

  /**
   * Where the board may draw, leaving room for the React room bar (top, its real height comes
   * from the registry key 'hudTop') and the result panel (bottom), plus a score row and a
   * status line above the board. Phones held sideways show the result panel on the right
   * instead (pages/Room/Room.css), so the board keeps the full height.
   */
  protected boardArea() {
    const { width, height } = this.scale;
    const hud = hudScale();
    const sideways = width > height && height < 500;
    const top = ((this.registry.get('hudTop') as number | undefined) ?? 110 * hud) + 8 * hud;
    const bottom = sideways ? 12 : 140 * hud;
    const score = 50 * hud;
    const status = 56 * hud;
    const above = score + status;
    const size = Math.max(120, Math.min(width * 0.92, height - top - bottom - above));
    const cx = width / 2;
    const cy = top + above + (height - top - bottom - above) / 2;
    const statusY = cy - size / 2 - status / 2;
    return { size, cx, cy, hud, statusY, scoreY: statusY - status / 2 - score / 2 };
  }

  /** Sets `text`, cutting it short with "…" so it is at most `maxWidth` wide. */
  protected fitText(obj: Phaser.GameObjects.Text, text: string, maxWidth: number) {
    obj.setText(text);
    let chars = [...text];
    while (obj.width > maxWidth && chars.length > 1) {
      chars = chars.slice(0, -1);
      obj.setText(`${chars.join('').trimEnd()}…`);
    }
    return obj;
  }

  protected nameOf(id: string) {
    return this.props.players.find((p) => p.id === id)?.name ?? '?';
  }

  protected abstract build(): void;
  protected abstract draw(): void;
}
