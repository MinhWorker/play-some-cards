/**
 * @psc/sdk/client: what a game's screens (browser only) may use.
 * `games/<id>/src/client.ts` does `export default defineClient({ scene: MyView, setup? })`.
 */
import type { GameView } from './GameView.js';
import type { RoomSetupScene } from './RoomSetupScene.js';

export * from './GameScene.js';
export * from './GameView.js';
export * from './host.js';
export * from './props.js';
export * from './RoomSetupScene.js';
export * from './text.js';

/** What `games/<id>/src/client.ts` exports by default. */
export interface GameClient {
  // biome-ignore lint/suspicious/noExplicitAny: scenes of different games have different types
  scene: new () => GameView<any, any>;
  /**
   * Optional room settings screen the game designs itself ("Tạo phòng", "Tuỳ chỉnh"). Without
   * it the room is created right away with the default options.
   */
  // biome-ignore lint/suspicious/noExplicitAny: each game has its own options type
  setup?: new () => RoomSetupScene<any>;
}

export function defineClient(client: GameClient): GameClient {
  return client;
}
