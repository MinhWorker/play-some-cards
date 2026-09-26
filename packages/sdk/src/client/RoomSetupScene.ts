import { GameScene } from './GameScene.js';
import { hudScale } from './text.js';

/** Events from a running setup scene to the app (on `game.events`). */
export const SETUP_SUBMIT = 'setup:submit';
export const SETUP_CANCEL = 'setup:cancel';
/** Registry key the app sets before starting the scene: the room's options, or `null`. */
export const SETUP_CURRENT = 'setup:current';

/**
 * A game's own room settings screen (optional: `defineClient({ scene, setup })`). It opens when
 * someone taps "Tạo phòng", and again when the host taps "Tuỳ chỉnh" inside the room between
 * games. Draw it however the game likes, then call `this.submit(options)`: that object becomes
 * the room's options. The server checks it with the plugin's `room.options` schema, then it
 * reaches `setup` and `bot` in the rules and `this.props.options` on the board.
 *
 * `this.current` is the room's options when editing (`null` for a new room), e.g. to mark what
 * is picked now. `build` creates objects once; `draw` places them (called again on resize). The
 * app shows a back button; `this.cancel()` goes back too.
 */
export abstract class RoomSetupScene<Options> extends GameScene {
  /** The room's current options when opened from inside a room, `null` for a new room. */
  protected current: Options | null = null;

  create() {
    this.current = (this.registry.get(SETUP_CURRENT) as Options | undefined) ?? null;
    this.build();
    this.draw();
    const onResize = () => this.draw();
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  protected abstract build(): void;
  protected abstract draw(): void;

  /**
   * Done: creates the room with these options, or changes the room's options (the app shows
   * the server's error if it refuses).
   */
  protected submit(options: Options) {
    this.game.events.emit(SETUP_SUBMIT, options);
  }

  /** Leave without changing anything. */
  protected cancel() {
    this.game.events.emit(SETUP_CANCEL);
  }

  /** Room for the app's top bar (back button, profile, sound), scaled like the HUD. */
  protected safeTop() {
    return 88 * hudScale();
  }
}
