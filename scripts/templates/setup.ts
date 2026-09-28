/**
 * __Name__Setup: the room settings screen. It opens for "Tạo phòng", and for the host's
 * "Tuỳ chỉnh" in a room between games. Draw anything; `this.submit(options)` creates the room
 * (or changes it) with those options, which the game and its screens read as `ctx.options`.
 * Wire it up:
 *   src/client.ts   defineClient({ scene: …, setup: __Name__Setup })
 *   src/index.ts    definePlugin({ meta, game, room: { options: optionsSchema } })
 */
import { type Button, RoomSetupScene } from '@psc/sdk/client';
import type Phaser from 'phaser';
import { type Options, optionsSchema } from '../game/options.js';

export class __Name__Setup extends RoomSetupScene<Options> {
  private title!: Phaser.GameObjects.Text;
  private start!: Button;

  /**
   * Once: make the objects. `this.current` is the room's options when editing ("Tuỳ chỉnh"),
   * `null` for a new room.
   */
  protected build() {
    this.title = this.label(this.current ? 'Tuỳ chỉnh' : 'Tạo phòng', { size: 44 });
    this.start = this.button('Bắt đầu', () =>
      this.submit(optionsSchema.parse({ ...this.current })),
    );
  }

  /** Place them (runs again on resize). `this.safeTop()` leaves room for the app's top bar. */
  protected draw() {
    const { width, height } = this.view;
    const top = this.safeTop();
    const middle = top + (height - top) / 2;
    this.title.setPosition(width / 2, middle - 80);
    this.start.setPosition(width / 2, middle + 40);
  }
}
